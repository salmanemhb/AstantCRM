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

// ===== A-GRADE EMAIL GENERATION SYSTEM =====
// Generates Jean-François level emails with deep context and storytelling

interface ContactData {
  id: string
  first_name: string
  last_name: string
  email: string
  firm?: string
  role?: string
  geography?: string
  investment_focus?: string
  fund_size?: string
  recent_investments?: string
  linkedin_url?: string
  notes?: string
  previous_meetings?: string
  past_interactions?: string
  mutual_connections?: string
  referred_by?: string
  last_contact?: string
}

interface EmailConfig {
  sender: 'jeanfrancois' | 'fahd' | 'marcos'
  contactType: 'vc' | 'media' | 'client' | 'partner' | 'strategic'
  tone: 'formal' | 'warm' | 'direct'
  emailLength: 'short' | 'medium' | 'long'
  includeForbesFeature: boolean
  includeEventInvite: boolean
  includeOfficeInvite: boolean
  includePitchDeck: boolean
  customContext?: string
  specificAsk?: string
}

function getSenderStyle(sender: string) {
  return EMAIL_STYLES[sender as keyof typeof EMAIL_STYLES] || EMAIL_STYLES.jeanfrancois
}

function buildAdvancedPrompt(
  contact: ContactData, 
  config: EmailConfig,
  campaignContext: string
): string {
  const senderStyle = getSenderStyle(config.sender)
  const senderInfo = ASTANT_KNOWLEDGE.team[config.sender as keyof typeof ASTANT_KNOWLEDGE.team]
  
  // Build comprehensive context
  const companyContext = buildEmailContext(config.contactType)
  const relationshipContext = buildRelationshipContext({
    previousMeetings: contact.previous_meetings,
    pastInteractions: contact.past_interactions,
    mutualConnections: contact.mutual_connections,
    referredBy: contact.referred_by,
    lastContact: contact.last_contact,
    notes: contact.notes,
  })

  // Select storytelling hooks based on config
  const hooks: string[] = []
  if (config.includeForbesFeature) {
    hooks.push(`FORBES FEATURE HOOK:\n${STORYTELLING_HOOKS.forbesFeature}`)
  }
  if (config.includeEventInvite) {
    hooks.push(`EVENT INVITE HOOK:\n${STORYTELLING_HOOKS.eventInvite}`)
  }
  hooks.push(`VISION HOOK:\n${STORYTELLING_HOOKS.visionStatement}`)
  hooks.push(`ALPHA DECAY HOOK:\n${STORYTELLING_HOOKS.alphaDecayNarrative}`)
  hooks.push(`MATURITY JOURNEY HOOK:\n${STORYTELLING_HOOKS.maturityJourney}`)

  // Length guidelines
  const lengthGuide = {
    short: '200-300 words, 3-4 paragraphs',
    medium: '400-500 words, 5-6 paragraphs',
    long: '600-800 words, 7-8 paragraphs with clear sections',
  }

  return `You are ${senderInfo?.name || 'Jean-François Manigo Gilardoni'} from Astant Global Management.
You are writing a personalized, A-grade outreach email that reads like it was written by a senior executive 
who knows the recipient and has done deep research.

=== YOUR ROLE ===
${senderInfo?.role || 'Global Partnerships & Expansion'}

=== YOUR WRITING STYLE ===
- Greeting style: "${senderStyle.greeting}"
- Tone: ${senderStyle.tone}
- Structure: ${senderStyle.structure}
- Sign-off: "${senderStyle.signoff}"
- Key characteristics: ${senderStyle.characteristics.join(', ')}

${companyContext}

${relationshipContext}

=== STORYTELLING HOOKS (Use 2-3 naturally in the email) ===
${hooks.join('\n\n')}

=== CAMPAIGN CONTEXT ===
${campaignContext}

=== RECIPIENT DETAILS ===
Name: ${contact.first_name} ${contact.last_name}
Email: ${contact.email}
Firm: ${contact.firm || 'Unknown'}
Role: ${contact.role || 'Unknown'}
Geography: ${contact.geography || 'Unknown'}
Investment Focus: ${contact.investment_focus || 'General'}
${contact.fund_size ? `Fund Size: ${contact.fund_size}` : ''}
${contact.recent_investments ? `Recent Investments: ${contact.recent_investments}` : ''}
${contact.notes ? `Notes: ${contact.notes}` : ''}

${config.customContext ? `=== ADDITIONAL CONTEXT ===\n${config.customContext}` : ''}

=== EMAIL REQUIREMENTS ===
1. LENGTH: ${lengthGuide[config.emailLength]}
2. TONE: ${config.tone === 'formal' ? 'Professional and institutional' : config.tone === 'warm' ? 'Warm and relationship-focused' : 'Direct and to the point'}
3. PERSONALIZATION: Reference their firm, role, investment focus, and any relationship history
4. STORYTELLING: Weave in the company narrative naturally - don't just list facts
5. VALUE FIRST: Lead with value for THEM, not what we want
6. SPECIFIC ASK: ${config.specificAsk || 'Schedule a meeting or call'}

=== STRUCTURE FOR ${config.emailLength.toUpperCase()} EMAIL ===
${config.emailLength === 'long' ? `
- Opening: Personal greeting + connection/context (2-3 sentences)
- Introduction: Who you are and why you're reaching out (2-3 sentences)
- Invitation/Hook: Event invite or specific value proposition (3-4 sentences)
- Forbes Feature: Mention the recognition naturally (2-3 sentences)
- Platform Details: OpenMacro and Alpha Decay thesis (4-5 sentences)
- The Ask: Clear next step with specifics (2-3 sentences)
- Closing: Professional sign-off with availability
` : config.emailLength === 'medium' ? `
- Opening: Personal greeting + connection (1-2 sentences)
- Why reaching out: Context and relevance (2-3 sentences)
- Value proposition: What we're building and why it matters (3-4 sentences)
- Social proof: Forbes feature or other credibility (1-2 sentences)
- Call to action: Clear, specific ask (1-2 sentences)
- Closing: Professional sign-off
` : `
- Opening: Direct greeting + why you're relevant to them (1-2 sentences)
- Value: Key proposition with specificity (2-3 sentences)
- Ask: Clear next step (1 sentence)
- Closing: Professional sign-off
`}

=== WHAT TO INCLUDE ===
${config.includeForbesFeature ? '✓ Forbes Italia feature with link' : ''}
${config.includeEventInvite ? '✓ 2026 in-person event invitation' : ''}
${config.includeOfficeInvite ? '✓ Office visit invitation (Paseo de la Castellana, 280)' : ''}
${config.includePitchDeck ? '✓ Mention attached pitch deck' : ''}
✓ OpenMacro platform link: https://openmacro.ai/
✓ Forbes link: https://nextleaders.forbes.it/da-studenti-a-imprenditori/

=== CRITICAL QUALITY STANDARDS ===
- NO generic phrases like "I hope this message finds you well" or "I'm reaching out because"
- NO vague claims - be specific about capabilities (65+ markets, asset classes, etc.)
- MUST feel like a real person wrote it with specific knowledge of the recipient
- MUST include at least one specific detail about their firm/role/focus
- MUST have a clear, actionable call-to-action
- MUST sound like a senior executive, not a sales email

=== OUTPUT FORMAT ===
Return a JSON object:
{
  "subject": "Compelling, specific subject line - NOT generic",
  "body": "The complete email body with proper formatting and line breaks. Use \\n\\n for paragraph breaks.",
  "confidence": "green" | "yellow" | "red",
  "personalization_score": 1-10,
  "hooks_used": ["list of storytelling hooks used"],
  "key_personalization_points": ["specific details referenced about recipient"]
}`
}

