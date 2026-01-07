// ============================================
// BULLETPROOF EMAIL ENGINE
// Mass VC Outreach System for 2000+ contacts
// A-GRADE EMAIL GENERATION
// ============================================

import { EMAIL_TEMPLATES, EmailTemplate, TemplateCategory } from './email-templates'
import { TEAM_MEMBERS, getSignatureText, getSignatureHtml } from './signatures'
import { 
  ASTANT_KNOWLEDGE, 
  buildEmailContext, 
  buildRelationshipContext,
  STORYTELLING_HOOKS,
  EMAIL_STYLES 
} from './astant-knowledge-base'

// ============================================
// TYPES
// ============================================

export interface ContactData {
  id: string
  first_name: string
  last_name: string
  email: string
  firm: string | null
  role: string | null
  geography: string | null
  investment_focus: string | null
  notes_private?: string | null
}

export interface CampaignConfig {
  id: string
  name: string
  template_id?: string  // Use a specific template
  category: TemplateCategory
  sender_id: string     // jean-francois, fahd, marcos
  tone: 'direct' | 'warm' | 'technical' | 'visionary'
  include_forbes_link: boolean
  include_demo_link: boolean
  include_pitch_deck: boolean
  custom_cta?: string
  custom_context?: string
  attachments?: AttachmentConfig[]
}

export interface AttachmentConfig {
  name: string
  type: 'pitch_deck' | 'memo' | 'one_pager' | 'custom'
  url?: string
  auto_attach: boolean
}

export interface GeneratedEmail {
  contact_id: string
  subject: string
  greeting: string
  context_p1: string
  value_p2: string
  cta: string
  signature_member_id: string
  confidence: 'green' | 'yellow' | 'red'
  quality_score: number  // 0-100
  personalization_tags: string[]  // What was personalized
  needs_review: boolean
  review_reasons: string[]
  attachments: AttachmentConfig[]
}

export interface BatchResult {
  total: number
  generated: number
  green: number
  yellow: number
  red: number
  needs_review: number
  errors: string[]
}

// ============================================
// PERSONALIZATION ENGINE
// ============================================

export function getPersonalizationData(contact: ContactData): {
  hooks: string[]
  personalization_level: 'high' | 'medium' | 'low'
  available_data: string[]
  missing_data: string[]
} {
  const hooks: string[] = []
  const available: string[] = []
  const missing: string[] = []

  // Check what data we have
  if (contact.firm) {
    available.push('firm')
    hooks.push(`their work at ${contact.firm}`)
  } else {
    missing.push('firm')
  }

  if (contact.role) {
    available.push('role')
    hooks.push(`their role as ${contact.role}`)
  } else {
    missing.push('role')
  }

  if (contact.investment_focus) {
    available.push('investment_focus')
    hooks.push(`their focus on ${contact.investment_focus}`)
  } else {
    missing.push('investment_focus')
  }

  if (contact.geography) {
    available.push('geography')
    hooks.push(`their presence in ${contact.geography}`)
  } else {
    missing.push('geography')
  }

  // Determine personalization level
  let level: 'high' | 'medium' | 'low' = 'low'
  if (available.length >= 3) level = 'high'
  else if (available.length >= 2) level = 'medium'

  return {
    hooks,
    personalization_level: level,
    available_data: available,
    missing_data: missing,
  }
}

// ============================================
// QUALITY SCORING
// ============================================

