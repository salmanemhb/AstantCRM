// ============================================
// OPENAI CLIENT - GPT-4o Integration
// ============================================

import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Model configuration
const MODELS = {
  // GPT-4o for best quality (recommended for emails)
  quality: 'gpt-4o',
  // GPT-4o-mini for faster, cheaper tasks
  fast: 'gpt-4o-mini',
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  model?: 'quality' | 'fast'
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

/**
 * Generate a completion using GPT-4o
 */
export async function generateCompletion(
  messages: ChatMessage[],
  options: GenerateOptions = {}
): Promise<string> {
  const {
    model = 'quality',
    temperature = 0.7,
    maxTokens = 2000,
    jsonMode = false,
  } = options

  try {
    const response = await openai.chat.completions.create({
      model: MODELS[model],
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    })

    return response.choices[0]?.message?.content || ''
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API failed: ${error.message}`)
  }
}

/**
 * Generate structured JSON response
 */
export async function generateJSON<T>(
  messages: ChatMessage[],
  options: Omit<GenerateOptions, 'jsonMode'> = {}
): Promise<T> {
  const response = await generateCompletion(messages, {
    ...options,
    jsonMode: true,
  })

  try {
    return JSON.parse(response) as T
  } catch {
    throw new Error('Failed to parse JSON response from OpenAI')
  }
}

export { openai, MODELS }
