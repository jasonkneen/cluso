import { useState, useCallback } from 'react'
import {
  generateText,
  streamText,
  CoreMessage,
  tool,
  CoreTool,
  ToolExecutionOptions,
  ToolCallPart,
  ToolResultPart,
} from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'

// Create a custom fetch that proxies through Electron to bypass CORS
const createElectronProxyFetch = (): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method || 'GET'
    const headers: Record<string, string> = {}

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, init.headers)
      }
    }

    let body: unknown = undefined
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body)
        } catch {
          body = init.body
        }
      } else {
        body = init.body
      }
    }

    const result = await window.electronAPI!.api.proxy({
      url,
      method,
      headers,
      body,
    })

    // Convert proxy response to a proper Response object
    const responseBody = typeof result.body === 'string'
      ? result.body
      : JSON.stringify(result.body)

    return new Response(responseBody, {
      status: result.status,
      statusText: result.statusText,
      headers: new Headers(result.headers || {}),
    })
  }
}

export type ProviderType = 'google' | 'openai' | 'anthropic' | 'claude-code'

export interface ProviderConfig {
  id: ProviderType
  apiKey: string
  // For claude-code, this will be the OAuth access token
  accessToken?: string
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
  onToolCall?: (toolCall: ToolCallPart) => void
  onToolResult?: (toolResult: ToolResultPart) => void
}

// Tool definition type compatible with AI SDK
export type ToolDefinition = {
  description: string
  parameters: z.ZodType<unknown>
  execute?: (args: unknown) => Promise<unknown>
}

export type ToolsMap = Record<string, ToolDefinition>

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
  'claude-4-sonnet': 'anthropic',
  'claude-4-sonnet-20250514': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
  // Claude Code (OAuth) - uses Anthropic API with OAuth token
  'claude-code': 'claude-code',
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
      'claude-4-sonnet': 'claude-sonnet-4-20250514',
      'claude-3-opus': 'claude-3-opus-20240229',
    }
    return anthropicModelMap[modelId] || modelId
  }

  // Claude Code uses Claude Sonnet 4 by default via OAuth
  if (provider === 'claude-code') {
    return 'claude-sonnet-4-20250514'
  }

  return modelId
}

export function getProviderForModel(modelId: string): ProviderType | null {
  return MODEL_PROVIDER_MAP[modelId] || null
}

