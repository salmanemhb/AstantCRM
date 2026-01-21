import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================
// PIPELINE STAGE API
// Update a contact's pipeline stage within a campaign
// ============================================

const VALID_STAGES = ['sent', 'opened', 'replied', 'interested', 'meeting', 'closed', 'not_interested']

export async function PATCH(request: NextRequest) {
    try {
        const { contactCampaignId, stage } = await request.json()

        if (!contactCampaignId || !stage) {
            return NextResponse.json(
                { error: 'Missing contactCampaignId or stage' },
                { status: 400 }
            )
        }

        if (!VALID_STAGES.includes(stage)) {
            return NextResponse.json(
                { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
                { status: 400 }
            )
        }

        const supabase = createClient()

        const { data, error } = await supabase
            .from('contact_campaigns')
            .update({ pipeline_stage: stage })
            .eq('id', contactCampaignId)
            .select()
            .single()

        if (error) {
            console.error('[PIPELINE] Update error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        console.error('[PIPELINE] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Get pipeline data for a campaign
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const campaignId = searchParams.get('campaign_id')

        const supabase = createClient()

        let query = supabase
            .from('contact_campaigns')
            .select(`
                id,
                pipeline_stage,
                contact:contacts (
                    id,
                    first_name,
                    last_name,
                    email,
                    firm,
                    role
                ),
                campaign:campaigns (
                    id,
                    name
                ),
                emails (
                    id,
                    sent_at,
                    opened_at,
                    clicked_at
                )
            `)
            .not('pipeline_stage', 'is', null)

        if (campaignId) {
            query = query.eq('campaign_id', campaignId)
        }

        const { data, error } = await query

        if (error) {
            console.error('[PIPELINE] Fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Group by stage
        const pipeline: Record<string, any[]> = {}
        VALID_STAGES.forEach(stage => {
            pipeline[stage] = []
        })

        data?.forEach(item => {
            const stage = item.pipeline_stage || 'sent'
            if (pipeline[stage]) {
                pipeline[stage].push(item)
            }
        })

        return NextResponse.json({
            success: true,
            data: pipeline,
            stages: VALID_STAGES
        })

    } catch (error: any) {
        console.error('[PIPELINE] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
