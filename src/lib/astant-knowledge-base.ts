// ============================================
// ASTANT GLOBAL MANAGEMENT - COMPLETE KNOWLEDGE BASE
// This powers A-grade email generation
// ============================================

export const ASTANT_KNOWLEDGE = {
  // ===== COMPANY IDENTITY =====
  company: {
    name: 'Astant Global Management',
    tagline: 'Democratizing Quant & Machine Learning-Driven Strategies',
    type: 'Emerging Quantitative Investment Firm',
    stage: 'Pre-scaling / Post-early-stage',
    headquarters: 'Paseo de la Castellana, 280 (Loom, 1st floor), Madrid, Spain',
    founded: 'IE University Entrepreneurship Ecosystem',
    distinction: 'Only venture founded by undergraduate alumni selected from 2,000+ applications through IE Venture Lab',
  },

  // ===== TEAM =====
  team: {
    fahd: {
      name: 'Fahd El Ghorfi',
      role: 'Founder & CEO',
      background: 'IE University, focused on bringing company to post-early-stage maturity before scaling',
      style: 'Strategic, relationship-focused, hands-on with key partners',
    },
    jeanfrancois: {
      name: 'Jean-François Manigo Gilardoni',
      role: 'Global Partnerships & Expansion',
      background: 'Recently joined to support global partnerships and expansion initiatives',
      style: 'Professional, warm, detail-oriented in communications',
    },
    marcos: {
      name: 'Marcos',
      role: 'Partner',
      background: 'Core team member',
    },
  },

  // ===== FLAGSHIP PRODUCT: OPENMACRO =====
  openMacro: {
    name: 'OpenMacro',
    tagline: 'AI-Driven Super Macro Intelligence Platform',
    url: 'https://openmacro.ai/',
    status: 'Currently under development (draft web app available)',
    
    mission: `Democratizing Quant & machine learning-driven strategies and high-quant institutional 
research, bringing the analytical power once exclusive to top hedge funds and investment banks 
to the broader professional market.`,

    thesis: `Based on the conviction that the institutional edge will begin to erode dramatically 
over the next few years, and collapse in large part by the end of the decade. By 2030, we expect 
a radical shift: the traditional institutional research edge will largely disappear — replaced 
by a new era of AI-powered, macro-intelligent investing available to anyone.`,

    problem: `Today, macro-quant research remains a closed ecosystem. Only the largest financial 
institutions possess the advanced mathematical models, proprietary data, and PhD-level research 
teams required to connect macroeconomic variables — such as labor markets, money supply, inflation, 
liquidity, and monetary and fiscal policy — to quantitative investment strategies and financial 
asset behavior.`,

    solution: `OpenMacro is the underlying infrastructure powering the next era of macro-intelligent 
investing, enabling a new generation of investors to operate with institutional precision in an 
open, data-driven world.`,

    alphaDecay: `The last barrier between institutional capital and retail capital. The current 
alternative landscape is saturated with overpriced and unjustified fee structures in a business 
model that ultimately rewards tradition and not innovation/performance.`,

    differentiators: [
      'Access to private data + market signals',
      'Mitigated risk through understanding',
      'Democratized hedge fund solutions and tools',
      'What users can now do that they couldn\'t before',
    ],
  },

  // ===== MARKET COVERAGE =====
  coverage: {
    markets: '65+ global markets',
    assetClasses: ['Equities', 'FX', 'Rates', 'Commodities', 'Crypto'],
    instruments: ['Spot/ETFs', 'Futures', 'Options'],
    executionModes: ['Discretionary', 'Non-discretionary', 'Fully systematic'],
  },

  // ===== REGULATORY & COMPLIANCE =====
  regulatory: {
    current: ['PSD2 (EU)', 'GDPR (EU)'],
    roadmap: 'EU + non-EU expansion + USA',
    note: 'Clear regulatory positioning and roadmap for global expansion',
  },

  // ===== PRESS & RECOGNITION =====
  press: {
    forbes: {
      outlet: 'Forbes Italia',
      feature: 'Top 3 fastest-growing and high-potential ventures from IE University ecosystem',
      url: 'https://nextleaders.forbes.it/da-studenti-a-imprenditori/',
      highlight: 'Selected from over 2,000 applications through IE Venture Lab',
    },
    businessInsider: {
      outlet: 'Business Insider',
      url: 'https://docs.google.com/document/d/1fUucuByfXi9CwOAgPdo59aBmIL03HEWTxnduu9kd2wE/edit',
    },
    moroccoWorldNews: {
      outlet: 'Morocco World News',
    },
  },

  // ===== COMPETITIVE POSITIONING =====
  competitive: {
    comparison: 'Why Astant and not BlackRock or Citadel?',
    edge: `While large institutions retain advantage through superior human capital and specialized 
research talent, the magnitude of their alpha generation will shrink substantially as modeling 
and analytical capabilities become fully democratized.`,
    proof: 'Alpha Decay thesis with backtesting/performance evidence',
  },

  // ===== CURRENT INITIATIVES =====
  initiatives: {
    websiteRedesign: {
      partner: 'Atlas IR',
      style: 'Simple - Clean - Professional (like Blackstone, Mirabaud)',
      timeline: '1 month for website, 3 months for SEO',
      features: ['Factsheet hub', 'Update archive', 'Mailing list', 'Data room', 'KPI widgets'],
    },
    events: {
      upcoming: 'First in-person event of 2026',
      content: 'Present upcoming macro quantitative intelligence AI-powered platform and strategy plan',
    },
  },

  // ===== PORTFOLIO =====
  portfolio: {
    focus: 'European B2B SaaS',
    status: 'Supporting three dynamic portfolio companies',
    offering: 'AI-powered tools for investor relations and due diligence',
  },

  // ===== KEY LINKS =====
  links: {
    openMacro: 'https://openmacro.ai/',
    forbes: 'https://nextleaders.forbes.it/da-studenti-a-imprenditori/',
    businessInsider: 'https://docs.google.com/document/d/1fUucuByfXi9CwOAgPdo59aBmIL03HEWTxnduu9kd2wE/edit',
  },
}

