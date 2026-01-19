// ============================================
// MASTER EMAIL TEMPLATES - KNOWLEDGE BASE
// ============================================
// 
// These are REAL, human-written professional emails.
// They are NOT to be rewritten or shortened.
// 
// The AI's ONLY job is to replace bracketed placeholders
// with contact-specific information. NOTHING ELSE.
//
// Template Structure:
// RECIPIENT placeholders:
// - [RECIPIENT_NAME] → First name of recipient
// - [RECIPIENT_COMPANY] → Their company/firm
// - [RELATIONSHIP_CONTEXT] → How we know them / connection
// - [MEETING_REFERENCE] → Previous meeting location/context
// - [OFFICE_ADDRESS] → Our office location
//
// SENDER placeholders:
// - [SENDER_NAME] → Full name of sender
// - [SENDER_FIRST_NAME] → First name of sender
// - [SENDER_TITLE] → Job title of sender
// - [SENDER_EMAIL] → Email of sender
// ============================================

export interface EmailTemplate {
  id: string
  name: string
  description: string
  author: string
  category: 'investor' | 'client' | 'media' | 'partner' | 'follow-up' | 'event'
  createdAt: string
  
  // The complete email - DO NOT MODIFY except placeholders
  subject: string
  body: string
  
  // List of placeholders that CAN be personalized
  placeholders: {
    field: string
    description: string
    required: boolean
    defaultValue?: string
  }[]
}

// ============================================
// JEAN-FRANÇOIS'S MASTER TEMPLATES
// ============================================

export const JEAN_FRANCOIS_INVESTOR_OUTREACH: EmailTemplate = {
  id: 'jf-investor-outreach-v1',
  name: "Investor/Partner Outreach (Long)",
  description: "Long-form professional outreach for investors, advisors, and strategic partners. Used for reconnecting with past contacts and inviting to events.",
  author: 'Jean-François Manigo Gilardoni',
  category: 'investor',
  createdAt: '2026-01-10',
  
  placeholders: [
    { field: 'RECIPIENT_NAME', description: 'First name of the recipient', required: true },
    { field: 'RECIPIENT_COMPANY', description: 'Their company/firm name', required: true },
    { field: 'OFFICE_ADDRESS', description: 'Astant office address', required: false, defaultValue: 'Paseo de la Castellana, 280 (Loom, 1st floor)' },
    { field: 'SENDER_NAME', description: 'Full name of the sender', required: true },
    { field: 'SENDER_FIRST_NAME', description: 'First name of the sender', required: true },
    { field: 'SENDER_TITLE', description: 'Job title of the sender', required: true },
  ],
  
  subject: `Astant Global Management – Invitation & Updates`,
  
  body: `Good morning [RECIPIENT_NAME],

I'm [SENDER_FIRST_NAME] from **Astant Global Management**, having recently joined the firm to support global partnerships and expansion initiatives. I'm writing on behalf of Astant's founding team, whom you have connected with previously. 

I'm pleased to personally extend an early invitation to Astant's first in-person event of 2026, where we will present our upcoming macro quantitative intelligence AI-powered platform and outline our strategy plan for the year. Full program details, including agenda and post-event gathering, will be shared in the coming weeks with your secretary.

The reason for this email is that our founding team has been focused on bringing the company to a fully mature, post-early-stage state before entering a phase of significant scaling. We wanted to personally reconnect and share a few updates on our progress since then. Last week, Astant was featured in **Forbes Italia** as one of the top three fastest-growing and high-potential ventures launched within IE's entrepreneurship ecosystem. 

Astant was the only venture founded by undergraduate alumni, selected from over 2,000 applications through IE's main innovation center pipeline (IE Venture Lab), alongside two other startups founded by ex IE MBA alums, highlighting our commitment to remain at the intersection of quantitative finance and innovation in the age of Gen AI. You can find the feature here (in Italian, with a screenshot of an English version attached):
https://nextleaders.forbes.it/da-studenti-a-imprenditori/

Regarding our current developments, we are also preparing to launch **OpenMacro**, our flagship AI-driven super macro intelligence platform, designed to bridge the last gap in finance:

**Alpha Decay**, the last barrier between institutional capital and retail capital, as well as the possibility of going for a narrow and empty market when the current alternative landscape is saturated with overpriced and unjustified fee structures in a business model that ultimately rewards tradition and not innovation / performance.

A draft of the web app, which is currently under development, is available here: https://openmacro.ai/ (please keep in mind this is far from being the final version). Our Goal is to demonstrate our product's capabilities and innovative features while directly answering the first question that came up during your previous discussions: Why Astant and not BlackRock or Citadel? Our leadership understands the seriousness of involving your company as a serious, strategic partner and key player to assess aggressive market penetration, early adoption across EMEA, while fueling our growth, vision and credibility.

 We've taken the time to address key aspects that have been mentioned as missing in previous meetings. We would be delighted to invite you to our office this week or the next according to your availability, to meet the founding team and discuss our latest developments as we are currently engaging in our pre-scaling phase. Our office address is [OFFICE_ADDRESS]. We are ready to welcome you, move forward and take Astant to the next level alongside [RECIPIENT_COMPANY]'s advisory.

The team and I are at your disposal if you have any questions. We look forward to hearing from you. 

Sincerely,

[SENDER_NAME]
[SENDER_TITLE]
Astant Global Management`
}

