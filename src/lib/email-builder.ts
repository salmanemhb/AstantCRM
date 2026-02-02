/**
 * Email Builder - HTML/Text Email Construction
 * Extracted from send-email/route.ts to reduce file size
 * and enable reuse across the codebase
 */

import { getMemberById } from './signatures'
import { COMPANY_INFO } from './signatures'
import { getBannerHtml, type EmailBanner, DEFAULT_BANNER } from './email-formatting'
import { getSignatureHtml } from './signatures'
import { 
  stripDuplicateGreeting as sharedStripDuplicateGreeting,
  stripHtml as sharedStripHtml,
  hasBlockElements as sharedHasBlockElements,
  applyEmailStyles
} from './email-utils'
import { escapeHtml } from './validation'

// ============================================
// HTML EMAIL STYLES
// Centralized style definitions for consistency
// ============================================

export const EMAIL_STYLES = {
  paragraph: 'margin: 0 0 16px 0; line-height: 1.6; text-align: justify; text-justify: inter-word;',
  list: {
    ul: 'margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;',
    ol: 'margin: 0 0 16px 0; padding-left: 24px; list-style-type: decimal;',
    li: 'margin: 0 0 8px 0; line-height: 1.6;',
  },
  link: 'color: #0066cc; text-decoration: underline;',
  signature: 'margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;',
  footer: 'padding: 20px; text-align: center; font-size: 11px; color: #999999;',
}

// ============================================
// PARAGRAPH FORMATTING
// Convert text/HTML to styled email paragraphs
// ============================================

/**
 * Format text/HTML content into styled email paragraphs
 * Preserves allowed formatting tags while escaping dangerous content
 */
