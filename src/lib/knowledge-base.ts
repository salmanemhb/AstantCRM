// ============================================
// KNOWLEDGE BASE LOADER
// Loads the claude-wizards knowledge base into the AI system
// ============================================

import fs from 'fs';
import path from 'path';

// ============================================
// GOLD STANDARD EMAILS
// These are the actual emails that got responses
// ============================================

export const GOLD_STANDARD_EMAILS = {
  jf_consulting_ceo: {
    id: 'jf-consulting-ceo',
    context: 'Cold outreach to consulting CEO for potential collaboration',
    result: 'Got a response',
    email: `Dear Daniel,

I hope this message finds you engaged in the exciting endeavors that define great leadership. As the CEO of a consulting company, your insights and experiences must span a fascinating range of challenges and triumphs.

I'm Jean-François M., co-founder of Astant Global Management, a boutique fund management and services firm. We specialize in delivering creative funding and management solutions, particularly for Real Estate, Hospitality, and Renewable Energy projects.

Your experience resonates with the kind of leadership and versatility we value. While your focus might not be directly in our sector, the strategic thinking required in your role is something we deeply appreciate and seek to learn from.

I would love to connect and learn about the unique challenges and victories in your journey. If you're open to it, even a brief exchange of ideas could be invaluable for us at Astant.

Thank you for considering this. I look forward to the possibility of connecting and learning from your experiences.

Warm regards,
Jean-François M.`,
    why_it_works: [
      'Opens with genuine compliment about their work',
      'Shows he did research on their company',
      'Humble - asks to LEARN, not to sell',
      'Short paragraphs, easy to read',
      'Warm but professional tone',
      'No corporate buzzwords'
    ],
    key_phrases: [
      'your insights and experiences must span',
      'the kind of leadership and versatility we value',
      'the strategic thinking required in your role',
      'seek to learn from',
      'even a brief exchange of ideas could be invaluable',
      'I look forward to the possibility of connecting'
    ]
  },

  jf_vc_partner: {
    id: 'jf-vc-partner',
    context: 'Introducing Astant to potential LP investor',
    result: 'Meeting scheduled',
    email: `Good morning Michael,

I recently came across Meridian Capital's work in the European real estate space - your approach to long-term value creation over quick flips caught my attention.

I'm Jean-François, recently joined Astant Global Management to lead our global partnerships. We're a Paris-based boutique fund, AMF-regulated, focused on real estate, hospitality, and renewables. What makes us a bit different is our "OpenMacro" thesis - we treat real estate as a macro asset class, which lets us spot opportunities most traditional funds miss.

Our founders made Forbes 30 Under 30 last year, but honestly the more interesting story is the thesis itself. We've been quietly building institutional relationships and the early results are validating the approach.

I'd genuinely value your perspective on where you see the European market heading. No pitch deck unless you want one - just curious to hear how you're thinking about the next 18 months.

Would a 20-minute call work sometime next week?

Best,
Jean-François`,
    why_it_works: [
      'Specific research on their portfolio',
      'Credibility without bragging',
      'Humble ask - positions them as expert',
      'Time respect - 20 minutes, specific',
      'No pitch deck pressure'
    ],
    key_phrases: [
      'caught my attention',
      'What makes us a bit different',
      'we\'ve been quietly building',
      'I\'d genuinely value your perspective',
      'No pitch deck unless you want one',
      'just curious to hear how you\'re thinking'
    ]
  },

  jf_family_office: {
    id: 'jf-family-office',
    context: 'Warm intro follow-up to family office principal',
    result: 'Due diligence process started',
    email: `Dear Sophie,

Thomas mentioned you might be exploring alternative real estate strategies for the family office - I wanted to follow up on his kind introduction.

Quick context on us: Astant is a Paris-based fund focused on real estate, hospitality, and renewable energy. We're small by design (boutique, AMF-regulated), which lets us be nimble in ways larger funds can't.

What might interest you: we've developed what we call "Alpha Decay" analysis. Essentially, the arbitrage opportunities everyone chased in 2015-2018 are gone. Most funds haven't adapted their thesis. We have.

I'm not suggesting we're the right fit - that depends entirely on your allocation strategy and risk appetite. But I'd be happy to walk you through our approach if you're curious.

No pressure either way. Thomas has my number if you'd prefer an introduction call with him present.

Warm regards,
Jean-François`,
    why_it_works: [
      'Immediately references the connector',
      'Intellectual hook (Alpha Decay)',
      'Anti-pressure signals throughout',
      'Offers to include connector on call',
      'Acknowledges fit depends on them'
    ],
    key_phrases: [
      'I wanted to follow up on his kind introduction',
      'Quick context on us',
      'What might interest you',
      'I\'m not suggesting we\'re the right fit',
      'depends entirely on your',
      'No pressure either way'
    ]
  },

  jf_journalist: {
    id: 'jf-journalist',
    context: 'Pitching a story to financial journalist',
    result: 'Featured in publication',
    email: `Hi Claire,

Your piece on the shifting dynamics in European hospitality investment was sharp - particularly the point about over-leveraged portfolios from 2019 coming home to roost.

We're seeing exactly that play out from our side. I'm Jean-François from Astant Global Management, a boutique fund based in Paris. Our founders just made the Forbes 30 Under 30 list, but the actual story is more interesting than "young people in finance."

Our thesis - we call it OpenMacro - treats real estate as a macro asset class rather than just buildings. It's a different lens, and it's letting us spot distressed opportunities that traditional funds are missing because they're still using 2018 playbooks.

I could give you 15 minutes on what we're actually seeing in the market. Even if it's not a story, it's probably useful background for your hospitality coverage.

Let me know if you're interested.

Jean-François`,
    why_it_works: [
      'Opens with their work',
      'Story pitch, not self-promotion',
      'Value exchange offered',
      'Casual tone matches recipient'
    ],
    key_phrases: [
      'was sharp',
      'particularly the point about',
      'We\'re seeing exactly that play out from our side',
      'the actual story is more interesting than',
      'Even if it\'s not a story, it\'s probably useful background',
      'Let me know if you\'re interested'
    ]
  },

  jf_followup_1: {
    id: 'jf-followup-1',
    context: 'Second touch after no response',
    result: 'Got a meeting',
    email: `Hi Marcus,

Circling back on my note from two weeks ago - I know timing is everything with these things.

Quick update: we just closed our first institutional LP commitment, and our OpenMacro thesis is playing out exactly as modeled. Happy to share specifics if useful.

If the timing still isn't right, completely understand. But if European real estate macro is crossing your desk at all, might be worth a quick chat.

Best,
Jean-François`,
    why_it_works: [
      'Acknowledges reality without being needy',
      'Adds new information (progress)',
      'Very short',
      'Soft close'
    ],
    key_phrases: [
      'Circling back on my note from',
      'I know timing is everything',
      'Quick update',
      'Happy to share specifics if useful',
      'If the timing still isn\'t right, completely understand',
      'might be worth a quick chat'
    ]
  },

  jf_followup_final: {
    id: 'jf-followup-final',
    context: 'Final follow-up before moving on',
    result: 'Opened dialogue',
    email: `Marcus - 

Last note from me on this. If European real estate isn't a priority right now, I'll take the hint.

But if it's just been busy - we're hosting a small dinner in London next month with a few LPs and allocators. Informal, good conversation, better wine. Would be happy to add you if interested.

Either way, appreciate your time reading these.

JF`,
    why_it_works: [
      'Direct acknowledgment',
      'Offers different value (event)',
      'Graceful exit',
      'Very casual signature'
    ],
    key_phrases: [
      'Last note from me on this',
      'I\'ll take the hint',
      'if it\'s just been busy',
      'Would be happy to add you if interested',
      'Either way, appreciate your time'
    ]
  },

  jf_expert: {
    id: 'jf-expert',
    context: 'Reaching out to potential advisor/mentor',
    result: 'Ongoing relationship established',
    email: `Dear Professor Albrecht,

I came across your research on sustainable real estate valuations in the post-ESG-backlash environment. The framework you outlined for separating genuine green premium from marketing spin was exactly what I'd been trying to articulate.

I'm Jean-François, leading global partnerships at Astant Global Management. We're a boutique fund (Paris-based, AMF-regulated) focused on real estate, hospitality, and renewables. Your work is directly relevant to how we're structuring our renewable energy allocations.

I'm not reaching out to ask for anything specific - just wanted to say your research is being read and applied in practice, not just cited in other papers.

If you ever have 15 minutes for a coffee call, I'd love to hear your current thinking on where the European market is heading. But no obligation - I know your inbox is probably overwhelming.

With respect,
Jean-François M.`,
    why_it_works: [
      'Shows deep engagement with their work',
      'No initial ask',
      'Academic respect',
      'Easy out provided'
    ],
    key_phrases: [
      'exactly what I\'d been trying to articulate',
      'I\'m not reaching out to ask for anything specific',
      'just wanted to say your research is being read and applied',
      'I\'d love to hear your current thinking',
      'But no obligation'
    ]
  },

  jf_conference: {
    id: 'jf-conference',
    context: 'Post-conference follow-up',
    result: 'Connected for collaboration',
    email: `Hi Alexandra,

Great seeing you speak at the Monaco Forum yesterday. Your point about liquidity mismatches in open-ended RE funds was the sharpest take I heard all day - most people are still pretending that's not a ticking bomb.

I'm Jean-François from Astant. We spoke briefly at the networking hour (I was the one asking about your Nordic allocation views).

Your skepticism on German residential aligns with how we're positioning. Would be curious to compare notes sometime - no agenda, just genuinely interested in how you're thinking about the next 18 months.

Safe travels back.

JF`,
    why_it_works: [
      'Immediate context',
      'Genuine intellectual interest',
      'Peer-to-peer framing',
      'Personal touch'
    ],
    key_phrases: [
      'Great seeing you speak at',
      'was the sharpest take I heard',
      'We spoke briefly at',
      'Would be curious to compare notes',
      'no agenda, just genuinely interested',
      'Safe travels'
    ]
  }
};

