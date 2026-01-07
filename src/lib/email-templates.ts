// ============================================
// EMAIL TEMPLATES - ASTANT GLOBAL MANAGEMENT
// Professional Templates for AI-Powered Generation
// ============================================

export type TemplateCategory = 'vc-outreach' | 'media-outreach' | 'client-outreach'

export interface EmailTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  subject: string
  body: string
  recommendedSender?: string // 'jean-francois' | 'fahd' | 'marcos'
  tags?: string[] // For filtering
}

// ============================================
// VC OUTREACH TEMPLATES (4)
// ============================================

const vcTemplates: EmailTemplate[] = [
  {
    id: 'vc-q1-intro',
    name: 'Q1 VC Introduction',
    category: 'vc-outreach',
    description: 'Professional Q1 introduction for VCs with Forbes validation and co-investment focus',
    recommendedSender: 'jean-francois',
    tags: ['q1', 'introduction', 'forbes'],
    subject: 'Astant Global Management – Q1 Introduction & Co-Investment Opportunity',
    body: `Dear {{first_name}},

I hope this message finds you well. I'm reaching out from Astant Global Management, a Madrid-based macro quantitative intelligence firm recently featured in Forbes Italia as one of the top high-potential ventures emerging from IE's entrepreneurship ecosystem.

At Astant, we are building OpenMacro, an AI-driven macro intelligence platform designed to bridge one of the last structural gaps in finance: the divide between institutional and retail macro insight. Our founding team includes Fahd El Ghorfi (23) and Marcos Agustín (21), two of Europe's youngest legally registered macro fund managers.

Given {{firm}}'s investment focus and portfolio composition, I believe there may be meaningful alignment between our vision and your thesis.

I would love to explore potential co-investment opportunities or discuss broader collaboration. Would you be open to a 15-minute introductory call next week?

Looking forward to the possibility of working together.

Best regards,`
  },
  {
    id: 'vc-forbes-validation',
    name: 'Forbes Validation Lead',
    category: 'vc-outreach',
    description: 'Lead with Forbes Italia recognition and platform demo',
    recommendedSender: 'fahd',
    tags: ['forbes', 'validation', 'demo'],
    subject: 'Forbes Italia Featured – OpenMacro AI Platform Investment Opportunity',
    body: `Dear {{first_name}},

I'm Fahd El Ghorfi, Co-Founder and Chief Investment Officer at Astant Global Management. I wanted to personally reach out following our recent recognition in Forbes Italia as one of the top three fastest-growing ventures from IE's innovation ecosystem.

We were the only venture founded by undergraduate alumni, selected from over 2,000 applications, highlighting our commitment to remaining at the intersection of quantitative finance and innovation in the age of Generative AI.

Forbes Feature: https://nextleaders.forbes.it/da-studenti-a-imprenditori/

At Astant, we are preparing to launch OpenMacro, our flagship AI-driven macro intelligence platform. A demo version is available here: https://openmacro.ai/

Our platform addresses a fundamental challenge: alpha decay and the structural divide between institutional and retail capital. I believe this aligns well with {{firm}}'s focus on {{investment_focus}}.

Would you be available for a 20-minute call this week or next to discuss potential synergies?

Sincerely,`
  },
  {
    id: 'vc-strategic-alignment',
    name: 'Strategic Portfolio Alignment',
    category: 'vc-outreach',
    description: 'For VCs with relevant portfolio companies - highlight strategic value',
    recommendedSender: 'marcos',
    tags: ['strategic', 'portfolio', 'partnership'],
    subject: 'Strategic Alignment – Astant Global Management x {{firm}}',
    body: `Dear {{first_name}},

I'm Marcos Agustín, CEO and Co-Founder of Astant Global Management. I've been following {{firm}}'s portfolio closely, and I believe there's a compelling strategic opportunity worth exploring.

At Astant, we've built OpenMacro, an AI-powered macro intelligence platform that transforms how institutional-grade market analysis is accessed and utilized. We were recently featured in Forbes Italia and are currently in discussions with S&P Global for strategic collaboration.

Key milestones:
• Featured in Forbes Italia as a top high-potential venture
• Proprietary quant-AI model for macro signal detection
• Live demo platform: https://openmacro.ai/
• Currently in pre-scaling phase with strong momentum

Given your investments in the fintech and AI space, I see potential for both direct investment and portfolio synergies. Several of your portfolio companies could benefit from our macro intelligence infrastructure.

I would welcome the opportunity to share our detailed thesis and explore alignment. Could we schedule a call at your convenience?

Best regards,`
  },
  {
    id: 'vc-follow-up',
    name: 'VC Follow-Up',
    category: 'vc-outreach',
    description: 'Professional follow-up for VCs who haven\'t responded',
    recommendedSender: 'jean-francois',
    tags: ['follow-up', 'reminder'],
    subject: 'Following Up – Astant Global Management',
    body: `Dear {{first_name}},

I hope you're well. I wanted to briefly follow up on my previous message regarding Astant Global Management.

Since my last outreach, we've continued to build momentum:

• Completed our Forbes Italia feature (link below)
• Advanced discussions with institutional partners including S&P Global
• Expanded our OpenMacro platform capabilities
• Moved into our pre-scaling phase

Forbes Feature: https://nextleaders.forbes.it/da-studenti-a-imprenditori/
Platform Demo: https://openmacro.ai/

I understand you receive many requests, but I believe there's genuine alignment between what we're building and {{firm}}'s investment focus. Even a brief 15-minute call would be valuable.

Would you have any availability this week or next?

Thank you for your time.

Best regards,`
  },
]

