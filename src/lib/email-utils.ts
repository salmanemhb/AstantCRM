// ============================================
// SHARED EMAIL UTILITIES
// Extracted common patterns used across:
// - send-email/route.ts
// - generate-claude/route.ts
// - gmail-email-composer.tsx
// ============================================

import { createLogger } from './logger'

const log = createLogger('[EMAIL-UTILS]')

// ============================================
// GREETING DETECTION & EXTRACTION
// ============================================

/**
 * Common greeting patterns
 */
const GREETING_PATTERNS = [
  /^good\s+morning/i,
  /^good\s+afternoon/i,
  /^good\s+evening/i,
  /^hi\s+/i,
  /^hello\s+/i,
  /^dear\s+/i,
  /^hey\s+/i,
]

/**
 * Check if a paragraph is just a greeting
 * Returns true if the paragraph is a short greeting like "Good morning Sarah,"
 */
export function isGreetingParagraph(paragraph: string): boolean {
  if (!paragraph) return false
  
  // Strip HTML tags and normalize whitespace
  const text = stripHtml(paragraph).trim()
  
  // Empty or too short
  if (text.length < 3) return false
  
  // Too long to be just a greeting (greetings are typically < 50 chars)
  if (text.length > 60) return false
  
  // Check against greeting patterns
  const hasGreetingStart = GREETING_PATTERNS.some(pattern => pattern.test(text))
  
  // Should end with comma or be short enough
  const endsWithComma = text.endsWith(',')
  const isShortEnough = text.split(/\s+/).length <= 5
  
  return hasGreetingStart && (endsWithComma || isShortEnough)
}

/**
 * Extract greeting from the beginning of text
 * Returns { greeting, remainingText }
 */
export function extractGreeting(text: string): { greeting: string; remainingText: string } {
  if (!text) return { greeting: '', remainingText: '' }
  
  const plainText = stripHtml(text).trim()
  
  // Try to find greeting pattern with name
  const greetingMatch = plainText.match(/^((?:good\s+(?:morning|afternoon|evening)|hi|hello|dear|hey)\s+[\w\s]+),?\s*/i)
  
  if (greetingMatch) {
    const greeting = greetingMatch[1].trim()
    const greetingWithComma = greeting.endsWith(',') ? greeting : greeting + ','
    
    // Calculate where to cut the original text
    const greetingEndIndex = greetingMatch[0].length
    const remainingText = plainText.substring(greetingEndIndex).trim()
    
    log.debug('Extracted greeting:', greetingWithComma)
    
    return { greeting: greetingWithComma, remainingText }
  }
  
  return { greeting: '', remainingText: text }
}

/**
 * Extract greeting from HTML content
 * Handles <p> tags properly
 */
export function extractGreetingFromHtml(html: string): { greeting: string; remainingHtml: string } {
  if (!html) return { greeting: '', remainingHtml: '' }
  
  // Try to find first <p> tag
  const firstPMatch = html.match(/^(\s*<p[^>]*>[\s\S]*?<\/p>)/i)
  
  if (firstPMatch) {
    const firstParagraph = firstPMatch[1]
    
    if (isGreetingParagraph(firstParagraph)) {
      const greeting = stripHtml(firstParagraph).trim()
      const remainingHtml = html.substring(firstPMatch[0].length).trim()
      
      log.debug('Extracted greeting from HTML:', greeting)
      
      return { greeting, remainingHtml }
    }
  }
  
  // No <p> tag found, try plain text extraction and convert result
  const textResult = extractGreeting(html)
  return { greeting: textResult.greeting, remainingHtml: textResult.remainingText }
}

/**
 * Remove duplicate greeting from context if it matches
 */
export function stripDuplicateGreeting(text: string, greeting: string): string {
  if (!text || !greeting) return text
  
  const normalizedGreeting = normalizeForComparison(greeting)
  const normalizedText = normalizeForComparison(text)
  
  // Check if text starts with the greeting
  if (!normalizedText.startsWith(normalizedGreeting)) {
    return text
  }
  
  log.debug('Found duplicate greeting at start of text, stripping...')
  
  // Find where greeting ends in the original text
  // Handle HTML case: look for first <p> that contains greeting
  const pTagMatch = text.match(/^<p[^>]*>([\s\S]*?)<\/p>\s*/i)
  
  if (pTagMatch) {
    const firstPContent = normalizeForComparison(pTagMatch[1])
    
    if (firstPContent === normalizedGreeting || 
        normalizedGreeting.startsWith(firstPContent) || 
        firstPContent.startsWith(normalizedGreeting)) {
      return text.substring(pTagMatch[0].length).trim()
    }
  }
  
  // Plain text case: find the greeting and remove it
  const greetingWords = normalizedGreeting.split(/\s+/)
  let foundEnd = 0
  let wordIndex = 0
  
  for (let i = 0; i < text.length && wordIndex < greetingWords.length; i++) {
    // Skip HTML tags
    if (text[i] === '<') {
      while (i < text.length && text[i] !== '>') i++
      continue
    }
    // Skip whitespace and punctuation
    if (/[\s,]/.test(text[i])) continue
    
    // Check if we're at the next greeting word
    const remaining = text.substring(i).toLowerCase()
    if (remaining.startsWith(greetingWords[wordIndex])) {
      i += greetingWords[wordIndex].length - 1
      wordIndex++
      foundEnd = i + 1
    }
  }
  
  // Skip trailing comma, whitespace, newlines
  while (foundEnd < text.length && /[\s,\n]/.test(text[foundEnd])) {
    foundEnd++
  }
  
  return text.substring(foundEnd).trim()
}

