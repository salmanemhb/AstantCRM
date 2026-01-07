import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompletion, ChatMessage } from '@/lib/agents/openai-client'
import { getCompanyContext } from '@/lib/company-context'
import { EMAIL_TEMPLATES, getTemplatesByCategory } from '@/lib/email-templates'

// Get sample templates for AI context
function getTemplateExamples(): string {
  const vcTemplate = EMAIL_TEMPLATES.find(t => t.id === 'vc-q1-intro')
  const mediaTemplate = EMAIL_TEMPLATES.find(t => t.id === 'media-story-pitch')
  const clientTemplate = EMAIL_TEMPLATES.find(t => t.id === 'client-partnership-proposal')
  
  return `
PROFESSIONAL EMAIL TEMPLATES (Use these as style reference):

--- VC OUTREACH EXAMPLE ---
Subject: ${vcTemplate?.subject}
${vcTemplate?.body}

--- MEDIA OUTREACH EXAMPLE ---
Subject: ${mediaTemplate?.subject}
${mediaTemplate?.body}

--- CLIENT OUTREACH EXAMPLE ---
Subject: ${clientTemplate?.subject}
${clientTemplate?.body}
`
}

export async function POST(request: NextRequest) {
  try {
    const { contact_id, campaign_id, signature } = await request.json()

    if (!contact_id || !campaign_id) {
      return NextResponse.json(
        { error: 'Missing contact_id or campaign_id' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get company context
    const companyContext = getCompanyContext()
    
    // Get template examples for style reference
    const templateExamples = getTemplateExamples()

    // Build the prompt
    const prompt = `You are writing a personalized outreach email for a VC/investor relations context.

${companyContext}

${templateExamples}

CAMPAIGN DETAILS:
- Campaign: ${campaign.name}
- Prompt: ${campaign.prompt || campaign.global_context || 'Write a professional outreach email'}
- Template Subject: ${campaign.template_subject || 'Introduction'}
- Template Body: ${campaign.template_body || ''}
- CTA: ${campaign.cta || 'Request a meeting'}
- Tone: ${campaign.tone || 'professional'}

CONTACT DETAILS:
- Name: ${contact.first_name} ${contact.last_name}
- Email: ${contact.email}
- Firm: ${contact.firm || 'Unknown'}
- Role: ${contact.role || 'Investor'}
- Geography: ${contact.geography || 'Unknown'}
- Investment Focus: ${contact.investment_focus || 'General'}

INSTRUCTIONS:
1. Use the template examples above as style reference - match the professional, warm yet concise tone
2. Personalize for this specific contact based on their firm, role, and investment focus
3. Reference Forbes Italia feature and OpenMacro platform naturally
4. Include relevant links (Forbes: https://nextleaders.forbes.it/da-studenti-a-imprenditori/ and Demo: https://openmacro.ai/)
5. Keep the email focused and under 250 words
6. End with a clear call-to-action

Generate a personalized email for this contact.

Return a JSON object with this exact structure:
{
  "subject": "the email subject line - make it specific and compelling",
  "greeting": "Dear [First Name],",
  "context_p1": "Opening paragraph establishing connection/context (2-3 sentences)",
  "value_p2": "Value proposition paragraph with key highlights (3-4 sentences)",
  "cta": "Call to action paragraph (1-2 sentences)",
  "confidence": "green" | "yellow" | "red"
}

Confidence scoring:
- "green": Strong personalization, clear value prop, relevant to their focus
- "yellow": Good email but could be more personalized
- "red": Generic, needs improvement`

    // Generate the email using message format
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert email copywriter specializing in VC/investor outreach. You write personalized, compelling emails that get responses. Always return valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
    
    const response = await generateCompletion(messages, { model: 'quality', jsonMode: true })

    // Parse the response
    let emailData
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        emailData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      // Fallback structure
      emailData = {
        subject: `Introduction - Astant x ${contact.firm || 'Your Firm'}`,
        greeting: `Hi ${contact.first_name},`,
        context_p1: response.slice(0, 200),
        value_p2: response.slice(200, 400),
        cta: 'Would you be open to a quick call next week?',
        confidence: 'yellow'
      }
    }

    // Find or create contact_campaign record
    let contactCampaignId: string | null = null
    
    const { data: existingCC } = await supabase
      .from('contact_campaigns')
      .select('id')
      .eq('contact_id', contact_id)
      .eq('campaign_id', campaign_id)
      .single()
    
    if (existingCC) {
      contactCampaignId = existingCC.id
    }

    // Save email to database if we have a contact_campaign
    let emailId = crypto.randomUUID()
    if (contactCampaignId) {
      const emailBody = {
        greeting: emailData.greeting,
        context_p1: emailData.context_p1,
        value_p2: emailData.value_p2,
        cta: emailData.cta,
        signature: signature || '',
      }
      
      const { data: email, error: emailError } = await supabase
        .from('emails')
        .insert({
          contact_campaign_id: contactCampaignId,
          subject: emailData.subject,
          original_body: emailBody,
          current_body: emailBody,
          confidence_score: emailData.confidence,
          approved: false,
        })
        .select()
        .single()

      if (email) {
        emailId = email.id
      }

      // Update contact_campaign confidence score
      await supabase
        .from('contact_campaigns')
        .update({ confidence_score: emailData.confidence })
        .eq('id', contactCampaignId)
    }

    return NextResponse.json({
      email_id: emailId,
      subject: emailData.subject,
      preview: {
        greeting: emailData.greeting,
        context_p1: emailData.context_p1,
        value_p2: emailData.value_p2,
        cta: emailData.cta,
        signature: signature || '',
      },
      confidence: emailData.confidence,
    })
  } catch (error: any) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