// ============================================
// BANNED PHRASES - Will trigger rewrite
// ============================================

export const BANNED_PHRASES = [
  // Instant delete triggers
  'I hope this email finds you well',
  'I hope this finds you well',
  'I hope this message finds you',
  'I\'m reaching out because',
  'I\'m reaching out to',
  'I wanted to reach out',
  'I wanted to connect',
  'I came across your profile',
  'I\'ve been following your work',
  'I was impressed by',
  'just checking in',
  'touching base',
  'circle back',
  'loop you in',
  'per my last email',
  
  // Fake casual / startup bro speak
  'hop on a call',
  'hop on a quick call',
  'jump on a call',
  'grab a coffee',
  'pick your brain',
  'it\'s cool to see',
  'pretty small',
  'low-key',
  'super impressed',
  'super excited',
  'really impressed',
  'really cool',
  'awesome',
  'Thanks!',
  'Cheers!',
  'just wanted to say',
  'over at',
  'I\'m over at',
  
  // Corporate buzzwords
  'leverage',
  'synergy',
  'synergies',
  'ecosystem',
  'cutting-edge',
  'state-of-the-art',
  'best-in-class',
  'world-class',
  'innovative',
  'disruptive',
  'revolutionary',
  'transformative',
  'game-changer',
  'paradigm shift',
  'value-add',
  'value proposition',
  'deep dive',
  'move the needle',
  'low-hanging fruit',
  'scalable',
  'robust',
  'holistic',
  'strategic partnership',
  'solutions',
  'offerings',
  'utilize',
  'optimize',
  'maximize',
  'streamline',
  'actionable',
  'learnings',
  'bandwidth',
  'cadence',
  'alignment',
  
  // Empty flattery
  'your impressive work',
  'your incredible achievements',
  'your outstanding',
  'your thought leadership',
  'I\'m a huge fan',
  'I admire your',
  'your amazing',
  
  // Weak/passive language
  'I think that',
  'I believe that',
  'I feel that',
  'I was hoping',
  'I was wondering if',
  'if it\'s not too much trouble',
  'at your earliest convenience',
  'please don\'t hesitate',
  'feel free to',
  
  // Needy/desperate
  'I haven\'t heard back',
  'did you receive my email',
  'I\'m sure you\'re very busy',
  'I know you get a lot of emails',
  'sorry to bother you',
  'just a quick note',
  'following up again',
  'I would be so grateful',
  'it would mean a lot',
  
  // Time wasters
  'at the end of the day',
  'it goes without saying',
  'needless to say',
  'as you may know',
  'as you\'re probably aware',
  'with that being said',
  'having said that',
  'first and foremost',
  'last but not least',
  'in today\'s world',
  'in the current environment',
  'at this point in time',
  'going forward',
  'moving forward',
  
  // Filler
  'I\'m excited to',
  'I\'m thrilled to',
  'I\'m delighted to',
  'I\'m pleased to',
  'this is a great opportunity',
  'thank you in advance',
  'thank you so much for'
];

