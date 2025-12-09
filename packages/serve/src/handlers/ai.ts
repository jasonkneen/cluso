// @ts-nocheck
/**
 * AI Chat Handlers for Web Mode
 *
 * Provides server-side AI chat capabilities using the Vercel AI SDK.
 * This allows the web mode to use AI features without requiring
 * API keys in the browser - keys can be passed per-request or from env vars.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText, type CoreMessage } from 'ai'
import type { Result } from '../types/api.js'
import { success, error } from '../types/api.js'

// Default provider instances from env vars (lazily initialized)
let defaultGoogleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null
let defaultAnthropicProvider: ReturnType<typeof createAnthropic> | null = null
let defaultOpenaiProvider: ReturnType<typeof createOpenAI> | null = null

/**
 * Initialize default providers from environment variables
 */
export function initializeProviders(config?: {
  googleApiKey?: string
  anthropicApiKey?: string
  openaiApiKey?: string
}) {
  if (config?.googleApiKey || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY) {
    defaultGoogleProvider = createGoogleGenerativeAI({
      apiKey: config?.googleApiKey || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY,
    })
  }

  if (config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
    defaultAnthropicProvider = createAnthropic({
      apiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    })
  }

  if (config?.openaiApiKey || process.env.OPENAI_API_KEY) {
    defaultOpenaiProvider = createOpenAI({
      apiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    })
  }
}

/**
 * Provider configs passed from frontend
 */
export interface ProviderConfigs {
  google?: string
  anthropic?: string
  openai?: string
}

/**
 * Create a provider instance with the given API key (or use default)
 */
function createProviderWithKey(providerType: 'google' | 'anthropic' | 'openai', apiKey?: string) {
  switch (providerType) {
    case 'google': {
      const key = apiKey || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY
      if (!key) return null
      return createGoogleGenerativeAI({ apiKey: key })
    }
    case 'anthropic': {
      const key = apiKey || process.env.ANTHROPIC_API_KEY
      if (!key) return null
      return createAnthropic({ apiKey: key })
    }
    case 'openai': {
      const key = apiKey || process.env.OPENAI_API_KEY
      if (!key) return null
      return createOpenAI({ apiKey: key })
    }
    default:
      return null
  }
}

/**
 * Get provider for a given model ID, using request-specific keys if provided
 */
function getProviderForModel(modelId: string, providers?: ProviderConfigs) {
  const lowerModel = modelId.toLowerCase()

  if (lowerModel.startsWith('gemini-')) {
    // Try request-specific key first, then fallback to default provider
    if (providers?.google) {
      const provider = createProviderWithKey('google', providers.google)
      if (provider) return provider(modelId)
    }
    if (defaultGoogleProvider) {
      return defaultGoogleProvider(modelId)
    }
    throw new Error('Google API key not configured. Pass google API key in providers or set GOOGLE_API_KEY.')
  }

  if (lowerModel.startsWith('claude-')) {
    if (providers?.anthropic) {
      const provider = createProviderWithKey('anthropic', providers.anthropic)
      if (provider) return provider(modelId)
    }
    if (defaultAnthropicProvider) {
      return defaultAnthropicProvider(modelId)
    }
    throw new Error('Anthropic API key not configured. Pass anthropic API key in providers or set ANTHROPIC_API_KEY.')
  }

  if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3')) {
    if (providers?.openai) {
      const provider = createProviderWithKey('openai', providers.openai)
      if (provider) return provider(modelId)
    }
    if (defaultOpenaiProvider) {
      return defaultOpenaiProvider(modelId)
    }
    throw new Error('OpenAI API key not configured. Pass openai API key in providers or set OPENAI_API_KEY.')
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
  providers?: ProviderConfigs  // API keys from frontend
}

/**
 * Generate a chat completion (non-streaming)
 */
export async function generateChatCompletion(request: ChatRequest): Promise<Result<{
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}>> {
  try {
    const model = getProviderForModel(request.modelId, request.providers)

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
  const model = getProviderForModel(request.modelId, request.providers)

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
