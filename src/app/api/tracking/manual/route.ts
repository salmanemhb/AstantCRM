import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================
// MANUAL TRACKING UPDATE API
// Allows manual marking of emails as opened/clicked/replied
// Since Gmail blocks tracking pixels, manual tracking is needed
// ============================================

type TrackingAction = 'opened' | 'clicked' | 'replied' | 'unmark_opened' | 'unmark_clicked' | 'unmark_replied'

export async function POST(request: NextRequest) {
    try {
        const { email_id, contact_campaign_id, action } = await request.json()

        if (!contact_campaign_id || !action) {
            return NextResponse.json(
                { error: 'contact_campaign_id and action are required' },
                { status: 400 }
            )
        }

        const validActions: TrackingAction[] = ['opened', 'clicked', 'replied', 'unmark_opened', 'unmark_clicked', 'unmark_replied']
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
                { status: 400 }
            )
        }

        const supabase = createClient()
        const now = new Date().toISOString()

        // Get the email ID if not provided
        let targetEmailId = email_id
        if (!targetEmailId) {
            const { data: emails } = await supabase
                .from('emails')
                .select('id')
                .eq('contact_campaign_id', contact_campaign_id)
                .not('sent_at', 'is', null)
                .order('sent_at', { ascending: false })
                .limit(1)
            
            if (emails && emails.length > 0) {
                targetEmailId = emails[0].id
            }
        }

        // Determine the updates based on action
        let emailUpdate: Record<string, any> = {}
        let ccUpdate: Record<string, any> = {}
        let stageToSet: string | null = null

        switch (action) {
            case 'opened':
                emailUpdate = { opened_at: now }
                stageToSet = 'opened'
                break
            case 'clicked':
                // Click implies open
                emailUpdate = { clicked_at: now, opened_at: now }
                stageToSet = 'opened' // Keep as opened, clicked doesn't have its own stage
                break
            case 'replied':
                // Reply implies open
                emailUpdate = { replied_at: now, opened_at: now }
                stageToSet = 'replied'
                break
            case 'unmark_opened':
                emailUpdate = { opened_at: null }
                stageToSet = 'sent'
                break
            case 'unmark_clicked':
                emailUpdate = { clicked_at: null }
                // Don't change stage, just remove click
                break
            case 'unmark_replied':
                emailUpdate = { replied_at: null }
                stageToSet = 'opened' // Downgrade to opened if we're unmarking reply
                break
        }

        // Update email if we have one
        if (targetEmailId && Object.keys(emailUpdate).length > 0) {
            const { error: emailError } = await supabase
                .from('emails')
                .update(emailUpdate)
                .eq('id', targetEmailId)

            if (emailError) {
                console.error('[MANUAL-TRACKING] Email update error:', emailError)
                return NextResponse.json({ error: emailError.message }, { status: 500 })
            }
        }

        // Update contact_campaign stage
        if (stageToSet) {
            ccUpdate = { stage: stageToSet, pipeline_stage: stageToSet }
            
            const { error: ccError } = await supabase
                .from('contact_campaigns')
                .update(ccUpdate)
                .eq('id', contact_campaign_id)

            if (ccError) {
                console.error('[MANUAL-TRACKING] Contact campaign update error:', ccError)
                return NextResponse.json({ error: ccError.message }, { status: 500 })
            }
        }

        // Update analytics_daily for manual tracking
        const today = new Date().toISOString().split('T')[0]
        
        // Get campaign_id from contact_campaign
        const { data: cc } = await supabase
            .from('contact_campaigns')
            .select('campaign_id')
            .eq('id', contact_campaign_id)
            .single()
        
        const campaignId = cc?.campaign_id
        
        // Update stats based on action (non-critical)
        if (action === 'opened') {
            try {
                await supabase.rpc('increment_daily_stat', {
                    p_date: today,
                    p_campaign_id: campaignId || null,
                    p_field: 'emails_opened'
                })
            } catch (e) {
                // Non-critical
            }
        } else if (action === 'replied') {
            try {
                await supabase.rpc('increment_daily_stat', {
                    p_date: today,
                    p_campaign_id: campaignId || null,
                    p_field: 'emails_replied'
                })
            } catch (e) {
                // Non-critical
            }
        }

        console.log('[MANUAL-TRACKING] Updated:', { contact_campaign_id, action, stageToSet })

        return NextResponse.json({
            success: true,
            action,
            email_id: targetEmailId,
            contact_campaign_id,
            stage: stageToSet
        })

    } catch (error: any) {
        console.error('[MANUAL-TRACKING] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update tracking' },
            { status: 500 }
        )
    }
}