// ============================================
// MEDIA OUTREACH TEMPLATES (3)
// ============================================

const mediaTemplates: EmailTemplate[] = [
  {
    id: 'media-story-pitch',
    name: 'Story Pitch – Young Founders',
    category: 'media-outreach',
    description: 'Compelling story pitch about young founders disrupting finance',
    recommendedSender: 'jean-francois',
    tags: ['story', 'pitch', 'founders'],
    subject: 'Story Pitch: Europe\'s Youngest Fund Managers Building AI-Powered Macro Platform',
    body: `Dear {{first_name}},

I hope you're doing well. I'm reaching out from Astant Global Management because I believe we have a story that would resonate strongly with your audience.

The Story:
Two of Europe's youngest legally registered macro fund managers – Fahd El Ghorfi (23) and Marcos Agustín (21) – are building OpenMacro, an AI-driven platform designed to bridge the last structural divide in finance: the gap between institutional and retail macro insight.

Why It Matters:
• We were just featured in Forbes Italia as one of the top high-potential startups
• Selected from 2,000+ applications – the only undergraduate-founded venture
• Currently in discussions with S&P Global for strategic partnership
• Launching our platform in Q1 2026

Resources Available:
• Full press kit with founder bios and high-res images
• Forbes Italia feature: https://nextleaders.forbes.it/da-studenti-a-imprenditori/
• Platform demo access: https://openmacro.ai/
• Exclusive founder interviews

I would be happy to coordinate a call or provide any additional materials your team might need. Would you be interested in exploring a feature?

Best regards,`
  },
  {
    id: 'media-exclusive-launch',
    name: 'Exclusive Launch Coverage',
    category: 'media-outreach',
    description: 'Offering exclusive coverage for platform launch',
    recommendedSender: 'fahd',
    tags: ['exclusive', 'launch', 'coverage'],
    subject: 'Exclusive Opportunity: AI Platform Launch by Forbes-Featured Fintech',
    body: `Dear {{first_name}},

I'm Fahd El Ghorfi, Co-Founder of Astant Global Management. I wanted to extend an exclusive opportunity regarding our upcoming platform launch.

We are preparing to unveil OpenMacro, our AI-driven macro intelligence platform, and would like to offer your publication exclusive coverage rights for the announcement.

The Exclusive:
• First-look at the platform before public launch
• In-depth interviews with both co-founders
• Access to our Madrid launch event
• Behind-the-scenes access to our technology and methodology

Our Story:
We were recently featured in Forbes Italia as one of the top three fastest-growing ventures from IE's ecosystem. At ages 21 and 23, Marcos and I became two of Europe's youngest legally registered macro fund managers, and we're now building the infrastructure to democratize institutional-grade macro intelligence.

The launch is scheduled for January 2026. I would be happy to arrange a preview call, provide press materials, or discuss how we can tailor the exclusive to your editorial vision.

Looking forward to your thoughts.

Sincerely,`
  },
  {
    id: 'media-forbes-follow-up',
    name: 'Post-Forbes Follow-Up',
    category: 'media-outreach',
    description: 'Follow-up leveraging existing Forbes coverage',
    recommendedSender: 'jean-francois',
    tags: ['follow-up', 'forbes', 'momentum'],
    subject: 'Following Up – Additional Angles on Our Forbes Italia Feature',
    body: `Dear {{first_name}},

I hope you're well. I wanted to briefly follow up on my previous message and share some updates.

Since our feature in Forbes Italia, we've seen significant momentum:

• Platform development advancing ahead of schedule
• Strategic discussions with S&P Global progressing
• Growing interest from institutional investors
• Preparing for our Q1 2026 launch event in Madrid

I believe there are several angles beyond the Forbes piece that could interest your audience:

1. The AI-in-Finance angle: How our proprietary models detect macro signals
2. The democratization story: Bridging institutional and retail intelligence
3. The young founders narrative: What it means to be registered fund managers at 21 and 23
4. The European fintech ecosystem: Madrid as an emerging hub

I would be happy to coordinate an interview, provide updated materials, or arrange platform access for your team.

Thank you for your time.

Warm regards,`
  },
]

// ============================================
// CLIENT OUTREACH TEMPLATES (3)
// ============================================

