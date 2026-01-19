// ============================================
// FORMAT SYNC SYSTEM V2
// Syncs structural edits (line breaks, paragraph structure, formatting)
// across all emails while preserving personalized content
// 
// KEY INSIGHT: We preserve HTML structure and formatting tags (<strong>, <br>, etc.)
// but swap out the personalized content (names, firms, etc.)
// ============================================

import type { EmailJsonBody } from './types'

/**
 * Campaign Format Template
 * Stored at campaign level, defines the structure that all emails share
 */
export interface CampaignFormat {
  // Structure definition - uses markers for where content goes
  // Each paragraph is stored as an array of "content blocks"
  // Content blocks can be: text (shared) or marker (personalized)
  greetingStructure: FormatBlock[]
  paragraph1Structure: FormatBlock[]
  paragraph2Structure: FormatBlock[]
  ctaStructure: FormatBlock[]
  
  // Metadata
  bannerEnabled: boolean
  version: number
  updatedAt: string
}

/**
 * A format block is either:
 * - Static text (shared across all emails, e.g., "Good morning ")
 * - Content marker (unique per email, e.g., the VC's name or personalized sentence)
 */
export interface FormatBlock {
  type: 'text' | 'content'
  // For 'text': the actual shared text
  // For 'content': a unique marker ID that maps to personalized content
  value: string
}

/**
 * Per-email content storage
 * Maps content marker IDs to personalized content
 */
export interface EmailContent {
  contentMap: Record<string, string>  // marker ID -> personalized content
  senderId: string
  signature: string
}

// ============================================
// SMART DIFF DETECTION
// Detects if an edit is structural (sync) or content (local)
// ============================================

export interface EditOperation {
  type: 'structural' | 'content'
  field: 'greeting' | 'context_p1' | 'value_p2' | 'cta'
  operation: 'insert' | 'delete' | 'replace'
  position?: number
  value?: string
  oldValue?: string
}

/**
 * Detect what type of edit occurred
 * Structural edits: newlines, paragraph breaks, consistent spacing
 * Content edits: new words, personalized changes
 */
export function detectEditType(
  oldText: string,
  newText: string
): 'structural' | 'content' | 'mixed' {
  const oldClean = oldText.trim()
  const newClean = newText.trim()
  
  // If only whitespace/newlines changed, it's structural
  const oldNoWhitespace = oldClean.replace(/\s+/g, ' ')
  const newNoWhitespace = newClean.replace(/\s+/g, ' ')
  
  if (oldNoWhitespace === newNoWhitespace) {
    return 'structural'
  }
  
  // If content changed but structure (line breaks) also changed, it's mixed
  const oldLineCount = oldClean.split(/\n/).length
  const newLineCount = newClean.split(/\n/).length
  
  if (oldLineCount !== newLineCount) {
    // Check if content changed too
    if (oldNoWhitespace !== newNoWhitespace) {
      return 'mixed'
    }
    return 'structural'
  }
  
  // Content-only change
  return 'content'
}

/**
 * Extract structural format from a paragraph
 * Returns the "shape" of the paragraph (whitespace pattern)
 */
export function extractStructure(text: string): string {
  // Replace all words with placeholders, keep whitespace
  return text.replace(/\S+/g, '•')
}

/**
 * Apply structural changes from one email to another
 * Preserves the target's content but applies source's structure
 * 
 * V2: Now properly handles HTML formatting (<strong>, <em>, <br>, etc.)
 * and preserves line breaks and paragraph structure
 */
