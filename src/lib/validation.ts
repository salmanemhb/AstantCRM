// ============================================
// VALIDATION UTILITIES
// Centralized validation for emails, data, etc.
// ============================================

import { VALIDATION_CONFIG } from './config'
import { createLogger } from './logger'

const log = createLogger('[VALIDATION]')

// ============================================
// EMAIL VALIDATION
// ============================================

export interface EmailValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate an email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  const trimmed = email.trim().toLowerCase()
  
  // Check length
  if (trimmed.length > VALIDATION_CONFIG.email.maxLength) {
    log.warn('Email too long:', trimmed.length)
    return false
  }
  
  // Check pattern
  if (!VALIDATION_CONFIG.email.pattern.test(trimmed)) {
    log.warn('Email failed pattern check:', trimmed)
    return false
  }
  
  // Additional checks
  // No consecutive dots
  if (trimmed.includes('..')) return false
  
  // No leading/trailing dots in local part
  const localPart = trimmed.split('@')[0]
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false
  
  return true
}

/**
 * Validate email subject line
 */
export function validateSubject(subject: string): EmailValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!subject || typeof subject !== 'string') {
    errors.push('Subject is required')
    return { isValid: false, errors, warnings }
  }
  
  const trimmed = subject.trim()
  
  if (trimmed.length < VALIDATION_CONFIG.subject.minLength) {
    errors.push(`Subject must be at least ${VALIDATION_CONFIG.subject.minLength} characters`)
  }
  
  if (trimmed.length > VALIDATION_CONFIG.subject.maxLength) {
    errors.push(`Subject must be less than ${VALIDATION_CONFIG.subject.maxLength} characters`)
  }
  
  // Warnings for common issues
  if (trimmed.toUpperCase() === trimmed && trimmed.length > 10) {
    warnings.push('Subject is all caps - this may trigger spam filters')
  }
  
  if (trimmed.includes('!!!') || trimmed.includes('$$$')) {
    warnings.push('Subject contains spam-like characters')
  }
  
  if (trimmed.toLowerCase().includes('free') || trimmed.toLowerCase().includes('urgent')) {
    warnings.push('Subject contains words that may trigger spam filters')
  }
  
  // Check for unfilled placeholders
  const placeholderMatch = trimmed.match(/\[([A-Z_]+)\]/g)
  if (placeholderMatch) {
    errors.push(`Subject contains unfilled placeholders: ${placeholderMatch.join(', ')}`)
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate email body
 * Body can be either a string or an object with greeting, context_p1, value_p2, cta fields
 */
export function validateBody(body: string | object | null | undefined): EmailValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!body) {
    errors.push('Email body is required')
    return { isValid: false, errors, warnings }
  }
  
  // Handle object-style body (from email editor with greeting, context_p1, value_p2, cta)
  let plainText: string
  let rawLength: number
  
  if (typeof body === 'object') {
    const bodyObj = body as Record<string, any>
    // Combine all text parts
    const parts = [
      bodyObj.greeting || '',
      bodyObj.context_p1 || '',
      bodyObj.value_p2 || '',
      bodyObj.cta || ''
    ].filter(Boolean)
    
    // Check if we have at least some content
    if (parts.length === 0) {
      errors.push('Email body is required')
      return { isValid: false, errors, warnings }
    }
    
    const combinedHtml = parts.join(' ')
    plainText = combinedHtml.replace(/<[^>]+>/g, '').trim()
    rawLength = combinedHtml.length
  } else if (typeof body === 'string') {
    plainText = body.replace(/<[^>]+>/g, '').trim()
    rawLength = body.length
  } else {
    errors.push('Email body is required')
    return { isValid: false, errors, warnings }
  }
  
  if (plainText.length < VALIDATION_CONFIG.body.minLength) {
    errors.push(`Email body must be at least ${VALIDATION_CONFIG.body.minLength} characters`)
  }
  
  if (rawLength > VALIDATION_CONFIG.body.maxLength) {
    errors.push(`Email body is too large (${(rawLength / 1024).toFixed(1)}KB, max ${VALIDATION_CONFIG.body.maxLength / 1024}KB)`)
  }
  
  // Check for unfilled placeholders
  const placeholderMatch = plainText.match(/\[([A-Z_]+)\]/g)
  if (placeholderMatch) {
    errors.push(`Body contains unfilled placeholders: ${placeholderMatch.join(', ')}`)
  }
  
  // Check for greeting (be more lenient - the greeting might be in a separate field)
  const textLower = plainText.toLowerCase()
  if (!textLower.startsWith('good morning') &&
      !textLower.startsWith('good afternoon') &&
      !textLower.startsWith('good evening') &&
      !textLower.startsWith('hi ') &&
      !textLower.startsWith('hello ') &&
      !textLower.startsWith('dear ') &&
      !textLower.includes('good morning') &&
      !textLower.includes('good afternoon')) {
    // Only warn if there's no greeting anywhere
    warnings.push('Email may not contain a greeting')
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate a complete email before sending
 */
export function validateEmailForSend(email: {
  to: string
  subject: string
  body: string | object | null | undefined
  attachments?: Array<{ file_size: number; file_type: string }>
}): EmailValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate recipient
  if (!isValidEmail(email.to)) {
    errors.push(`Invalid recipient email: ${email.to}`)
  }
  
  // Validate subject
  const subjectResult = validateSubject(email.subject)
  errors.push(...subjectResult.errors)
  warnings.push(...subjectResult.warnings)
  
  // Validate body
  const bodyResult = validateBody(email.body)
  errors.push(...bodyResult.errors)
  warnings.push(...bodyResult.warnings)
  
  // Validate attachments
  if (email.attachments && email.attachments.length > 0) {
    const attachmentResult = validateAttachments(email.attachments)
    errors.push(...attachmentResult.errors)
    warnings.push(...attachmentResult.warnings)
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

// ============================================
// ATTACHMENT VALIDATION
// ============================================

/**
 * Validate file attachments
 */
export function validateAttachments(attachments: Array<{ 
  file_size: number
  file_type: string 
}>): EmailValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (attachments.length > VALIDATION_CONFIG.attachments.maxCount) {
    errors.push(`Too many attachments (${attachments.length}, max ${VALIDATION_CONFIG.attachments.maxCount})`)
  }
  
  let totalSize = 0
  
  for (const att of attachments) {
    totalSize += att.file_size
    
    if (att.file_size > VALIDATION_CONFIG.attachments.maxFileSize) {
      errors.push(`File too large: ${(att.file_size / 1024 / 1024).toFixed(1)}MB (max ${VALIDATION_CONFIG.attachments.maxFileSize / 1024 / 1024}MB)`)
    }
    
    // Type assertion needed because config uses 'as const' for the array
    const allowedTypes = VALIDATION_CONFIG.attachments.allowedTypes as readonly string[]
    if (!allowedTypes.includes(att.file_type)) {
      warnings.push(`File type may not be supported: ${att.file_type}`)
    }
  }
  
  if (totalSize > VALIDATION_CONFIG.attachments.maxTotalSize) {
    errors.push(`Total attachment size too large: ${(totalSize / 1024 / 1024).toFixed(1)}MB (max ${VALIDATION_CONFIG.attachments.maxTotalSize / 1024 / 1024}MB)`)
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

// ============================================
// CONTACT VALIDATION
// ============================================

export interface ContactValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  normalizedData?: {
    email: string
    firstName: string
    lastName: string
  }
}

/**
 * Validate contact data
 */
export function validateContact(contact: {
  email?: string
  first_name?: string
  last_name?: string
  firm?: string
}): ContactValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Email is required and must be valid
  if (!contact.email) {
    errors.push('Email is required')
  } else if (!isValidEmail(contact.email)) {
    errors.push(`Invalid email format: ${contact.email}`)
  }
  
  // First name recommended
  if (!contact.first_name || contact.first_name.trim().length === 0) {
    warnings.push('First name is missing - personalization will be limited')
  }
  
  // Normalize data
  const normalizedData = {
    email: (contact.email || '').trim().toLowerCase(),
    firstName: (contact.first_name || '').trim(),
    lastName: (contact.last_name || '').trim(),
  }
  
  // Capitalize names properly
  if (normalizedData.firstName) {
    normalizedData.firstName = normalizedData.firstName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  
  if (normalizedData.lastName) {
    normalizedData.lastName = normalizedData.lastName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings,
    normalizedData 
  }
}

// ============================================
// CAMPAIGN VALIDATION
// ============================================

/**
 * Validate campaign data before creation
 */
export function validateCampaign(campaign: {
  name?: string
  template_subject?: string
  template_body?: string
}): EmailValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!campaign.name || campaign.name.trim().length < 3) {
    errors.push('Campaign name must be at least 3 characters')
  }
  
  if (!campaign.template_subject) {
    warnings.push('No subject template set - you will need to add one before generating drafts')
  }
  
  if (!campaign.template_body) {
    warnings.push('No body template set - you will need to add one before generating drafts')
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize a string for safe display
 */
export function sanitizeForDisplay(str: string): string {
  if (!str) return ''
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  if (!str) return ''
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, char => htmlEntities[char] || char)
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}
