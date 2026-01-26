import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ============================================
// RESEND WEBHOOK HANDLER
// Receives email events for analytics tracking
// ============================================

// Webhook event types from Resend
type ResendEventType =
    | 'email.sent'
    | 'email.delivered'
    | 'email.delivery_delayed'
    | 'email.complained'
    | 'email.bounced'
    | 'email.opened'
    | 'email.clicked'

interface ResendWebhookPayload {
    type: ResendEventType
    created_at: string
    data: {
        email_id: string  // Resend's message ID
        from: string
        to: string[]
        subject: string
        // For click events
        click?: {
            link: string
            timestamp: string
        }
        // For bounce events
        bounce?: {
            type: 'hard' | 'soft'
            message: string
        }
    }
}

// Verify webhook signature from Resend using HMAC-SHA256
// Resend uses Svix format: v1,<signature> where signature is base64-encoded HMAC
function verifyWebhookSignature(
    payload: string,
    signatureHeader: string,
    timestampHeader: string,
    secret: string
): boolean {
    if (!secret) {
        console.warn('[WEBHOOK] No RESEND_WEBHOOK_SECRET configured - SECURITY RISK in production!')
        // In development, allow without signature. In production, reject.
        if (process.env.NODE_ENV === 'production') {
            console.error('[WEBHOOK] Rejecting webhook - no secret configured in production')
            return false
        }
        return true
    }

    try {
        // Svix signature format: v1,<base64_signature>
        const signatures = signatureHeader.split(' ')
        const signedPayload = `${timestampHeader}.${payload}`
        
        // The secret from Resend starts with 'whsec_', we need to decode it
        const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')
        const expectedSignature = crypto
            .createHmac('sha256', secretBytes)
            .update(signedPayload)
            .digest('base64')

        // Check if any of the provided signatures match
        for (const sig of signatures) {
            const [version, signature] = sig.split(',')
            if (version === 'v1' && signature === expectedSignature) {
                return true
            }
        }
        
        console.error('[WEBHOOK] Signature mismatch')
        return false
    } catch (err) {
        console.error('[WEBHOOK] Signature verification error:', err)
        return false
    }
}