// ===== EMAIL CONTEXT BUILDER =====
export function buildEmailContext(contactType: 'vc' | 'media' | 'client' | 'partner' | 'strategic'): string {
  const k = ASTANT_KNOWLEDGE

  const baseContext = `
=== ABOUT ASTANT GLOBAL MANAGEMENT ===
${k.company.name} is an emerging quantitative investment firm developing OpenMacro, 
an AI-driven super macro intelligence platform.

MISSION: ${k.openMacro.mission}

THESIS: ${k.openMacro.thesis}

KEY PROBLEM WE SOLVE: ${k.openMacro.problem}

OUR SOLUTION: ${k.openMacro.solution}

ALPHA DECAY CONCEPT: ${k.openMacro.alphaDecay}

=== CREDIBILITY & RECOGNITION ===
- Featured in Forbes Italia as one of the top 3 fastest-growing ventures from IE University
- Selected from 2,000+ applications through IE Venture Lab
- Only venture founded by undergraduate alumni (vs MBA alumni competitors)
- Forbes Feature: ${k.links.forbes}

=== PRODUCT CAPABILITIES ===
- 65+ global markets coverage
- Asset Classes: Equities, FX, Rates, Commodities, Crypto
- Instruments: Spot/ETFs, Futures, Options
- Execution Modes: Discretionary, Non-discretionary, Fully systematic
- Demo: ${k.links.openMacro}

=== TEAM ===
- Fahd El Ghorfi: Founder & CEO
- Jean-François Manigo Gilardoni: Global Partnerships & Expansion
- Marcos: Partner

=== OFFICE ===
Paseo de la Castellana, 280 (Loom, 1st floor), Madrid, Spain
`

  const vcContext = `
=== VC-SPECIFIC CONTEXT ===
We're in pre-scaling phase, having deliberately focused on reaching post-early-stage maturity.

KEY QUESTION WE ANSWER: "Why Astant and not BlackRock or Citadel?"
→ We're building the infrastructure for the next era of macro-intelligent investing
→ Large institutions' alpha advantage will shrink as capabilities democratize
→ By 2030, AI-powered macro investing will be available to anyone

COMPETITIVE EDGE:
- Access to private data + market signals
- Democratized hedge fund solutions (what users can now do that they couldn't before)
- Clear regulatory roadmap (EU, non-EU, USA expansion)

PORTFOLIO: Supporting 3 dynamic European B2B SaaS companies (follow-on funding candidates)
`

  const mediaContext = `
=== MEDIA-SPECIFIC CONTEXT ===
STORY ANGLES:
1. "From Students to Entrepreneurs" - IE University success story
2. "Democratizing Hedge Fund Intelligence" - Disrupting the closed ecosystem
3. "The Alpha Decay Thesis" - Why institutional edge will disappear by 2030
4. "AI-Powered Macro Investing" - The future of retail investment

PREVIOUS COVERAGE:
- Forbes Italia (Next Leaders feature)
- Business Insider
- Morocco World News

FOUNDER STORY: 
Fahd El Ghorfi built Astant from IE University, competing against MBA-founded ventures
and being selected from 2,000+ applications.
`

  const partnerContext = `
=== STRATEGIC PARTNER CONTEXT ===
We're seeking partners who can:
- Assess aggressive market penetration across EMEA
- Drive early adoption
- Fuel growth, vision, and credibility

WHAT WE OFFER:
- First-mover advantage in democratized quant investing
- AI-powered platform with institutional-grade capabilities
- Clear path to 2030 vision

CURRENT PHASE: Pre-scaling, ready to take Astant to the next level
`

  let typeSpecificContext = ''
  switch (contactType) {
    case 'vc':
      typeSpecificContext = vcContext
      break
    case 'media':
      typeSpecificContext = mediaContext
      break
    case 'partner':
    case 'strategic':
      typeSpecificContext = partnerContext
      break
    default:
      typeSpecificContext = vcContext
  }

  return baseContext + typeSpecificContext
}

