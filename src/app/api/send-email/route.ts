import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { TEAM_MEMBERS, COMPANY_INFO, getSignatureHtml, getMemberById } from '@/lib/signatures'
import { getBannerHtml, type EmailBanner, DEFAULT_BANNER } from '@/lib/email-formatting'
import { EMAIL_CONFIG, getCCEmails, API_CONFIG } from '@/lib/config'
import { isValidEmail, escapeHtml, validateEmailForSend } from '@/lib/validation'
import { 
  stripDuplicateGreeting, 
  isGreetingParagraph, 
  extractGreetingFromHtml,
  hasBlockElements,
  applyEmailStyles,
  stripHtml,
  normalizeForComparison
} from '@/lib/email-utils'
import { createLogger } from '@/lib/logger'

// ============================================
// EMAIL SENDING API
// Single + Bulk email sending with rate limiting
// ============================================

const logger = createLogger('send-email')

// Initialize Resend
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Default sender for broadcasts/general emails
const FROM_DOMAIN = EMAIL_CONFIG.fromDomain
const DEFAULT_FROM_EMAIL = `info@${FROM_DOMAIN}`
const DEFAULT_FROM_NAME = COMPANY_INFO.name

// Rate limiting for bulk - from config
const BATCH_SIZE = EMAIL_CONFIG.rateLimit.batchSize
const BATCH_DELAY_MS = EMAIL_CONFIG.rateLimit.batchDelayMs

// Get sender info from team members
function getSenderFromId(senderId: string): { name: string; email: string; replyTo?: string } {
  const member = TEAM_MEMBERS.find(m => m.id === senderId)
  if (member) {
    return { name: member.name, email: member.email, replyTo: member.replyTo }
  }
  // Default to company email for broadcasts
  return { name: DEFAULT_FROM_NAME, email: DEFAULT_FROM_EMAIL }
}

interface SendEmailRequest {
  email_id: string
  dry_run?: boolean
}

interface BulkSendRequest {
  action: 'bulk'
  campaign_id: string
  email_ids?: string[]
  filter?: 'approved' | 'all'
  sender_id?: string
  dry_run?: boolean
}

