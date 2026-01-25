// ============================================
// BULK OPERATIONS API
// Mass approve, send, edit operations
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      operation,      // 'approve_all' | 'approve_green' | 'send_approved' | 'send_dry_run' | 'regenerate_red' | 'update_signature'
      campaign_id,
      email_ids,      // Optional - specific email IDs to operate on
      filter,         // Optional - 'green' | 'yellow' | 'red' | 'needs_review'
      sender_id,      // For update_signature operation
      dry_run,        // For send operations - validates without actually sending
    } = body

    if (!operation || !campaign_id) {
      return NextResponse.json({ error: 'Missing operation or campaign_id' }, { status: 400 })
    }

    const supabase = createClient()

    // Get emails for this campaign
    let query = supabase
      .from('emails')
      .select(`
        id,
        subject,
        current_body,
        confidence_score,
        approved,
        sent_at,
        contact_campaign_id,
        contact_campaigns!inner(
          id,
          campaign_id,
          contact_id,
          contacts(id, first_name, last_name, email, firm)
        )
      `)
      .eq('contact_campaigns.campaign_id', campaign_id)

    // Apply filters
    if (email_ids && email_ids.length > 0) {
      query = query.in('id', email_ids)
    }

    if (filter) {
      if (filter === 'green' || filter === 'yellow' || filter === 'red') {
        query = query.eq('confidence_score', filter)
      }
    }

    const { data: emails, error: emailsError } = await query

    if (emailsError) {
      return NextResponse.json({ error: emailsError.message }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ error: 'No emails found matching criteria' }, { status: 404 })
    }

    let result: {
      operation: string
      total: number
      success: number
      failed: number
      errors: string[]
      dry_run?: boolean
      message?: string
    } = {
      operation,
      total: emails.length,
      success: 0,
      failed: 0,
      errors: [],
    }

    switch (operation) {
      // ============================================
      // APPROVE ALL
      // ============================================
      case 'approve_all': {
        const { error } = await supabase
          .from('emails')
          .update({ approved: true })
          .in('id', emails.map(e => e.id))

        if (error) {
          result.failed = emails.length
          result.errors.push(error.message)
        } else {
          result.success = emails.length
        }
        break
      }

      // ============================================
      // APPROVE GREEN ONLY
      // ============================================
      case 'approve_green': {
        const greenEmails = emails.filter(e => e.confidence_score === 'green')
        
        if (greenEmails.length === 0) {
          return NextResponse.json({ message: 'No green emails to approve', result: { ...result, total: 0 } })
        }

        const { error } = await supabase
          .from('emails')
          .update({ approved: true })
          .in('id', greenEmails.map(e => e.id))

        if (error) {
          result.failed = greenEmails.length
          result.errors.push(error.message)
        } else {
          result.success = greenEmails.length
          result.total = greenEmails.length
        }
        break
      }

      // ============================================
      // SEND ALL APPROVED (supports dry_run)
      // ============================================
      case 'send_dry_run':
      case 'send_approved': {
        const isDryRun = operation === 'send_dry_run' || dry_run === true
        const approvedEmails = emails.filter(e => e.approved && !e.sent_at)
        
        if (approvedEmails.length === 0) {
          return NextResponse.json({ message: 'No approved emails to send', result: { ...result, total: 0 } })
        }

        // Send each email
        for (const email of approvedEmails) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email_id: email.id, dry_run: isDryRun }),
            })

            if (response.ok) {
              result.success++
            } else {
              result.failed++
              const errorData = await response.json()
              result.errors.push(`${email.id}: ${errorData.error}`)
            }
          } catch (err: any) {
            result.failed++
            result.errors.push(`${email.id}: ${err.message}`)
          }

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        result.total = approvedEmails.length
        if (isDryRun) {
          result.dry_run = true
          result.message = `DRY RUN: ${result.success} emails validated successfully (not actually sent)`
        }
        break
      }

      // ============================================
      // REGENERATE RED EMAILS
      // ============================================
      case 'regenerate_red': {
        const redEmails = emails.filter(e => e.confidence_score === 'red')
        
        if (redEmails.length === 0) {
          return NextResponse.json({ message: 'No red emails to regenerate', result: { ...result, total: 0 } })
        }

        // Regenerate each email
        for (const email of redEmails) {
          try {
            const contactCampaign = email.contact_campaigns as any
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-claude`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contact_id: contactCampaign.contact_id,
                campaign_id: campaign_id,
              }),
            })

            if (response.ok) {
              result.success++
            } else {
              result.failed++
              const errorData = await response.json()
              result.errors.push(`${email.id}: ${errorData.error}`)
            }
          } catch (err: any) {
            result.failed++
            result.errors.push(`${email.id}: ${err.message}`)
          }

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        result.total = redEmails.length
        break
      }

      // ============================================
      // UPDATE SIGNATURE FOR ALL
      // ============================================
      case 'update_signature': {
        if (!sender_id) {
          return NextResponse.json({ error: 'Missing sender_id for signature update' }, { status: 400 })
        }

        // Update all emails with new signature
        for (const email of emails) {
          const currentBody = email.current_body as any
          const updatedBody = {
            ...currentBody,
            signatureMemberId: sender_id,
          }

          const { error } = await supabase
            .from('emails')
            .update({ current_body: updatedBody })
            .eq('id', email.id)

          if (error) {
            result.failed++
            result.errors.push(`${email.id}: ${error.message}`)
          } else {
            result.success++
          }
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk operation failed' },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Campaign email stats
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaign_id = searchParams.get('campaign_id')

  if (!campaign_id) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 })
  }

  const supabase = createClient()

  // Get all emails for campaign with stats
  const { data: emails, error } = await supabase
    .from('emails')
    .select(`
      id,
      subject,
      confidence_score,
      approved,
      sent_at,
      contact_campaigns!inner(
        campaign_id,
        contacts(first_name, last_name, firm)
      )
    `)
    .eq('contact_campaigns.campaign_id', campaign_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const stats = {
    total: emails?.length || 0,
    by_confidence: {
      green: emails?.filter(e => e.confidence_score === 'green').length || 0,
      yellow: emails?.filter(e => e.confidence_score === 'yellow').length || 0,
      red: emails?.filter(e => e.confidence_score === 'red').length || 0,
    },
    by_status: {
      draft: emails?.filter(e => !e.approved && !e.sent_at).length || 0,
      approved: emails?.filter(e => e.approved && !e.sent_at).length || 0,
      sent: emails?.filter(e => e.sent_at).length || 0,
    },
    ready_to_send: emails?.filter(e => e.approved && !e.sent_at).length || 0,
    needs_review: emails?.filter(e => e.confidence_score === 'red' || e.confidence_score === 'yellow').length || 0,
  }

  return NextResponse.json({
    campaign_id,
    stats,
    emails: emails?.map(e => ({
      id: e.id,
      subject: e.subject,
      confidence: e.confidence_score,
      approved: e.approved,
      sent: !!e.sent_at,
      contact: (e.contact_campaigns as any)?.contacts,
    })),
  })
}
