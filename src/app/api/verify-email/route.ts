import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getMemberById } from '@/lib/signatures'

// ============================================
// EMAIL VERIFICATION API - OpenAI Powered
// ============================================
// This API verifies that emails are consistent:
// - Sender name in body matches signature
// - No mixed references to different senders
// - Professional formatting is maintained
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface VerificationRequest {
  emailBody: string
  subject: string
  senderId: string
  recipientName: string
  recipientCompany?: string
}

interface VerificationResult {
  isValid: boolean
  issues: string[]
  correctedBody?: string
  correctedSubject?: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const { 
      emailBody, 
      subject, 
      senderId, 
      recipientName,
      recipientCompany 
    }: VerificationRequest = await request.json()

    const sender = getMemberById(senderId)
    if (!sender) {
      return NextResponse.json({ error: 'Invalid sender ID' }, { status: 400 })
    }

    // Build the verification prompt
    const verificationPrompt = `You are an email quality assurance assistant. Analyze this email for consistency issues.

EXPECTED SENDER: ${sender.name} (${sender.firstName})
EXPECTED SENDER TITLE: ${sender.title}
RECIPIENT NAME: ${recipientName}
RECIPIENT COMPANY: ${recipientCompany || 'Unknown'}

EMAIL SUBJECT:
${subject}

EMAIL BODY:
${emailBody}

VERIFICATION TASKS:
1. Check if the email body correctly introduces the sender as "${sender.firstName}" or "${sender.name}"
2. Ensure NO OTHER team member names appear as the sender (e.g., if sender is Marcos, the email should NOT say "I'm Jean-François")
3. Verify the greeting uses the correct recipient name
4. Check for placeholder text like [FIRST_NAME], [COMPANY], etc that wasn't replaced
5. Ensure professional tone and formatting

RESPONSE FORMAT (JSON only):
{
  "isValid": true/false,
  "issues": ["issue 1", "issue 2"],
  "corrections": {
    "needed": true/false,
    "correctedBody": "The corrected email body if needed, otherwise null",
    "correctedSubject": "The corrected subject if needed, otherwise null"
  },
  "confidence": 0.0-1.0
}

If the email is correct, return isValid: true with empty issues array.
If corrections are needed, provide the FULL corrected email body with proper sender name.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an email verification assistant. Respond ONLY with valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: verificationPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content || '{}'
    
    // Parse the response
    let result: VerificationResult
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanContent)
      
      result = {
        isValid: parsed.isValid ?? true,
        issues: parsed.issues || [],
        correctedBody: parsed.corrections?.correctedBody || undefined,
        correctedSubject: parsed.corrections?.correctedSubject || undefined,
        confidence: parsed.confidence ?? 0.95,
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      // Default to valid if we can't parse
      result = {
        isValid: true,
        issues: [],
        confidence: 0.5,
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Email verification error:', error)
    
    // Don't block the flow on verification errors
    return NextResponse.json({
      isValid: true,
      issues: [],
      confidence: 0,
      error: 'Verification skipped due to error',
    })
  }
}