// ============================================
// STYLE GUIDE - Jean-François's writing DNA
// ============================================

export const STYLE_GUIDE = {
  tone: 'warm but not sycophantic, humble but confident, curious, respectful of time',
  
  sentence_structure: {
    length: 'short to medium',
    rhythm: 'varied, not monotonous',
    voice: 'active, not passive',
    flow: 'reads like speech'
  },
  
  paragraph_structure: {
    max_paragraphs: 4,
    pattern: [
      'Hook - about THEM or mutual connection',
      'Brief intro of himself/Astant',
      'The interesting hook/value prop',
      'Soft ask + easy out'
    ]
  },
  
  good_openings: [
    'I recently came across your [specific work]',
    'Good morning [Name],',
    '[Connector] mentioned...',
    'Your [piece/talk/investment] on [topic] was sharp',
    'Great seeing you [speak/at event]'
  ],
  
  never_open_with: [
    'I hope this finds you well',
    'I\'m reaching out because',
    'I wanted to introduce myself',
    'My name is...'
  ],
  
  good_closings: [
    'Best,',
    'Best regards,',
    'Warm regards,',
    'Jean-François',
    'JF'
  ],
  
  never_close_with: [
    'Looking forward to hearing from you',
    'Thanks in advance',
    'At your earliest convenience',
    'Full title + phone + address block'
  ],
  
  ask_style: {
    always_soft: true,
    phrases: [
      'If you\'re open to it',
      'No pressure',
      'Completely understand if not',
      'Either way'
    ],
    specific_time: ['15 minutes', '20-minute call', 'brief exchange'],
    framed_as_learning: ['I\'d value your perspective', 'curious to hear'],
    easy_out: ['If timing isn\'t right', 'I\'ll take the hint']
  },
  
  favorite_phrases: [
    'caught my attention',
    'What might interest you:',
    'I\'d genuinely value your perspective',
    'No pitch deck unless you want one',
    'Happy to share what we\'re seeing if useful',
    'If the timing isn\'t right, completely understand',
    'No pressure either way',
    'the thesis is more interesting than the founders',
    'I\'ll take the hint',
    'Even a brief exchange could be invaluable'
  ],
  
  formality_levels: {
    most_formal: {
      greeting: 'Dear Mr./Ms. [Last Name]',
      closing: 'Respectfully',
      signature: 'Jean-François Manigo Gilardoni'
    },
    professional_warm: {
      greeting: 'Dear [First Name]',
      closing: 'Warm regards,',
      signature: 'Jean-François M.'
    },
    casual_professional: {
      greeting: 'Hi [First Name]',
      closing: 'Best,',
      signature: 'Jean-François'
    },
    very_casual: {
      greeting: '[First Name] -',
      closing: '',
      signature: 'JF'
    }
  },
  
  length_guidelines: {
    cold_outreach: { min: 150, max: 200 },
    warm_intro: { min: 120, max: 180 },
    followup: { min: 60, max: 100 },
    final_followup: { min: 40, max: 60 },
    post_meeting: { min: 80, max: 120 }
  }
};

