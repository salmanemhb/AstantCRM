import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { TEAM_MEMBERS, COMPANY_INFO, getSignatureHtml, getMemberById } from '@/lib/signatures'
import { getBannerHtml, type EmailBanner, DEFAULT_BANNER } from '@/lib/email-formatting'

// ============================================
// EMAIL SENDING API
// Single + Bulk email sending with rate limiting
// ============================================

// Initialize Resend
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Default sender for broadcasts/general emails
const FROM_DOMAIN = process.env.FROM_DOMAIN || 'astantglobal.com'
const DEFAULT_FROM_EMAIL = `info@${FROM_DOMAIN}`
const DEFAULT_FROM_NAME = COMPANY_INFO.name

// Rate limiting for bulk: 10 emails/second
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1100

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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
  console.log('[SEND-EMAIL] === POST Request Started ===')
  try {
    const reqBody = await request.json()
    console.log('[SEND-EMAIL] Request body:', JSON.stringify(reqBody, null, 2))
    
    // Check if this is a bulk operation
    if (reqBody.action === 'bulk') {
      console.log('[SEND-EMAIL] Handling bulk send operation')
      return handleBulkSend(reqBody as BulkSendRequest)
    }
    
    // Single email send
    const { email_id, dry_run = false } = reqBody as SendEmailRequest
    console.log('[SEND-EMAIL] Single email send:', { email_id, dry_run })

    if (!email_id) {
      console.error('[SEND-EMAIL] Missing email_id')
      return NextResponse.json(
        { success: false, error: 'email_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    console.log('[SEND-EMAIL] Fetching email data...')

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
      console.error('[SEND-EMAIL] Email not found:', emailError)
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }
    console.log('[SEND-EMAIL] Email found:', { id: email.id, subject: email.subject })

    // Check if already sent
    if (email.sent_at) {
      console.warn('[SEND-EMAIL] Email already sent at:', email.sent_at)
      return NextResponse.json(
        { success: false, error: 'Email already sent' },
        { status: 400 }
      )
    }

    const contact = email.contact_campaign?.contact
    const campaign = email.contact_campaign?.campaign
    const toEmail = contact?.email
    console.log('[SEND-EMAIL] Recipient:', { contactId: contact?.id, toEmail, campaignId: campaign?.id })

    if (!toEmail) {
      console.error('[SEND-EMAIL] No recipient email address found')
      return NextResponse.json(
        { success: false, error: 'No recipient email address' },
        { status: 400 }
      )
    }

    // Get sender from contact_campaign or campaign
    // PRIORITY: 1) signatureMemberId in email body (most recently selected), 
    //           2) contact_campaign.sender_id, 
    //           3) campaign.sender_id, 
    //           4) default
    const emailBody = email.current_body || email.original_body
    const senderId = emailBody?.signatureMemberId 
      || email.contact_campaign?.sender_id 
      || campaign?.sender_id 
      || 'jean-francois'
    const sender = getSenderFromId(senderId)
    console.log('[SEND-EMAIL] Sender:', sender, 'from signatureMemberId:', emailBody?.signatureMemberId)

    // Create banner config from email body settings
    console.log('[SEND-EMAIL] Banner enabled?', emailBody?.bannerEnabled, 'Using banner URL:', DEFAULT_BANNER.imageUrl)
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

    if (dry_run) {
      // Dry run - just log what would be sent
      console.log('=== DRY RUN EMAIL ===')
      console.log('From:', `${sender.name} <${sender.email}>`)
      console.log('To:', toEmail)
      console.log('Subject:', email.subject)
      console.log('Body preview:', textBody.substring(0, 200))
      console.log('Attachments:', attachments?.length || 0)
      messageId = `dry-run-${Date.now()}`
    } else if (resend) {
      // Send via Resend SDK with proper headers for deliverability
      const resendPayload: any = {
        from: `${sender.name} <${sender.email}>`,
        to: [toEmail],
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
        console.error('[SEND-EMAIL] Resend API error:', sendError)
        throw new Error(sendError.message || 'Failed to send via Resend')
      }

      console.log('[SEND-EMAIL] Resend send successful:', sendResult)
      messageId = sendResult?.id
    } else {
      // No email provider configured - simulate send for demo
      console.log('[SEND-EMAIL] === SIMULATED SEND (no RESEND_API_KEY configured) ===')
      console.log('[SEND-EMAIL] To:', toEmail)
      console.log('[SEND-EMAIL] Subject:', email.subject)
      messageId = `simulated-${Date.now()}`
    }

    // Update database with proper error handling
    // Since Supabase JS client doesn't support transactions directly,
    // we handle errors and attempt rollback if needed
    const sentAt = new Date().toISOString()
    console.log('[SEND-EMAIL] Updating database records...', { sentAt })

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
      console.error('[SEND-EMAIL] Failed to update email record:', emailUpdateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update email record: ' + emailUpdateError.message },
        { status: 500 }
      )
    }
    console.log('[SEND-EMAIL] Email record updated successfully')

    // Step 2: Update contact_campaign stage and pipeline_stage
    console.log('[SEND-EMAIL] Updating contact_campaign stage...')
    const { error: ccUpdateError } = await supabase
      .from('contact_campaigns')
      .update({ stage: 'sent', pipeline_stage: 'sent' })
      .eq('id', email.contact_campaign_id)

    if (ccUpdateError) {
      console.error('[SEND-EMAIL] Failed to update contact_campaign, attempting rollback:', ccUpdateError)
      // Attempt to rollback email update
      const { error: rollbackError } = await supabase
        .from('emails')
        .update({ sent_at: null, approved: false })
        .eq('id', email_id)
      
      if (rollbackError) {
        console.error('[SEND-EMAIL] CRITICAL: Rollback failed! Email marked as sent but campaign not updated:', rollbackError)
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
        console.warn('[SEND-EMAIL] Failed to log engagement event (non-critical):', eventError)
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
      console.warn('[SEND-EMAIL] RPC failed, trying manual upsert:', rpcError)
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
  
  // Convert text to HTML paragraphs
  // IMPORTANT: Preserve allowed formatting tags (<strong>, <em>, <a>) while escaping dangerous content
  const formatParagraph = (text: string) => {
    if (!text) return ''
    
    // Check if content already has <p> tags (from TipTap HTML)
    const hasExistingPTags = /<p[\s>]/i.test(text)
    
    if (hasExistingPTags) {
      // Content already has paragraph structure - clean and style it
      // This handles TipTap output that's already HTML formatted
      return text
        // Add styling to existing <p> tags (handle both <p> and <p ...>)
        .replace(/<p(\s[^>]*)?>/gi, '<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify; text-justify: inter-word;">')
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
        ${formatParagraph(body.greeting || `Good morning ${firstName},`)}
        ${formatParagraph(body.context_p1 || '')}
        ${formatParagraph(body.value_p2 || '')}
        ${formatParagraph(body.cta || '')}
        
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

  return [
    stripHtml(body.greeting),
    '',
    stripHtml(body.context_p1),
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

  // Dry run - return what would be sent
  if (dry_run) {
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
      estimated_time: `${Math.ceil(emails.length / BATCH_SIZE) * (BATCH_DELAY_MS / 1000)}s`
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

  // Process in batches with rate limiting
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map(async (email) => {
      const contact = email.contact_campaign?.contact
      const toEmail = contact?.email

      if (!toEmail) {
        results.skipped++
        results.errors.push({ email_id: email.id, error: 'No recipient email' })
        return
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

      try {
        let messageId: string

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
            throw new Error(sendError.message)
          }

          messageId = sendResult?.id || `resend-${Date.now()}`
        } else {
          // Simulated send (no API key)
          console.log(`[SIMULATED] Sending to ${toEmail}: ${email.subject}`)
          messageId = `simulated-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
        results.failed++
        results.errors.push({ email_id: email.id, error: err.message })
      }
    })

    await Promise.all(batchPromises)

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < emails.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return NextResponse.json({
    success: true,
    stats: results,
    resend_configured: !!resend,
    rate_limit: {
      batch_size: BATCH_SIZE,
      delay_ms: BATCH_DELAY_MS
    }
  })
}
