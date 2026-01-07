// ============================================
// BATCH EMAIL GENERATION API
// Mass generation for 2000+ contacts
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON, ChatMessage } from '@/lib/agents/openai-client'
import {
  buildEmailPrompt,
  selectBestTemplate,
  scoreEmailQuality,
  getPersonalizationData,
  createBatchConfig,
  ContactData,
  CampaignConfig,
  GeneratedEmail,
  BatchResult,
  DEFAULT_ATTACHMENTS,
} from '@/lib/email-engine'
import { getSignatureText } from '@/lib/signatures'
import { TemplateCategory } from '@/lib/email-templates'

// ============================================
// SINGLE EMAIL GENERATION
// ============================================

interface EmailGenerationResult {
  subject: string
  greeting: string
  context_p1: string
  value_p2: string
  cta: string
  confidence: 'green' | 'yellow' | 'red'
  personalization_tags: string[]
}

async function generateSingleEmail(
  contact: ContactData,
  config: CampaignConfig
): Promise<GeneratedEmail> {
  // Select best template for this contact
  const template = selectBestTemplate(contact, config.category)
  
  // Build optimized prompt
  const prompt = buildEmailPrompt(contact, config, template)

  // Generate with GPT-4o
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an elite email copywriter for Astant Global Management, a Madrid-based macro intelligence firm. 
Your emails consistently achieve 40%+ open rates and 15%+ response rates.
You write near-perfect emails that require minimal editing.
Always return valid JSON matching the exact schema requested.`
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const result = await generateJSON<EmailGenerationResult>(messages, {
      model: 'quality',
      temperature: 0.7,
    })

    // Score the email quality
    const baseEmail = {
      contact_id: contact.id,
      subject: result.subject,
      greeting: result.greeting,
      context_p1: result.context_p1,
      value_p2: result.value_p2,
      cta: result.cta,
      signature_member_id: config.sender_id,
      confidence: result.confidence,
      personalization_tags: result.personalization_tags || [],
      attachments: config.include_pitch_deck ? [DEFAULT_ATTACHMENTS.pitch_deck] : [],
    }

    const quality = scoreEmailQuality(baseEmail, contact)

    return {
      ...baseEmail,
      quality_score: quality.score,
      needs_review: quality.needs_review,
      review_reasons: quality.reasons,
    }
  } catch (error: any) {
    // Return a flagged email on error
    return {
      contact_id: contact.id,
      subject: `Introduction - Astant x ${contact.firm || 'Your Firm'}`,
      greeting: `Dear ${contact.first_name},`,
      context_p1: '[GENERATION FAILED - NEEDS MANUAL EDIT]',
      value_p2: '',
      cta: 'Would you be open to a brief call?',
      signature_member_id: config.sender_id,
      confidence: 'red',
      quality_score: 0,
      personalization_tags: [],
      needs_review: true,
      review_reasons: [`Generation error: ${error.message}`],
      attachments: [],
    }
  }
}

// ============================================
// BATCH GENERATION
// ============================================

async function generateBatch(
  contacts: ContactData[],
  config: CampaignConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedEmail[]> {
  const results: GeneratedEmail[] = []
  
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5
  
  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    const batch = contacts.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(contact => generateSingleEmail(contact, config))
    )
    results.push(...batchResults)
    
    if (onProgress) {
      onProgress(results.length, contacts.length)
    }
    
    // Rate limit delay
    if (i + CONCURRENCY < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return results
}

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      campaign_id,
      contact_ids,        // Array of contact IDs to generate for
      category = 'vc-outreach',
      sender_id = 'jean-francois',
      tone = 'warm',
      include_forbes_link = true,
      include_demo_link = true,
      include_pitch_deck = false,
      custom_cta,
      custom_context,
      save_to_db = true,  // Whether to save generated emails
    } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 })
    }

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty contact_ids array' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Fetch contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contact_ids)

    if (contactsError || !contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found' }, { status: 404 })
    }

    // Build campaign config
    const config: CampaignConfig = {
      id: campaign_id,
      name: campaign.name,
      category: category as TemplateCategory,
      sender_id,
      tone,
      include_forbes_link,
      include_demo_link,
      include_pitch_deck,
      custom_cta,
      custom_context,
    }

    // Get batch info
    const batchInfo = createBatchConfig(contacts as ContactData[], config)

    // Generate all emails
    const generatedEmails = await generateBatch(contacts as ContactData[], config)

    // Calculate results
    const result: BatchResult = {
      total: contacts.length,
      generated: generatedEmails.length,
      green: generatedEmails.filter(e => e.confidence === 'green').length,
      yellow: generatedEmails.filter(e => e.confidence === 'yellow').length,
      red: generatedEmails.filter(e => e.confidence === 'red').length,
      needs_review: generatedEmails.filter(e => e.needs_review).length,
      errors: generatedEmails
        .filter(e => e.review_reasons.some(r => r.includes('error')))
        .map(e => `${e.contact_id}: ${e.review_reasons.join(', ')}`),
    }

    // Save to database if requested
    if (save_to_db) {
      for (const email of generatedEmails) {
        // Find or create contact_campaign
        const { data: existingCC } = await supabase
          .from('contact_campaigns')
          .select('id')
          .eq('contact_id', email.contact_id)
          .eq('campaign_id', campaign_id)
          .single()

        let contactCampaignId = existingCC?.id

        if (!contactCampaignId) {
          // Create unified thread first
          const contact = contacts.find(c => c.id === email.contact_id)
          const { data: thread } = await supabase
            .from('unified_threads')
            .insert({
              firm_name: contact?.firm || 'Unknown Firm',
              status: 'active',
            })
            .select()
            .single()

          if (thread) {
            const { data: newCC } = await supabase
              .from('contact_campaigns')
              .insert({
                contact_id: email.contact_id,
                campaign_id,
                unified_thread_id: thread.id,
                stage: 'drafted',
                confidence_score: email.confidence,
              })
              .select()
              .single()

            contactCampaignId = newCC?.id
          }
        }

        if (contactCampaignId) {
          // Save email
          const emailBody = {
            greeting: email.greeting,
            context_p1: email.context_p1,
            value_p2: email.value_p2,
            cta: email.cta,
            signature: getSignatureText(email.signature_member_id),
            signatureMemberId: email.signature_member_id,
          }

          await supabase
            .from('emails')
            .insert({
              contact_campaign_id: contactCampaignId,
              subject: email.subject,
              original_body: emailBody,
              current_body: emailBody,
              confidence_score: email.confidence,
              approved: false,
            })

          // Update contact_campaign
          await supabase
            .from('contact_campaigns')
            .update({ confidence_score: email.confidence })
            .eq('id', contactCampaignId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      result,
      emails: generatedEmails,
      batch_info: {
        total_batches: batchInfo.batches.length,
        estimated_time_seconds: batchInfo.estimatedTime,
      },
    })
  } catch (error: any) {
    console.error('Batch generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Batch generation failed' },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Preview batch before generating
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaign_id = searchParams.get('campaign_id')
  const contact_count = parseInt(searchParams.get('contact_count') || '0')

  if (!campaign_id) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 })
  }

  const supabase = createClient()

  // Get campaign contacts
  const { data: contacts, count } = await supabase
    .from('contact_campaigns')
    .select('contact_id, contacts(*)', { count: 'exact' })
    .eq('campaign_id', campaign_id)

  const totalContacts = count || 0
  const contactsToGenerate = contact_count || totalContacts

  // Estimate time
  const AVG_TIME_PER_EMAIL = 3 // seconds
  const estimatedTime = contactsToGenerate * AVG_TIME_PER_EMAIL

  return NextResponse.json({
    campaign_id,
    total_contacts: totalContacts,
    contacts_to_generate: contactsToGenerate,
    estimated_time_seconds: estimatedTime,
    estimated_time_human: formatTime(estimatedTime),
    recommendation: contactsToGenerate > 100
      ? 'Consider generating in batches for better control'
      : 'Ready to generate',
  })
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`
  return `${Math.round(seconds / 3600)} hours`
}