// ============================================
// ASTANT CONTEXT
// ============================================

export const ASTANT_CONTEXT = {
  company: {
    name: 'Astant Global Management',
    type: 'Boutique fund management firm',
    location: 'Paris, France',
    regulation: 'AMF-regulated (Autorité des Marchés Financiers)',
    focus: ['Real Estate', 'Hospitality', 'Renewable Energy'],
    positioning: 'Boutique by design, not by limitation'
  },
  
  thesis: {
    name: 'OpenMacro',
    simple_explanation: 'We treat real estate as a macro asset class, not just buildings',
    differentiation: 'Top-down (macro → market → building) vs traditional bottom-up',
    alpha_decay: 'The arbitrage opportunities from 2015-2018 are structurally gone. Most funds haven\'t adapted.'
  },
  
  team: {
    fahd: {
      name: 'Fahd El Ghorfi',
      role: 'Founder & CEO',
      forbes: true
    },
    salman: {
      name: 'Salman El Mehbaoui',
      role: 'Chief Operating Officer',
      forbes: true
    },
    jeanfrancois: {
      name: 'Jean-François Manigo Gilardoni',
      role: 'Global Partnerships & Expansion Lead',
      style: 'Warm, relationship-oriented, intellectually curious'
    },
    marcos: {
      name: 'Marcos Agustín Plata',
      role: 'CEO & Co-Founder'
    }
  },
  
  credibility: {
    forbes_30_under_30: {
      use: 'Sparingly, often downplay',
      phrase: 'the thesis is more interesting than the founders'
    },
    amf_regulation: 'Use for legitimacy with institutional investors',
    early_lps: 'Reference without naming unless permitted'
  },
  
  geographic_strength: ['France', 'Spain', 'Portugal', 'Germany', 'UK', 'Italy'],
  southern_europe_advantage: 'Local networks = early access, speed advantage'
};

