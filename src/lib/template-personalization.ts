// ============================================
// TEMPLATE PERSONALIZATION ENGINE
// Core Philosophy: NO GENERATION, ONLY MODIFICATION
// 
// The AI's ONLY job is to identify and replace
// specific placeholder words to personalize for each contact.
// 95%+ of the template stays EXACTLY the same.
// ============================================

import {
  EmailTemplate,
  ALL_TEMPLATES,
  personalizeEmail as kbPersonalizeEmail,
  ContactInfo,
  SenderInfo,
  JEAN_FRANCOIS_INVESTOR_OUTREACH,
  JEAN_FRANCOIS_VC_COLD,
  JEAN_FRANCOIS_FOLLOW_UP,
} from './email-knowledge-base'
import { TEAM_MEMBERS, getMemberById } from './signatures'

// Re-export types for backward compatibility
export type MasterTemplate = EmailTemplate
export type ContactData = ContactInfo
export type { SenderInfo }

export interface PersonalizationResult {
  subject: string
  body: string
  modifications: Array<{
    original: string
    replacement: string
    field: string
  }>
  templateId: string
  confidence: number
}

// ============================================
// MASTER TEMPLATES REGISTRY
// Re-export from knowledge base
// ============================================

export const MASTER_TEMPLATES: MasterTemplate[] = ALL_TEMPLATES

export const JEAN_FRANCOIS_TEMPLATE = JEAN_FRANCOIS_INVESTOR_OUTREACH

// ============================================
// GET SENDER INFO BY ID
// ============================================

export function getSenderInfo(senderId: string): SenderInfo | undefined {
  const member = getMemberById(senderId)
  if (!member) return undefined
  
  return {
    id: member.id,
    name: member.name,
    firstName: member.firstName,
    title: member.title,
    email: member.email,
  }
}

// ============================================
// GET TEMPLATE BY ID
// ============================================

export function getTemplateById(id: string): MasterTemplate | undefined {
  return MASTER_TEMPLATES.find(t => t.id === id)
}

// ============================================
// CORE PERSONALIZATION FUNCTION
// Pure string replacement - NO AI creativity
// ============================================

export async function personalizeTemplate(
  template: MasterTemplate,
  contact: ContactData,
  senderId?: string
): Promise<PersonalizationResult> {
  
  // Get sender info
  const sender = senderId ? getSenderInfo(senderId) : undefined
  
  // Use the knowledge base's personalization function
  const result = kbPersonalizeEmail(template, {
    name: contact.name,
    firstName: contact.firstName || contact.first_name,
    lastName: contact.lastName || contact.last_name,
    company: contact.company || contact.firm,
    firm: contact.firm || contact.company,
    role: contact.role,
    investmentFocus: contact.investmentFocus || contact.investment_focus,
    relationshipContext: contact.relationshipContext,
    meetingReference: contact.meetingReference,
    notes: contact.notes,
  }, sender)
  
  return {
    subject: result.subject,
    body: result.body,
    modifications: result.replacements.map(r => ({
      original: `[${r.placeholder}]`,
      replacement: r.value,
      field: r.placeholder,
    })),
    templateId: template.id,
    confidence: 1.0, // 100% confidence because it's pure replacement
  }
}

// ============================================
// FALLBACK SUBSTITUTION
// Direct string replacement with no AI
// ============================================

export function fallbackSubstitution(
  template: MasterTemplate,
  contact: ContactData,
  senderId?: string
): PersonalizationResult {
  
  // Get sender info
  const sender = senderId ? getSenderInfo(senderId) : undefined
  
  const result = kbPersonalizeEmail(template, {
    name: contact.name,
    firstName: contact.firstName || contact.first_name,
    lastName: contact.lastName || contact.last_name,
    company: contact.company || contact.firm,
    firm: contact.firm || contact.company,
    role: contact.role,
    investmentFocus: contact.investmentFocus || contact.investment_focus,
    relationshipContext: contact.relationshipContext,
    meetingReference: contact.meetingReference,
    notes: contact.notes,
  }, sender)
  
  return {
    subject: result.subject,
    body: result.body,
    modifications: result.replacements.map(r => ({
      original: `[${r.placeholder}]`,
      replacement: r.value,
      field: r.placeholder,
    })),
    templateId: template.id,
    confidence: 1.0,
  }
}

// ============================================
// BATCH PERSONALIZATION
// For processing many contacts at once
// ============================================

export async function batchPersonalize(
  template: MasterTemplate,
  contacts: ContactData[],
  senderId?: string
): Promise<PersonalizationResult[]> {
  
  const results: PersonalizationResult[] = []
  
  for (const contact of contacts) {
    const result = await personalizeTemplate(template, contact, senderId)
    results.push(result)
  }
  
  return results
}

// ============================================
// PREVIEW A TEMPLATE
// Show all placeholders without replacing
// ============================================

export function previewTemplate(templateId: string): {
  template: MasterTemplate | null
  placeholders: string[]
  preview: { subject: string; body: string }
} {
  const template = getTemplateById(templateId)
  
  if (!template) {
    return {
      template: null,
      placeholders: [],
      preview: { subject: '', body: '' }
    }
  }
  
  const placeholders = template.placeholders.map(p => p.field)
  
  return {
    template,
    placeholders,
    preview: {
      subject: template.subject,
      body: template.body,
    }
  }
}

// ============================================
// LIST ALL TEMPLATES
// ============================================

export function listTemplates(): Array<{
  id: string
  name: string
  description: string
  category: string
  author: string
  placeholders: string[]
}> {
  return MASTER_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    author: t.author,
    placeholders: t.placeholders.map(p => p.field),
  }))
}
