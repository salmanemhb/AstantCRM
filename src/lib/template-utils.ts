// ============================================
// TEMPLATE UTILITIES
// Convert between personalized emails and templates with placeholders
// ============================================

import { EmailJsonBody } from './types'
import { getMemberById } from './signatures'

// Standard placeholders used in templates
export const PLACEHOLDERS = {
  CONTACT_FIRST_NAME: '{{contact_first_name}}',
  CONTACT_LAST_NAME: '{{contact_last_name}}',
  CONTACT_FIRM: '{{contact_firm}}',
  CONTACT_ROLE: '{{contact_role}}',
  CONTACT_FOCUS: '{{contact_focus}}',
  SENDER_FIRST_NAME: '{{sender_first_name}}',
  SENDER_NAME: '{{sender_name}}',
  SENDER_TITLE: '{{sender_title}}',
} as const

// Template structure stored in campaign
export interface CampaignTemplate {
  greeting: string    // e.g., "Good morning {{contact_first_name}},"
  context_p1: string  // First paragraph with placeholders
  value_p2: string    // Second paragraph with placeholders
  cta: string         // Call to action with placeholders
  bannerEnabled: boolean
  version: number     // Template version
  savedAt: string     // When it was saved
  savedFromContactId?: string  // Which contact it was saved from (for reference)
}

// Contact data for personalization
export interface ContactData {
  first_name: string
  last_name?: string
  firm?: string
  role?: string
  investment_focus?: string
}

// Sender data for personalization
export interface SenderData {
  firstName: string
  name: string
  title: string
}

/**
 * Convert a personalized email body BACK to a template with placeholders
 * This is the reverse of personalization
 */
export function emailToTemplate(
  body: EmailJsonBody,
  contact: ContactData,
  senderId?: string
): CampaignTemplate {
  // Get sender info
  const sender = senderId ? getMemberById(senderId) : null
  
  // Build replacement map: actual values -> placeholders
  const replacements: Array<{ value: string; placeholder: string }> = []
  
  // Contact replacements (order matters - longer strings first to avoid partial replacements)
  if (contact.first_name) {
    replacements.push({ value: contact.first_name, placeholder: PLACEHOLDERS.CONTACT_FIRST_NAME })
  }
  if (contact.last_name) {
    replacements.push({ value: contact.last_name, placeholder: PLACEHOLDERS.CONTACT_LAST_NAME })
  }
  if (contact.firm) {
    replacements.push({ value: contact.firm, placeholder: PLACEHOLDERS.CONTACT_FIRM })
  }
  if (contact.role) {
    replacements.push({ value: contact.role, placeholder: PLACEHOLDERS.CONTACT_ROLE })
  }
  if (contact.investment_focus) {
    replacements.push({ value: contact.investment_focus, placeholder: PLACEHOLDERS.CONTACT_FOCUS })
  }
  
  // Sender replacements
  if (sender) {
    // Full name first, then first name (avoid replacing "Jean-François" with just "Jean-François")
    if (sender.name) {
      replacements.push({ value: sender.name, placeholder: PLACEHOLDERS.SENDER_NAME })
    }
    if (sender.firstName) {
      // Special handling for "I'm [Name]" pattern - preserve the pattern
      // We'll handle this in the replacement logic
      replacements.push({ value: sender.firstName, placeholder: PLACEHOLDERS.SENDER_FIRST_NAME })
    }
    if (sender.title) {
      replacements.push({ value: sender.title, placeholder: PLACEHOLDERS.SENDER_TITLE })
    }
  }
  
  // Sort by value length descending (replace longer strings first)
  replacements.sort((a, b) => b.value.length - a.value.length)
  
  // Function to convert text to template
  const toTemplate = (text: string): string => {
    if (!text) return text
    let result = text
    
    for (const { value, placeholder } of replacements) {
      if (!value) continue
      
      // Case-insensitive replacement that handles common patterns
      // Pattern: "I'm Jean-François" -> "I'm {{sender_first_name}}"
      if (placeholder === PLACEHOLDERS.SENDER_FIRST_NAME) {
        const imPattern = new RegExp(`(I(?:'|')m\\s+)${escapeRegex(value)}`, 'gi')
        result = result.replace(imPattern, `$1${placeholder}`)
        
        const namePattern = new RegExp(`(My name is\\s+)${escapeRegex(value)}`, 'gi')
        result = result.replace(namePattern, `$1${placeholder}`)
      }
      
      // General replacement for other occurrences
      const regex = new RegExp(escapeRegex(value), 'gi')
      result = result.replace(regex, placeholder)
    }
    
    return result
  }
  
  return {
    greeting: toTemplate(body.greeting || ''),
    context_p1: toTemplate(body.context_p1 || ''),
    value_p2: toTemplate(body.value_p2 || ''),
    cta: toTemplate(body.cta || ''),
    bannerEnabled: body.bannerEnabled || false,
    version: 1,
    savedAt: new Date().toISOString(),
  }
}

