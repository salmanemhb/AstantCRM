import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// GET: Fetch all custom templates
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('custom_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST: Create new template with AI placeholder detection
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, category, subject, body: templateBody, description, created_by, detect_placeholders } = body

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Name, subject, and body are required' },
        { status: 400 }
      )
    }

    let placeholders: string[] = []

    // AI Placeholder Detection
    if (detect_placeholders !== false) {
      const combinedText = `Subject: ${subject}\n\nBody:\n${templateBody}`
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are analyzing email templates to detect placeholder values that should be personalized for each recipient.

Look for:
1. Explicit placeholders like [FIRST_NAME], {company}, {{recipient_firm}}, etc.
2. Generic references that should be personalized: "Dear Friend", "your company", "your firm", "your fund"
3. Words that are clearly meant to be replaced: "INSERT NAME", "COMPANY_NAME", etc.

Standard placeholders to detect:
- FIRST_NAME, LAST_NAME, RECIPIENT_NAME - recipient's name
- FIRM, COMPANY, FUND - recipient's organization
- ROLE, TITLE - recipient's position
- INVESTMENT_FOCUS, THESIS - their investment focus/thesis
- PORTFOLIO_COMPANY - specific portfolio company reference
- GEOGRAPHY, LOCATION - geographic focus/location
- SENDER_NAME, YOUR_NAME - sender's name (signature)
- COMPANY_NAME - sender's company

Return ONLY a JSON array of detected placeholder names (uppercase with underscores).
If the template already has explicit placeholders, extract just their names.
If something looks like it should be personalized but isn't explicitly marked, suggest a placeholder name for it.

Example output: ["FIRST_NAME", "FIRM", "INVESTMENT_FOCUS"]`
          },
          {
            role: 'user',
            content: combinedText
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      })

      const aiResponse = response.choices[0]?.message?.content || '[]'
      
      try {
        // Extract JSON array from response
        const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
          placeholders = JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        console.error('Failed to parse AI placeholders:', parseError)
        placeholders = []
      }
    }

    // Insert into database
    const { data, error } = await supabase
      .from('custom_templates')
      .insert({
        name,
        category: category || 'investor',
        description: description || `Custom template: ${name}`,
        subject,
        body: templateBody,
        placeholders,
        created_by: created_by || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      template: data,
      detected_placeholders: placeholders 
    })
  } catch (error: any) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}

// PUT: Update existing template
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, category, subject, body: templateBody, description, placeholders } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (subject !== undefined) updateData.subject = subject
    if (templateBody !== undefined) updateData.body = templateBody
    if (description !== undefined) updateData.description = description
    if (placeholders !== undefined) updateData.placeholders = placeholders

    const { data, error } = await supabase
      .from('custom_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE: Remove template
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('custom_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}
