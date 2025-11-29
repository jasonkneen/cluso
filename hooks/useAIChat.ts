import { useState, useCallback } from 'react'
import { generateText, streamText, CoreMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export type ProviderType = 'google' | 'openai' | 'anthropic'

export interface ProviderConfig {
  id: ProviderType
  apiKey: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  model?: string
}

export interface UseAIChatOptions {
  onResponse?: (text: string) => void
  onError?: (error: Error) => void
  onFinish?: () => void
}

// Model ID to provider mapping
const MODEL_PROVIDER_MAP: Record<string, ProviderType> = {
  // Google models
  'gemini-3-pro-preview': 'google',
  'gemini-2.5-flash': 'google',
  'gemini-2.5-pro': 'google',
  'gemini-2.0-flash': 'google',
  'gemini-2.0-flash-lite': 'google',
  'gemini-1.5-pro': 'google',
  'gemini-1.5-flash': 'google',
  // OpenAI models
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4': 'openai',
  'gpt-3.5-turbo': 'openai',
  'o1': 'openai',
  'o1-mini': 'openai',
  'o1-preview': 'openai',
  // Anthropic models
  'claude-3-5-sonnet': 'anthropic',
  'claude-3-5-sonnet-20241022': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
}

// Normalize model IDs to what each provider expects
const normalizeModelId = (modelId: string, provider: ProviderType): string => {
  // Google models - map to actual API names
  if (provider === 'google') {
    const googleModelMap: Record<string, string> = {
      'gemini-3-pro-preview': 'gemini-2.0-flash', // fallback if not available
      'gemini-2.5-flash': 'gemini-2.0-flash',
      'gemini-2.5-pro': 'gemini-1.5-pro',
      'gemini-2.0-flash': 'gemini-2.0-flash',
    }
    return googleModelMap[modelId] || modelId
  }

  // Anthropic models - ensure full model names
  if (provider === 'anthropic') {
    const anthropicModelMap: Record<string, string> = {
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-opus': 'claude-3-opus-20240229',
    }
    return anthropicModelMap[modelId] || modelId
  }

  return modelId
}

export function getProviderForModel(modelId: string): ProviderType | null {
  return MODEL_PROVIDER_MAP[modelId] || null
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Create provider instance based on type and API key
  const createProvider = useCallback((provider: ProviderType, apiKey: string) => {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey })
      case 'anthropic':
        return createAnthropic({ apiKey })
      case 'google':
        return createGoogleGenerativeAI({ apiKey })
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }, [])

  // Generate response (non-streaming)
  const generate = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
  }): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Determine provider from model
      const providerType = getProviderForModel(modelId)
      if (!providerType) {
        throw new Error(`Unknown model: ${modelId}`)
      }

      // Find provider config
      const providerConfig = providers.find(p => p.id === providerType)
      if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      }

      // Create provider instance
      const provider = createProvider(providerType, providerConfig.apiKey)
      const normalizedModelId = normalizeModelId(modelId, providerType)

      // Generate text
      const { text } = await generateText({
        model: provider(normalizedModelId),
        messages,
        system,
      })

      options.onResponse?.(text)
      options.onFinish?.()
      return text
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [createProvider, options])

  // Stream response
  const stream = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
    onChunk,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    onChunk?: (chunk: string) => void
  }): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Determine provider from model
      const providerType = getProviderForModel(modelId)
      if (!providerType) {
        throw new Error(`Unknown model: ${modelId}`)
      }

      // Find provider config
      const providerConfig = providers.find(p => p.id === providerType)
      if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      }

      // Create provider instance
      const provider = createProvider(providerType, providerConfig.apiKey)
      const normalizedModelId = normalizeModelId(modelId, providerType)

      // Stream text
      const { textStream, text } = streamText({
        model: provider(normalizedModelId),
        messages,
        system,
      })

      // Process stream
      let fullText = ''
      for await (const chunk of textStream) {
        fullText += chunk
        onChunk?.(chunk)
      }

      const finalText = await text
      options.onResponse?.(finalText)
      options.onFinish?.()
      return finalText
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [createProvider, options])

  return {
    generate,
    stream,
    isLoading,
    error,
  }
}

// Helper to convert app messages to CoreMessage format
export function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))
}
