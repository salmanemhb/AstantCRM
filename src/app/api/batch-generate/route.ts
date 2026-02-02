import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TEAM_MEMBERS } from '@/lib/signatures'
import { createLogger } from '@/lib/logger'

const logger = createLogger('batch-generate')

// Valid sender IDs for validation
const VALID_SENDER_IDS = new Set(TEAM_MEMBERS.map(m => m.id))

// Maximum batch size to prevent DoS and memory issues
const MAX_BATCH_SIZE = 100

export async function POST(request: NextRequest) {
  logger.info('Starting batch generation...')
  
  try {
    const { 
      campaign_id,
      contact_ids,
      category = 'vc-outreach',
      sender_id = 'jean-francois',
      tone = 'warm',
      include_forbes_link = true,
      include_demo_link = true,
      include_pitch_deck = false,
      save_to_db = true,
    } = await request.json()

    // Validate required fields
    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'Missing campaign_id' },
        { status: 400 }
      )
    }

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid contact_ids array' },
        { status: 400 }
      )
    }

    // Enforce batch size limit
    if (contact_ids.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BATCH_SIZE} contacts per batch. Received: ${contact_ids.length}` },
        { status: 400 }
      )
    }

    // Validate sender_id
    if (!VALID_SENDER_IDS.has(sender_id)) {
      return NextResponse.json(
        { success: false, error: `Invalid sender_id: ${sender_id}. Valid options: ${Array.from(VALID_SENDER_IDS).join(', ')}` },
        { status: 400 }
      )
    }

    logger.info('Processing', contact_ids.length, 'contacts for campaign', campaign_id)

    const results = {
      success: [] as string[],
      failed: [] as { contact_id: string; error: string }[],
      skipped: [] as { contact_id: string; reason: string }[],
    }

    // Process each contact sequentially to avoid rate limits
    for (const contact_id of contact_ids) {
      try {
        // Call the generate-claude API for each contact
        const response = await fetch(new URL('/api/generate-claude', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id,
            campaign_id,
            config: {
              category,
              sender_id,
              tone,
              include_forbes_link,
              include_demo_link,
              include_pitch_deck,
            },
          }),
        })

        const data = await response.json()

        if (response.ok && data.email_id) {
          results.success.push(contact_id)
          logger.debug('Generated email for contact:', contact_id)
        } else {
          results.failed.push({ 
            contact_id, 
            error: data.error || 'Unknown error' 
          })
          logger.error('Failed for contact:', contact_id, data.error)
        }
      } catch (error: any) {
        results.failed.push({ 
          contact_id, 
          error: error.message || 'Request failed' 
        })
        logger.error('Error for contact:', contact_id, error)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info('Completed:', {
      success: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
    })

    return NextResponse.json({
      success: true,
      result: {
        total: contact_ids.length,
        generated: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results,
      },
    })
  } catch (error: any) {
    logger.error('Fatal error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
