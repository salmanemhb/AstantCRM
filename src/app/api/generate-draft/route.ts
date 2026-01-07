import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompletion, ChatMessage } from '@/lib/agents/openai-client'
import { 
  ASTANT_KNOWLEDGE, 
  buildEmailContext, 
  buildRelationshipContext, 
  STORYTELLING_HOOKS,
  EMAIL_STYLES 
} from '@/lib/astant-knowledge-base'

// ===== A-GRADE EMAIL GENERATION =====
// Uses comprehensive knowledge base for Jean-François level emails

function getSenderStyle(sender: string = 'jeanfrancois') {
  return EMAIL_STYLES[sender as keyof typeof EMAIL_STYLES] || EMAIL_STYLES.jeanfrancois
}

function getStorytellingHooks(): string {
  return `
=== STORYTELLING HOOKS (Weave 2-3 naturally into the email) ===

FORBES FEATURE:
${STORYTELLING_HOOKS.forbesFeature}

ALPHA DECAY THESIS:
${STORYTELLING_HOOKS.alphaDecayNarrative}

VISION:
${STORYTELLING_HOOKS.visionStatement}

COMPETITIVE ANSWER:
${STORYTELLING_HOOKS.competitiveAnswer}
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

    // Get comprehensive company context from knowledge base
    const companyContext = buildEmailContext('vc')
    
    // Get storytelling hooks
    const storyHooks = getStorytellingHooks()
    
    // Get relationship context if available
    const relationshipContext = buildRelationshipContext({
      previousMeetings: contact.previous_meetings,
      pastInteractions: contact.past_interactions,
      mutualConnections: contact.mutual_connections,
      referredBy: contact.referred_by,
      lastContact: contact.last_contact,
      notes: contact.notes,
    })

    // Build the A-grade prompt
    const prompt = `You are Jean-François Manigo Gilardoni from Astant Global Management.
You write emails that read like a senior executive who has done deep research on the recipient.

${companyContext}

${storyHooks}

${relationshipContext}

CAMPAIGN DETAILS:
- Campaign: ${campaign.name}
- Goal: ${campaign.prompt || campaign.global_context || 'Build relationship and explore partnership'}
- CTA: ${campaign.cta || 'Schedule a meeting'}
- Tone: ${campaign.tone || 'warm and professional'}

RECIPIENT:
- Name: ${contact.first_name} ${contact.last_name}
- Email: ${contact.email}
- Firm: ${contact.firm || 'Unknown'}
- Role: ${contact.role || 'Investor'}
- Geography: ${contact.geography || 'Unknown'}
- Investment Focus: ${contact.investment_focus || 'General'}
${contact.fund_size ? `- Fund Size: ${contact.fund_size}` : ''}
${contact.recent_investments ? `- Recent Investments: ${contact.recent_investments}` : ''}
${contact.notes ? `- Notes: ${contact.notes}` : ''}

=== A-GRADE EMAIL REQUIREMENTS ===
1. NO generic openings like "I hope this finds you well" - start with value or context
2. MUST reference at least one specific detail about their firm/role/focus
3. MUST weave in storytelling naturally (Forbes feature, Alpha Decay thesis, etc.)
4. Structure: 400-500 words, 5-6 paragraphs
5. Include Forbes link: https://nextleaders.forbes.it/da-studenti-a-imprenditori/
6. Include OpenMacro demo: https://openmacro.ai/
7. End with specific, actionable CTA
8. Sound like a real senior executive, not a cold email

=== EMAIL STRUCTURE ===
- Opening: Personal greeting + connection/context (2-3 sentences)
- Who you are: Brief intro establishing credibility (1-2 sentences)
- Why them: Why their firm/focus is relevant (2-3 sentences)
- Value proposition: OpenMacro and what makes it unique (3-4 sentences)
- Social proof: Forbes feature woven naturally (1-2 sentences)
- Call to action: Clear next step (1-2 sentences)
- Closing: Professional sign-off

Return a JSON object:
{
  "subject": "Specific, compelling subject - NOT generic",
  "greeting": "Good morning/Hi [Name]",
  "context_p1": "Opening paragraph with connection/context",
  "value_p2": "Main body with value proposition, storytelling, and proof",
  "cta": "Clear call-to-action paragraph",
  "confidence": "green" | "yellow" | "red"
}

Confidence:
- green: Strong personalization, specific details, clear value
- yellow: Good but could be more specific
- red: Too generic, needs work`

    // Generate A-grade email with quality model
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are Jean-François Manigo Gilardoni, a senior executive at Astant Global Management.
You write emails that:
1. Read like they were crafted by a seasoned professional with deep industry knowledge
2. Demonstrate specific research on the recipient's firm and role
3. Tell compelling stories that make people want to respond
4. Are specific and substantive - every sentence adds value
5. Balance institutional professionalism with genuine warmth

You NEVER write generic cold emails. Each email feels personally written.
Always return valid JSON.`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
    
    const response = await generateCompletion(messages, { 
      model: 'quality', 
      jsonMode: true,
      temperature: 0.7 
    })

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
