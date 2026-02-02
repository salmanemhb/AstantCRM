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
  
  // Allow all-caps acronyms (2-4 characters) like IE, MIT, VC
  const isAcronym = word.length >= 2 && word.length <= 4 && /^[A-Z]+$/.test(word)
  if (isAcronym && !isStartOfSentence) {
    return true
  }
  
  return (
    firstChar === firstChar.toUpperCase() &&
    firstChar !== firstChar.toLowerCase() &&
    /[a-z]/.test(rest) &&
    !/^(The|This|That|These|Those|It|We|Our|Your|Their|I|A|An|And|But|Or|If|When|What|How|Why|Where|Who)$/i.test(word)
  )
}

// Bold important words in text
export function boldImportantWords(text: string, additionalNames: string[] = []): string {
  if (!text) return ''
  
  // First, convert any **markdown bold** to <strong> tags
  let result = convertMarkdownBold(text)
  
  // If text already has <strong> tags throughout, skip auto-bolding to prevent nesting
  const AUTO_BOLD_THRESHOLD = 3
  const strongCount = (result.match(/<strong>/gi) || []).length
  if (strongCount > AUTO_BOLD_THRESHOLD) {
    // Already has significant bolding, don't add more
    return result
  }
  
  // Create a combined list of terms to bold
  const termsToMatch = [...IMPORTANT_KEYWORDS, ...additionalNames]
  
  // Sort by length (longest first) to avoid partial replacements
  termsToMatch.sort((a, b) => b.length - a.length)
  
  // Bold specific terms (case-insensitive but preserve original case)
  // Skip if already wrapped in <strong> tags
  for (const term of termsToMatch) {
    try {
      // Use negative lookbehind/lookahead to avoid double-wrapping (modern browsers)
      const regex = new RegExp(`(?<!<strong[^>]*>)\\b(${escapeRegex(term)})\\b(?![^<]*</strong>)`, 'gi')
      result = result.replace(regex, '<strong>$1</strong>')
    } catch {
      // Fallback for older browsers (Safari <16.4) that don't support lookbehind
      const simpleRegex = new RegExp(`\\b(${escapeRegex(term)})\\b`, 'gi')
      result = result.replace(simpleRegex, (match, p1, offset) => {
        // Check if already inside a <strong> tag by looking backwards
        const before = result.substring(Math.max(0, offset - 50), offset)
        if (before.includes('<strong>') && !before.includes('</strong>')) {
          return match // Already inside strong tag
        }
        return `<strong>${p1}</strong>`
      })
    }
  }
  
  // Bold proper names (words starting with capital not at sentence start)
  // This is done sentence by sentence
  // Use a compatible sentence split (avoid lookbehind for Safari <16.4)
  let sentences: string[]
  try {
    sentences = result.split(/(?<=[.!?])\s+/)
  } catch {
    // Fallback: split on sentence-ending punctuation followed by space
    sentences = result.split(/([.!?])\s+/).reduce((acc: string[], part, i, arr) => {
      if (i % 2 === 0) {
        // Content part - combine with next punctuation if exists
        acc.push(part + (arr[i + 1] || ''))
      }
      return acc
    }, [])
  }
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
  } catch (err) {
    // Fall back to static bolding
    console.warn('[dynamicBoldWithAI] API call failed, falling back to static bolding:', err)
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
// 
// DIMENSIONS:
// - Desktop Gmail/Outlook: 600px container, 560px banner image
// - Mobile: Scales to 100% width with max-width constraint
// - Aspect Ratio: 5:1 recommended (e.g., 600x120)
// - Image should be 1200px wide for retina displays, scaled to 600px
export function getBannerHtml(banner: EmailBanner): string {
  if (!banner.enabled || !banner.imageUrl) return ''
  
  // Optimal dimensions for email banners:
  // - Container: 600px (email standard)
  // - Image display: 600px wide, height auto based on image ratio
  // - Actual image file: 1200x525 for retina (@2x) - OpenMacro banner
  const containerWidth = 600
  const imageWidth = 600  // Full width of container for better mobile scaling
  const imageHeight = 262 // Matches OpenMacro banner ratio (1200x525 / 2)
  
  return `
<!-- Email Header Banner -->
<!--[if mso]>
<table cellpadding="0" cellspacing="0" border="0" width="${containerWidth}" align="center">
<tr><td>
<![endif]-->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: ${containerWidth}px; margin: 0 auto;">
  <tr>
    <td align="center" style="padding: 0;">
      <!-- Top accent bar -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td height="4" style="height: 4px; background-color: #1a365d; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>
      
      <!-- Banner image container with dark background -->
      ${banner.linkUrl ? `<a href="${banner.linkUrl}" target="_blank" style="text-decoration: none; display: block;">` : ''}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#1a202c" style="background-color: #1a202c;">
        <tr>
          <td align="center" style="padding: 8px 0;">
            <!--[if mso]>
            <img src="${banner.imageUrl}" alt="${banner.altText}" width="${imageWidth}" height="${imageHeight}" style="display: block; border: 0; width: ${imageWidth}px; height: ${imageHeight}px;" />
            <![endif]-->
            <!--[if !mso]><!-->
            <img src="${banner.imageUrl}" alt="${banner.altText}" style="display: block; width: 100%; max-width: ${imageWidth}px; height: auto; border: 0; outline: none;" />
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
<!-- Spacer after banner -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: ${containerWidth}px; margin: 0 auto;"><tr><td height="16" style="height: 16px; font-size: 1px; line-height: 1px;">&nbsp;</td></tr></table>
<!-- End Email Header Banner -->
`
}

// Alternative: Simple centered banner without accent
// Uses same responsive scaling for mobile compatibility
export function getSimpleBannerHtml(banner: EmailBanner): string {
  if (!banner.enabled || !banner.imageUrl) return ''
  
  // Same dimensions for consistency
  const containerWidth = 600
  const imageWidth = 600
  
  const imgTag = `<img src="${banner.imageUrl}" alt="${banner.altText}" width="${imageWidth}" style="display: block; width: 100%; max-width: ${imageWidth}px; height: auto; margin: 0 auto; border: 0;" />`
  
  if (banner.linkUrl) {
    return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: ${containerWidth}px; margin: 0 auto;">
  <tr>
    <td style="padding: 16px; text-align: center;">
      <a href="${banner.linkUrl}" target="_blank" style="display: inline-block; text-decoration: none;">
        ${imgTag}
      </a>
    </td>
  </tr>
</table>`
  }
  
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: ${containerWidth}px; margin: 0 auto;">
  <tr>
    <td style="padding: 16px; text-align: center;">
      ${imgTag}
    </td>
  </tr>
</table>`
}