export function formatParagraph(text: string): string {
  if (!text) return ''
  
  // Check if content already has block-level HTML
  const hasBlockElements = /<(?:p|ul|ol|li|div)[\s>]/i.test(text)
  
  if (hasBlockElements) {
    // Content already has block structure - apply styles
    return text
      .replace(/<p(\s[^>]*)?>/gi, `<p style="${EMAIL_STYLES.paragraph}">`)
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="${EMAIL_STYLES.list.ul}">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="${EMAIL_STYLES.list.ol}">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="${EMAIL_STYLES.list.li}">`)
      .replace(/<p[^>]*>\s*<\/p>/gi, '') // Remove empty paragraphs
      .replace(/<a\s+([^>]*href="[^"]+")[^>]*>/gi, `<a $1 style="${EMAIL_STYLES.link}">`)
  }
  
  // Plain text - convert to HTML paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  
  return paragraphs.map(p => {
    // Tag placeholders for preserving allowed HTML
    const allowedTags = [
      { pattern: /<strong>/gi, placeholder: '%%STRONG_OPEN%%', restore: '<strong>' },
      { pattern: /<\/strong>/gi, placeholder: '%%STRONG_CLOSE%%', restore: '</strong>' },
      { pattern: /<em>/gi, placeholder: '%%EM_OPEN%%', restore: '<em>' },
      { pattern: /<\/em>/gi, placeholder: '%%EM_CLOSE%%', restore: '</em>' },
      { pattern: /<b>/gi, placeholder: '%%B_OPEN%%', restore: '<strong>' },
      { pattern: /<\/b>/gi, placeholder: '%%B_CLOSE%%', restore: '</strong>' },
      { pattern: /<i>/gi, placeholder: '%%I_OPEN%%', restore: '<em>' },
      { pattern: /<\/i>/gi, placeholder: '%%I_CLOSE%%', restore: '</em>' },
      { pattern: /<u>/gi, placeholder: '%%U_OPEN%%', restore: '<u>' },
      { pattern: /<\/u>/gi, placeholder: '%%U_CLOSE%%', restore: '</u>' },
      { pattern: /<\/a>/gi, placeholder: '%%LINK_CLOSE%%', restore: '</a>' },
      { pattern: /<br\s*\/?>/gi, placeholder: '%%BR%%', restore: '<br>' },
    ]
    
    let processed = p
    const linkHrefs: string[] = []
    
    // Extract links with their hrefs
    processed = processed.replace(/<a\s+[^>]*href="([^"]+)"[^>]*>/gi, (match, href) => {
      linkHrefs.push(href)
      return `%%LINK_OPEN_${linkHrefs.length - 1}%%`
    })
    
    // Replace tags with placeholders
    for (const tag of allowedTags) {
      processed = processed.replace(tag.pattern, tag.placeholder)
    }
    
    // Escape dangerous HTML
    processed = escapeHtml(processed)
    
    // Restore allowed tags
    for (const tag of allowedTags) {
      processed = processed.replace(new RegExp(tag.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tag.restore)
    }
    
    // Restore links
    linkHrefs.forEach((href, index) => {
      processed = processed.replace(
        `%%LINK_OPEN_${index}%%`,
        `<a href="${href}" style="${EMAIL_STYLES.link}">`
      )
    })
    
    // Convert newlines to <br>
    const formatted = processed.replace(/\n/g, '<br>')
    return `<p style="${EMAIL_STYLES.paragraph}">${formatted}</p>`
  }).join('')
}

// ============================================
// GREETING DETECTION & EXTRACTION
// ============================================

/**
 * Check if text starts with a greeting pattern
 */
export function startsWithGreeting(text: string): boolean {
  if (!text) return false
  const normalized = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return /^(good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+/i.test(normalized)
}

/**
 * Extract greeting from text if it starts with one
 */
export function extractGreetingFromText(text: string): { greeting: string; rest: string } {
  if (!text) return { greeting: '', rest: '' }
  
  // Try to find greeting in first <p> tag
  const pMatch = text.match(/^<p[^>]*>([\s\S]*?)<\/p>\s*/i)
  if (pMatch) {
    const firstPContent = pMatch[1]
    const normalized = firstPContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    
    // Check if first paragraph is just a greeting
    if (/^(good\s+morning|good\s+afternoon|good\s+evening|hi|hello|dear|hey)\s+[\w\s]+,?\s*$/i.test(normalized)) {
      let rest = text.substring(pMatch[0].length).replace(/^(?:<p[^>]*>\s*<\/p>\s*)+/gi, '')
      return { greeting: pMatch[0], rest }
    }
  }
  
  return { greeting: '', rest: text }
}

// ============================================
// HTML EMAIL BUILDER
// ============================================

export interface EmailBodyStructure {
  greeting?: string
  context_p1?: string
  value_p2?: string
  cta?: string
  signature?: string
  signatureMemberId?: string
  bannerEnabled?: boolean
}

export interface BuildHtmlEmailOptions {
  body: EmailBodyStructure
  contact: { first_name?: string; [key: string]: any }
  senderId: string
  banner?: EmailBanner
  includeUnsubscribe?: boolean
  unsubscribeUrl?: string
}

/**
 * Build a complete HTML email with proper structure and styling
 */
export function buildHtmlEmail(options: BuildHtmlEmailOptions): string {
  const { body, contact, senderId, banner, includeUnsubscribe = false, unsubscribeUrl } = options
  const firstName = contact?.first_name || 'there'
  const sender = getMemberById(senderId)
  
  // Get signature HTML
  const signatureHtml = getSignatureHtml(senderId, true)
  
  // Get banner HTML if enabled
  const bannerHtml = banner ? getBannerHtml(banner) : ''
  
  // Process greeting and body content
  let greetingOut: string
  let context1Cleaned: string
  
  if (body.greeting && body.greeting.trim()) {
    // Explicit greeting provided
    greetingOut = formatParagraph(body.greeting)
    context1Cleaned = sharedStripDuplicateGreeting(body.context_p1 || '', body.greeting)
  } else if (startsWithGreeting(body.context_p1 || '')) {
    // Extract greeting from context_p1
    const extracted = extractGreetingFromText(body.context_p1 || '')
    if (extracted.greeting) {
      greetingOut = formatParagraph(extracted.greeting.replace(/<\/?p[^>]*>/gi, ''))
      context1Cleaned = extracted.rest
    } else {
      greetingOut = formatParagraph(`Good morning ${firstName},`)
      context1Cleaned = body.context_p1 || ''
    }
  } else {
    // No greeting - use fallback
    greetingOut = formatParagraph(`Good morning ${firstName},`)
    context1Cleaned = body.context_p1 || ''
  }
  
  // Build email body parts
  const bodyParts = [
    greetingOut,
    formatParagraph(context1Cleaned),
    formatParagraph(body.value_p2 || ''),
    formatParagraph(body.cta || '')
  ].filter(Boolean).join('\n')
  
  // Build unsubscribe footer if enabled
  const unsubscribeHtml = includeUnsubscribe && unsubscribeUrl ? `
    <p style="margin: 10px 0 0 0; font-size: 11px;">
      <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from these emails</a>
    </p>
  ` : ''
  
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
        ${bodyParts}
        
        <!-- Signature Section -->
        <div style="${EMAIL_STYLES.signature}">
          ${signatureHtml}
        </div>
      </td>
    </tr>
  </table>
  
  <!-- Anti-spam footer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="${EMAIL_STYLES.footer}">
        <p style="margin: 0;">
          ${COMPANY_INFO.name}<br>
          ${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.country}
        </p>
        ${unsubscribeHtml}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// ============================================
// PLAIN TEXT EMAIL BUILDER
// ============================================

export interface BuildTextEmailOptions {
  body: EmailBodyStructure
  senderId: string
}

/**
 * Build plain text version of email
 */
export function buildTextEmail(options: BuildTextEmailOptions): string {
  const { body, senderId } = options
  const sender = getMemberById(senderId)
  
  const textSignature = sender ? `
${sender.name}
${sender.title}
${COMPANY_INFO.name}
${COMPANY_INFO.address}
${COMPANY_INFO.city}, ${COMPANY_INFO.country}
${sender.email}
${COMPANY_INFO.website}
` : body.signature || ''

  // Strip duplicate greeting from context
  const stripDuplicateGreetingText = (text: string, greeting: string): string => {
    if (!text) return ''
    
    const textClean = sharedStripHtml(text)
    
    if (greeting) {
      const cleaned = textClean
        .replace(/^(good\s+morning|good\s+afternoon|good\s+evening|hello|hi|dear)\s+[^,\n]+,?\s*\n*/i, '')
        .trim()
      
      return cleaned
    }
    
    return textClean
  }

  return [
    sharedStripHtml(body.greeting || ''),
    '',
    stripDuplicateGreetingText(body.context_p1 || '', body.greeting || ''),
    '',
    sharedStripHtml(body.value_p2 || ''),
    '',
    sharedStripHtml(body.cta || ''),
    '',
    '---',
    textSignature.trim()
  ].filter(Boolean).join('\n')
}