export function applyStructuralChanges(
  sourceText: string,
  targetText: string
): string {
  if (!sourceText || !targetText) return targetText || sourceText || ''
  
  // Extract whitespace pattern from source (line breaks, paragraph breaks)
  const sourceLineBreaks = extractLineBreakPattern(sourceText)
  const targetLineBreaks = extractLineBreakPattern(targetText)
  
  // If source has more line breaks, we need to inject them into target
  // If source has fewer, we need to remove some from target
  
  // Step 1: Normalize both texts to extract just the words and HTML tags
  const sourceWords = extractWordsAndTags(sourceText)
  const targetWords = extractWordsAndTags(targetText)
  
  // Step 2: Apply source's whitespace structure to target's content
  // This preserves: target's words + source's line breaks/spacing
  
  // Simple approach: Count paragraph breaks in source, apply same pattern to target
  const sourceParagraphs = sourceText.split(/\n\n+/)
  const targetParagraphs = targetText.split(/\n\n+/)
  
  // If they have different paragraph counts, try to match structure
  if (sourceParagraphs.length === targetParagraphs.length) {
    // Same structure - just apply line breaks within each paragraph
    return targetParagraphs.map((targetPara, i) => {
      const sourcePara = sourceParagraphs[i] || ''
      return applyIntraParagraphBreaks(sourcePara, targetPara)
    }).join('\n\n')
  }
  
  // Different structure - apply the overall line break pattern
  const sourceBreakPattern = sourceText.match(/\n+/g) || []
  
  // Build result by injecting source's break pattern into target content
  let result = targetText
  
  // Apply double newlines where source has them
  if (sourceText.includes('\n\n') && !targetText.includes('\n\n')) {
    // Add paragraph breaks at similar positions (percentage-based)
    const sourceBreakPositions = findBreakPositions(sourceText)
    result = injectBreaksAtPositions(targetText, sourceBreakPositions)
  }
  
  return result
}

/**
 * Extract the pattern of line breaks from text
 */
function extractLineBreakPattern(text: string): { single: number; double: number; positions: number[] } {
  const singleBreaks = (text.match(/(?<!\n)\n(?!\n)/g) || []).length
  const doubleBreaks = (text.match(/\n\n+/g) || []).length
  // Use Array.from for compatibility
  const matches = text.match(/\n+/g) || []
  const positions: number[] = []
  let searchPos = 0
  for (const match of matches) {
    const idx = text.indexOf(match, searchPos)
    if (idx >= 0) {
      positions.push(idx)
      searchPos = idx + match.length
    }
  }
  return { single: singleBreaks, double: doubleBreaks, positions }
}

/**
 * Extract words and HTML tags, preserving their order
 */
function extractWordsAndTags(text: string): string[] {
  // Match either HTML tags or words
  const pattern = /<[^>]+>|[^\s<]+/g
  return text.match(pattern) || []
}

/**
 * Apply line breaks from source paragraph to target paragraph
 */
function applyIntraParagraphBreaks(sourcePara: string, targetPara: string): string {
  // Count single newlines in source
  const sourceNewlines = (sourcePara.match(/\n/g) || []).length
  const targetNewlines = (targetPara.match(/\n/g) || []).length
  
  if (sourceNewlines === targetNewlines) {
    return targetPara // Already matches
  }
  
  // If source has more newlines, we need to add them to target
  // Find positions in source (as percentages) and apply to target
  if (sourceNewlines > targetNewlines) {
    const sourcePositions = findBreakPositions(sourcePara)
    return injectBreaksAtPositions(targetPara, sourcePositions)
  }
  
  // If source has fewer newlines, remove some from target
  // This is trickier - for now, just condense multiple newlines
  return targetPara.replace(/\n+/g, (match) => {
    return match.length > sourceNewlines ? '\n'.repeat(sourceNewlines || 1) : match
  })
}

/**
 * Find relative positions of line breaks in text (0-1 scale)
 */
function findBreakPositions(text: string): number[] {
  const positions: number[] = []
  const len = text.length
  if (len === 0) return positions
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      positions.push(i / len)
    }
  }
  return positions
}

/**
 * Inject line breaks at relative positions
 */
function injectBreaksAtPositions(text: string, positions: number[]): string {
  if (positions.length === 0) return text
  
  const chars = text.split('')
  const len = chars.length
  
  // Sort positions in reverse so insertions don't affect later indices
  const insertPositions = positions
    .map(p => Math.floor(p * len))
    .sort((a, b) => b - a)
  
  for (const pos of insertPositions) {
    // Find the nearest word boundary
    let insertAt = pos
    while (insertAt < chars.length && !/\s/.test(chars[insertAt])) {
      insertAt++
    }
    // Only insert if there's not already a newline
    if (chars[insertAt] !== '\n') {
      chars.splice(insertAt, 0, '\n')
    }
  }
  
  return chars.join('')
}

// ============================================
// FORMAT APPLICATION
// Apply a format template to an email while preserving its content
// ============================================

