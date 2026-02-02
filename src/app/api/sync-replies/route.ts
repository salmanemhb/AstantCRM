import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { createLogger } from '@/lib/logger'

// ============================================
// REPLY DETECTION API
// Checks sent emails for replies via email headers
// If someone replied, they definitely opened the email
// ============================================

const logger = createLogger('sync-replies')
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  logger.info('Starting reply sync...')

  try {
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))
    const { campaign_id } = body

    // Get all sent emails that haven't been marked as replied
    let query = supabase
      .from('emails')
      .select(`
        id,
        subject,
        sent_at,
        opened_at,
        replied_at,
        resend_message_id,
        contact_campaign_id,
        contact_campaign:contact_campaigns (
          id,
          contact_id,
          campaign_id,
          contact:contacts (
            id,
            email,
            first_name,
            last_name,
            firm
          )
        )
      `)
      .not('sent_at', 'is', null)
      .is('replied_at', null)
      .order('sent_at', { ascending: false })
      .limit(100)

    if (campaign_id) {
      query = query.eq('contact_campaign.campaign_id', campaign_id)
    }

    const { data: sentEmails, error: emailsError } = await query

    if (emailsError) {
      logger.error('Error fetching emails:', emailsError)
      return NextResponse.json({ error: emailsError.message }, { status: 500 })
    }

    if (!sentEmails || sentEmails.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No emails to check',
        checked: 0,
        replies_found: 0
      })
    }

    logger.info(`Checking ${sentEmails.length} emails for replies...`)

    // For each sent email, we'll check if we received a reply
    // We can detect replies by checking:
    // 1. Inbound emails to our mailbox with matching subject (Re: ...)
    // 2. Using Resend's email events (if they support inbound)
    // 3. Manual marking via UI

    // Since we don't have Gmail API integration yet, we'll:
    // 1. Check if Resend has any inbound functionality
    // 2. Provide a manual sync mechanism
    // 3. Check email_link_clicks as a proxy (click = definite open)

    let repliesFound = 0
    let opensInferred = 0
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    for (const email of sentEmails) {
      const contactCampaign = Array.isArray(email.contact_campaign)
        ? email.contact_campaign[0]
        : email.contact_campaign

      if (!contactCampaign) continue

      // Check 1: If email was clicked, mark as opened (click implies open)
      const { data: clicks } = await supabase
        .from('email_link_clicks')
        .select('id')
        .eq('email_id', email.id)
        .limit(1)

      if (clicks && clicks.length > 0 && !email.opened_at) {
        // Click found - mark as opened
        await supabase
          .from('emails')
          .update({ opened_at: now })
          .eq('id', email.id)

        // Update engagement
        await supabase
          .from('contact_engagement')
          .upsert({
            contact_id: contactCampaign.contact_id,
            total_opens: 1,
            last_open_at: now,
            updated_at: now
          }, { onConflict: 'contact_id' })

        // Log event
        if (contactCampaign.id) {
          const { data: thread } = await supabase
            .from('contact_campaigns')
            .select('unified_thread_id')
            .eq('id', contactCampaign.id)
            .single()

          if (thread?.unified_thread_id) {
            await supabase
              .from('engagement_events')
              .insert({
                unified_thread_id: thread.unified_thread_id,
                email_id: email.id,
                event_type: 'opened',
                metadata: { inferred_from: 'click' }
              })
          }
        }

        opensInferred++
        logger.debug(`Inferred open from click for email ${email.id}`)
      }

      // Check 2: Look for engagement events that indicate a reply
      // (This would be populated by Gmail API webhook or manual entry)
      const { data: replyEvents } = await supabase
        .from('engagement_events')
        .select('id')
        .eq('email_id', email.id)
        .eq('event_type', 'replied')
        .limit(1)

      if (replyEvents && replyEvents.length > 0) {
        // Reply event exists - mark email as replied
        await supabase
          .from('emails')
          .update({ 
            replied_at: now,
            opened_at: email.opened_at || now // Reply implies open
          })
          .eq('id', email.id)

        // Update contact stage to 'replied'
        await supabase
          .from('contact_campaigns')
          .update({ 
            stage: 'replied',
            pipeline_stage: 'replied'
          })
          .eq('id', contactCampaign.id)

        // Update engagement
        await updateEngagementForReply(supabase, contactCampaign.contact_id, now)

        repliesFound++
        logger.info(`Marked email ${email.id} as replied`)
      }
    }

    // Update daily analytics if we found anything
    if (opensInferred > 0 || repliesFound > 0) {
      // Try to increment daily stats
      try {
        if (opensInferred > 0) {
          await supabase.rpc('increment_daily_stat', {
            p_date: today,
            p_campaign_id: campaign_id || null,
            p_field: 'emails_opened'
          })
        }
        if (repliesFound > 0) {
          await supabase.rpc('increment_daily_stat', {
            p_date: today,
            p_campaign_id: campaign_id || null,
            p_field: 'emails_replied'
          })
        }
      } catch (rpcError) {
        logger.warn('RPC error (non-fatal):', rpcError)
      }
    }

    return NextResponse.json({
      success: true,
      checked: sentEmails.length,
      opens_inferred: opensInferred,
      replies_found: repliesFound,
      message: `Checked ${sentEmails.length} emails. Inferred ${opensInferred} opens from clicks. Found ${repliesFound} replies.`
    })

  } catch (error) {
    logger.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

// Manual reply marking endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { email_id, contact_id, replied } = await request.json()

    if (!email_id) {
      return NextResponse.json({ error: 'email_id required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (replied) {
      // Mark as replied
      await supabase
        .from('emails')
        .update({ 
          replied_at: now,
          opened_at: now // Reply implies open
        })
        .eq('id', email_id)

      // Get contact_campaign info
      const { data: emailData } = await supabase
        .from('emails')
        .select('contact_campaign_id')
        .eq('id', email_id)
        .single()

      if (emailData?.contact_campaign_id) {
        // Update stage
        await supabase
          .from('contact_campaigns')
          .update({ 
            stage: 'replied',
            pipeline_stage: 'replied'
          })
          .eq('id', emailData.contact_campaign_id)

        // Get contact_id if not provided
        if (!contact_id) {
          const { data: cc } = await supabase
            .from('contact_campaigns')
            .select('contact_id, unified_thread_id')
            .eq('id', emailData.contact_campaign_id)
            .single()

          if (cc) {
            await updateEngagementForReply(supabase, cc.contact_id, now)
            
            // Log event
            if (cc.unified_thread_id) {
              await supabase
                .from('engagement_events')
                .insert({
                  unified_thread_id: cc.unified_thread_id,
                  email_id: email_id,
                  event_type: 'replied',
                  metadata: { manual: true }
                })
            }
          }
        } else {
          await updateEngagementForReply(supabase, contact_id, now)
        }
      }

      return NextResponse.json({ success: true, message: 'Marked as replied' })
    } else {
      // Unmark reply
      await supabase
        .from('emails')
        .update({ replied_at: null })
        .eq('id', email_id)

      return NextResponse.json({ success: true, message: 'Unmarked reply' })
    }

  } catch (error) {
    logger.error('PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}

// Helper to update engagement scores for a reply
async function updateEngagementForReply(supabase: any, contactId: string, timestamp: string) {
  // First get existing engagement
  const { data: existing } = await supabase
    .from('contact_engagement')
    .select('*')
    .eq('contact_id', contactId)
    .single()

  if (existing) {
    await supabase
      .from('contact_engagement')
      .update({
        total_replies: (existing.total_replies || 0) + 1,
        last_reply_at: timestamp,
        // Reply is high-value, boost score
        engagement_score: Math.min(100, (existing.engagement_score || 0) + 30),
        updated_at: timestamp
      })
      .eq('contact_id', contactId)
  } else {
    await supabase
      .from('contact_engagement')
      .insert({
        contact_id: contactId,
        total_replies: 1,
        last_reply_at: timestamp,
        engagement_score: 50, // Reply starts at 50
        updated_at: timestamp
      })
  }

  // Recalculate full score
  try {
    await supabase.rpc('update_engagement_score', { p_contact_id: contactId })
  } catch (err) {
    logger.warn('Score recalc error:', err)
  }
}

// GET: Return stats about reply detection
export async function GET() {
  try {
    const supabase = createClient()

    // Get counts
    const { count: totalSent } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .not('sent_at', 'is', null)

    const { count: totalOpened } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .not('opened_at', 'is', null)

    const { count: totalClicked } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .not('clicked_at', 'is', null)

    const { count: totalReplied } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .not('replied_at', 'is', null)

    return NextResponse.json({
      total_sent: totalSent || 0,
      total_opened: totalOpened || 0,
      total_clicked: totalClicked || 0,
      total_replied: totalReplied || 0,
      open_rate: totalSent ? ((totalOpened || 0) / totalSent * 100).toFixed(1) : '0',
      click_rate: totalSent ? ((totalClicked || 0) / totalSent * 100).toFixed(1) : '0',
      reply_rate: totalSent ? ((totalReplied || 0) / totalSent * 100).toFixed(1) : '0'
    })

  } catch (error) {
    logger.error('GET error:', error)
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 })
  }
}
