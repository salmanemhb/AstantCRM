import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompletion, ChatMessage } from '@/lib/agents/openai-client'
import {
  buildHumanEmailPrompt,
  HUMAN_EMAIL_SYSTEM_PROMPT,
  GOLD_STANDARD_EMAIL
} from '@/lib/gold-standard-emails'
import { getSignatureText } from '@/lib/signatures'

// ===== HUMAN-QUALITY EMAIL GENERATION =====
// Matches Jean-François's actual email quality

export async function POST(request: NextRequest) {
  try {
    const {
      contact_id,
      campaign_id,
      run,
      signature,
      config = {}
    } = await request.json()

    if (!contact_id || !campaign_id) {
      return NextResponse.json(
        { error: 'Missing contact_id or campaign_id' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch contact with ALL available data
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

    // Fetch campaign (optional - continue without it)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    // Campaign is optional - log warning but continue
    if (campaignError || !campaign) {
      console.warn(`Campaign ${campaign_id} not found in database, using default settings`)
    }

    // Determine sender
    const senderId = config.sender_id || campaign?.sender_id || 'jean-francois'
    const senderNames: Record<string, { name: string; role: string }> = {
      'jean-francois': {
        name: 'Jean-François Manigo Gilardoni',
        role: 'Global Partnerships & Expansion Lead'
      },
      'fahd': {
        name: 'Fahd El Ghorfi',
        role: 'Founder & CEO'
      },
      'marcos': {
        name: 'Marcos Agustín Plata',
        role: 'CEO & Co-Founder'
      },
      'salman': {
        name: 'Salman El Mehbaoui',
        role: 'Chief Operating Officer'
      },
    }
    const sender = senderNames[senderId] || senderNames['jean-francois']

    // Determine email type
    let emailType: 'vc' | 'media' | 'partner' | 'warm_intro' = 'vc'
    if (config.email_type) {
      emailType = config.email_type
    } else if (campaign?.prompt_preset_id) {
      if (campaign.prompt_preset_id.includes('media')) emailType = 'media'
      else if (campaign.prompt_preset_id.includes('client')) emailType = 'partner'
    }

    // Build the human-quality prompt
    const prompt = buildHumanEmailPrompt(
      {
        first_name: contact.first_name,
        last_name: contact.last_name,
        firm: contact.firm,
        role: contact.role,
        geography: contact.geography,
        investment_focus: contact.investment_focus,
        notes: contact.notes,
        previous_interactions: contact.previous_meetings || contact.past_interactions,
      },
      {
        sender_name: sender.name,
        sender_role: sender.role,
        email_type: emailType,
        custom_context: config.custom_context || campaign?.prompt,
        reference_email: config.reference_email || campaign?.reference_email, // User's custom template from config or campaign
        include_event_invite: config.include_event_invite,
        specific_ask: config.specific_ask || campaign?.cta,
      }
    )

    // Generate with GPT-4o - use the human system prompt
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: HUMAN_EMAIL_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: prompt
      }
    ]

    const response = await generateCompletion(messages, {
      model: 'quality',
      jsonMode: true,
      temperature: 0.8 // Slightly higher for more natural variation
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

    // Get signature
    const senderSignature = signature || getSignatureText(senderId)

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

    // Prepare email body
    const emailBody = {
      body: emailData.body,
      signature: senderSignature,
    }

    // Save email to database
    let emailId = crypto.randomUUID()
    if (contactCampaignId) {
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

      // Update contact_campaign
      await supabase
        .from('contact_campaigns')
        .update({
          confidence_score: emailData.confidence,
          sender_id: senderId,
        })
        .eq('id', contactCampaignId)
    }

    return NextResponse.json({
      email_id: emailId,
      subject: emailData.subject,
      body: emailData.body,
      preview: emailBody,
      confidence: emailData.confidence,
      sender_id: senderId,
      sender_name: sender.name,
    })
  } catch (error: any) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