// ============================================
// HTML UTILITIES
// ============================================

/**
 * Strip HTML tags from text
 */
export function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize text for comparison (lowercase, no extra whitespace, no punctuation)
 */
export function normalizeForComparison(text: string): string {
  if (!text) return ''
  return stripHtml(text)
    .toLowerCase()
    .replace(/[,\s]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

/**
 * Check if text contains HTML block elements
 */
export function hasBlockElements(html: string): boolean {
  return /<(?:p|ul|ol|li|div|h[1-6])[\s>]/i.test(html)
}

/**
 * Check if text contains HTML list elements
 */
export function hasListElements(html: string): boolean {
  return /<(?:ul|ol|li)[\s>]/i.test(html)
}

/**
 * Extract HTML blocks (paragraphs, lists) from HTML content
 */
export function extractHtmlBlocks(html: string): string[] {
  if (!html) return []
  
  // Match <p>...</p>, <ul>...</ul>, <ol>...</ol> blocks
  const blockMatches = html.match(/<(?:p|ul|ol)[^>]*>[\s\S]*?<\/(?:p|ul|ol)>/gi) || []
  
  // Filter out empty paragraphs
  return blockMatches.filter(block => {
    const content = stripHtml(block)
    return content.length > 0
  })
}

/**
 * Convert plain text to HTML paragraphs
 */
export function textToHtml(text: string): string {
  if (!text) return ''
  
  // If already has block elements, return as-is
  if (hasBlockElements(text)) {
    return text
  }
  
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  
  return paragraphs
    .map(p => {
      // Convert single newlines to <br>
      const formatted = p.trim().replace(/\n/g, '<br>')
      return `<p>${formatted}</p>`
    })
    .join('\n')
}

/**
 * Convert HTML to plain text (for text version of email)
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  
  return html
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert </p> to double newline
    .replace(/<\/p>/gi, '\n\n')
    // Convert </li> to newline with bullet
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ============================================
// EMAIL STYLING
// ============================================

/**
 * Default paragraph style for emails
 */
export const PARAGRAPH_STYLE = 'margin: 0 0 16px 0; line-height: 1.6; text-align: justify; text-justify: inter-word;'

/**
 * Default list styles
 */
export const UL_STYLE = 'margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;'
export const OL_STYLE = 'margin: 0 0 16px 0; padding-left: 24px; list-style-type: decimal;'
export const LI_STYLE = 'margin: 0 0 8px 0; line-height: 1.6;'

/**
 * Apply consistent styling to HTML elements
 */
export function applyEmailStyles(html: string): string {
  if (!html) return ''
  
  return html
    // Style paragraphs
    .replace(/<p(\s[^>]*)?>/gi, `<p style="${PARAGRAPH_STYLE}">`)
    // Style unordered lists
    .replace(/<ul(\s[^>]*)?>/gi, `<ul style="${UL_STYLE}">`)
    // Style ordered lists
    .replace(/<ol(\s[^>]*)?>/gi, `<ol style="${OL_STYLE}">`)
    // Style list items
    .replace(/<li(\s[^>]*)?>/gi, `<li style="${LI_STYLE}">`)
    // Style links
    .replace(/<a\s+([^>]*href="[^"]+")[^>]*>/gi, '<a $1 style="color: #0066cc; text-decoration: underline;">')
    // Remove empty paragraphs
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
}

// ============================================
// TIME OF DAY GREETING
// ============================================

/**
 * Get appropriate greeting based on time of day
 * @param timezone - IANA timezone string (e.g., 'Europe/Madrid')
 */
export function getTimeBasedGreeting(timezone?: string): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const now = new Date()
  
  let hour = now.getHours()
  
  // If timezone provided, try to get local hour
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      })
      hour = parseInt(formatter.format(now), 10)
    } catch (e) {
      log.warn('Invalid timezone, using local time:', timezone)
    }
  }
  
  if (hour >= 5 && hour < 12) {
    return 'Good morning'
  } else if (hour >= 12 && hour < 18) {
    return 'Good afternoon'
  } else {
    return 'Good evening'
  }
}

// ============================================
// PLACEHOLDER UTILITIES
// ============================================

/**
 * Find unfilled placeholders in text
 */
export function findUnfilledPlaceholders(text: string): string[] {
  if (!text) return []
  
  const matches = text.match(/\[([A-Z_]+)\]/g) || []
  // Use Array.from instead of spread for better compatibility
  return Array.from(new Set(matches))
}

/**
 * Replace a placeholder with a value
 */
export function replacePlaceholder(text: string, placeholder: string, value: string): string {
  if (!text || !placeholder) return text
  
  // Handle both [PLACEHOLDER] and placeholder formats
  const patterns = [
    new RegExp(`\\[${placeholder}\\]`, 'gi'),
    new RegExp(`\\[${placeholder.toLowerCase()}\\]`, 'gi'),
  ]
  
  let result = text
  for (const pattern of patterns) {
    result = result.replace(pattern, value)
  }
  
  return result
}

/**
 * Check if text has any unfilled placeholders
 */
export function hasUnfilledPlaceholders(text: string): boolean {
  return findUnfilledPlaceholders(text).length > 0
}