const clientTemplates: EmailTemplate[] = [
  {
    id: 'client-q1-event',
    name: 'Q1 Event Invitation',
    category: 'client-outreach',
    description: 'Formal invitation to in-person event and platform presentation',
    recommendedSender: 'jean-francois',
    tags: ['event', 'invitation', 'q1'],
    subject: 'Invitation: Astant\'s Q1 2026 Strategy Presentation & OpenMacro Unveiling',
    body: `Dear {{first_name}},

I'm Jean-François from Astant Global Management, reaching out on behalf of Fahd El Ghorfi and Marcos Agustín regarding an upcoming milestone for our firm.

I'm pleased to extend a personal invitation to Astant's first in-person event of 2026, where we will present our macro quantitative intelligence AI-powered platform and outline our strategy for the year.

Event Highlights:
• Exclusive OpenMacro platform demonstration
• 2026 strategic roadmap presentation
• Networking reception with industry leaders

Over the past months, Fahd and Marcos have been focused on bringing the company to a fully mature, post-early-stage state before entering significant scaling. They wanted to personally reconnect and share updates on our progress, including our recent Forbes Italia feature.

The event will be held at our office on Paseo de la Castellana, 280 (Loom, 1st floor). Full program details will follow.

Would you be available to attend? We would be delighted to accommodate your schedule.

Sincerely,`
  },
  {
    id: 'client-partnership-proposal',
    name: 'Strategic Partnership Proposal',
    category: 'client-outreach',
    description: 'Formal partnership proposal for potential clients and strategic partners',
    recommendedSender: 'marcos',
    tags: ['partnership', 'strategic', 'proposal'],
    subject: 'Strategic Partnership Proposal – Astant Global Management x {{firm}}',
    body: `Dear {{first_name}},

I'm Marcos Agustín, CEO of Astant Global Management. I'm reaching out to explore a potential strategic partnership between our organizations.

At Astant, we are building OpenMacro, an AI-powered macro intelligence platform that transforms how market analysis is conducted and accessed. Given {{firm}}'s position in the market and your focus on {{investment_focus}}, I believe there's a compelling opportunity for collaboration.

Partnership Opportunities:
• Early platform access and API integration
• Co-branded market intelligence reports
• Joint go-to-market initiatives across EMEA
• White-label solutions for your client base
• Exclusive data partnerships

Our Credentials:
• Featured in Forbes Italia as a top high-potential venture
• Founded by Europe's youngest registered fund managers
• Currently in discussions with S&P Global
• Platform demo: https://openmacro.ai/

I believe a conversation could uncover meaningful ways to create value together. Would you be available for a call this week or next?

Best regards,`
  },
  {
    id: 'client-reconnect',
    name: 'Reconnect & Progress Update',
    category: 'client-outreach',
    description: 'Reconnect with previous contacts sharing recent progress',
    recommendedSender: 'fahd',
    tags: ['reconnect', 'update', 'follow-up'],
    subject: 'Reconnecting – Astant Global Management Progress Update',
    body: `Dear {{first_name}},

I hope this message finds you well. I wanted to personally reach out to share some updates since our last conversation.

Astant was recently featured in Forbes Italia as one of the top three fastest-growing ventures from IE's entrepreneurship ecosystem. We were the only venture founded by undergraduate alumni, selected from over 2,000 applications.

Forbes Feature: https://nextleaders.forbes.it/da-studenti-a-imprenditori/

Since we last spoke, we've been building OpenMacro, our flagship AI-driven macro intelligence platform. A demo is now live: https://openmacro.ai/

I took the personal decision to step back for a few months to work on many aspects that were mentioned in our previous discussions. We are now in our pre-scaling phase, with strategic discussions ongoing including S&P Global.

I would be delighted to invite you to our office to meet the team and discuss our latest developments. Our address is Paseo de la Castellana, 280 (Loom, 1st floor).

Looking forward to reconnecting.

Sincerely,`
  },
]

// ============================================
// EXPORTS
// ============================================

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  ...vcTemplates,
  ...mediaTemplates,
  ...clientTemplates,
]

export function getTemplatesByCategory(category: TemplateCategory): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter(t => t.category === category)
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id)
}

export function getTemplatesByTag(tag: string): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter(t => t.tags?.includes(tag))
}

export function getCategoryLabel(category: TemplateCategory): string {
  switch (category) {
    case 'vc-outreach': return 'VC Outreach'
    case 'media-outreach': return 'Media Outreach'
    case 'client-outreach': return 'Client Outreach'
  }
}

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'vc-outreach', label: 'VC Outreach' },
  { value: 'media-outreach', label: 'Media Outreach' },
  { value: 'client-outreach', label: 'Client Outreach' },
]

// Template variable placeholders for AI generation
export const TEMPLATE_VARIABLES = [
  '{{first_name}}',      // Contact's first name
  '{{last_name}}',       // Contact's last name
  '{{firm}}',            // Firm/company name
  '{{investment_focus}}', // Their investment focus areas
  '{{role}}',            // Their role/title
  '{{geography}}',       // Their geographic focus
]
