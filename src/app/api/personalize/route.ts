import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confidenceToEnum } from '@/lib/utils'
import { 
  personalizeTemplate,
  fallbackSubstitution,
  batchPersonalize,
  getTemplateById,
  listTemplates,
  MASTER_TEMPLATES,
  type MasterTemplate,
  type ContactData
} from '@/lib/template-personalization'
import OpenAI from 'openai'
import { createAIBoldingPrompt } from '@/lib/email-formatting'

// OpenAI client for dynamic bolding
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================
// TEMPLATE PERSONALIZATION API
// Core Philosophy: NO GENERATION, ONLY MODIFICATION
// 
// The AI's ONLY job is to identify and replace
// specific words/phrases to personalize for each contact.
// ============================================

export async function POST(request: NextRequest) {
  console.log('[PERSONALIZE] === POST Request Started ===')
  try {
    const body = await request.json()
    const { action } = body
    console.log('[PERSONALIZE] Action:', action, 'Body keys:', Object.keys(body))

    switch (action) {
      case 'personalize':
        console.log('[PERSONALIZE] Handling single personalize')
        return handlePersonalize(body)
      case 'batch':
        console.log('[PERSONALIZE] Handling batch personalize')
        return handleBatch(body)
      case 'preview':
        console.log('[PERSONALIZE] Handling preview')
        return handlePreview(body)
      case 'templates':
        console.log('[PERSONALIZE] Handling list templates')
        return handleListTemplates()
      case 'quick':
        console.log('[PERSONALIZE] Handling quick personalize (no AI)')
        // Fast mode - no AI, just string replacement
        return handleQuickPersonalize(body)
      case 'bold':
        console.log('[PERSONALIZE] Handling dynamic AI bolding')
        return handleDynamicBolding(body)
      default:
        console.error('[PERSONALIZE] Unknown action:', action)
        return NextResponse.json(
          { error: 'Unknown action. Use: personalize, batch, preview, templates, quick, or bold' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[PERSONALIZE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Personalization failed' },
      { status: 500 }
    )
  }
}

// ============================================
// DYNAMIC AI BOLDING
// Uses OpenAI to intelligently add <strong> tags
// ============================================

async function handleDynamicBolding(body: {
  text: string
  context?: {
    recipientName?: string
    recipientFirm?: string
    senderName?: string
  }
}) {
  const { text, context = {} } = body
  
  if (!text || text.length < 10) {
    return NextResponse.json({ text })
  }
  
  try {
    const prompt = createAIBoldingPrompt(text, context)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional email formatter. Return only the formatted text with <strong> tags, no explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 2000,
    })
    
    const formattedText = response.choices[0]?.message?.content?.trim() || text
    
    return NextResponse.json({ 
      text: formattedText,
      aiProcessed: true 
    })
  } catch (error: any) {
    console.error('[handleDynamicBolding] OpenAI error:', error)
    // Return original text on error
    return NextResponse.json({ 
      text, 
      aiProcessed: false,
      error: error.message 
    })
  }
}

// ============================================
// PERSONALIZE SINGLE EMAIL (with AI assist)
// ============================================

async function handlePersonalize(body: {
  contact_id: string
  campaign_id: string
  template_id?: string
  sender_id?: string
}) {
  const { contact_id, campaign_id, template_id, sender_id } = body
  console.log('[handlePersonalize] Starting...', { contact_id, campaign_id, template_id, sender_id })

  const supabase = createClient()

  // Get contact
  console.log('[handlePersonalize] Fetching contact...')
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contact_id)
    .single()

  if (contactError || !contact) {
    console.error('[handlePersonalize] Contact not found:', contactError)
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }
  console.log('[handlePersonalize] Contact found:', contact.email)

  // Get template (default to Jean-François's template)
  const template = getTemplateById(template_id || 'jf-investor-outreach-v1') || MASTER_TEMPLATES[0]
  console.log('[handlePersonalize] Using template:', template.id)

  // Personalize with sender info
  console.log('[handlePersonalize] Running template personalization...')
  const result = await personalizeTemplate(template, contact as ContactData, sender_id || 'jean-francois')
  console.log('[handlePersonalize] Personalization result:', { confidence: result.confidence, subject: result.subject?.substring(0, 50) })

  // Body already includes signature via [SENDER_*] placeholders
  const fullBody = result.body

  // Save to database
  console.log('[handlePersonalize] Checking for existing contact_campaign...')
  const { data: existingCC } = await supabase
    .from('contact_campaigns')
    .select('id')
    .eq('contact_id', contact_id)
    .eq('campaign_id', campaign_id)
    .single()

  let emailId = crypto.randomUUID()

  // Convert numeric confidence to enum value for database
  const confidenceEnum = confidenceToEnum(result.confidence)
  console.log('[handlePersonalize] Confidence enum:', confidenceEnum)

  if (existingCC) {
    console.log('[handlePersonalize] Existing CC found:', existingCC.id)
    // Check for existing draft email to prevent duplicates
    const { data: existingEmails } = await supabase
      .from('emails')
      .select('id')
      .eq('contact_campaign_id', existingCC.id)
      .eq('approved', false)
      .is('sent_at', null)
      .limit(1)
    console.log('[handlePersonalize] Existing draft emails:', existingEmails?.length || 0)

    if (existingEmails && existingEmails.length > 0) {
      console.log('[handlePersonalize] Updating existing draft:', existingEmails[0].id)
      // Update existing draft instead of creating duplicate
      const { data: updatedEmail } = await supabase
        .from('emails')
        .update({
          subject: result.subject,
          original_body: { body: result.body },
          current_body: { body: result.body },
          confidence_score: confidenceEnum,
          mutated_at: new Date().toISOString()
        })
        .eq('id', existingEmails[0].id)
        .select()
        .single()

      if (updatedEmail) emailId = updatedEmail.id
    } else {
      // Create new email
      const { data: email } = await supabase
        .from('emails')
        .insert({
          contact_campaign_id: existingCC.id,
          subject: result.subject,
          original_body: { body: result.body },
          current_body: { body: result.body },
          confidence_score: confidenceEnum,
          approved: false,
        })
        .select()
        .single()

      if (email) emailId = email.id
    }

    await supabase
      .from('contact_campaigns')
      .update({ 
        confidence_score: confidenceEnum,
        sender_id: sender_id || 'jean-francois'
      })
      .eq('id', existingCC.id)
  }

  return NextResponse.json({
    success: true,
    email_id: emailId,
    subject: result.subject,
    body: fullBody,
    template_used: template.id,
    template_name: template.name,
    modifications: result.modifications,
    confidence: result.confidence,
    engine: 'personalization-v1',
    philosophy: 'modification-only'
  })
}

