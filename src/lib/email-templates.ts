// ============================================
// EMAIL TEMPLATES - UI COMPATIBILITY LAYER
// Uses templates from the knowledge base
// ============================================

import { Mail, Users, Megaphone, Star, Coffee, type LucideIcon } from 'lucide-react'
import { 
  ALL_TEMPLATES as KB_TEMPLATES,
  JEAN_FRANCOIS_INVESTOR_OUTREACH,
  JEAN_FRANCOIS_VC_COLD,
  JEAN_FRANCOIS_FOLLOW_UP,
  type EmailTemplate as KBEmailTemplate,
} from './email-knowledge-base'

export type TemplateCategory = 'investor' | 'client' | 'media' | 'partner' | 'follow-up' | 'event'

export interface EmailTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  author: string
  // The actual templates
  subject: string
  body: string
  // Placeholders that can be personalized
  placeholders: string[]
  // For UI display
  subject_template: string
  body_template: string
  recommendedSender?: string
}

// Template categories for UI
export const TEMPLATE_CATEGORIES: Array<{
  value: TemplateCategory
  label: string
  icon: LucideIcon
  description: string
}> = [
  {
    value: 'investor',
    label: 'Investor Outreach',
    icon: Users,
    description: 'VC and investor outreach'
  },
  {
    value: 'partner',
    label: 'Strategic Partners',
    icon: Star,
    description: 'Partner and advisor outreach'
  },
  {
    value: 'media',
    label: 'Media & Press',
    icon: Megaphone,
    description: 'Press outreach and story pitches'
  },
  {
    value: 'client',
    label: 'Client Outreach',
    icon: Star,
    description: 'Client acquisition and sales'
  },
  {
    value: 'follow-up',
    label: 'Follow-ups',
    icon: Coffee,
    description: 'Professional follow-up emails'
  },
  {
    value: 'event',
    label: 'Event Invitations',
    icon: Mail,
    description: 'Event and meeting invitations'
  }
]

// Convert knowledge base templates to UI format
function convertKBTemplate(kbTemplate: KBEmailTemplate): EmailTemplate {
  return {
    id: kbTemplate.id,
    name: kbTemplate.name,
    category: kbTemplate.category as TemplateCategory,
    description: kbTemplate.description,
    author: kbTemplate.author,
    subject: kbTemplate.subject,
    body: kbTemplate.body,
    placeholders: kbTemplate.placeholders.map(p => p.field),
    subject_template: kbTemplate.subject,
    body_template: kbTemplate.body,
    recommendedSender: 'jean-francois',
  }
}

// Convert all templates from knowledge base
export const EMAIL_TEMPLATES: EmailTemplate[] = KB_TEMPLATES.map(convertKBTemplate)

// Helper functions
export function getTemplatesByCategory(category: TemplateCategory): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter(t => t.category === category)
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id)
}

// Re-export for convenience
export { JEAN_FRANCOIS_INVESTOR_OUTREACH, JEAN_FRANCOIS_VC_COLD, JEAN_FRANCOIS_FOLLOW_UP }