/**
 * Apply a template to create a personalized email body
 * This replaces placeholders with actual values
 */
export function templateToEmail(
  template: CampaignTemplate,
  contact: ContactData,
  sender: SenderData,
  currentBody?: EmailJsonBody
): EmailJsonBody {
  // Build replacement map: placeholders -> actual values
  // IMPORTANT: Use the actual sender info passed in, never default to a specific person
  const replacements: Record<string, string> = {
    [PLACEHOLDERS.CONTACT_FIRST_NAME]: contact.first_name || '[Name]',
    [PLACEHOLDERS.CONTACT_LAST_NAME]: contact.last_name || '',
    [PLACEHOLDERS.CONTACT_FIRM]: contact.firm || '[Firm]',
    [PLACEHOLDERS.CONTACT_ROLE]: contact.role || '',
    [PLACEHOLDERS.CONTACT_FOCUS]: contact.investment_focus || 'technology and innovation',
    [PLACEHOLDERS.SENDER_FIRST_NAME]: sender.firstName || '[Sender First Name]',
    [PLACEHOLDERS.SENDER_NAME]: sender.name || '[Sender Name]',
    [PLACEHOLDERS.SENDER_TITLE]: sender.title || '[Sender Title]',
  }
  
  // Function to personalize text
  const personalize = (text: string): string => {
    if (!text) return text
    let result = text
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.split(placeholder).join(value)
    }
    
    return result
  }
  
  return {
    greeting: personalize(template.greeting),
    context_p1: personalize(template.context_p1),
    value_p2: personalize(template.value_p2),
    cta: personalize(template.cta),
    bannerEnabled: template.bannerEnabled,
    signature: currentBody?.signature || '',
    signatureMemberId: currentBody?.signatureMemberId || '',
  }
}

/**
 * Update sender in email body
 * Changes "I'm OldName" to "I'm NewName" and updates signature
 * PRESERVES HTML formatting (e.g., <strong>Jean-François</strong> -> <strong>Fahd</strong>)
 */
export function updateSenderInBody(
  body: EmailJsonBody,
  oldSenderId: string,
  newSenderId: string
): EmailJsonBody {
  const oldSender = getMemberById(oldSenderId)
  const newSender = getMemberById(newSenderId)
  
  console.log('[updateSenderInBody] Called with:', { oldSenderId, newSenderId })
  console.log('[updateSenderInBody] Old sender:', oldSender?.firstName, 'New sender:', newSender?.firstName)
  
  if (!oldSender || !newSender) {
    console.log('[updateSenderInBody] Missing sender info, returning unchanged body')
    return body
  }
  
  const replaceSenderName = (text: string): string => {
    if (!text) return text
    
    const oldName = oldSender.firstName
    const newName = newSender.firstName
    const oldFullName = oldSender.name
    const newFullName = newSender.name
    
    console.log('[updateSenderInBody] Replacing in text:', text.substring(0, 100))
    
    let result = text
    
    // Handle HTML-wrapped names: <strong>OldName</strong> -> <strong>NewName</strong>
    // This preserves bold formatting when swapping sender names
    const htmlTags = ['strong', 'b', 'em', 'i', 'span']
    for (const tag of htmlTags) {
      // Replace full name inside tags
      const oldTaggedFull = new RegExp(`<${tag}([^>]*)>${escapeRegex(oldFullName)}</${tag}>`, 'gi')
      result = result.replace(oldTaggedFull, `<${tag}$1>${newFullName}</${tag}>`)
      
      // Replace first name inside tags
      const oldTaggedFirst = new RegExp(`<${tag}([^>]*)>${escapeRegex(oldName)}</${tag}>`, 'gi')
      result = result.replace(oldTaggedFirst, `<${tag}$1>${newName}</${tag}>`)
    }
    
    // Simple direct replacement approach - replace all variations of "I'm [OldName]"
    // Handle different apostrophe characters: ' (0x27), ' (0x2019), ' (0x2018), ` (0x60)
    const apostrophes = ["'", "'", "'", "`"]
    
    for (const apos of apostrophes) {
      // Pattern: "I'm [Name]" at various positions - handle HTML versions too
      // "I'm <strong>OldName</strong>" -> "I'm <strong>NewName</strong>"
      for (const tag of ['strong', 'b', '']) {
        const openTag = tag ? `<${tag}>` : ''
        const closeTag = tag ? `</${tag}>` : ''
        
        const imOld = `I${apos}m ${openTag}${oldName}${closeTag}`
        const imNew = `I'm ${openTag}${newName}${closeTag}`
        if (result.includes(imOld)) {
          console.log('[updateSenderInBody] Found and replacing:', imOld, '->', imNew)
          result = result.split(imOld).join(imNew)
        }
      }
    }
    
    // Also handle "My name is [Name]" with HTML tags
    for (const tag of ['strong', 'b', '']) {
      const openTag = tag ? `<${tag}>` : ''
      const closeTag = tag ? `</${tag}>` : ''
      
      const myNameOld = `My name is ${openTag}${oldName}${closeTag}`
      const myNameNew = `My name is ${openTag}${newName}${closeTag}`
      if (result.includes(myNameOld)) {
        result = result.split(myNameOld).join(myNameNew)
      }
    }
    
    // Replace full name occurrences (plain text - HTML already handled above)
    if (oldFullName && newFullName && result.includes(oldFullName)) {
      result = result.split(oldFullName).join(newFullName)
    }
    
    // Replace standalone first name occurrences
    // Use word boundary to avoid replacing partial matches
    const firstNameRegex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g')
    result = result.replace(firstNameRegex, newName)
    
    console.log('[updateSenderInBody] Result:', result.substring(0, 100))
    
    return result
  }
  
  const updatedBody = {
    ...body,
    greeting: replaceSenderName(body.greeting || ''),
    context_p1: replaceSenderName(body.context_p1 || ''),
    value_p2: replaceSenderName(body.value_p2 || ''),
    cta: replaceSenderName(body.cta || ''),
    signatureMemberId: newSenderId,
  }
  
  console.log('[updateSenderInBody] Updated body fields:', {
    greeting: updatedBody.greeting?.substring(0, 50),
    context_p1: updatedBody.context_p1?.substring(0, 50),
  })
  
  return updatedBody
}