// Convert our tool definitions to AI SDK format
function convertTools(tools: ToolsMap): Record<string, CoreTool> {
  const result: Record<string, CoreTool> = {}

  for (const [name, def] of Object.entries(tools)) {
    result[name] = tool({
      description: def.description,
      parameters: def.parameters,
      execute: def.execute,
    })
  }

  return result
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Create provider instance based on type and API key or access token
  const createProvider = useCallback((provider: ProviderType, apiKey: string, accessToken?: string) => {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey })
      case 'anthropic':
        return createAnthropic({ apiKey })
      case 'google':
        return createGoogleGenerativeAI({ apiKey })
      case 'claude-code':
        // Claude Code uses the Anthropic API with an OAuth access token
        // Use Electron proxy fetch to bypass CORS restrictions
        const proxyFetch = window.electronAPI?.api ? createElectronProxyFetch() : undefined
        return createAnthropic({
          apiKey: accessToken || apiKey,
          headers: {
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
          },
          fetch: proxyFetch,
        })
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }, [])

  // Generate response (non-streaming) with optional tools
  const generate = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
    tools,
    maxSteps = 5,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    tools?: ToolsMap
    maxSteps?: number
  }): Promise<{
    text: string | null
    toolCalls?: ToolCallPart[]
    toolResults?: ToolResultPart[]
  }> => {
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

      // For claude-code, get access token via OAuth
      let accessToken: string | undefined
      if (providerType === 'claude-code') {
        if (window.electronAPI?.oauth) {
          const tokenResult = await window.electronAPI.oauth.getAccessToken()
          if (!tokenResult.success || !tokenResult.accessToken) {
            throw new Error('Claude Code requires OAuth authentication. Please login in Settings.')
          }
          accessToken = tokenResult.accessToken
        } else {
          throw new Error('Claude Code OAuth is only available in the desktop app')
        }
      } else if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      }

      // Create provider instance
      const provider = createProvider(providerType, providerConfig?.apiKey || '', accessToken)
      const normalizedModelId = normalizeModelId(modelId, providerType)

      // Build generation options
      const generateOptions: Parameters<typeof generateText>[0] = {
        model: provider(normalizedModelId),
        messages,
        system,
      }

      // Add tools if provided
      if (tools && Object.keys(tools).length > 0) {
        generateOptions.tools = convertTools(tools)
        generateOptions.maxSteps = maxSteps
      }

      // Generate text with potential tool calls
      const result = await generateText(generateOptions)

      // Process tool calls if present
      const toolCalls: ToolCallPart[] = []
      const toolResults: ToolResultPart[] = []

      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              const toolCall: ToolCallPart = {
                type: 'tool-call',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              }
              toolCalls.push(toolCall)
              options.onToolCall?.(toolCall)
            }
          }
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const toolResult: ToolResultPart = {
                type: 'tool-result',
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                result: tr.result,
              }
              toolResults.push(toolResult)
              options.onToolResult?.(toolResult)
            }
          }
        }
      }

      options.onResponse?.(result.text)
      options.onFinish?.()

      return {
        text: result.text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
      return { text: null }
    } finally {
      setIsLoading(false)
    }
  }, [createProvider, options])

  // Stream response with optional tools
  const stream = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
    tools,
    maxSteps = 5,
    onChunk,
    onStepFinish,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    tools?: ToolsMap
    maxSteps?: number
    onChunk?: (chunk: string) => void
    onStepFinish?: (step: { text: string; toolCalls?: ToolCallPart[]; toolResults?: ToolResultPart[] }) => void
  }): Promise<{
    text: string | null
    toolCalls?: ToolCallPart[]
    toolResults?: ToolResultPart[]
  }> => {
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

      // For claude-code, get access token via OAuth
      let accessToken: string | undefined
      if (providerType === 'claude-code') {
        if (window.electronAPI?.oauth) {
          const tokenResult = await window.electronAPI.oauth.getAccessToken()
          if (!tokenResult.success || !tokenResult.accessToken) {
            throw new Error('Claude Code requires OAuth authentication. Please login in Settings.')
          }
          accessToken = tokenResult.accessToken
        } else {
          throw new Error('Claude Code OAuth is only available in the desktop app')
        }
      } else if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      }

      // Create provider instance
      const provider = createProvider(providerType, providerConfig?.apiKey || '', accessToken)
      const normalizedModelId = normalizeModelId(modelId, providerType)

      // Build stream options
      const streamOptions: Parameters<typeof streamText>[0] = {
        model: provider(normalizedModelId),
        messages,
        system,
      }

      // Add tools if provided
      if (tools && Object.keys(tools).length > 0) {
        streamOptions.tools = convertTools(tools)
        streamOptions.maxSteps = maxSteps

        // Handle step finish callback
        if (onStepFinish) {
          streamOptions.onStepFinish = async (event) => {
            const stepToolCalls: ToolCallPart[] = []
            const stepToolResults: ToolResultPart[] = []

            if (event.toolCalls) {
              for (const tc of event.toolCalls) {
                stepToolCalls.push({
                  type: 'tool-call',
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  args: tc.args,
                })
              }
            }

            if (event.toolResults) {
              for (const tr of event.toolResults) {
                stepToolResults.push({
                  type: 'tool-result',
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName,
                  result: tr.result,
                })
              }
            }

            onStepFinish({
              text: event.text,
              toolCalls: stepToolCalls.length > 0 ? stepToolCalls : undefined,
              toolResults: stepToolResults.length > 0 ? stepToolResults : undefined,
            })
          }
        }
      }

      // Stream text
      const result = streamText(streamOptions)

      // Process stream
      let fullText = ''
      for await (const chunk of result.textStream) {
        fullText += chunk
        onChunk?.(chunk)
      }

      // Await final result
      const finalResult = await result

      // Collect all tool calls and results
      const allToolCalls: ToolCallPart[] = []
      const allToolResults: ToolResultPart[] = []

      if (finalResult.steps) {
        for (const step of finalResult.steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              const toolCall: ToolCallPart = {
                type: 'tool-call',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              }
              allToolCalls.push(toolCall)
              options.onToolCall?.(toolCall)
            }
          }
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const toolResult: ToolResultPart = {
                type: 'tool-result',
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                result: tr.result,
              }
              allToolResults.push(toolResult)
              options.onToolResult?.(toolResult)
            }
          }
        }
      }

      const finalText = await finalResult.text
      options.onResponse?.(finalText)
      options.onFinish?.()

      return {
        text: finalText,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
      return { text: null }
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

// Re-export useful types and utilities from AI SDK
export { z } from 'zod'
export type { CoreMessage, CoreTool, ToolCallPart, ToolResultPart }
