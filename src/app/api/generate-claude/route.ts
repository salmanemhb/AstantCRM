import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { confidenceToEnum } from '@/lib/utils'
import { 
  personalizeTemplate,
  fallbackSubstitution,
  getTemplateById,
  MASTER_TEMPLATES,
  type ContactData
} from '@/lib/template-personalization'
import { getMemberById, TEAM_MEMBERS } from '@/lib/signatures'
import { boldImportantWords, extractNamesFromContact, createAIBoldingPrompt, convertMarkdownBold } from '@/lib/email-formatting'

// Valid sender IDs for validation
const VALID_SENDER_IDS = new Set(TEAM_MEMBERS.map(m => m.id))

// ============================================
// EMAIL PERSONALIZATION API
// ============================================
// PHILOSOPHY: NO GENERATION, ONLY MODIFICATION
// 
// This API takes a gold-standard template and personalizes
// it for each contact by ONLY changing specific words.
// 
// The AI is NOT creative. It's a smart find-and-replace.
// 95%+ of the template text stays EXACTLY the same.
// ============================================

// OpenAI client for verification
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Verify and correct email with OpenAI
async function verifyAndCorrectEmail(
  body: string, 
  subject: string, 
  senderId: string,
  recipientName: string,
  recipientCompany: string
): Promise<{ body: string; subject: string; wasFixed: boolean }> {
  const sender = getMemberById(senderId)
  if (!sender) {
    return { body, subject, wasFixed: false }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an email consistency checker. Your ONLY job is to ensure the sender name in the email matches the expected sender. Do NOT rewrite the email or change its content.`
        },
        {
          role: 'user',
          content: `Check this email for sender consistency issues.

EXPECTED SENDER: ${sender.name} (first name: ${sender.firstName})
RECIPIENT: ${recipientName}

SUBJECT: ${subject}

BODY:
${body}

RULES:
1. The email should say "I'm ${sender.firstName} from Astant" NOT any other team member's name
2. Do NOT change the writing style, tone, or any content
3. ONLY fix the sender's name if it's wrong
4. If the email already has the correct sender name, return it UNCHANGED

Return JSON only:
{
  "needsFix": true/false,
  "correctedBody": "the body with ONLY sender name fixed, or null if no fix needed"
}`
        }
      ],
      temperature: 0,
      max_tokens: 3000,
    })

    const content = response.choices[0]?.message?.content || '{}'
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    try {
      const parsed = JSON.parse(cleanContent)
      if (parsed.needsFix && parsed.correctedBody) {
        console.log(`[VERIFY] Fixed sender name inconsistency for ${senderId}`)
        return { body: parsed.correctedBody, subject, wasFixed: true }
      }
    } catch {
      // Parsing failed, return original
    }
  } catch (error) {
    console.error('[VERIFY] OpenAI verification failed:', error)
  }

  return { body, subject, wasFixed: false }
}

// Dynamic AI-powered bolding
async function applyDynamicBolding(
  text: string,
  context: { recipientName?: string; recipientFirm?: string; senderName?: string }
): Promise<string> {
  if (!text || text.length < 10) return text
  
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
      temperature: 0.1,
      max_tokens: 2000,
    })
    
    return response.choices[0]?.message?.content?.trim() || text
  } catch (error) {
    console.error('[DYNAMIC-BOLD] OpenAI error:', error)
    return text
  }
}

export async function POST(request: NextRequest) {
  console.log('[GENERATE-CLAUDE] Starting request...')
  try {
    const { 
      contact_id, 
      campaign_id, 
      signature,
      config = {},
    } = await request.json()
    
    console.log('[GENERATE-CLAUDE] Received:', { contact_id, campaign_id, config })

    // Preview mode for testing
    const isPreview = contact_id === 'preview' && campaign_id === 'preview'

    let contact: ContactData = {
      first_name: '[First Name]',
      firm: '[Company]',
      investment_focus: '[Investment Focus]'
    }
    let campaign: any = null
    
    // Default settings - will be overridden by campaign settings
    let templateId = config.template_id || 'jf-investor-outreach-v1'
    let senderId = config.sender_id || 'jean-francois'
    let mode = config.mode || 'quick'

    // Validate sender_id
    if (!VALID_SENDER_IDS.has(senderId)) {
      console.error('[GENERATE-CLAUDE] Invalid sender_id:', senderId)
      return NextResponse.json(
        { error: `Invalid sender_id: ${senderId}. Valid options: ${Array.from(VALID_SENDER_IDS).join(', ')}` },
        { status: 400 }
      )
    }

    if (!isPreview) {
      if (!contact_id || !campaign_id) {
        return NextResponse.json(
          { error: 'Missing contact_id or campaign_id' },
          { status: 400 }
        )
      }

      const supabase = createClient()

      // Get contact
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contact_id)
        .single()

      if (contactError || !contactData) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }
      contact = contactData as ContactData

      // Get campaign (optional - we can generate without it)
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaign_id)
        .single()

      // Campaign is optional - log warning but continue
      if (campaignError || !campaignData) {
        console.warn(`Campaign ${campaign_id} not found in database, continuing with default settings`)
      } else {
        campaign = campaignData
        
        // IMPORTANT: Read settings from campaign's global_context
        if (campaign.global_context) {
          try {
            const ctx = typeof campaign.global_context === 'string' 
              ? JSON.parse(campaign.global_context) 
              : campaign.global_context
            
            // Use campaign settings if not overridden by config
            if (ctx.sender_id && !config.sender_id) {
              senderId = ctx.sender_id
            }
            if (ctx.template_id && !config.template_id) {
              templateId = ctx.template_id
            }
          } catch (e) {
            console.warn('Failed to parse campaign global_context:', e)
          }
        }
        
        // Also check direct campaign fields
        if (campaign.sender_id && !config.sender_id) {
          senderId = campaign.sender_id
        }
      }
    }

    // ============================================
    // TEMPLATE RESOLUTION (Priority order):
    // 1. Campaign's own template_subject/template_body
    // 2. Custom template from custom_templates table (by UUID)
    // 3. Built-in master template (by ID like 'jf-investor-outreach-v1')
    // 4. Fallback to first master template
    // ============================================
    let template: any = null
    
    console.log('[GENERATE-CLAUDE] Template resolution - campaign:', {
      template_subject: campaign?.template_subject?.substring(0, 50),
      template_body: campaign?.template_body?.substring(0, 100),
      templateId,
    })
    
    // Priority 1: Use campaign's stored template if it has one
    if (campaign?.template_subject && campaign?.template_body) {
      console.log('[GENERATE-CLAUDE] ✅ Using campaign\'s stored template (Priority 1)')
      template = {
        id: `campaign-${campaign_id}`,
        name: campaign.name || 'Campaign Template',
        subject: campaign.template_subject,
        body: campaign.template_body,
        placeholders: [], // Will be detected dynamically
      }
    }
    
    // Priority 2: Check if templateId is a UUID (custom template)
    if (!template && templateId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId)) {
      console.log('[GENERATE-CLAUDE] Fetching custom template:', templateId)
      const supabase = createClient()
      const { data: customTemplate, error: customError } = await supabase
        .from('custom_templates')
        .select('*')
        .eq('id', templateId)
        .single()
      
      if (!customError && customTemplate) {
        console.log('[GENERATE-CLAUDE] Found custom template:', customTemplate.name)
        template = {
          id: customTemplate.id,
          name: customTemplate.name,
          subject: customTemplate.subject,
          body: customTemplate.body,
          placeholders: customTemplate.placeholders?.map((p: string) => ({ field: p, description: p, required: false })) || [],
        }
      }
    }
    
    // Priority 3: Built-in master template by ID
    if (!template) {
      template = getTemplateById(templateId) || MASTER_TEMPLATES[0]
      console.log('[GENERATE-CLAUDE] Using built-in template:', template?.id || 'default')
    }

    // Personalize the template
    let subject: string
    let body: string
    let modifications: Array<{ original: string; replacement: string; field: string }> = []
    let confidence: number

    if (mode === 'smart' && !isPreview) {
      // AI-assisted personalization (still very restrictive)
      const result = await personalizeTemplate(template, contact, senderId)
      subject = result.subject
      body = result.body
      modifications = result.modifications
      confidence = result.confidence
    } else {
      // Quick mode - pure string replacement, no AI
      const result = fallbackSubstitution(template, contact, senderId)
      subject = result.subject
      body = result.body
      modifications = result.modifications
      confidence = 100 // Direct substitution = 100% confidence
    }

    // ============================================
    // OPENAI VERIFICATION STEP
    // Ensure sender name consistency in the email
    // ============================================
    let wasVerified = false
    if (!isPreview && process.env.OPENAI_API_KEY) {
      const recipientName = contact.first_name || contact.name || 'Recipient'
      const recipientCompany = contact.firm || contact.company || ''
      
      const verified = await verifyAndCorrectEmail(
        body, 
        subject, 
        senderId, 
        recipientName, 
        recipientCompany
      )
      
      body = verified.body
      subject = verified.subject
      wasVerified = true
      
      if (verified.wasFixed) {
        console.log(`[VERIFY] Corrected email sender inconsistency`)
      }
    }

    // Body now includes signature via [SENDER_*] placeholders
    const fullBody = body

    console.log('[GENERATE-CLAUDE] ========== TEMPLATE PARSING DEBUG ==========')
    console.log('[GENERATE-CLAUDE] Raw body (first 300 chars):', JSON.stringify(body?.substring(0, 300)))
    console.log('[GENERATE-CLAUDE] Body length:', body?.length)

    // Parse body into structured format for GmailEmailComposer
    // Handle both plain text (split by \n\n) and HTML (split by </p><p> or </p>\s*<p>)
    let paragraphs: string[]
    
    // Check if body is HTML formatted (has <p> tags or list tags)
    const isHtmlBody = /<p[\s>]|<ul[\s>]|<ol[\s>]/i.test(body)
    
    if (isHtmlBody) {
      // HTML body - extract individual blocks (<p>, <ul>, <ol>)
      // This regex matches <p>...</p>, <ul>...</ul>, <ol>...</ol> blocks
      const blockMatches = body.match(/<(?:p|ul|ol)[^>]*>[\s\S]*?<\/(?:p|ul|ol)>/gi) || []
      // Filter out empty paragraphs (just <p></p> or <p>&nbsp;</p> or <p> </p>)
      paragraphs = blockMatches.filter(p => {
        const content = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        return content.length > 0
      })
      console.log('[GENERATE-CLAUDE] HTML body detected, extracted', paragraphs.length, 'non-empty blocks (p/ul/ol)')
    } else {
      // Plain text body - split by double newlines
      paragraphs = body.split(/\n\n+/).filter((p: string) => p.trim())
      console.log('[GENERATE-CLAUDE] Plain text body detected')
    }
    
    console.log('[GENERATE-CLAUDE] Paragraph count:', paragraphs.length)
    paragraphs.forEach((p, i) => {
      console.log(`[GENERATE-CLAUDE] Paragraph ${i}:`, JSON.stringify(p.substring(0, 100)))
    })
    
    // Intelligently split into sections:
    // - greeting: First paragraph (usually "Good morning [Name],")
    // - context_p1: Opening context and introduction
    // - value_p2: Value proposition and details
    // - cta: Closing call-to-action and sign-off
    
    let greeting = ''
    let context_p1 = ''
    let value_p2 = ''
    let cta = ''
    
    // Helper to check if a paragraph is just a greeting (short, ends with comma)
    const isGreetingParagraph = (p: string): boolean => {
      const text = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      // Match: Good morning Name, | Hi Name, | Hello Name, | Dear Name, etc.
      return /^(good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+[\w\s]+,?\s*$/i.test(text)
    }
    
    // Check if the template has lists - if so, don't split it, keep together
    const hasLists = /<ul[\s>]|<ol[\s>]|●|•|^\d+\./mi.test(body)
    
    if (hasLists && paragraphs.length >= 2) {
      // Template has bullet/numbered lists - keep body together to preserve formatting
      console.log('[GENERATE-CLAUDE] Template has lists, keeping body together')
      if (isGreetingParagraph(paragraphs[0])) {
        greeting = paragraphs[0]
        // Join all remaining paragraphs - they'll stay formatted
        context_p1 = paragraphs.slice(1).join(isHtmlBody ? '' : '\n\n')
      } else {
        // No clear greeting paragraph, put everything in context_p1
        context_p1 = paragraphs.join(isHtmlBody ? '' : '\n\n')
      }
    } else if (paragraphs.length >= 4) {
      greeting = paragraphs[0]
      // Find where the sign-off starts (usually last 2-3 paragraphs)
      const signOffIndex = paragraphs.findIndex((p, i) => 
        i > paragraphs.length / 2 && 
        (p.toLowerCase().includes('look forward') || 
         p.toLowerCase().includes('sincerely') ||
         p.toLowerCase().includes('best regards') ||
         p.toLowerCase().includes('at your disposal'))
      )
      
      const splitPoint = signOffIndex > 0 ? signOffIndex : Math.ceil(paragraphs.length * 0.6)
      context_p1 = paragraphs.slice(1, Math.ceil(splitPoint / 2) + 1).join(isHtmlBody ? '' : '\n\n')
      value_p2 = paragraphs.slice(Math.ceil(splitPoint / 2) + 1, splitPoint).join(isHtmlBody ? '' : '\n\n')
      cta = paragraphs.slice(splitPoint).join(isHtmlBody ? '' : '\n\n')
    } else if (paragraphs.length === 3) {
      greeting = paragraphs[0]
      context_p1 = paragraphs[1]
      cta = paragraphs[2]
    } else if (paragraphs.length === 2) {
      // Check if first paragraph is a greeting
      if (isGreetingParagraph(paragraphs[0])) {
        greeting = paragraphs[0]
        cta = paragraphs[1]
      } else {
        context_p1 = paragraphs[0]
        cta = paragraphs[1]
      }
    } else if (paragraphs.length === 1) {
      // Single paragraph - check if it starts with a greeting
      const singleParagraph = paragraphs[0]
      const text = singleParagraph.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      
      // Check for greeting pattern at start: "Good morning Name, ..."
      const greetingMatch = text.match(/^((?:good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+[\w\s]+),?\s*/i)
      
      if (greetingMatch) {
        console.log('[GENERATE-CLAUDE] Extracting greeting from single paragraph:', greetingMatch[0])
        greeting = greetingMatch[1] + ','
        // Remove the greeting from context_p1
        // For HTML, we need to remove the first <p> if it's just the greeting, or just the text
        if (isHtmlBody) {
          // Check if there's a separate <p> for the greeting
          const pMatches = singleParagraph.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
          // This shouldn't happen since we're in the length === 1 case, but handle it
          context_p1 = singleParagraph
        } else {
          context_p1 = text.substring(greetingMatch[0].length).trim()
        }
      } else {
        context_p1 = singleParagraph
      }
    }
    
    console.log('[GENERATE-CLAUDE] ========== AFTER SPLITTING ==========')
    console.log('[GENERATE-CLAUDE] greeting:', JSON.stringify(greeting?.substring(0, 100)))
    console.log('[GENERATE-CLAUDE] context_p1 (first 150):', JSON.stringify(context_p1?.substring(0, 150)))
    console.log('[GENERATE-CLAUDE] value_p2 (first 100):', JSON.stringify(value_p2?.substring(0, 100)))
    console.log('[GENERATE-CLAUDE] cta (first 100):', JSON.stringify(cta?.substring(0, 100)))
    
    // Check if context_p1 starts with the greeting (this would be a BUG)
    const greetingNormCheck = greeting?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const contextNormCheck = context_p1?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (greetingNormCheck && contextNormCheck && contextNormCheck.startsWith(greetingNormCheck)) {
      console.log('[GENERATE-CLAUDE] !!! BUG DETECTED: context_p1 starts with greeting !!!')
    }
    
    // Create structured email body
    // Apply important word bolding for better formatting
    // Options: 
    // - config.applyBolding = false: Disable auto-bolding (only convert **markdown** to <strong>)
    // - config.dynamicBolding = true: Use AI for smart bolding (slower but smarter)
    // - Default: Use static keyword bolding (fast) - auto-bold names, companies, etc.
    const additionalNames = isPreview ? [] : extractNamesFromContact(contact)
    const applyBolding = config.applyBolding !== false // Default to true (original behavior)
    const useDynamicBolding = config.dynamicBolding === true // Default to false (opt-in)
    
    // Get sender info for context
    const sender = getMemberById(senderId)
    const boldingContext = {
      recipientName: contact.first_name || contact.name,
      recipientFirm: contact.firm || contact.company,
      senderName: sender?.firstName || 'Astant team'
    }
    
    // Apply bolding based on configuration
    // Default: Auto-bold keywords and names (original behavior)
    // If applyBolding=false: Only convert **markdown bold** to <strong> tags
    let boldedGreeting = greeting
    let boldedContext = context_p1
    let boldedValue = value_p2
    let boldedCta = cta
    
    if (applyBolding) {
      if (useDynamicBolding && !isPreview) {
        // AI-powered dynamic bolding (smarter, but slower)
        console.log('[GENERATE-CLAUDE] Using dynamic AI bolding...')
        const [c, v, ct] = await Promise.all([
          applyDynamicBolding(context_p1, boldingContext),
          applyDynamicBolding(value_p2, boldingContext),
          applyDynamicBolding(cta, boldingContext)
        ])
        boldedContext = c
        boldedValue = v
        boldedCta = ct
      } else {
        // Static keyword bolding (fast) - DEFAULT
        boldedContext = boldImportantWords(context_p1, additionalNames)
        boldedValue = boldImportantWords(value_p2, additionalNames)
        boldedCta = boldImportantWords(cta, additionalNames)
      }
    } else {
      // Only convert **markdown** to <strong> when bolding is explicitly disabled
      boldedGreeting = convertMarkdownBold(greeting)
      boldedContext = convertMarkdownBold(context_p1)
      boldedValue = convertMarkdownBold(value_p2)
      boldedCta = convertMarkdownBold(cta)
    }
    
    // SAFEGUARD: Ensure greeting is not duplicated in context_p1
    // This can happen if the template parsing misses the separation
    if (boldedGreeting && boldedContext) {
      const normalizeForComparison = (s: string): string => 
        s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim().toLowerCase()
      
      const greetingNorm = normalizeForComparison(boldedGreeting)
      const contextNorm = normalizeForComparison(boldedContext)
      
      if (contextNorm.startsWith(greetingNorm) && greetingNorm.length > 5) {
        console.log('[GENERATE-CLAUDE] WARNING: Greeting found at start of context_p1, stripping...')
        console.log('[GENERATE-CLAUDE] Greeting:', greetingNorm)
        console.log('[GENERATE-CLAUDE] Context starts with:', contextNorm.substring(0, greetingNorm.length + 20))
        
        // Strip the greeting from context_p1
        // Find where the greeting ends in the original HTML
        const greetingWords = greetingNorm.split(/\s+/)
        let foundEnd = 0
        let wordIndex = 0
        const tempContent = boldedContext
        
        for (let i = 0; i < tempContent.length && wordIndex < greetingWords.length; i++) {
          // Skip HTML tags
          if (tempContent[i] === '<') {
            while (i < tempContent.length && tempContent[i] !== '>') i++
            continue
          }
          // Skip whitespace and punctuation
          if (/[\s,]/.test(tempContent[i])) continue
          
          // Check if we're at the start of the next greeting word
          const remaining = tempContent.substring(i).toLowerCase()
          if (remaining.startsWith(greetingWords[wordIndex])) {
            i += greetingWords[wordIndex].length - 1
            wordIndex++
            foundEnd = i + 1
          }
        }
        
        // Skip any trailing comma, whitespace, or newlines
        while (foundEnd < tempContent.length && /[\s,\n]/.test(tempContent[foundEnd])) foundEnd++
        
        boldedContext = tempContent.substring(foundEnd).trim()
        console.log('[GENERATE-CLAUDE] Stripped context_p1 now starts with:', boldedContext.substring(0, 50))
      }
    }
    
    const emailBody = {
      greeting: boldedGreeting,
      context_p1: boldedContext,
      value_p2: boldedValue,
      cta: boldedCta,
      signature: '',
      signatureMemberId: senderId,
      bannerEnabled: true, // Default to showing banner
    }

    // Save to database if not preview
    let emailId = crypto.randomUUID()

    if (!isPreview) {
      const supabase = createClient()
      
      console.log('[GENERATE-CLAUDE] Looking for contact_campaign:', { contact_id, campaign_id })
      
      // Retry logic to handle race condition when contact_campaign was just created
      let existingCC: { id: string } | null = null
      let ccLookupError: any = null
      const maxRetries = 3
      const retryDelay = 500 // ms
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const { data: ccRows, error } = await supabase
          .from('contact_campaigns')
          .select('id')
          .eq('contact_id', contact_id)
          .eq('campaign_id', campaign_id)
          .limit(1)
        
        ccLookupError = error
        existingCC = ccRows?.[0] || null
        
        if (existingCC) {
          console.log(`[GENERATE-CLAUDE] contact_campaign found on attempt ${attempt}:`, existingCC.id)
          break
        }
        
        if (attempt < maxRetries) {
          console.log(`[GENERATE-CLAUDE] contact_campaign not found, retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
      
      console.log('[GENERATE-CLAUDE] contact_campaign lookup result:', { existingCC, ccLookupError })

      if (existingCC) {
        // Convert numeric confidence to enum value
        const confidenceScore = confidenceToEnum(confidence)
        
        // Check for existing draft email to prevent duplicates
        const { data: existingEmails, error: existingEmailError } = await supabase
          .from('emails')
          .select('id, current_body')
          .eq('contact_campaign_id', existingCC.id)
          .eq('approved', false)
          .is('sent_at', null)
          .limit(1)
        
        if (existingEmailError) {
          console.warn('[GENERATE-CLAUDE] Failed to check for existing emails:', existingEmailError)
        }
        
        // If there's already a draft email, update it instead of creating a new one
        if (existingEmails && existingEmails.length > 0) {
          const existingEmail = existingEmails[0]
          console.log('[GENERATE-CLAUDE] Updating existing draft email:', existingEmail.id)
          
          const { data: updatedEmail, error: updateError } = await supabase
            .from('emails')
            .update({
              subject,
              original_body: emailBody,
              current_body: emailBody,
              confidence_score: confidenceScore,
              mutated_at: new Date().toISOString(),
            })
            .eq('id', existingEmail.id)
            .select()
            .single()
          
          if (updateError) {
            console.error('Failed to update email:', updateError)
            return NextResponse.json(
              { error: 'Failed to update email in database', details: updateError.message },
              { status: 500 }
            )
          }
          
          emailId = existingEmail.id
        } else {
          // No existing draft - create new email
          console.log('[GENERATE-CLAUDE] Inserting email for cc:', existingCC.id)
          
          const { data: email, error: emailError } = await supabase
            .from('emails')
            .insert({
              contact_campaign_id: existingCC.id,
              subject,
              original_body: emailBody,
              current_body: emailBody,
              confidence_score: confidenceScore,
              approved: false,
            })
            .select()
            .single()
          
          console.log('[GENERATE-CLAUDE] Email insert result:', { email: email?.id, emailError })

          if (emailError) {
            console.error('Failed to save email:', emailError)
            return NextResponse.json(
              { error: 'Failed to save email to database', details: emailError.message },
              { status: 500 }
            )
          }

          if (!email) {
            return NextResponse.json(
              { error: 'Email was not created' },
              { status: 500 }
            )
          }
          
          emailId = email.id
        }

        // Update contact_campaign with confidence score and sender
        await supabase
          .from('contact_campaigns')
          .update({ 
            confidence_score: confidenceScore,
            sender_id: senderId,
          })
          .eq('id', existingCC.id)
      } else {
        console.error('No contact_campaign found for contact_id:', contact_id, 'campaign_id:', campaign_id)
        return NextResponse.json(
          { error: 'No contact_campaign found. Ensure contact is added to campaign first.' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json({
      // Standard response fields
      email_id: emailId,
      subject,
      body: body,
      preview: emailBody,
      confidence,
      
      // Template info
      template_used: template.id,
      template_name: template.name,
      template_author: template.author,
      
      // What was personalized
      modifications,
      
      // Metadata
      sender_id: senderId,
      mode,
      engine: 'personalization-v1',
      is_preview: isPreview,
      
      // Philosophy reminder
      philosophy: 'modification-only',
      note: 'This email is Jean-François\'s proven template with only names/firms swapped.'
    })

  } catch (error: any) {
    console.error('Personalization error:', error)
    
    return NextResponse.json({
      error: error.message || 'Failed to personalize template',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}