export async function POST(request: NextRequest) {
    console.log('[RESEND-WEBHOOK] Received webhook event')

    try {
        const rawBody = await request.text()
        const signature = request.headers.get('svix-signature') || ''
        const timestamp = request.headers.get('svix-timestamp') || ''
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || ''

        // Verify signature in production
        if (!verifyWebhookSignature(rawBody, signature, timestamp, webhookSecret)) {
            console.error('[RESEND-WEBHOOK] Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const payload: ResendWebhookPayload = JSON.parse(rawBody)
        console.log('[RESEND-WEBHOOK] Event type:', payload.type, 'Email ID:', payload.data.email_id)

        const supabase = createClient()

        // Find our email by Resend's message ID
        const { data: email, error: emailError } = await supabase
            .from('emails')
            .select(`
        id,
        contact_campaign_id,
        contact_campaign:contact_campaigns (
          id,
          contact_id,
          campaign_id
        )
      `)
            .eq('resend_message_id', payload.data.email_id)
            .single()

        if (emailError || !email) {
            console.warn('[RESEND-WEBHOOK] Email not found for Resend ID:', payload.data.email_id)
            // Still return 200 to prevent Resend from retrying
            return NextResponse.json({ received: true, matched: false })
        }

        // Supabase joins return arrays, get first item
        const contactCampaign = Array.isArray(email.contact_campaign)
            ? email.contact_campaign[0]
            : email.contact_campaign
        const contactId = contactCampaign?.contact_id
        const campaignId = contactCampaign?.campaign_id
        const emailId = email.id
        const now = new Date().toISOString()
        const today = new Date().toISOString().split('T')[0]

        // Handle different event types
        switch (payload.type) {
            case 'email.delivered':
                await supabase
                    .from('emails')
                    .update({ delivered_at: now })
                    .eq('id', emailId)

                await incrementDailyStat(supabase, today, campaignId, 'emails_delivered')
                await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'delivered')
                break

            case 'email.opened':
                // Update email if first open
                const { data: existingEmail } = await supabase
                    .from('emails')
                    .select('opened_at')
                    .eq('id', emailId)
                    .single()

                if (!existingEmail?.opened_at) {
                    await supabase
                        .from('emails')
                        .update({ opened_at: now })
                        .eq('id', emailId)

                    // Update contact_campaign stage and pipeline_stage to 'opened'
                    await supabase
                        .from('contact_campaigns')
                        .update({ stage: 'opened', pipeline_stage: 'opened' })
                        .eq('id', email.contact_campaign_id)

                    await incrementDailyStat(supabase, today, campaignId, 'unique_opens')
                }

                await incrementDailyStat(supabase, today, campaignId, 'emails_opened')
                await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'opened')
                await updateContactEngagement(supabase, contactId, 'open', now)
                break

            case 'email.clicked':
                // Update email if first click
                const { data: clickedEmail } = await supabase
                    .from('emails')
                    .select('clicked_at, opened_at')
                    .eq('id', emailId)
                    .single()

                // Click implies open - set opened_at if not already set
                if (!clickedEmail?.opened_at) {
                    await supabase
                        .from('emails')
                        .update({ opened_at: now })
                        .eq('id', emailId)

                    await incrementDailyStat(supabase, today, campaignId, 'emails_opened')
                    await incrementDailyStat(supabase, today, campaignId, 'unique_opens')
                    await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'opened')
                    await updateContactEngagement(supabase, contactId, 'open', now)
                }

                if (!clickedEmail?.clicked_at) {
                    await supabase
                        .from('emails')
                        .update({ clicked_at: now })
                        .eq('id', emailId)

                    await incrementDailyStat(supabase, today, campaignId, 'unique_clicks')
                }

                await incrementDailyStat(supabase, today, campaignId, 'emails_clicked')
                await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'clicked', {
                    url: payload.data.click?.link
                })

                // Track link click
                if (payload.data.click?.link) {
                    await trackLinkClick(supabase, emailId, payload.data.click.link)
                }

                await updateContactEngagement(supabase, contactId, 'click', now)
                break

            case 'email.bounced':
                await supabase
                    .from('emails')
                    .update({
                        bounced_at: now,
                        bounce_reason: payload.data.bounce?.message || 'Unknown'
                    })
                    .eq('id', emailId)

                await incrementDailyStat(supabase, today, campaignId, 'emails_bounced')
                await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'bounced', {
                    type: payload.data.bounce?.type,
                    message: payload.data.bounce?.message
                })
                await updateContactEngagement(supabase, contactId, 'bounce', now)
                break

            case 'email.complained':
                await logEngagementEvent(supabase, email.contact_campaign_id, emailId, 'complained')
                console.warn('[RESEND-WEBHOOK] Spam complaint received for email:', emailId)
                break
        }

        console.log('[RESEND-WEBHOOK] Successfully processed:', payload.type)
        return NextResponse.json({ received: true, processed: true })

    } catch (error: any) {
        console.error('[RESEND-WEBHOOK] Error processing webhook:', error)
        return NextResponse.json(
            { error: error.message || 'Webhook processing failed' },
            { status: 500 }
        )
    }
}