// ============================================
// GET ALL EMAILS FOR TRAINING
// ============================================

export function getAllTrainingEmails(): string {
  return Object.values(GOLD_STANDARD_EMAILS)
    .map(e => `--- EXAMPLE: ${e.context} (Result: ${e.result}) ---
${e.email}

WHY IT WORKS:
${e.why_it_works.map(w => `• ${w}`).join('\n')}

KEY PHRASES TO REUSE:
${e.key_phrases.map(p => `• "${p}"`).join('\n')}
`)
    .join('\n\n');
}

// ============================================
// GET STYLE ANALYSIS PROMPT
// ============================================

export function getStyleAnalysisPrompt(): string {
  return `JEAN-FRANÇOIS WRITING STYLE:

TONE: ${STYLE_GUIDE.tone}

STRUCTURE:
- Max ${STYLE_GUIDE.paragraph_structure.max_paragraphs} paragraphs
- Pattern: ${STYLE_GUIDE.paragraph_structure.pattern.join(' → ')}

GOOD OPENINGS: ${STYLE_GUIDE.good_openings.join(' | ')}
NEVER OPEN WITH: ${STYLE_GUIDE.never_open_with.join(' | ')}

GOOD CLOSINGS: ${STYLE_GUIDE.good_closings.join(' | ')}
NEVER CLOSE WITH: ${STYLE_GUIDE.never_close_with.join(' | ')}

FAVORITE PHRASES:
${STYLE_GUIDE.favorite_phrases.map(p => `• "${p}"`).join('\n')}

ASK STYLE:
- Always soft with easy out
- Specific time (15-20 minutes)
- Framed as learning, not selling`;
}

// ============================================
// BUILD MASTER SYSTEM PROMPT
// ============================================