// ===== RELATIONSHIP CONTEXT BUILDER =====
export function buildRelationshipContext(contact: {
  previousMeetings?: string
  pastInteractions?: string
  mutualConnections?: string
  referredBy?: string
  lastContact?: string
  notes?: string
}): string {
  if (!contact.previousMeetings && !contact.pastInteractions && !contact.mutualConnections && !contact.referredBy && !contact.notes) {
    return ''
  }

  let context = '\n=== RELATIONSHIP HISTORY ===\n'
  
  if (contact.referredBy) {
    context += `Referred by: ${contact.referredBy}\n`
  }
  if (contact.previousMeetings) {
    context += `Previous Meetings: ${contact.previousMeetings}\n`
  }
  if (contact.pastInteractions) {
    context += `Past Interactions: ${contact.pastInteractions}\n`
  }
  if (contact.mutualConnections) {
    context += `Mutual Connections: ${contact.mutualConnections}\n`
  }
  if (contact.lastContact) {
    context += `Last Contact: ${contact.lastContact}\n`
  }
  if (contact.notes) {
    context += `Notes: ${contact.notes}\n`
  }

  return context
}

// ===== STORYTELLING HOOKS =====
export const STORYTELLING_HOOKS = {
  forbesFeature: `Last week, Astant was featured in Forbes Italia as one of the top three 
fastest-growing and high-potential ventures launched within IE's entrepreneurship ecosystem. 
Astant was the only venture founded by undergraduate alumni, selected from over 2,000 applications 
through IE's main innovation center pipeline (IE Venture Lab), alongside two other startups 
founded by ex IE MBA alums, highlighting our commitment to remain at the intersection of 
quantitative finance and innovation in the age of Gen AI.`,

  alphaDecayNarrative: `We are preparing to launch OpenMacro, our flagship AI-driven super macro 
intelligence platform, designed to bridge the last gap in finance: Alpha Decay, the last barrier 
between institutional capital and retail capital, as well as the possibility of going for a 
narrow and empty market when the current alternative landscape is saturated with overpriced 
and unjustified fee structures in a business model that ultimately rewards tradition and not 
innovation/performance.`,

  visionStatement: `OpenMacro is more than a platform — it is the underlying infrastructure 
powering the next era of macro-intelligent investing, enabling a new generation of investors 
to operate with institutional precision in an open, data-driven world.`,

  competitiveAnswer: `Our Goal is to demonstrate our product's capabilities and innovative 
features while directly answering the first question that came up: Why Astant and not 
BlackRock or Citadel?`,

  maturityJourney: `We have been focused on bringing the company to a fully mature, 
post-early-stage state before entering a phase of significant scaling.`,

  eventInvite: `I'm pleased to personally extend an early invitation to Astant's first 
in-person event of 2026, where we will present our upcoming macro quantitative intelligence 
AI-powered platform and outline our strategy plan for the year.`,
}

// ===== EMAIL PERSONALITY STYLES =====
export const EMAIL_STYLES = {
  jeanfrancois: {
    greeting: 'Good morning',
    tone: 'Professional yet warm, relationship-focused',
    structure: 'Long-form with clear sections, storytelling approach',
    signoff: 'Sincerely,',
    characteristics: [
      'References specific past interactions',
      'Includes concrete next steps',
      'Provides context before asking',
      'Uses formal but approachable language',
    ],
  },
  fahd: {
    greeting: 'Hi',
    tone: 'Direct, strategic, founder-to-founder',
    structure: 'Concise with clear value proposition',
    signoff: 'Best,',
    characteristics: [
      'Gets to the point quickly',
      'Emphasizes vision and strategy',
      'Invites collaboration',
      'Confident but not arrogant',
    ],
  },
  marcos: {
    greeting: 'Hello',
    tone: 'Technical, detail-oriented',
    structure: 'Structured with clear sections',
    signoff: 'Best regards,',
    characteristics: [
      'Focuses on product capabilities',
      'Includes relevant technical details',
      'Clear and methodical',
    ],
  },
}