// ============================================
// VC COLD OUTREACH (Shorter version)
// ============================================

export const JEAN_FRANCOIS_VC_COLD: EmailTemplate = {
  id: 'jf-vc-cold-v1',
  name: "VC Cold Outreach (Short)",
  description: "Cold outreach to VCs who don't have prior relationship with Astant",
  author: 'Jean-François Manigo Gilardoni',
  category: 'investor',
  createdAt: '2026-01-10',
  
  placeholders: [
    { field: 'RECIPIENT_NAME', description: 'First name of the VC', required: true },
    { field: 'FIRM_NAME', description: 'Name of the VC firm', required: true },
    { field: 'INVESTMENT_FOCUS', description: 'What they invest in', required: false, defaultValue: 'fintech and AI' },
    { field: 'SENDER_NAME', description: 'Full name of the sender', required: true },
    { field: 'SENDER_FIRST_NAME', description: 'First name of the sender', required: true },
    { field: 'SENDER_TITLE', description: 'Job title of the sender', required: true },
  ],
  
  subject: `Quick intro - Astant x [FIRM_NAME]`,
  
  body: `Good morning [RECIPIENT_NAME],

I'm [SENDER_FIRST_NAME] from Astant Global Management, reaching out on behalf of Astant's founding team.

I came across [FIRM_NAME]'s work in [INVESTMENT_FOCUS] and thought there might be a strong fit with what we're building at Astant.

Last week, Astant was featured in Forbes Italia as one of the top three fastest-growing and high-potential ventures launched within IE's entrepreneurship ecosystem, selected from over 2,000 applications. We were the only venture founded by undergraduate alumni.

We're preparing to launch OpenMacro, our flagship AI-driven macro intelligence platform, designed to bridge the last gap between institutional capital and retail capital. A draft of the platform is available here: https://openmacro.ai/

Our founding team would be delighted to connect and share our latest developments as we enter our pre-scaling phase. Would you have 20 minutes for a brief call this week or next?

The team and I are at your disposal if you have any questions. We look forward to hearing from you.

Sincerely,

[SENDER_NAME]
[SENDER_TITLE]
Astant Global Management`
}

// ============================================
// FOLLOW-UP TEMPLATE
// ============================================