// ============================================
// QUICK PERSONALIZE (NO AI - fastest)
// Just string replacement, no AI calls
// ============================================

async function handleQuickPersonalize(body: {
  contact_id: string
  campaign_id: string
  template_id?: string
  sender_id?: string
}) {
  const { contact_id, campaign_id, template_id, sender_id } = body

  const supabase = createClient()

  // Get contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contact_id)
    .single()

  if (contactError || !contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Get template
  const template = getTemplateById(template_id || 'jf-investor-outreach-v1') || MASTER_TEMPLATES[0]

  // Simple string replacement with sender info - NO AI
  const result = fallbackSubstitution(template, contact as ContactData, sender_id || 'jean-francois')

  // Body already includes signature via [SENDER_*] placeholders
  const fullBody = result.body

  // Save to database
  const { data: existingCC } = await supabase
    .from('contact_campaigns')
    .select('id')
    .eq('contact_id', contact_id)
    .eq('campaign_id', campaign_id)
    .single()

  let emailId = crypto.randomUUID()

  if (existingCC) {
    const { data: email } = await supabase
      .from('emails')
      .insert({
        contact_campaign_id: existingCC.id,
        subject: result.subject,
        original_body: { body: result.body },
        current_body: { body: result.body },
        confidence_score: 'green', // Direct substitution = high confidence
        approved: false,
      })
      .select()
      .single()

    if (email) emailId = email.id

    await supabase
      .from('contact_campaigns')
      .update({ 
        confidence_score: 'green',
        sender_id: sender_id || 'jean-francois'
      })
      .eq('id', existingCC.id)
  }

  return NextResponse.json({
    success: true,
    email_id: emailId,
    subject: result.subject,
    body: fullBody,
    template_used: template.id,
    template_name: template.name,
    confidence: 100,
    engine: 'quick-substitution',
    philosophy: 'no-ai-pure-replacement'
  })
}

// ============================================
// BATCH PERSONALIZE (for 1000s of contacts)
// ============================================

async function handleBatch(body: {
  campaign_id: string
  contact_ids?: string[]
  template_id?: string
  sender_id?: string
  limit?: number
}) {
  const { campaign_id, contact_ids, template_id, sender_id, limit = 1000 } = body

  const supabase = createClient()

  // Get contacts
  let query = supabase.from('contacts').select('*')

  if (contact_ids && contact_ids.length > 0) {
    query = query.in('id', contact_ids)
  } else {
    // Get contacts in campaign
    const { data: campaignContacts } = await supabase
      .from('contact_campaigns')
      .select('contact_id')
      .eq('campaign_id', campaign_id)

    if (campaignContacts && campaignContacts.length > 0) {
      query = query.in('id', campaignContacts.map(cc => cc.contact_id))
    }
  }

  const { data: contacts, error: contactsError } = await query.limit(limit)

  if (contactsError || !contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No contacts found' }, { status: 404 })
  }

  // Get template
  const template = getTemplateById(template_id || 'jf-investor-outreach-v1') || MASTER_TEMPLATES[0]

  // Batch personalize with sender info (uses fast fallback, no AI)
  const results = await batchPersonalize(
    template,
    contacts as ContactData[],
    sender_id || 'jean-francois'
  )

  // Save to database
  let savedCount = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const contact = contacts[i]

    const { data: existingCC } = await supabase
      .from('contact_campaigns')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('campaign_id', campaign_id)
      .single()

    if (existingCC) {
      // Convert numeric confidence to enum
      const batchConfidenceEnum = confidenceToEnum(result.confidence)
      
      await supabase
        .from('emails')
        .insert({
          contact_campaign_id: existingCC.id,
          subject: result.subject,
          original_body: { body: result.body },
          current_body: { body: result.body },
          confidence_score: batchConfidenceEnum,
          approved: false,
        })

      await supabase
        .from('contact_campaigns')
        .update({ 
          confidence_score: batchConfidenceEnum,
          sender_id: sender_id || 'jean-francois'
        })
        .eq('id', existingCC.id)

      savedCount++
    }
  }

  return NextResponse.json({
    success: true,
    stats: {
      total: results.length,
      personalized: results.length,
      saved: savedCount
    },
    template_used: template.id,
    template_name: template.name,
    engine: 'batch-personalization',
    philosophy: 'modification-only'
  })
}

