// ============================================
// EMAIL FORMATTING ENGINE
// Detects and bolds important words/names
// 
// V2: Now supports both static bolding (fast) and
// dynamic OpenAI-powered bolding (smart)
// ============================================

// Convert **markdown bold** to <strong> tags
export function convertMarkdownBold(text: string): string {
  if (!text) return text
  // Replace **text** with <strong>text</strong>
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

// Important keywords that should be bolded in emails
const IMPORTANT_KEYWORDS = [
  // Company names and terms
  'Astant',
  'Astant Global',
  'Astant Global Management',
  'OpenMacro',
  // Publications and Recognition
  'Forbes',
  'Forbes Italia',
  'TechCrunch',
  'Bloomberg',
  'Financial Times',
  // Educational/Institutions
  'IE',
  'IE Business School',
  'Harvard',
  'Stanford',
  'MIT',
  'Wharton',
  // Financial/Investment terms
  'Series A',
  'Series B',
  'Series C',
  'seed round',
  'pre-seed',
  'pre-scaling',
  'fundraise',
  'investment',
  'venture capital',
  'VC',
  'portfolio',
  'fund',
  'AUM',
  'IRR',
  'returns',
  'institutional capital',
  'retail capital',
  // Important business terms
  'partnership',
  'collaboration',
  'opportunity',
  'exclusive',
  'strategic',
  'global',
  'expansion',
  'founding team',
  'flagship',
  'AI-driven',
  // Metrics
  '$1M',
  '$5M',
  '$10M',
  '$50M',
  '$100M',
  '$1B',
  // Call to action terms
  'meeting',
  'call',
  'connect',
  'discuss',
  '15-minute',
  '20 minutes',
  '30-minute',
]

// Detect if a word is a proper name (starts with capital, not at sentence start)
function isPossibleName(word: string, isStartOfSentence: boolean): boolean {
  if (!word || word.length < 2) return false
  if (isStartOfSentence) return false
  
  // Check if first letter is capital and rest has lowercase
  const firstChar = word.charAt(0)
  const rest = word.slice(1)
  
  return (
    firstChar === firstChar.toUpperCase() &&
    firstChar !== firstChar.toLowerCase() &&
    /[a-z]/.test(rest) &&
    !/^(The|This|That|These|Those|It|We|Our|Your|Their|I|A|An|And|But|Or|If|When|What|How|Why|Where|Who)$/i.test(word)
  )
}

// Bold important words in text
export function boldImportantWords(text: string, additionalNames: string[] = []): string {
  if (!text) return text
  
  // First, convert any **markdown bold** to <strong> tags
  let result = convertMarkdownBold(text)
  
  // Create a combined list of terms to bold
  const termsToMatch = [...IMPORTANT_KEYWORDS, ...additionalNames]
  
  // Sort by length (longest first) to avoid partial replacements
  termsToMatch.sort((a, b) => b.length - a.length)
  
  // Bold specific terms (case-insensitive but preserve original case)
  for (const term of termsToMatch) {
    const regex = new RegExp(`\\b(${escapeRegex(term)})\\b`, 'gi')
    result = result.replace(regex, '<strong>$1</strong>')
  }
  
  // Bold proper names (words starting with capital not at sentence start)
  // This is done sentence by sentence
  const sentences = result.split(/(?<=[.!?])\s+/)
  result = sentences.map(sentence => {
    const words = sentence.split(/(\s+)/)
    let isFirst = true
    
    return words.map(word => {
      // Skip whitespace
      if (/^\s+$/.test(word)) return word
      
      // Skip already bolded
      if (word.includes('<strong>')) {
        isFirst = false
        return word
      }
      
      // Check for proper name
      const cleanWord = word.replace(/[.,!?;:'"()]/g, '')
      if (isPossibleName(cleanWord, isFirst)) {
        const bolded = word.replace(cleanWord, `<strong>${cleanWord}</strong>`)
        isFirst = false
        return bolded
      }
      
      isFirst = false
      return word
    }).join('')
  }).join(' ')
  
  return result
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================
// DYNAMIC OPENAI-POWERED BOLDING
// Uses AI to intelligently decide what to bold
// ============================================

/**
 * Use OpenAI to dynamically bold important words in email text
 * This is smarter than static keywords - it understands context
 * 
 * @param text - The email text to process
 * @param context - Optional context (contact name, firm, sender name)
 * @returns Promise<string> - Text with <strong> tags added
 */
export async function dynamicBoldWithAI(
  text: string,
  context: {
    recipientName?: string
    recipientFirm?: string
    senderName?: string
  } = {}
): Promise<string> {
  if (!text || text.length < 10) return text
  
  // This will be called from API routes where OpenAI is available
  // For client-side, we fall back to static bolding
  try {
    const response = await fetch('/api/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bold',
        text,
        context
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      return result.text || text
    }
  } catch {
    // Fall back to static bolding
  }
  
  return boldImportantWords(text, [
    context.recipientName,
    context.recipientFirm,
    context.senderName
  ].filter(Boolean) as string[])
}

/**
 * Server-side OpenAI bolding function
 * To be used in API routes with direct OpenAI access
 */
export function createAIBoldingPrompt(text: string, context: {
  recipientName?: string
  recipientFirm?: string
  senderName?: string
}): string {
  return `You are a professional email formatter. Your job is to add <strong> tags around important words and phrases in this email text.

CONTEXT:
- Recipient: ${context.recipientName || 'Unknown'} from ${context.recipientFirm || 'Unknown'}
- Sender: ${context.senderName || 'Astant team member'}

RULES FOR BOLDING:
1. Bold the recipient's name and firm name
2. Bold important company names (Astant, Forbes, IE, OpenMacro, etc.)
3. Bold key metrics and numbers ($1M, Series A, 2,000 applications, etc.)
4. Bold important action words (meeting, call, partnership, opportunity)
5. Bold dates and times when mentioned
6. DO NOT bold common words or articles (the, a, we, our, etc.)
7. DO NOT over-bold - less is more
8. Keep the exact same text, only add <strong></strong> tags

TEXT TO FORMAT:
${text}

Return ONLY the formatted text with <strong> tags. No explanations.`
}

// Extract names from contact data for additional bolding
export function extractNamesFromContact(contact: any): string[] {
  const names: string[] = []
  
  if (contact?.first_name) names.push(contact.first_name)
  if (contact?.last_name) names.push(contact.last_name)
  if (contact?.first_name && contact?.last_name) {
    names.push(`${contact.first_name} ${contact.last_name}`)
  }
  if (contact?.company) names.push(contact.company)
  
  return names.filter(n => n && n.length > 2)
}

// Format email body with bolding and structure
export function formatEmailWithBolding(body: any, contact?: any): any {
  const names = contact ? extractNamesFromContact(contact) : []
  
  return {
    greeting: convertMarkdownBold(body.greeting || ''), // Convert markdown in greeting
    context_p1: boldImportantWords(body.context_p1 || '', names),
    value_p2: boldImportantWords(body.value_p2 || '', names),
    cta: boldImportantWords(body.cta || '', names),
    signature: convertMarkdownBold(body.signature || ''), // Convert markdown in signature
    signatureMemberId: body.signatureMemberId,
    bannerEnabled: body.bannerEnabled,
  }
}

// ============================================
// EMAIL BANNER CONFIGURATION
// ============================================

import { SUPABASE_PROJECT_ID } from './signatures'

// Supabase-hosted banner URL (upload astant.jpg to Supabase storage)
export const BANNER_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/public-assets/astant-banner.jpg`

export interface EmailBanner {
  enabled: boolean
  imageUrl: string
  linkUrl?: string
  altText: string
  height?: number
}

export const DEFAULT_BANNER: EmailBanner = {
  enabled: false,
  imageUrl: BANNER_URL,
  linkUrl: 'https://www.astantglobal.com',
  altText: 'Astant Global Management',
  height: 120,
}

// Generate professional email header with banner
// Optimized for ALL email clients including Outlook (which uses Word's rendering engine)
export function getBannerHtml(banner: EmailBanner): string {
  if (!banner.enabled || !banner.imageUrl) return ''
  
  // Outlook requirements:
  // - Explicit width AND height on images (no "auto")
  // - Use width attribute, not max-width CSS
  // - MSO conditional comments for Outlook-specific fixes
  // - No role="presentation" (can cause issues)
  return `
<!-- Email Header Banner -->
<!--[if mso]>
<table cellpadding="0" cellspacing="0" border="0" width="600" align="center">
<tr><td>
<![endif]-->
<table cellpadding="0" cellspacing="0" border="0" width="600" align="center" style="width: 600px; margin: 0 auto;">
  <tr>
    <td align="center" style="padding: 0;">
      <!-- Top accent bar -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td height="4" style="height: 4px; background-color: #1a365d; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>
      
      <!-- Banner image container -->
      ${banner.linkUrl ? `<a href="${banner.linkUrl}" target="_blank" style="text-decoration: none;">` : ''}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#1a202c" style="background-color: #1a202c;">
        <tr>
          <td align="center" style="padding: 16px 20px;">
            <!--[if mso]>
            <img src="${banner.imageUrl}" alt="${banner.altText}" width="320" height="80" style="display: block; border: 0;" />
            <![endif]-->
            <!--[if !mso]><!-->
            <img src="${banner.imageUrl}" alt="${banner.altText}" width="320" height="80" style="display: block; width: 320px; height: auto; max-height: 120px; border: 0; outline: none;" />
            <!--<![endif]-->
          </td>
        </tr>
      </table>
      ${banner.linkUrl ? '</a>' : ''}
      
      <!-- Bottom border -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td height="1" style="height: 1px; background-color: #e2e8f0; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!--[if mso]>
</td></tr>
</table>
<![endif]-->
<table cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td height="20" style="height: 20px; font-size: 1px; line-height: 1px;">&nbsp;</td></tr></table>
<!-- End Email Header Banner -->
`
}

// Alternative: Simple centered banner without accent
export function getSimpleBannerHtml(banner: EmailBanner): string {
  if (!banner.enabled || !banner.imageUrl) return ''
  
  const imgTag = `<img src="${banner.imageUrl}" alt="${banner.altText}" width="500" style="display: block; width: 100%; max-width: 500px; height: auto; margin: 0 auto; border: 0;" />`
  
  if (banner.linkUrl) {
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
  <tr>
    <td style="padding: 20px 20px 30px 20px; text-align: center;">
      <a href="${banner.linkUrl}" target="_blank" style="display: inline-block;">
        ${imgTag}
      </a>
    </td>
  </tr>
</table>`
  }
  
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
  <tr>
    <td style="padding: 20px 20px 30px 20px; text-align: center;">
      ${imgTag}
    </td>
  </tr>
</table>`
}