/**
 * Check if an email body contains template placeholders
 */
export function hasPlaceholders(body: EmailJsonBody): boolean {
  const text = [body.greeting, body.context_p1, body.value_p2, body.cta].join(' ')
  return Object.values(PLACEHOLDERS).some(p => text.includes(p))
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert legacy SavedFormat to CampaignTemplate
 */
export function legacyFormatToTemplate(
  savedFormat: {
    bodyStructure: { greeting: string; context_p1: string; value_p2: string; cta: string }
    sourceContactName: string
    sourceContactFirm: string
    sourceSenderName: string
    bannerEnabled: boolean
  }
): CampaignTemplate {
  // The legacy format has actual values, we need to convert to placeholders
  const replacements: Array<{ value: string; placeholder: string }> = []
  
  if (savedFormat.sourceContactName) {
    replacements.push({ value: savedFormat.sourceContactName, placeholder: PLACEHOLDERS.CONTACT_FIRST_NAME })
  }
  if (savedFormat.sourceContactFirm) {
    replacements.push({ value: savedFormat.sourceContactFirm, placeholder: PLACEHOLDERS.CONTACT_FIRM })
  }
  if (savedFormat.sourceSenderName) {
    replacements.push({ value: savedFormat.sourceSenderName, placeholder: PLACEHOLDERS.SENDER_FIRST_NAME })
  }
  
  // Sort by length descending
  replacements.sort((a, b) => b.value.length - a.value.length)
  
  const toTemplate = (text: string): string => {
    if (!text) return text
    let result = text
    
    for (const { value, placeholder } of replacements) {
      if (!value) continue
      
      // Handle sender name patterns
      if (placeholder === PLACEHOLDERS.SENDER_FIRST_NAME) {
        const imPattern = new RegExp(`(I(?:'|')m\\s+)${escapeRegex(value)}`, 'gi')
        result = result.replace(imPattern, `$1${placeholder}`)
        
        const namePattern = new RegExp(`(My name is\\s+)${escapeRegex(value)}`, 'gi')
        result = result.replace(namePattern, `$1${placeholder}`)
      }
      
      const regex = new RegExp(escapeRegex(value), 'gi')
      result = result.replace(regex, placeholder)
    }
    
    return result
  }
  
  return {
    greeting: toTemplate(savedFormat.bodyStructure.greeting),
    context_p1: toTemplate(savedFormat.bodyStructure.context_p1),
    value_p2: toTemplate(savedFormat.bodyStructure.value_p2),
    cta: toTemplate(savedFormat.bodyStructure.cta),
    bannerEnabled: savedFormat.bannerEnabled,
    version: 1,
    savedAt: new Date().toISOString(),
  }
}