export const JEAN_FRANCOIS_FOLLOW_UP: EmailTemplate = {
  id: 'jf-follow-up-v1',
  name: "Professional Follow-up",
  description: "Professional follow-up after no response",
  author: 'Jean-François Manigo Gilardoni',
  category: 'follow-up',
  createdAt: '2026-01-10',
  
  placeholders: [
    { field: 'RECIPIENT_NAME', description: 'First name of the recipient', required: true },
    { field: 'RECIPIENT_COMPANY', description: 'Their company/firm name', required: true },
    { field: 'SENDER_NAME', description: 'Full name of the sender', required: true },
    { field: 'SENDER_FIRST_NAME', description: 'First name of the sender', required: true },
    { field: 'SENDER_TITLE', description: 'Job title of the sender', required: true },
  ],
  
  subject: `Re: Astant Global Management – Following Up`,
  
  body: `Good morning [RECIPIENT_NAME],

I wanted to follow up on my previous email regarding Astant's upcoming developments and our invitation.

I understand you have a busy schedule, so I'll keep this brief: we're seeing strong momentum heading into 2026 and would love to share what we've been working on.

Our team remains keen to reconnect at your earliest convenience. We're flexible with timing and happy to work around your availability.

Please let us know if there's a better time to connect, or if you'd prefer we coordinate directly with your assistant.

Looking forward to hearing from you.

Sincerely,

[SENDER_NAME]
[SENDER_TITLE]
Astant Global Management`
}

// ============================================
// ALL TEMPLATES REGISTRY
// ============================================

export const ALL_TEMPLATES: EmailTemplate[] = [
  JEAN_FRANCOIS_INVESTOR_OUTREACH,
  JEAN_FRANCOIS_VC_COLD,
  JEAN_FRANCOIS_FOLLOW_UP,
]

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTemplateById(id: string): EmailTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id)
}

export function getTemplatesByCategory(category: EmailTemplate['category']): EmailTemplate[] {
  return ALL_TEMPLATES.filter(t => t.category === category)
}

export function getTemplatesByAuthor(author: string): EmailTemplate[] {
  return ALL_TEMPLATES.filter(t => t.author.toLowerCase().includes(author.toLowerCase()))
}

// ============================================
// PERSONALIZATION FUNCTION
// Only replaces placeholders - NO other changes
// ============================================

export interface ContactInfo {
  name?: string
  firstName?: string
  first_name?: string  // snake_case variant from database
  lastName?: string
  last_name?: string   // snake_case variant from database
  company?: string
  firm?: string
  role?: string
  investmentFocus?: string
  investment_focus?: string  // snake_case variant from database
  relationshipContext?: string
  meetingReference?: string
  notes?: string
  [key: string]: string | undefined
}

export interface SenderInfo {
  id: string
  name: string
  firstName: string
  title: string
  email: string
}

