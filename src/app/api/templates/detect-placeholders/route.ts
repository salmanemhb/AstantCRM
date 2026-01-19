import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// POST: Detect placeholders in pasted text using AI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subject, body: templateBody } = body

    if (!templateBody) {
      return NextResponse.json(
        { error: 'Template body is required' },
        { status: 400 }
      )
    }

    const combinedText = subject 
      ? `Subject: ${subject}\n\nBody:\n${templateBody}`
      : templateBody

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI that analyzes email templates to detect placeholder values that need personalization.

Your task is to find ALL placeholders and personalization opportunities in the template.

**Detection rules:**

1. **Explicit placeholders** (highest confidence):
   - Brackets: [FIRST_NAME], [COMPANY], [FIRM]
   - Curly braces: {first_name}, {company}
   - Double braces: {{name}}, {{firm}}
   - Angle brackets: <RECIPIENT_NAME>
   - Caps with underscores: FIRST_NAME, COMPANY_NAME

2. **Generic references** (medium confidence):
   - "Dear Friend" → should be FIRST_NAME
   - "your company", "your firm" → could be FIRM
   - "Hi there" → should be FIRST_NAME

3. **Context clues** (lower confidence):
   - References to specific investments, portfolio, thesis that seem generic

**Standard placeholder names to use:**
- FIRST_NAME - recipient's first name
- LAST_NAME - recipient's last name
- FULL_NAME - recipient's full name
- FIRM - recipient's firm/company
- FUND - recipient's fund name
- ROLE - recipient's job title
- INVESTMENT_FOCUS - their investment thesis/focus
- PORTFOLIO_COMPANY - a portfolio company reference
- GEOGRAPHY - geographic focus
- RECENT_NEWS - recent news about them
- CUSTOM_HOOK - personalized opening hook

Return a JSON object with this exact structure:
{
  "placeholders": [
    {
      "name": "FIRST_NAME",
      "original_text": "[first_name]",
      "confidence": "high",
      "description": "Recipient's first name"
    }
  ],
  "suggested_name": "Short name suggestion based on template content"
}

Return ONLY the JSON, no markdown or explanation.`
        },
        {
          role: 'user',
          content: combinedText
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    const aiResponse = response.choices[0]?.message?.content || '{}'
    
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      let jsonStr = aiResponse.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      }
      
      const parsed = JSON.parse(jsonStr)
      
      return NextResponse.json({
        placeholders: parsed.placeholders || [],
        suggested_name: parsed.suggested_name || 'Custom Template',
        raw_response: aiResponse
      })
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, aiResponse)
      
      // Fallback: try to extract any explicit placeholders with regex
      const bracketMatches = combinedText.match(/\[([A-Z_]+)\]/g) || []
      const curlyMatches = combinedText.match(/\{([a-zA-Z_]+)\}/g) || []
      
      const fallbackPlaceholders = [
        ...bracketMatches.map((m: string) => ({
          name: m.replace(/[\[\]]/g, ''),
          original_text: m,
          confidence: 'high' as const,
          description: 'Detected from brackets'
        })),
        ...curlyMatches.map((m: string) => ({
          name: m.replace(/[{}]/g, '').toUpperCase(),
          original_text: m,
          confidence: 'high' as const,
          description: 'Detected from curly braces'
        }))
      ]
      
      return NextResponse.json({
        placeholders: fallbackPlaceholders,
        suggested_name: 'Custom Template',
        warning: 'AI parsing failed, using regex fallback'
      })
    }
  } catch (error: any) {
    console.error('Error detecting placeholders:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to detect placeholders' },
      { status: 500 }
    )
  }
}