// ============================================
// PREVIEW (show what the personalized email looks like)
// ============================================

async function handlePreview(body: {
  template_id?: string
  sample_contact?: ContactData
  sender_id?: string
}) {
  const { template_id, sample_contact, sender_id } = body

  // Use sample or default contact
  const contact: ContactData = sample_contact || {
    first_name: 'Michael',
    last_name: 'Chen',
    email: 'michael@sequoia.com',
    firm: 'Sequoia Capital',
    role: 'Partner',
    investment_focus: 'fintech infrastructure',
    geography: 'San Francisco'
  }

  // Get template
  const template = getTemplateById(template_id || 'jf-investor-outreach-v1') || MASTER_TEMPLATES[0]

  // Show before and after with sender info
  const result = fallbackSubstitution(template, contact, sender_id || 'jean-francois')

  return NextResponse.json({
    success: true,
    template: {
      id: template.id,
      name: template.name,
      author: template.author,
      placeholders: template.placeholders.map(p => p.field)
    },
    before: {
      subject: template.subject,
      body: template.body
    },
    after: {
      subject: result.subject,
      body: result.body
    },
    contact_used: contact,
    modifications: result.modifications
  })
}

// ============================================
// LIST ALL TEMPLATES
// ============================================

function handleListTemplates() {
  const templates = listTemplates()
  return NextResponse.json({
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      author: t.author,
      placeholders: t.placeholders,
    })),
    philosophy: 'These are gold-standard templates. AI only modifies the bracketed fields.'
  })
}