export function personalizeEmail(
  template: EmailTemplate,
  contact: ContactInfo,
  sender?: SenderInfo
): { subject: string; body: string; replacements: Array<{ placeholder: string; value: string }> } {
  
  let subject = template.subject
  let body = template.body
  const replacements: Array<{ placeholder: string; value: string }> = []
  
  // ============================================
  // DYNAMIC PLACEHOLDER REPLACEMENT
  // Supports [BRACKETS], {curly_braces}, and {{double_curly}}
  // Maps common placeholder names to contact/sender data
  // ============================================
  
  // Get contact values with fallbacks
  const firstName = contact.firstName || contact.first_name || contact.name?.split(' ')[0] || ''
  const lastName = contact.lastName || contact.last_name || contact.name?.split(' ').slice(1).join(' ') || ''
  const fullName = contact.name || `${firstName} ${lastName}`.trim() || ''
  const company = contact.company || contact.firm || ''
  const firm = contact.firm || contact.company || ''
  const investmentFocus = contact.investmentFocus || contact.investment_focus || ''
  const role = contact.role || ''
  const notes = contact.notes || ''
  
  // Build comprehensive replacement map (case-insensitive matching)
  const replacementMap: Record<string, string> = {
    // First name variations
    'first_name': firstName,
    'firstname': firstName,
    'first': firstName,
    'recipient_name': firstName,
    'name': firstName || fullName,
    
    // Last name variations
    'last_name': lastName,
    'lastname': lastName,
    'last': lastName,
    
    // Full name
    'full_name': fullName,
    'fullname': fullName,
    'recipient_full_name': fullName,
    
    // Company/Firm variations
    'company': company || firm,
    'firm': firm || company,
    'firm_name': firm || company,
    'firmname': firm || company,
    'organization': company || firm,
    'recipient_company': company || firm,
    
    // Investment focus variations
    'investment_focus': investmentFocus,
    'investmentfocus': investmentFocus,
    'focus': investmentFocus,
    'sector': investmentFocus,
    'industry': investmentFocus,
    
    // Role/Title
    'role': role,
    'title': role,
    'position': role,
    'recipient_title': role,
    
    // Notes/Context
    'notes': notes,
    'context': notes,
    'custom_context': notes,
    'relationship_context': contact.relationshipContext || '',
    'meeting_reference': contact.meetingReference || '',
    
    // Sender placeholders
    'sender_name': sender?.name || 'Jean-François Manigo Gilardoni',
    'sendername': sender?.name || 'Jean-François Manigo Gilardoni',
    'sender_first_name': sender?.firstName || 'Jean-François',
    'sender_firstname': sender?.firstName || 'Jean-François',
    'sender_title': sender?.title || 'Global Partnerships & Expansion Lead',
    'sendertitle': sender?.title || 'Global Partnerships & Expansion Lead',
    'sender_email': sender?.email || 'jean.francois@astantglobal.com',
    'senderemail': sender?.email || 'jean.francois@astantglobal.com',
    
    // Static values
    'office_address': 'Paseo de la Castellana, 280 (Loom, 1st floor)',
    'company_name': 'Astant Global Management',
    'product_name': 'OpenMacro',
  }
  
  // Function to replace placeholders in text
  const replacePlaceholders = (text: string): string => {
    // Match [PLACEHOLDER], {placeholder}, {{placeholder}}
    const patterns = [
      /\[([A-Z_]+)\]/g,           // [UPPERCASE_WITH_UNDERSCORES]
      /\[([a-z_]+)\]/g,           // [lowercase_with_underscores]
      /\{([a-z_]+)\}/g,           // {lowercase_with_underscores}
      /\{\{([a-z_]+)\}\}/g,       // {{lowercase_with_underscores}}
    ]
    
    let result = text
    
    for (const pattern of patterns) {
      result = result.replace(pattern, (match, placeholder) => {
        const key = placeholder.toLowerCase()
        const value = replacementMap[key]
        
        if (value !== undefined && value !== '') {
          // Track replacement
          if (!replacements.find(r => r.placeholder.toLowerCase() === key)) {
            replacements.push({ placeholder: placeholder, value })
          }
          return value
        }
        
        // Check if contact has this key directly
        const directValue = contact[key] || contact[placeholder]
        if (directValue) {
          if (!replacements.find(r => r.placeholder.toLowerCase() === key)) {
            replacements.push({ placeholder: placeholder, value: directValue })
          }
          return directValue
        }
        
        // Leave placeholder as-is if no value found (but log it)
        console.log(`[PERSONALIZE] No value for placeholder: ${match}`)
        return match
      })
    }
    
    return result
  }
  
  // Apply replacements
  subject = replacePlaceholders(subject)
  body = replacePlaceholders(body)
  
  return { subject, body, replacements }
}

// ============================================
// BATCH PERSONALIZATION
// ============================================

export function batchPersonalize(
  template: EmailTemplate,
  contacts: ContactInfo[],
  sender?: SenderInfo
): Array<{ contact: ContactInfo; subject: string; body: string; replacements: Array<{ placeholder: string; value: string }> }> {
  
  return contacts.map(contact => ({
    contact,
    ...personalizeEmail(template, contact, sender)
  }))
}
