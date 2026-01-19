// ============================================
// GOLD STANDARD EMAIL GENERATION
// ============================================
// Human-quality email generation for professional outreach

interface ContactInfo {
    first_name?: string
    last_name?: string
    firm?: string
    role?: string
    geography?: string
    investment_focus?: string
    notes?: string
    previous_interactions?: string
}

interface PromptOptions {
    sender_name: string
    sender_role: string
    email_type: 'vc' | 'media' | 'partner' | 'warm_intro'
    custom_context?: string
    reference_email?: string
    include_event_invite?: boolean
    specific_ask?: string
}

// System prompt for human-quality email generation
export const HUMAN_EMAIL_SYSTEM_PROMPT = `You are an expert email writer for Astant Global Management, a leading investment management firm.

Your emails should:
- Sound natural and human-written (NOT AI-generated)
- Be professional but warm
- Be concise (2-3 short paragraphs max)
- Include specific personalization based on the recipient
- Have a clear call to action

Output format: JSON with { subject, body, confidence }
- confidence: "green" (high quality), "yellow" (good), "red" (needs review)`

// Example gold standard email
export const GOLD_STANDARD_EMAIL = `Good morning [NAME],

I'm reaching out on behalf of Astant Global Management regarding potential synergies between our firms.

We've been following [FIRM]'s impressive work in [FOCUS_AREA] and believe there could be meaningful opportunities for collaboration.

Would you be open to a brief introductory call next week?

Best regards,
[SENDER]`

/**
 * Build a prompt for generating human-quality emails
 */
export function buildHumanEmailPrompt(
    contact: ContactInfo,
    options: PromptOptions
): string {
    const contactName = [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(' ') || 'there'

    const firmInfo = contact.firm ? `who works at ${contact.firm}` : ''
    const roleInfo = contact.role ? `as ${contact.role}` : ''
    const geoInfo = contact.geography ? `based in ${contact.geography}` : ''
    const focusInfo = contact.investment_focus ? `focusing on ${contact.investment_focus}` : ''

    let emailTypeContext = ''
    switch (options.email_type) {
        case 'vc':
            emailTypeContext = 'This is an outreach to a venture capital firm for potential investment discussions.'
            break
        case 'media':
            emailTypeContext = 'This is an outreach to a media contact for press coverage or editorial opportunities.'
            break
        case 'partner':
            emailTypeContext = 'This is an outreach to a potential business partner for strategic collaboration.'
            break
        case 'warm_intro':
            emailTypeContext = 'This is a warm introduction through a mutual connection.'
            break
    }

    let prompt = `Write a professional outreach email from ${options.sender_name} (${options.sender_role}) at Astant Global Management.

Recipient: ${contactName} ${firmInfo} ${roleInfo} ${geoInfo} ${focusInfo}

${emailTypeContext}

${options.custom_context ? `Additional context: ${options.custom_context}` : ''}
${options.specific_ask ? `Specific ask: ${options.specific_ask}` : ''}
${contact.notes ? `Notes about recipient: ${contact.notes}` : ''}
${contact.previous_interactions ? `Previous interactions: ${contact.previous_interactions}` : ''}

${options.reference_email ? `Use this email as a reference for tone and style:\n${options.reference_email}` : ''}

IMPORTANT: Keep the email brief (2-3 paragraphs max), natural, and professional.

Return JSON format: { "subject": "...", "body": "...", "confidence": "green|yellow|red" }`

    return prompt.trim()
}