export function scoreEmailQuality(
  email: Omit<GeneratedEmail, 'quality_score' | 'needs_review' | 'review_reasons'>,
  contact: ContactData
): { score: number; needs_review: boolean; reasons: string[] } {
  let score = 50 // Base score
  const reasons: string[] = []

  // Subject line quality (+15 max)
  if (email.subject.includes(contact.firm || '')) score += 10
  if (email.subject.length > 20 && email.subject.length < 80) score += 5
  if (email.subject.includes('{{') || email.subject.includes('null')) {
    score -= 20
    reasons.push('Subject contains unresolved placeholders')
  }

  // Greeting quality (+5)
  if (email.greeting.includes(contact.first_name)) score += 5
  else {
    reasons.push('Greeting missing first name')
  }

  // Context paragraph quality (+15 max)
  if (contact.firm && email.context_p1.includes(contact.firm)) score += 10
  if (contact.investment_focus && email.context_p1.toLowerCase().includes(contact.investment_focus.toLowerCase().split(',')[0])) {
    score += 5
  }

  // Value proposition (+10 max)
  if (email.value_p2.includes('OpenMacro') || email.value_p2.includes('Forbes')) score += 5
  if (email.value_p2.length > 100 && email.value_p2.length < 400) score += 5

  // CTA quality (+5)
  if (email.cta.includes('call') || email.cta.includes('meeting') || email.cta.includes('chat')) {
    score += 5
  }

  // Confidence alignment
  if (email.confidence === 'green') score += 10
  else if (email.confidence === 'red') score -= 10

  // Check for issues
  const fullEmail = `${email.subject} ${email.greeting} ${email.context_p1} ${email.value_p2} ${email.cta}`
  
  if (fullEmail.includes('{{')) {
    score -= 30
    reasons.push('Contains unresolved template variables')
  }
  if (fullEmail.includes('null') || fullEmail.includes('undefined')) {
    score -= 20
    reasons.push('Contains null/undefined values')
  }
  if (fullEmail.includes('Unknown')) {
    score -= 10
    reasons.push('Contains "Unknown" placeholder')
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Determine if needs review
  const needs_review = score < 70 || reasons.length > 0 || email.confidence === 'red'

  if (score < 70) reasons.push(`Low quality score: ${score}`)

  return { score, needs_review, reasons }
}

// ============================================
// TEMPLATE SELECTOR
// ============================================

export function selectBestTemplate(
  contact: ContactData,
  category: TemplateCategory
): EmailTemplate {
  const templates = EMAIL_TEMPLATES.filter(t => t.category === category)
  
  if (templates.length === 0) {
    throw new Error(`No templates found for category: ${category}`)
  }

  // Score each template based on contact data
  const scored = templates.map(template => {
    let score = 0
    
    // Check if template matches contact's geography
    if (contact.geography) {
      if (template.body.toLowerCase().includes('europe') && contact.geography.toLowerCase().includes('eu')) {
        score += 10
      }
      if (template.body.toLowerCase().includes('uk') && contact.geography.toLowerCase().includes('uk')) {
        score += 10
      }
    }

    // Check investment focus alignment
    if (contact.investment_focus) {
      const focus = contact.investment_focus.toLowerCase()
      if (focus.includes('ai') && template.body.toLowerCase().includes('ai')) score += 15
      if (focus.includes('fintech') && template.body.toLowerCase().includes('finance')) score += 15
      if (focus.includes('saas') && template.body.toLowerCase().includes('platform')) score += 10
    }

    // Prefer templates with tags matching contact data
    if (template.tags) {
      if (template.tags.includes('q1')) score += 5 // Current quarter relevance
      if (template.tags.includes('forbes')) score += 5 // Social proof
    }

    return { template, score }
  })

  // Sort by score and return best match
  scored.sort((a, b) => b.score - a.score)
  return scored[0].template
}

// ============================================
// PROMPT BUILDER - A-GRADE QUALITY
// Uses comprehensive knowledge base
// ============================================

export function buildEmailPrompt(
  contact: ContactData,
  config: CampaignConfig,
  template: EmailTemplate
): string {
  const personalization = getPersonalizationData(contact)
  const sender = TEAM_MEMBERS.find(m => m.id === config.sender_id) || TEAM_MEMBERS[0]
  const senderStyle = EMAIL_STYLES[config.sender_id as keyof typeof EMAIL_STYLES] || EMAIL_STYLES.jeanfrancois
  
  // Get comprehensive company context
  const companyContext = buildEmailContext(config.category === 'vc' ? 'vc' : config.category === 'media' ? 'media' : 'partner')
  
  // Get relationship context if available
  const relationshipContext = buildRelationshipContext({
    notes: contact.notes_private || undefined,
  })

  // Build the A-grade prompt
  return `You are ${sender.name} from Astant Global Management. You write A-grade emails that read like a senior executive who has done deep research.

=== YOUR WRITING STYLE ===
- Greeting: "${senderStyle.greeting}"
- Tone: ${senderStyle.tone}
- Structure: ${senderStyle.structure}
- Characteristics: ${senderStyle.characteristics.join(', ')}

${companyContext}

${relationshipContext}

=== STORYTELLING HOOKS (Use 2-3 naturally) ===
FORBES FEATURE:
${STORYTELLING_HOOKS.forbesFeature}

ALPHA DECAY THESIS:
${STORYTELLING_HOOKS.alphaDecayNarrative}

VISION:
${STORYTELLING_HOOKS.visionStatement}

=== TEMPLATE STYLE REFERENCE ===
Subject: ${template.subject}
${template.body}

=== RECIPIENT ===
First Name: ${contact.first_name}
Last Name: ${contact.last_name}
Email: ${contact.email}
Firm: ${contact.firm || '[NO FIRM - be professional but generic about their work]'}
Role: ${contact.role || 'Investor'}
Geography: ${contact.geography || 'Europe'}
Investment Focus: ${contact.investment_focus || 'Technology/FinTech'}

=== PERSONALIZATION OPPORTUNITIES ===
Level: ${personalization.personalization_level.toUpperCase()}
${personalization.hooks.length > 0 
  ? `Hooks to use: ${personalization.hooks.join(', ')}`
  : 'Limited data - focus on compelling value proposition'}

=== TONE DIRECTIVE ===
${config.tone === 'direct' ? 'Be concise. Busy investors appreciate brevity. Get to the value fast.' : ''}
${config.tone === 'warm' ? 'Be friendly and relationship-focused. Build rapport before the ask.' : ''}
${config.tone === 'technical' ? 'Lead with technical substance about AI/quant approach. They want depth.' : ''}
${config.tone === 'visionary' ? 'Paint the big picture. Talk about market transformation by 2030.' : ''}

=== REQUIREMENTS ===
${config.include_forbes_link ? '✓ Include Forbes: https://nextleaders.forbes.it/da-studenti-a-imprenditori/' : ''}
${config.include_demo_link ? '✓ Include Demo: https://openmacro.ai/' : ''}
${config.include_pitch_deck ? '✓ Mention attached pitch deck' : ''}
${config.custom_cta ? `✓ CTA: ${config.custom_cta}` : ''}
${config.custom_context ? `✓ Context: ${config.custom_context}` : ''}

=== A-GRADE QUALITY STANDARDS ===
1. NO generic openings like "I hope this finds you well"
2. MUST reference specific detail about their firm/role if available
3. MUST weave storytelling naturally (Forbes, Alpha Decay thesis)
4. 400-500 words for medium emails, 5-6 paragraphs
5. Sound like a real senior executive, not a cold email
6. Every sentence must add value

=== OUTPUT ===
{
  "subject": "Compelling, specific subject (include firm name if available, max 60 chars)",
  "greeting": "${senderStyle.greeting} ${contact.first_name},",
  "context_p1": "Opening paragraph with connection/context (2-3 sentences)",
  "value_p2": "Value proposition with storytelling, Forbes, OpenMacro (4-5 sentences with links)",
  "cta": "Clear, specific call-to-action (1-2 sentences)",
  "confidence": "green|yellow|red",
  "personalization_tags": ["list", "of", "personalization", "points"]
}

CONFIDENCE:
- green: Strong personalization, specific details, storytelling, clear value
- yellow: Good structure but could be more specific
- red: Too generic, needs manual review`
}

// ============================================
// BATCH CONFIGURATION
// ============================================

export function createBatchConfig(
  contacts: ContactData[],
  config: CampaignConfig
): {
  batches: ContactData[][]
  estimatedTime: number // in seconds
  totalContacts: number
} {
  // Batch size of 10 for rate limiting
  const BATCH_SIZE = 10
  const DELAY_BETWEEN_BATCHES = 2 // seconds
  const AVG_GENERATION_TIME = 3 // seconds per email

  const batches: ContactData[][] = []
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    batches.push(contacts.slice(i, i + BATCH_SIZE))
  }

  const estimatedTime = 
    (contacts.length * AVG_GENERATION_TIME) + 
    (batches.length * DELAY_BETWEEN_BATCHES)

  return {
    batches,
    estimatedTime,
    totalContacts: contacts.length,
  }
}

// ============================================
// DEFAULT ATTACHMENTS
// ============================================

export const DEFAULT_ATTACHMENTS: Record<string, AttachmentConfig> = {
  pitch_deck: {
    name: 'Astant_Pitch_Deck_Q1_2026.pdf',
    type: 'pitch_deck',
    auto_attach: true,
  },
  one_pager: {
    name: 'Astant_One_Pager.pdf',
    type: 'one_pager',
    auto_attach: false,
  },
  memo: {
    name: 'Astant_Investment_Memo.pdf',
    type: 'memo',
    auto_attach: false,
  },
}

// ============================================
// EXPORTS
// ============================================

export {
  EMAIL_TEMPLATES,
  TEAM_MEMBERS,
}