export async function POST(request: NextRequest) {
  logger.info('=== POST Request Started ===')
  try {
    const reqBody = await request.json()
    logger.info('Request body:', JSON.stringify(reqBody, null, 2))
    
    // Check if this is a bulk operation
    if (reqBody.action === 'bulk') {
      logger.info('Handling bulk send operation')
      return handleBulkSend(reqBody as BulkSendRequest)
    }
    
    // Single email send
    const { email_id, dry_run = false } = reqBody as SendEmailRequest
    logger.info('Single email send:', { email_id, dry_run })

    if (!email_id) {
      logger.error('Missing email_id')
      return NextResponse.json(
        { success: false, error: 'email_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    logger.info('Fetching email data...')

    // Fetch email with related data
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select(`
        *,
        contact_campaign:contact_campaigns (
          *,
          contact:contacts (*),
          campaign:campaigns (*)
        )
      `)
      .eq('id', email_id)
      .single()

    if (emailError || !email) {
      logger.error('Email not found:', emailError)
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }
    logger.info('Email found:', { id: email.id, subject: email.subject })

    // Check if already sent
    if (email.sent_at) {
      logger.warn('Email already sent at:', email.sent_at)
      return NextResponse.json(
        { success: false, error: 'Email already sent' },
        { status: 400 }
      )
    }

    const contact = email.contact_campaign?.contact
    const campaign = email.contact_campaign?.campaign
    const toEmail = contact?.email
    logger.info('Recipient:', { contactId: contact?.id, toEmail, campaignId: campaign?.id })

    if (!toEmail) {
      logger.error('No recipient email address found')
      return NextResponse.json(
        { success: false, error: 'No recipient email address' },
        { status: 400 }
      )
    }

    // Validate recipient email format
    if (!isValidEmail(toEmail)) {
      logger.error('Invalid recipient email format:', toEmail)
      return NextResponse.json(
        { success: false, error: `Invalid recipient email format: ${toEmail}` },
        { status: 400 }
      )
    }

    // Validate email content before sending
    const emailBody = email.current_body || email.original_body
    const validation = validateEmailForSend({
      to: toEmail,
      subject: email.subject,
      body: emailBody
    })

    if (!validation.isValid) {
      logger.warn('Email validation failed:', validation)
      // Log warnings but don't block if only warnings
      if (validation.errors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Email validation failed', details: validation.errors },
          { status: 400 }
        )
      }
      // If only warnings, log and continue
      logger.info('Proceeding with warnings:', validation.warnings)
    }
    // Get sender from contact_campaign or campaign
    // PRIORITY: 1) signatureMemberId in email body (most recently selected), 
    //           2) contact_campaign.sender_id, 
    //           3) campaign.sender_id, 
    //           4) default
    // emailBody already defined above for validation
    
    logger.debug('========== EMAIL BODY FROM DATABASE ==========')
    logger.debug('emailBody.greeting:', JSON.stringify(emailBody?.greeting?.substring(0, 100)))
    logger.debug('emailBody.context_p1 (first 200):', JSON.stringify(emailBody?.context_p1?.substring(0, 200)))
    logger.debug('emailBody.value_p2 (first 100):', JSON.stringify(emailBody?.value_p2?.substring(0, 100)))
    logger.debug('emailBody.cta (first 100):', JSON.stringify(emailBody?.cta?.substring(0, 100)))
    
    // Check for greeting in context_p1 using shared utility
    const greetingNormDB = normalizeForComparison(emailBody?.greeting || '')
    const contextNormDB = normalizeForComparison(emailBody?.context_p1 || '')
    if (greetingNormDB && contextNormDB && contextNormDB.startsWith(greetingNormDB)) {
      logger.warn('!!! WARNING: Database has greeting duplicated in context_p1 !!!')
    }
    
    const senderId = emailBody?.signatureMemberId 
      || email.contact_campaign?.sender_id 
      || campaign?.sender_id 
      || 'jean-francois'
    const sender = getSenderFromId(senderId)
    logger.info('Sender:', sender, 'from signatureMemberId:', emailBody?.signatureMemberId)

    // Create banner config from email body settings
    logger.debug('Banner enabled?', emailBody?.bannerEnabled, 'Using banner URL:', DEFAULT_BANNER.imageUrl)
    const banner: EmailBanner | undefined = emailBody?.bannerEnabled 
      ? { ...DEFAULT_BANNER, enabled: true }
      : undefined
    
    const htmlBody = buildHtmlEmail(emailBody, contact, senderId, banner)
    const textBody = buildTextEmail(emailBody, senderId)

    // Fetch attachments if any
    const { data: attachments } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('email_id', email_id)

    let messageId: string | undefined

    // Get CC emails from config, filtering out sender and recipient
    const ccEmailList = getCCEmails().filter(cc => cc !== sender.email && cc !== toEmail)

    if (dry_run) {
      // Dry run - just log what would be sent
      logger.info('=== DRY RUN EMAIL ===')
      logger.info('From:', `${sender.name} <${sender.email}>`)
      logger.info('To:', toEmail)
      logger.info('CC:', ccEmailList.join(', '))
      logger.info('Subject:', email.subject)
      logger.info('Body preview:', textBody.substring(0, 200))
      logger.info('Attachments:', attachments?.length || 0)
      messageId = `dry-run-${Date.now()}`
    } else if (resend) {
      // Send via Resend SDK with proper headers for deliverability
      const resendPayload: any = {
        from: `${sender.name} <${sender.email}>`,
        to: [toEmail],
        cc: ccEmailList.length > 0 ? ccEmailList : undefined,
        subject: email.subject,
        html: htmlBody,
        text: textBody,
        // Reply-to ensures replies go to the sender (or their preferred reply address)
        reply_to: sender.replyTo || sender.email,
        // Headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': email_id,
          'X-Mailer': 'Astant CRM',
        },
        // Tags for Resend analytics
        tags: [
          { name: 'campaign', value: campaign?.id || 'direct' },
          { name: 'sender', value: senderId },
        ],
        // Enable tracking for opens and clicks
        tracking: {
          open: true,
          click: true,
        },
      }

      // Add attachments if present
      if (attachments && attachments.length > 0) {
        resendPayload.attachments = await Promise.all(
          attachments.map(async (att) => {
            // Fetch file from Supabase storage
            const { data: fileData } = await supabase.storage
              .from('email-attachments')
              .download(att.storage_path)
            
            if (fileData) {
              const buffer = await fileData.arrayBuffer()
              return {
                filename: att.file_name,
                content: Buffer.from(buffer).toString('base64'),
              }
            }
            return null
          })
        ).then(atts => atts.filter(Boolean))
      }

      const { data: sendResult, error: sendError } = await resend.emails.send(resendPayload)

      if (sendError) {
        logger.error('Resend API error:', sendError)
        throw new Error(sendError.message || 'Failed to send via Resend')
      }

      logger.info('Resend send successful:', sendResult)
      messageId = sendResult?.id
    } else {
      // No email provider configured - simulate send for demo
      logger.info('=== SIMULATED SEND (no RESEND_API_KEY configured) ===')
      logger.info('To:', toEmail)
      logger.info('Subject:', email.subject)
      messageId = `simulated-${Date.now()}`
    }

    // Update database with proper error handling
    // Since Supabase JS client doesn't support transactions directly,
    // we handle errors and attempt rollback if needed
    const sentAt = new Date().toISOString()
    logger.info('Updating database records...', { sentAt })

    // Step 1: Update email record (including resend_message_id for webhook tracking)
    const { error: emailUpdateError } = await supabase
      .from('emails')
      .update({ 
        sent_at: sentAt,
        approved: true,
        resend_message_id: messageId || null
      })
      .eq('id', email_id)

    if (emailUpdateError) {
      logger.error('Failed to update email record:', emailUpdateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update email record: ' + emailUpdateError.message },
        { status: 500 }
      )
    }
    logger.info('Email record updated successfully')

    // Step 2: Update contact_campaign stage and pipeline_stage
    logger.info('Updating contact_campaign stage...')
    const { error: ccUpdateError } = await supabase
      .from('contact_campaigns')
      .update({ stage: 'sent', pipeline_stage: 'sent' })
      .eq('id', email.contact_campaign_id)

    if (ccUpdateError) {
      logger.error('Failed to update contact_campaign, attempting rollback:', ccUpdateError)
      // Attempt to rollback email update
      const { error: rollbackError } = await supabase
        .from('emails')
        .update({ sent_at: null, approved: false })
        .eq('id', email_id)
      
      if (rollbackError) {
        logger.error('CRITICAL: Rollback failed! Email marked as sent but campaign not updated:', rollbackError)
        return NextResponse.json(
          { success: false, error: 'Failed to update campaign status and rollback failed. Manual intervention required.', details: { ccError: ccUpdateError.message, rollbackError: rollbackError.message } },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to update campaign status: ' + ccUpdateError.message },
        { status: 500 }
      )
    }

    // Step 3: Log engagement event (non-critical, don't fail the request)
    if (email.contact_campaign?.unified_thread_id) {
      const { error: eventError } = await supabase
        .from('engagement_events')
        .insert({
          unified_thread_id: email.contact_campaign.unified_thread_id,
          email_id: email_id,
          event_type: 'sent',
          metadata: { message_id: messageId, dry_run }
        })
      
      if (eventError) {
        logger.warn('Failed to log engagement event (non-critical):', eventError)
      }
    }

    // Step 4: Update analytics_daily for charts (non-critical)
    const today = new Date().toISOString().split('T')[0]
    const campaignId = email.contact_campaign?.campaign_id
    
    // Try RPC first, fallback to manual upsert
    const { error: rpcError } = await supabase.rpc('increment_daily_stat', {
      p_date: today,
      p_campaign_id: campaignId || null,
      p_field: 'emails_sent'
    })
    
    if (rpcError) {
      logger.warn('RPC failed, trying manual upsert:', rpcError)
      // Manual upsert fallback
      const { data: existing } = await supabase
        .from('analytics_daily')
        .select('id, emails_sent')
        .eq('date', today)
        .eq('campaign_id', campaignId)
        .single()
      
      if (existing) {
        await supabase
          .from('analytics_daily')
          .update({ emails_sent: (existing.emails_sent || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('analytics_daily')
          .insert({ date: today, campaign_id: campaignId, emails_sent: 1 })
      }
    }

    return NextResponse.json({
      success: true,
      email_id,
      sent_to: toEmail,
      sent_at: sentAt,
      message_id: messageId,
      dry_run,
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

function buildHtmlEmail(body: any, contact: any, senderId: string, banner?: EmailBanner): string {
  const firstName = contact?.first_name || 'there'
  const sender = getMemberById(senderId)
  
  // Get the HTML signature with the logo
  const signatureHtml = getSignatureHtml(senderId, true) // true = use absolute URL
  
  // Get banner HTML if enabled
  const bannerHtml = banner ? getBannerHtml(banner) : ''
  
  // Helper to remove duplicate greeting from context_p1 if it matches the greeting field
  // This fixes the issue where pasted templates have greeting in both fields
  const stripDuplicateGreeting = (text: string, greeting: string): string => {
    if (!text || !greeting) return text
    
    console.log('[stripDuplicateGreeting] === STARTING GREETING STRIP ===')
    console.log('[stripDuplicateGreeting] Input text (first 200):', JSON.stringify(text.substring(0, 200)))
    console.log('[stripDuplicateGreeting] Greeting:', JSON.stringify(greeting))
    
    // Normalize function - strip HTML tags, extra spaces, and common punctuation variations
    const normalize = (s: string): string => {
      return s
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/\s+/g, ' ')    // Collapse whitespace
        .replace(/[,\s]+$/, '')  // Remove trailing comma and spaces
        .trim()
        .toLowerCase()
    }
    
    const greetingNorm = normalize(greeting)
    console.log('[stripDuplicateGreeting] Normalized greeting:', JSON.stringify(greetingNorm))
    
    // Check if context_p1 starts with the greeting (plain text comparison)
    const textNorm = normalize(text)
    console.log('[stripDuplicateGreeting] Normalized text start:', JSON.stringify(textNorm.substring(0, 100)))
    
    if (!textNorm.startsWith(greetingNorm)) {
      console.log('[stripDuplicateGreeting] No match - text does not start with greeting')
      return text
    }
    
    console.log('[stripDuplicateGreeting] MATCH FOUND - greeting is at start of context_p1!')
    
    // We need to remove the greeting from the original HTML
    // Strategy: Find the first paragraph tag (or first sentence) and remove it
    let cleaned = text
    
    // Case 1: Content starts with <p> tag containing the greeting
    const pTagMatch = cleaned.match(/^<p[^>]*>([\s\S]*?)<\/p>\s*/i)
    if (pTagMatch) {
      const firstParagraphContent = pTagMatch[1]
      const firstParagraphNorm = normalize(firstParagraphContent)
      console.log('[stripDuplicateGreeting] First <p> content:', JSON.stringify(firstParagraphNorm))
      
      // If the first paragraph is the greeting, remove it entirely
      if (firstParagraphNorm === greetingNorm || 
          greetingNorm.startsWith(firstParagraphNorm) || 
          firstParagraphNorm.startsWith(greetingNorm)) {
        console.log('[stripDuplicateGreeting] Removing first <p> tag (contains greeting)')
        cleaned = cleaned.substring(pTagMatch[0].length).trim()
      }
    }
    
    // Case 2: Plain text greeting at start (no <p> tag)
    if (!pTagMatch) {
      // Find where greeting ends in the original text
      // Build a regex that matches the greeting words with possible HTML tags in between
      const greetingWords = greetingNorm.split(/\s+/)
      let regexStr = '^\\s*'
      for (let i = 0; i < greetingWords.length; i++) {
        // Escape special regex chars
        const word = greetingWords[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regexStr += word
        if (i < greetingWords.length - 1) {
          // Allow HTML tags and whitespace between words
          regexStr += '(?:<[^>]*>|\\s|,)*'
        }
      }
      regexStr += '[,\\s]*(?:\\n|<br\\s*/?>)*'
      
      const greetingRegex = new RegExp(regexStr, 'i')
      console.log('[stripDuplicateGreeting] Trying regex:', regexStr.substring(0, 100))
      
      const match = cleaned.match(greetingRegex)
      if (match) {
        console.log('[stripDuplicateGreeting] Regex matched:', JSON.stringify(match[0].substring(0, 50)))
        cleaned = cleaned.substring(match[0].length).trim()
      }
    }
    
    // Remove any remaining empty paragraphs at the start
    cleaned = cleaned.replace(/^(?:<p[^>]*>\s*<\/p>\s*)+/gi, '')
    
    // Clean up leading whitespace/newlines
    cleaned = cleaned.replace(/^[\s\n]+/, '')
    
    console.log('[stripDuplicateGreeting] Final cleaned text (first 200):', JSON.stringify(cleaned.substring(0, 200)))
    return cleaned
  }
  
  // Convert text to HTML paragraphs
  // IMPORTANT: Preserve allowed formatting tags (<strong>, <em>, <a>) while escaping dangerous content
  const formatParagraph = (text: string) => {
    if (!text) return ''
    
    // Check if content already has block-level HTML (from TipTap HTML)
    // This includes <p>, <ul>, <ol>, <li>, <div>, etc.
    const hasBlockElements = /<(?:p|ul|ol|li|div)[\s>]/i.test(text)
    
    if (hasBlockElements) {
      // Content already has block structure - clean and style it
      // This handles TipTap output that's already HTML formatted
      return text
        // Add styling to existing <p> tags (handle both <p> and <p ...>)
        .replace(/<p(\s[^>]*)?>/gi, '<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify; text-justify: inter-word;">')
        // Add styling to <ul> lists
        .replace(/<ul(\s[^>]*)?>/gi, '<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">')
        // Add styling to <ol> lists
        .replace(/<ol(\s[^>]*)?>/gi, '<ol style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: decimal;">')
        // Add styling to <li> items
        .replace(/<li(\s[^>]*)?>/gi, '<li style="margin: 0 0 8px 0; line-height: 1.6;">')
        // Remove empty paragraphs
        .replace(/<p[^>]*>\s*<\/p>/gi, '')
        // Ensure links have proper styling
        .replace(/<a\s+([^>]*href="[^"]+")[^>]*>/gi, '<a $1 style="color: #0066cc; text-decoration: underline;">')
    }
    
    // Plain text or text without <p> tags - convert to HTML paragraphs
    // Split by double newlines for paragraph breaks
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
    
    return paragraphs.map(p => {
      // Preserve safe HTML formatting tags while escaping dangerous content
      // Step 1: Temporarily replace allowed tags with placeholders
      const allowedTags: Array<{ pattern: RegExp, replacement: string, placeholder: string }> = [
        { pattern: /<strong>/gi, replacement: '<strong>', placeholder: '%%STRONG_OPEN%%' },
        { pattern: /<\/strong>/gi, replacement: '</strong>', placeholder: '%%STRONG_CLOSE%%' },
        { pattern: /<em>/gi, replacement: '<em>', placeholder: '%%EM_OPEN%%' },
        { pattern: /<\/em>/gi, replacement: '</em>', placeholder: '%%EM_CLOSE%%' },
        { pattern: /<b>/gi, replacement: '<strong>', placeholder: '%%B_OPEN%%' },
        { pattern: /<\/b>/gi, replacement: '</strong>', placeholder: '%%B_CLOSE%%' },
        { pattern: /<i>/gi, replacement: '<em>', placeholder: '%%I_OPEN%%' },
        { pattern: /<\/i>/gi, replacement: '</em>', placeholder: '%%I_CLOSE%%' },
        { pattern: /<u>/gi, replacement: '<u>', placeholder: '%%U_OPEN%%' },
        { pattern: /<\/u>/gi, replacement: '</u>', placeholder: '%%U_CLOSE%%' },
        { pattern: /<\/a>/gi, replacement: '</a>', placeholder: '%%LINK_CLOSE%%' },
        // Handle <br>, <br/>, and <br /> tags
        { pattern: /<br\s*\/?>/gi, replacement: '<br>', placeholder: '%%BR%%' },
      ]
      
      let processed = p
      const linkHrefs: string[] = []
      
      // Extract and preserve links with their hrefs
      // TipTap outputs: <a target="_blank" rel="..." class="..." href="URL">
      // Standard HTML: <a href="URL">
      // We need to handle BOTH formats - href can be anywhere in the tag
      processed = processed.replace(/<a\s+[^>]*href="([^"]+)"[^>]*>/gi, (match, href) => {
        linkHrefs.push(href)
        return `%%LINK_OPEN_${linkHrefs.length - 1}%%`
      })
      
      // Replace other allowed tags with placeholders
      for (const tag of allowedTags.filter(t => !t.pattern.source.includes('<a'))) {
        processed = processed.replace(tag.pattern, tag.placeholder)
      }
      
      // Escape dangerous HTML
      processed = escapeHtml(processed)
      
      // Restore allowed tags
      processed = processed.replace(/%%STRONG_OPEN%%/g, '<strong>')
      processed = processed.replace(/%%STRONG_CLOSE%%/g, '</strong>')
      processed = processed.replace(/%%EM_OPEN%%/g, '<em>')
      processed = processed.replace(/%%EM_CLOSE%%/g, '</em>')
      processed = processed.replace(/%%B_OPEN%%/g, '<strong>')
      processed = processed.replace(/%%B_CLOSE%%/g, '</strong>')
      processed = processed.replace(/%%I_OPEN%%/g, '<em>')
      processed = processed.replace(/%%I_CLOSE%%/g, '</em>')
      processed = processed.replace(/%%U_OPEN%%/g, '<u>')
      processed = processed.replace(/%%U_CLOSE%%/g, '</u>')
      processed = processed.replace(/%%LINK_CLOSE%%/g, '</a>')
      processed = processed.replace(/%%BR%%/g, '<br>')
      
      // Restore links with their hrefs
      linkHrefs.forEach((href, index) => {
        processed = processed.replace(
          `%%LINK_OPEN_${index}%%`,
          `<a href="${href}" style="color: #0066cc; text-decoration: underline;">`
        )
      })
      
      // Convert newlines to <br>
      const formatted = processed.replace(/\n/g, '<br>')
      return `<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify; text-justify: inter-word;">${formatted}</p>`
    }).join('')
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Message from ${sender?.name || 'Astant Global Management'}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    td {padding: 0;}
    p {text-align: justify !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333;">
  ${bannerHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 30px 20px; text-align: justify;">
        <!-- Email Body -->
        ${(() => {
          // DEBUG: Log body structure to understand the issue
          console.log('[BUILD-HTML] ========== EMAIL BODY DEBUG ==========')
          console.log('[BUILD-HTML] body.greeting:', JSON.stringify(body.greeting))
          console.log('[BUILD-HTML] body.context_p1 (first 200 chars):', JSON.stringify(body.context_p1?.substring(0, 200)))
          console.log('[BUILD-HTML] body.value_p2 (first 100 chars):', JSON.stringify(body.value_p2?.substring(0, 100)))
          
          // Helper to check if text starts with a greeting pattern
          const startsWithGreeting = (text: string): boolean => {
            if (!text) return false
            const normalized = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
            return /^(good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+/i.test(normalized)
          }
          
          // Helper to extract greeting from text if it starts with one
          const extractGreetingFromText = (text: string): { greeting: string, rest: string } => {
            if (!text) return { greeting: '', rest: '' }
            
            // Try to find greeting in first <p> tag
            const pMatch = text.match(/^<p[^>]*>([\s\S]*?)<\/p>\s*/i)
            if (pMatch) {
              const firstPContent = pMatch[1]
              const normalized = firstPContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
              
              // Check if first paragraph is just a greeting (ends with comma or is very short)
              if (/^(good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+[\w\s]+,?\s*$/i.test(normalized)) {
                console.log('[BUILD-HTML] Extracted greeting from context_p1:', JSON.stringify(pMatch[0]))
                // Remove empty paragraphs after the greeting
                let rest = text.substring(pMatch[0].length).replace(/^(?:<p[^>]*>\s*<\/p>\s*)+/gi, '')
                return { greeting: pMatch[0], rest }
              }
            }
            
            return { greeting: '', rest: text }
          }
          
          let greetingOut: string
          let context1Cleaned: string
          
          if (body.greeting && body.greeting.trim()) {
            // We have an explicit greeting - use it and strip from context_p1
            greetingOut = formatParagraph(body.greeting)
            context1Cleaned = stripDuplicateGreeting(body.context_p1 || '', body.greeting)
            console.log('[BUILD-HTML] Using explicit greeting from body.greeting')
          } else if (startsWithGreeting(body.context_p1 || '')) {
            // No explicit greeting but context_p1 starts with one - extract it
            const extracted = extractGreetingFromText(body.context_p1 || '')
            if (extracted.greeting) {
              greetingOut = formatParagraph(extracted.greeting.replace(/<\/?p[^>]*>/gi, ''))
              context1Cleaned = extracted.rest
              console.log('[BUILD-HTML] Extracted greeting from context_p1, NOT adding fallback')
            } else {
              // Fallback - couldn't extract cleanly
              greetingOut = formatParagraph(`Good morning ${firstName},`)
              context1Cleaned = body.context_p1 || ''
              console.log('[BUILD-HTML] Could not extract greeting cleanly, using fallback')
            }
          } else {
            // No greeting anywhere - use fallback
            greetingOut = formatParagraph(`Good morning ${firstName},`)
            context1Cleaned = body.context_p1 || ''
            console.log('[BUILD-HTML] No greeting found, using fallback')
          }
          
          console.log('[BUILD-HTML] Final greeting (first 100):', JSON.stringify(greetingOut?.substring(0, 100)))
          console.log('[BUILD-HTML] Final context_p1 (first 200):', JSON.stringify(context1Cleaned?.substring(0, 200)))
          
          const parts = [
            greetingOut,
            formatParagraph(context1Cleaned),
            formatParagraph(body.value_p2 || ''),
            formatParagraph(body.cta || '')
          ].filter(Boolean).join('\n')
          
          return parts
        })()}
        
        <!-- Signature Section -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
          ${signatureHtml}
        </div>
      </td>
    </tr>
  </table>
  
  <!-- Anti-spam footer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 20px; text-align: center; font-size: 11px; color: #999999;">
        <p style="margin: 0;">
          ${COMPANY_INFO.name}<br>
          ${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.country}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function buildTextEmail(body: any, senderId: string): string {
  const sender = getMemberById(senderId)
  
  // Helper to strip HTML tags and convert to plain text
  const stripHtml = (html: string): string => {
    if (!html) return ''
    return html
      // Replace </p><p> with double newlines (paragraph breaks)
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      // Replace <br> with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  
  const textSignature = sender ? `
${sender.name}
${sender.title}
${COMPANY_INFO.name}
${COMPANY_INFO.address}
${COMPANY_INFO.city}, ${COMPANY_INFO.country}
${sender.email}
${COMPANY_INFO.website}
` : body.signature || ''

  // Helper to strip duplicate greeting from context_p1
  const stripDuplicateGreetingText = (text: string, greeting: string): string => {
    if (!text) return ''
    
    const textClean = stripHtml(text)
    
    // If we have a greeting, strip ANY greeting pattern from start
    if (greeting) {
      // Remove greeting patterns from start
      const cleaned = textClean
        .replace(/^(good\s+morning|good\s+afternoon|good\s+evening|hello|hi|dear)\s+[^,\n]+,?\s*\n*/i, '')
        .trim()
      
      return cleaned
    }
    
    return textClean
  }

  return [
    stripHtml(body.greeting),
    '',
    stripDuplicateGreetingText(body.context_p1, body.greeting),
    '',
    stripHtml(body.value_p2),
    '',
    stripHtml(body.cta),
    '',
    '---',
    textSignature.trim()
  ].filter(Boolean).join('\n')
}

// ============================================
// BULK SEND HANDLER
// For sending 100s or 1000s of emails
// Sequential sending with rate limiting for Resend API
// ============================================

async function handleBulkSend(request: BulkSendRequest) {
  const { campaign_id, email_ids, filter = 'approved', sender_id, dry_run = false } = request

  const supabase = createClient()

  // Build query for emails in this campaign
  let query = supabase
    .from('emails')
    .select(`
      *,
      contact_campaign:contact_campaigns!inner(
        *,
        campaign_id,
        contact:contacts(*)
      )
    `)
    .eq('contact_campaigns.campaign_id', campaign_id)
    .is('sent_at', null) // Not already sent

  // Filter by specific IDs if provided
  if (email_ids && email_ids.length > 0) {
    query = query.in('id', email_ids)
  }

  // Filter by approval status
  if (filter === 'approved') {
    query = query.eq('approved', true)
  }

  const { data: emails, error: emailsError } = await query

  if (emailsError) {
    return NextResponse.json({ success: false, error: emailsError.message }, { status: 500 })
  }

  if (!emails || emails.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No emails found to send',
      filter_used: filter
    }, { status: 404 })
  }

  // RATE LIMITING CONFIGURATION
  // Resend free tier: 2 requests/second
  // We send at ~1.5 req/sec to stay safely under the limit
  const DELAY_BETWEEN_EMAILS_MS = 700  // 700ms = ~1.4 emails/sec

  // Dry run - return what would be sent
  if (dry_run) {
    const estimatedTimeSeconds = Math.ceil(emails.length * DELAY_BETWEEN_EMAILS_MS / 1000)
    return NextResponse.json({
      success: true,
      dry_run: true,
      would_send: emails.length,
      emails: emails.map(e => ({
        id: e.id,
        to: e.contact_campaign?.contact?.email,
        subject: e.subject,
        contact_name: `${e.contact_campaign?.contact?.first_name} ${e.contact_campaign?.contact?.last_name}`
      })),
      estimated_time: `${estimatedTimeSeconds}s (~${Math.ceil(estimatedTimeSeconds / 60)} minutes)`
    })
  }

  // Track results
  const results = {
    total: emails.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ email_id: string; error: string }>,
    message_ids: [] as string[]
  }

  // Get sender info - use sender_id from request, or fallback to campaign's sender
  const campaign = emails[0]?.contact_campaign?.campaign
  const effectiveSenderId = sender_id || campaign?.sender_id || 'jean-francois'
  const senderInfo = getSenderFromId(effectiveSenderId)

  // RATE LIMITING: Send emails SEQUENTIALLY with retry logic
  // Resend free tier: 2 requests/second, we send at ~1.4/sec to be safe
  const MAX_RETRIES = 3
  const RETRY_BASE_DELAY_MS = 2000

  logger.info(`Starting sequential bulk send of ${emails.length} emails at ~1.4/sec rate`)

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i]
    const contact = email.contact_campaign?.contact
    const toEmail = contact?.email

    if (!toEmail) {
      results.skipped++
      results.errors.push({ email_id: email.id, error: 'No recipient email' })
      continue
    }

    const emailBody = email.current_body || email.original_body
    
    // Use per-email sender from emailBody, or fall back to request sender_id, then campaign sender
    const emailSenderId = emailBody?.signatureMemberId || effectiveSenderId
    const emailSenderInfo = getSenderFromId(emailSenderId)
    
    const textBody = buildTextEmail(emailBody, emailSenderId)
    
    // Create banner config from email body settings  
    const emailBanner: EmailBanner | undefined = emailBody?.bannerEnabled 
      ? { ...DEFAULT_BANNER, enabled: true }
      : undefined
    
    const htmlBody = buildHtmlEmail(emailBody, contact, emailSenderId, emailBanner)

    // Fetch attachments if any (same as single send)
    const { data: attachments } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('email_id', email.id)

    // Send with retry logic for rate limit errors
    let retryCount = 0
    let success = false
    let messageId: string = ''

    while (retryCount <= MAX_RETRIES && !success) {
      try {
        if (resend) {
          // Build send payload using per-email sender
          const resendPayload: any = {
            from: `${emailSenderInfo.name} <${emailSenderInfo.email}>`,
            to: [toEmail],
            subject: email.subject,
            text: textBody,
            html: htmlBody,
            replyTo: emailSenderInfo.replyTo || emailSenderInfo.email,
            tags: [
              { name: 'campaign', value: campaign_id },
              { name: 'contact', value: contact.id }
            ],
            tracking: {
              open: true,
              click: true,
            },
          }

          // Add attachments if present
          if (attachments && attachments.length > 0) {
            resendPayload.attachments = await Promise.all(
              attachments.map(async (att) => {
                const { data: fileData } = await supabase.storage
                  .from('email-attachments')
                  .download(att.storage_path)
                
                if (fileData) {
                  const buffer = await fileData.arrayBuffer()
                  return {
                    filename: att.file_name,
                    content: Buffer.from(buffer).toString('base64'),
                  }
                }
                return null
              })
            ).then(atts => atts.filter(Boolean))
          }

          // Send via Resend SDK
          const { data: sendResult, error: sendError } = await resend.emails.send(resendPayload)

          if (sendError) {
            // Check if it's a rate limit error
            if (sendError.message?.includes('rate') || sendError.message?.includes('429') || sendError.message?.includes('Too many')) {
              if (retryCount < MAX_RETRIES) {
                const retryDelay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount)
                logger.warn(`Rate limited on email ${email.id}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
                await new Promise(resolve => setTimeout(resolve, retryDelay))
                retryCount++
                continue
              }
            }
            throw new Error(sendError.message)
          }

          messageId = sendResult?.id || `resend-${Date.now()}`
          success = true
        } else {
          // Simulated send (no API key)
          console.log(`[SIMULATED] Sending to ${toEmail}: ${email.subject}`)
          messageId = `simulated-${Date.now()}-${Math.random().toString(36).slice(2)}`
          success = true
        }

        // Update database
        const sentAt = new Date().toISOString()

        await supabase
          .from('emails')
          .update({ sent_at: sentAt, approved: true, resend_message_id: messageId })
          .eq('id', email.id)

        await supabase
          .from('contact_campaigns')
          .update({ stage: 'sent', pipeline_stage: 'sent' })
          .eq('id', email.contact_campaign.id)

        // Update analytics_daily for batch sends
        const today = new Date().toISOString().split('T')[0]
        try {
          await supabase.rpc('increment_daily_stat', {
            p_date: today,
            p_campaign_id: email.contact_campaign.campaign_id || null,
            p_field: 'emails_sent'
          })
        } catch (e) {
          // Non-critical, ignore errors
        }

        results.sent++
        results.message_ids.push(messageId)

      } catch (err: any) {
        if (retryCount < MAX_RETRIES) {
          const retryDelay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount)
          logger.warn(`Error sending email ${email.id}, retrying in ${retryDelay}ms: ${err.message}`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          retryCount++
        } else {
          results.failed++
          results.errors.push({ email_id: email.id, error: err.message })
          break
        }
      }
    }

    // Log progress every 10 emails
    if ((i + 1) % 10 === 0) {
      logger.info(`Bulk send progress: ${i + 1}/${emails.length} processed (${results.sent} sent, ${results.failed} failed)`)
    }

    // Add delay between emails (not after the last one)
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS))
    }
  }

  logger.info(`Bulk send completed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`)

  return NextResponse.json({
    success: true,
    stats: results,
    resend_configured: !!resend,
    rate_limit: {
      emails_per_second: 1.4,
      delay_ms: DELAY_BETWEEN_EMAILS_MS
    }
  })
}
