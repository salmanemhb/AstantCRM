import { NextRequest, NextResponse } from 'next/server'
import { generateCompletion, ChatMessage } from '@/lib/agents/openai-client'
import { getCompanyContext } from '@/lib/company-context'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, prompt } = body

    if (action === 'generate_template') {
      return await generateTemplate(prompt)
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('API agents error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateTemplate(prompt: string) {
  if (!prompt || prompt.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Prompt is required' },
      { status: 400 }
    )
  }

  const companyContext = getCompanyContext()

  const systemPrompt = `You are an expert email copywriter specializing in VC/investor outreach. 
You help founders craft compelling email templates for reaching out to investors.
Your emails are personalized, concise, and have high response rates.`

  const userPrompt = `${companyContext}

USER REQUEST:
${prompt}

Create an email template based on this request. Use placeholders like {{first_name}}, {{firm}}, {{role}} for personalization.

Return a JSON object with this exact structure:
{
  "subject_template": "Email subject line with optional {{placeholders}}",
  "body_template": "Full email body with {{placeholders}} for personalization. Include greeting, context, value proposition, and call to action.",
  "improvements": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

The improvements should be 2-3 brief tips for making the email more effective.`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  try {
    const response = await generateCompletion(messages, { 
      model: 'quality', 
      jsonMode: true 
    })

    // Parse the response
    let template
    try {
      template = JSON.parse(response)
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        template = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    return NextResponse.json({
      success: true,
      template: {
        subject_template: template.subject_template || 'Introduction from Astant Global Management',
        body_template: template.body_template || prompt,
      },
      improvements: template.improvements || [],
    })
  } catch (error: any) {
    console.error('Template generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate template' },
      { status: 500 }
    )
  }
}
