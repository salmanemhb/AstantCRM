import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyFormatToEmail } from '@/lib/format-sync'
import type { EmailJsonBody } from '@/lib/types'

/**
 * POST /api/sync-format
 * Applies structural format from one email to all other emails in the campaign
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client inside the handler
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const body = await request.json()
    const { campaignId, sourceEmailId, sourceBody } = body
    
    if (!campaignId || !sourceEmailId || !sourceBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: campaignId, sourceEmailId, sourceBody' },
        { status: 400 }
      )
    }
    
    console.log('[SyncFormat] Starting format sync for campaign:', campaignId)
    console.log('[SyncFormat] Source email:', sourceEmailId)
    
    // Get all emails in this campaign (except the source)
    const { data: contactCampaigns, error: ccError } = await supabase
      .from('contact_campaigns')
      .select('id, emails!inner(id, current_body, original_body)')
      .eq('campaign_id', campaignId)
    
    if (ccError) {
      console.error('[SyncFormat] Error fetching contact campaigns:', ccError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch emails' },
        { status: 500 }
      )
    }
    
    // Flatten emails and filter out source
    const emailsToUpdate: Array<{ id: string; body: EmailJsonBody }> = []
    for (const cc of contactCampaigns || []) {
      const emails = cc.emails as Array<{ id: string; current_body: EmailJsonBody; original_body: EmailJsonBody }> | undefined
      if (emails) {
        for (const email of emails) {
          if (email.id !== sourceEmailId) {
            emailsToUpdate.push({
              id: email.id,
              body: email.current_body || email.original_body
            })
          }
        }
      }
    }
    
    console.log('[SyncFormat] Found', emailsToUpdate.length, 'emails to update')
    
    // Apply format to each email
    const updates: Array<{ emailId: string; success: boolean }> = []
    
    for (const email of emailsToUpdate) {
      const updatedBody = applyFormatToEmail(sourceBody, email.body)
      
      const { error: updateError } = await supabase
        .from('emails')
        .update({ current_body: updatedBody })
        .eq('id', email.id)
      
      if (updateError) {
        console.error('[SyncFormat] Failed to update email:', email.id, updateError)
        updates.push({ emailId: email.id, success: false })
      } else {
        updates.push({ emailId: email.id, success: true })
      }
    }
    
    const successCount = updates.filter(u => u.success).length
    console.log('[SyncFormat] Updated', successCount, 'of', emailsToUpdate.length, 'emails')
    
    return NextResponse.json({
      success: true,
      updated: successCount,
      total: emailsToUpdate.length,
      updates
    })
    
  } catch (error) {
    console.error('[SyncFormat] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