export async function POST(request: NextRequest) {
  try {
    const { 
      contact_id, 
      campaign_id, 
      signature,
      config = {} as Partial<EmailConfig>
    } = await request.json()

    if (!contact_id || !campaign_id) {
      return NextResponse.json(
        { error: 'Missing contact_id or campaign_id' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch contact with all available data
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

    // Build email configuration with defaults
    const emailConfig: EmailConfig = {
      sender: config.sender || 'jeanfrancois',
      contactType: config.contactType || 'vc',
      tone: config.tone || 'warm',
      emailLength: config.emailLength || 'medium',
      includeForbesFeature: config.includeForbesFeature ?? true,
      includeEventInvite: config.includeEventInvite ?? false,
      includeOfficeInvite: config.includeOfficeInvite ?? false,
      includePitchDeck: config.includePitchDeck ?? false,
      customContext: config.customContext || campaign.global_context,
      specificAsk: config.specificAsk || campaign.cta,
    }

    // Build the advanced prompt
    const campaignContext = `
Campaign: ${campaign.name}
Goal: ${campaign.prompt || 'Outreach and relationship building'}
CTA: ${campaign.cta || 'Schedule a meeting'}
Additional Context: ${campaign.template_body || ''}
`

    const prompt = buildAdvancedPrompt(contact as ContactData, emailConfig, campaignContext)

    // Generate with GPT-4o for best quality
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a world-class executive communication specialist. You write emails that:
1. Read like they were written by a senior partner at a top consulting firm
2. Demonstrate deep research and understanding of the recipient
3. Tell compelling stories that make people want to respond
4. Are specific, not generic - every sentence adds value
5. Balance professionalism with warmth

You NEVER write generic cold emails. Every email is a carefully crafted piece of communication.
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
      temperature: 0.7  // Slightly creative for better emails
    })

    // Parse the response
    let emailData
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        emailData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
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

    // Save email to database
    let emailId = crypto.randomUUID()
    if (contactCampaignId) {
      const emailBody = {
        body: emailData.body,
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
      body: emailData.body,
      signature: signature || '',
      confidence: emailData.confidence,
      personalization_score: emailData.personalization_score,
      hooks_used: emailData.hooks_used,
      key_personalization_points: emailData.key_personalization_points,
      config: emailConfig,
    })
  } catch (error: any) {
    console.error('A-Grade email generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate email' },
      { status: 500 }
    )
  }
}

// GET endpoint to preview config options
export async function GET() {
  return NextResponse.json({
    senders: Object.keys(EMAIL_STYLES),
    contactTypes: ['vc', 'media', 'client', 'partner', 'strategic'],
    tones: ['formal', 'warm', 'direct'],
    lengths: ['short', 'medium', 'long'],
    hooks: Object.keys(STORYTELLING_HOOKS),
    knowledge: {
      company: ASTANT_KNOWLEDGE.company,
      team: Object.keys(ASTANT_KNOWLEDGE.team),
      coverage: ASTANT_KNOWLEDGE.coverage,
      press: ASTANT_KNOWLEDGE.press,
    }
  })
}