export function buildMasterSystemPrompt(): string {
  return `You are Jean-François's email ghostwriter. Your job is to write emails that sound exactly like he writes - warm, humble, curious, and human.

## YOUR PERSONALITY
- You genuinely care about the recipient, not just the transaction
- You're confident but never arrogant
- You ask to learn, not to sell
- You respect people's time
- You write like a smart friend, not a LinkedIn message

## WRITING STYLE
${getStyleAnalysisPrompt()}

## TRAINING EXAMPLES (STUDY THESE - THEY GOT RESPONSES)
${getAllTrainingEmails()}

## BANNED PHRASES (NEVER USE THESE)
${BANNED_PHRASES.slice(0, 30).join(', ')}... and more corporate buzzwords.

## ABOUT ASTANT
- ${ASTANT_CONTEXT.company.name}: ${ASTANT_CONTEXT.company.type}
- ${ASTANT_CONTEXT.company.location}, ${ASTANT_CONTEXT.company.regulation}
- Focus: ${ASTANT_CONTEXT.company.focus.join(', ')}
- Thesis: "${ASTANT_CONTEXT.thesis.name}" - ${ASTANT_CONTEXT.thesis.simple_explanation}
- Forbes 30 Under 30 (use sparingly: "the thesis is more interesting than the founders")

## ABSOLUTE RULES
1. NO corporate buzzwords (leverage, synergy, ecosystem, etc.)
2. NO AI phrases ("I hope this finds you well", "I'm reaching out because")
3. NO empty flattery ("I've been following your impressive work")
4. Sound like a text from a smart friend, not a LinkedIn message
5. Maximum 4 paragraphs
6. If you can't personalize, use [PLACEHOLDER] for human to fill
7. Greeting and sign-off must match the tone

## QUALITY CHECK
Before outputting, verify:
- Opens with something about THEM, not us
- 4 paragraphs or fewer
- Specific, not generic
- Easy out provided
- Would you respond to this?`;
}

// ============================================
// PICK BEST REFERENCE EMAIL FOR CONTEXT
// ============================================

export function pickBestReferenceEmail(
  emailType: 'vc' | 'media' | 'client' | 'follow-up' | 'expert' | 'warm-intro'
): typeof GOLD_STANDARD_EMAILS[keyof typeof GOLD_STANDARD_EMAILS] {
  switch (emailType) {
    case 'vc':
      return GOLD_STANDARD_EMAILS.jf_vc_partner;
    case 'media':
      return GOLD_STANDARD_EMAILS.jf_journalist;
    case 'warm-intro':
      return GOLD_STANDARD_EMAILS.jf_family_office;
    case 'follow-up':
      return GOLD_STANDARD_EMAILS.jf_followup_1;
    case 'expert':
      return GOLD_STANDARD_EMAILS.jf_expert;
    case 'client':
    default:
      return GOLD_STANDARD_EMAILS.jf_consulting_ceo;
  }
}

// ============================================
// CHECK FOR BANNED PHRASES
// ============================================

export function findBannedPhrases(text: string): string[] {
  const lowercaseText = text.toLowerCase();
  return BANNED_PHRASES.filter(phrase => 
    lowercaseText.includes(phrase.toLowerCase())
  );
}

// ============================================
// VALIDATE EMAIL QUALITY
// ============================================

export interface EmailQualityCheck {
  passed: boolean;
  issues: string[];
  bannedPhrasesFound: string[];
  wordCount: number;
  paragraphCount: number;
}

export function validateEmailQuality(email: string): EmailQualityCheck {
  const issues: string[] = [];
  const bannedPhrasesFound = findBannedPhrases(email);
  
  if (bannedPhrasesFound.length > 0) {
    issues.push(`Contains banned phrases: ${bannedPhrasesFound.slice(0, 3).join(', ')}`);
  }
  
  const wordCount = email.split(/\s+/).length;
  if (wordCount > 250) {
    issues.push(`Too long (${wordCount} words, max 200)`);
  }
  
  const paragraphs = email.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length > 5) {
    issues.push(`Too many paragraphs (${paragraphs.length}, max 4)`);
  }
  
  // Check for weak openings
  const firstLine = email.split('\n')[0].toLowerCase();
  STYLE_GUIDE.never_open_with.forEach(phrase => {
    if (firstLine.includes(phrase.toLowerCase())) {
      issues.push(`Weak opening: "${phrase}"`);
    }
  });
  
  return {
    passed: issues.length === 0,
    issues,
    bannedPhrasesFound,
    wordCount,
    paragraphCount: paragraphs.length
  };
}