// Helper: Increment daily analytics stat
async function incrementDailyStat(
    supabase: any,
    date: string,
    campaignId: string | null,
    field: string
) {
    // Upsert the daily record
    const { error } = await supabase.rpc('increment_daily_stat', {
        p_date: date,
        p_campaign_id: campaignId,
        p_field: field
    })

    if (error) {
        // Fallback: manual upsert
        console.warn('[RESEND-WEBHOOK] RPC failed, using manual upsert:', error)

        const { data: existing } = await supabase
            .from('analytics_daily')
            .select('id, ' + field)
            .eq('date', date)
            .eq('campaign_id', campaignId)
            .single()

        if (existing) {
            await supabase
                .from('analytics_daily')
                .update({ [field]: (existing[field] || 0) + 1, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
        } else {
            await supabase
                .from('analytics_daily')
                .insert({ date, campaign_id: campaignId, [field]: 1 })
        }
    }
}

// Helper: Log engagement event
async function logEngagementEvent(
    supabase: any,
    contactCampaignId: string,
    emailId: string,
    eventType: string,
    metadata?: Record<string, any>
) {
    // Get unified_thread_id from contact_campaign
    const { data: cc } = await supabase
        .from('contact_campaigns')
        .select('unified_thread_id')
        .eq('id', contactCampaignId)
        .single()

    if (cc?.unified_thread_id) {
        await supabase
            .from('engagement_events')
            .insert({
                unified_thread_id: cc.unified_thread_id,
                email_id: emailId,
                event_type: eventType,
                metadata
            })
    }
}

// Helper: Update contact engagement scores
async function updateContactEngagement(
    supabase: any,
    contactId: string | null,
    action: 'open' | 'click' | 'reply' | 'bounce',
    timestamp: string
) {
    if (!contactId) return

    try {
        // First, check if engagement record exists
        const { data: existing } = await supabase
            .from('contact_engagement')
            .select('id, total_opens, total_clicks, total_replies, total_bounces')
            .eq('contact_id', contactId)
            .single()

        if (existing) {
            // Update existing record with incremented values
            const updates: Record<string, any> = { updated_at: timestamp }

            switch (action) {
                case 'open':
                    updates.total_opens = (existing.total_opens || 0) + 1
                    updates.last_open_at = timestamp
                    break
                case 'click':
                    updates.total_clicks = (existing.total_clicks || 0) + 1
                    updates.last_click_at = timestamp
                    break
                case 'reply':
                    updates.total_replies = (existing.total_replies || 0) + 1
                    updates.last_reply_at = timestamp
                    break
                case 'bounce':
                    updates.total_bounces = (existing.total_bounces || 0) + 1
                    break
            }

            await supabase
                .from('contact_engagement')
                .update(updates)
                .eq('id', existing.id)
        } else {
            // Insert new record
            const newRecord: Record<string, any> = {
                contact_id: contactId,
                updated_at: timestamp,
                total_opens: action === 'open' ? 1 : 0,
                total_clicks: action === 'click' ? 1 : 0,
                total_replies: action === 'reply' ? 1 : 0,
                total_bounces: action === 'bounce' ? 1 : 0,
            }

            if (action === 'open') newRecord.last_open_at = timestamp
            if (action === 'click') newRecord.last_click_at = timestamp
            if (action === 'reply') newRecord.last_reply_at = timestamp

            await supabase
                .from('contact_engagement')
                .insert(newRecord)
        }

        // Recalculate score using RPC
        const { error: rpcError } = await supabase.rpc('update_engagement_score', { p_contact_id: contactId })
        if (rpcError) {
            console.warn('[WEBHOOK] Failed to update engagement score:', rpcError)
        }
    } catch (err) {
        console.error('[WEBHOOK] Error updating contact engagement:', err)
    }
}

// Helper: Track individual link clicks
async function trackLinkClick(
    supabase: any,
    emailId: string,
    url: string
) {
    const { data: existing } = await supabase
        .from('email_link_clicks')
        .select('id, click_count')
        .eq('email_id', emailId)
        .eq('original_url', url)
        .single()

    if (existing) {
        await supabase
            .from('email_link_clicks')
            .update({
                click_count: existing.click_count + 1,
                last_clicked_at: new Date().toISOString()
            })
            .eq('id', existing.id)
    } else {
        await supabase
            .from('email_link_clicks')
            .insert({
                email_id: emailId,
                original_url: url
            })
    }
}
