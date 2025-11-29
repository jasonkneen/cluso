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

// Anthropic beta header for OAuth support
const ANTHROPIC_BETA_HEADER = 'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'

// Create a custom fetch for Claude Code OAuth that:
// 1. Uses Bearer authorization (not x-api-key)
// 2. Adds the anthropic-beta header with oauth flag
// 3. Removes x-api-key header
// 4. Handles token refresh when expired
// 5. Proxies through Electron to bypass CORS
const createClaudeCodeOAuthFetch = (getAccessToken: () => Promise<{ success: boolean; accessToken?: string | null }>): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Get fresh access token (handles refresh internally via Electron IPC)
    const result = await getAccessToken()
    if (!result.success || !result.accessToken) {
      throw new Error('Claude Code OAuth: No valid access token available. Please authenticate first.')
    }

    const accessToken = result.accessToken
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    // Build headers from init
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

    // Debug: Log the headers we received from the SDK before modification
    console.log('[Claude Code OAuth] Headers from SDK (before modification):', JSON.stringify(headers, null, 2))

    // Remove all variations of x-api-key - OAuth uses Bearer auth instead
    // HTTP headers are case-insensitive, but JS objects are case-sensitive
    const headersToDelete = ['x-api-key', 'X-Api-Key', 'X-API-Key', 'X-API-KEY',
                             'anthropic-beta', 'Anthropic-Beta', 'Anthropic-beta',
                             'authorization', 'Authorization']
    for (const key of headersToDelete) {
      delete headers[key]
    }

    // Set Bearer authorization and all required headers for Claude Code OAuth
    headers['authorization'] = `Bearer ${accessToken}`
    headers['anthropic-beta'] = ANTHROPIC_BETA_HEADER
    // Ensure anthropic-version is set (Claude Code uses 2023-06-01)
    headers['anthropic-version'] = '2023-06-01'
    // Override User-Agent to identify as a Claude Code compatible client (like opencode)
    headers['user-agent'] = 'opencode/latest/1.0.0'

    // Parse body first so we can log it
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

    console.log('[Claude Code OAuth] Making request to:', url)
    console.log('[Claude Code OAuth] Method:', init?.method || 'POST')
    console.log('[Claude Code OAuth] Headers:', JSON.stringify({ ...headers, authorization: 'Bearer [REDACTED]' }, null, 2))
    console.log('[Claude Code OAuth] Body (first 500 chars):', JSON.stringify(body)?.substring(0, 500))

    // Proxy through Electron to bypass CORS
    const proxyResult = await window.electronAPI!.api.proxy({
      url,
      method: init?.method || 'POST',
      headers,
      body,
    })

    console.log('[Claude Code OAuth] Response status:', proxyResult.status, proxyResult.statusText)
    console.log('[Claude Code OAuth] Response ok:', proxyResult.ok)
    if (!proxyResult.ok) {
      console.log('[Claude Code OAuth] Error response body:', JSON.stringify(proxyResult.body)?.substring(0, 1000))
    }

    // Convert proxy response to a proper Response object
    const responseBody = typeof proxyResult.body === 'string'
      ? proxyResult.body
      : JSON.stringify(proxyResult.body)

    return new Response(responseBody, {
      status: proxyResult.status,
      statusText: proxyResult.statusText,
      headers: new Headers(proxyResult.headers || {}),
    })
  }
}

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
  // Claude Code (OAuth) - uses direct Anthropic API with OAuth Bearer token
  // Requires OAuth authentication via Electron
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

  // Claude Code - use Claude Opus 4.5 via OAuth
  if (provider === 'claude-code') {
    return 'claude-opus-4-5'
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

  // Create provider instance based on type and API key
  const createProvider = useCallback((provider: ProviderType, apiKey: string) => {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey })
      case 'anthropic':
        return createAnthropic({ apiKey })
      case 'google':
        return createGoogleGenerativeAI({ apiKey })
      case 'claude-code':
        // Claude Code uses OAuth with direct Anthropic API
        // The custom fetch handles Bearer auth and proper headers
        if (!window.electronAPI?.oauth?.getAccessToken) {
          throw new Error('Claude Code OAuth requires Electron environment')
        }
        return createAnthropic({
          apiKey: '', // Empty - auth comes from Bearer header in custom fetch
          // Pass headers option directly to the provider (in addition to fetch modification)
          headers: {
            'anthropic-beta': ANTHROPIC_BETA_HEADER,
          },
          fetch: createClaudeCodeOAuthFetch(async () => {
            return window.electronAPI!.oauth.getAccessToken()
          }),
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

      // Claude Code uses OAuth, doesn't need API key from config
      let apiKey: string
      if (providerType === 'claude-code') {
        // OAuth-based auth - no API key needed, handled by custom fetch
        apiKey = ''
      } else if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      } else {
        apiKey = providerConfig.apiKey
      }

      // Create provider instance
      const provider = createProvider(providerType, apiKey)
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

      // Claude Code uses OAuth, doesn't need API key from config
      let apiKey: string
      if (providerType === 'claude-code') {
        // OAuth-based auth - no API key needed, handled by custom fetch
        apiKey = ''
      } else if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`No API key configured for provider: ${providerType}`)
      } else {
        apiKey = providerConfig.apiKey
      }

      // Create provider instance
      const provider = createProvider(providerType, apiKey)
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