/**
 * Apply structural format from source body to target body
 * Preserves target's personalized content, applies source's line breaks/spacing
 * 
 * V2 IMPROVEMENTS:
 * - Syncs bannerEnabled setting
 * - Preserves HTML formatting (<strong>, <em>, etc.)
 * - Properly handles line breaks (\n) and paragraph breaks (\n\n)
 * - Keeps target's signature (per-email sender override)
 */
export function applyFormatToEmail(
  sourceBody: EmailJsonBody,
  targetBody: EmailJsonBody,
  options: { syncBanner?: boolean; syncSender?: boolean } = {}
): EmailJsonBody {
  const { syncBanner = true, syncSender = false } = options
  
  return {
    ...targetBody,
    // Apply structural changes to each field
    greeting: applyStructuralChanges(sourceBody.greeting || '', targetBody.greeting || ''),
    context_p1: applyStructuralChanges(sourceBody.context_p1 || '', targetBody.context_p1 || ''),
    value_p2: applyStructuralChanges(sourceBody.value_p2 || '', targetBody.value_p2 || ''),
    cta: applyStructuralChanges(sourceBody.cta || '', targetBody.cta || ''),
    // Sync banner setting (can be overridden)
    bannerEnabled: syncBanner ? sourceBody.bannerEnabled : targetBody.bannerEnabled,
    // Signature handling: keep target's by default (per-email sender override)
    signature: syncSender ? sourceBody.signature : targetBody.signature,
    signatureMemberId: syncSender ? sourceBody.signatureMemberId : targetBody.signatureMemberId,
  }
}

// ============================================
// SENDER UPDATE UTILITY
// Updates sender name throughout email body
// ============================================

/**
 * Update sender name in email body when sender changes
 * Handles patterns like "I'm [Name]" and "My name is [Name]"
 */
export function updateSenderInEmail(
  body: EmailJsonBody,
  oldSenderFirstName: string,
  newSenderFirstName: string,
  newSenderId: string,
  newSignature: string
): EmailJsonBody {
  if (!oldSenderFirstName || !newSenderFirstName) {
    return { ...body, signatureMemberId: newSenderId, signature: newSignature }
  }
  
  const replaceSenderName = (text: string): string => {
    if (!text) return text
    
    // Escape special regex chars
    const escaped = oldSenderFirstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    // Pattern: "I'm [Name]" or "I'm [Name],"
    const imPattern = new RegExp(`(I(?:'|'|')m\\s+)${escaped}`, 'gi')
    let result = text.replace(imPattern, `$1${newSenderFirstName}`)
    
    // Pattern: "My name is [Name]"
    const namePattern = new RegExp(`(My name is\\s+)${escaped}`, 'gi')
    result = result.replace(namePattern, `$1${newSenderFirstName}`)
    
    // Pattern: standalone name (e.g., in casual reference)
    // Be careful not to replace partial matches
    const standalonePattern = new RegExp(`\\b${escaped}\\b`, 'g')
    result = result.replace(standalonePattern, newSenderFirstName)
    
    return result
  }
  
  return {
    ...body,
    greeting: replaceSenderName(body.greeting || ''),
    context_p1: replaceSenderName(body.context_p1 || ''),
    value_p2: replaceSenderName(body.value_p2 || ''),
    cta: replaceSenderName(body.cta || ''),
    signatureMemberId: newSenderId,
    signature: newSignature,
    bannerEnabled: body.bannerEnabled,
  }
}

// ============================================
// FORMAT SYNC STATE
// Manage sync state and propagation
// ============================================

export interface FormatSyncState {
  enabled: boolean
  masterEmailId: string | null  // The email being edited (source of truth)
  lastFormat: EmailJsonBody | null
  syncedEmailIds: string[]
}

/**
 * Calculate which emails need to be updated based on format changes
 */
export function getEmailsToSync(
  allEmails: Array<{ id: string; body: EmailJsonBody }>,
  sourceEmailId: string,
  sourceBody: EmailJsonBody
): Array<{ emailId: string; updatedBody: EmailJsonBody }> {
  return allEmails
    .filter(email => email.id !== sourceEmailId)
    .map(email => ({
      emailId: email.id,
      updatedBody: applyFormatToEmail(sourceBody, email.body)
    }))
}
