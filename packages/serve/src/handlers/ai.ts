// @ts-nocheck
/**
 * AI Chat Handlers for Web Mode
 *
 * Provides server-side AI chat capabilities using the Vercel AI SDK.
 * This allows the web mode to use AI features without requiring
 * API keys in the browser.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText, type CoreMessage } from 'ai'
import type { Result } from '../types/api.js'
import { success, error } from '../types/api.js'

// Provider instances (lazily initialized)
let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null
let anthropicProvider: ReturnType<typeof createAnthropic> | null = null
let openaiProvider: ReturnType<typeof createOpenAI> | null = null

/**
 * Initialize providers from environment variables
 */
export function initializeProviders(config?: {
  googleApiKey?: string
  anthropicApiKey?: string
  openaiApiKey?: string
}) {
  if (config?.googleApiKey || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY) {
    googleProvider = createGoogleGenerativeAI({
      apiKey: config?.googleApiKey || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY,
    })
  }

  if (config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
    anthropicProvider = createAnthropic({
      apiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    })
  }

  if (config?.openaiApiKey || process.env.OPENAI_API_KEY) {
    openaiProvider = createOpenAI({
      apiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    })
  }
}

/**
 * Get provider for a given model ID
 */
function getProviderForModel(modelId: string) {
  const lowerModel = modelId.toLowerCase()

  if (lowerModel.startsWith('gemini-')) {
    if (!googleProvider) {
      throw new Error('Google API key not configured. Set GOOGLE_API_KEY or VITE_GOOGLE_API_KEY.')
    }
    return googleProvider(modelId)
  }

  if (lowerModel.startsWith('claude-')) {
    if (!anthropicProvider) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY.')
    }
    return anthropicProvider(modelId)
  }

  if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3')) {
    if (!openaiProvider) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY.')
    }
    return openaiProvider(modelId)
  }

  throw new Error(`Unknown model provider for: ${modelId}`)
}

export interface ChatRequest {
  messages: CoreMessage[]
  modelId: string
  system?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

/**
 * Generate a chat completion (non-streaming)
 */
export async function generateChatCompletion(request: ChatRequest): Promise<Result<{
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}>> {
  try {
    const model = getProviderForModel(request.modelId)

    const result = await generateText({
      model,
      messages: request.messages,
      system: request.system,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    })

    return success({
      text: result.text,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      } : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(message, 'AI_ERROR')
  }
}

/**
 * Stream a chat completion
 * Returns an async generator of text chunks
 */
export async function* streamChatCompletion(request: ChatRequest): AsyncGenerator<{
  type: 'text-delta' | 'finish'
  text?: string
  usage?: { promptTokens: number; completionTokens: number }
}> {
  const model = getProviderForModel(request.modelId)

  const result = streamText({
    model,
    messages: request.messages,
    system: request.system,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  })

  for await (const chunk of result.textStream) {
    yield { type: 'text-delta', text: chunk }
  }

  const finalResult = await result
  yield {
    type: 'finish',
    usage: finalResult.usage ? {
      promptTokens: finalResult.usage.promptTokens,
      completionTokens: finalResult.usage.completionTokens,
    } : undefined,
  }
}

/**
 * Check which providers are available
 */
export function getAvailableProviders(): Result<{
  google: boolean
  anthropic: boolean
  openai: boolean
}> {
  return success({
    google: googleProvider !== null,
    anthropic: anthropicProvider !== null,
    openai: openaiProvider !== null,
  })
}
