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
const ANTHROPIC_BETA_HEADER = 'oauth-2025-04-20'

// Claude Code system prompt - REQUIRED for OAuth tokens to work
// This is what makes the API accept the request as a "Claude Code" request
const CLAUDE_CODE_SYSTEM_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude."

// Codex (OpenAI ChatGPT Plus/Pro) constants
const CODEX_BASE_URL = 'https://chatgpt.com/backend-api'
const CODEX_BETA_HEADER = 'responses=experimental'
const CODEX_ORIGINATOR = 'codex_cli_rs'

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

    // Remove all variations of headers that need to be overwritten
    // HTTP headers are case-insensitive, but JS objects are case-sensitive
    const headersToDelete = ['x-api-key', 'X-Api-Key', 'X-API-Key', 'X-API-KEY',
                             'anthropic-beta', 'Anthropic-Beta', 'Anthropic-beta',
                             'authorization', 'Authorization']
    for (const key of headersToDelete) {
      delete headers[key]
    }

    // Set headers for Claude Code OAuth (matching vibe-kit/auth exactly)
    headers['Authorization'] = `Bearer ${accessToken}`
    headers['anthropic-beta'] = ANTHROPIC_BETA_HEADER
    headers['anthropic-version'] = '2023-06-01'
    headers['X-API-Key'] = '' // Empty string required for OAuth

    // Parse body first so we can modify and log it
    let body: Record<string, unknown> = {}
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>
        } catch {
          body = { raw: init.body }
        }
      } else {
        body = init.body as Record<string, unknown>
      }
    }

    // CRITICAL: Inject the Claude Code system prompt
    // This is REQUIRED for OAuth tokens to be accepted
    // The user's system prompt will be prepended after this
    const existingSystem = body.system as string | undefined
    body.system = existingSystem
      ? `${CLAUDE_CODE_SYSTEM_PROMPT}\n\n${existingSystem}`
      : CLAUDE_CODE_SYSTEM_PROMPT

    // Proxy through Electron to bypass CORS
    const proxyResult = await window.electronAPI!.api.proxy({
      url,
      method: init?.method || 'POST',
      headers,
      body,
    })

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

// Helper to decode JWT and extract account ID for Codex
function decodeCodexJWT(token: string): { accountId?: string } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return {}
    const payload = JSON.parse(atob(parts[1]))
    // Extract account ID from OpenAI-specific claim
    const authClaim = payload['https://api.openai.com/auth']
    if (authClaim && authClaim.user_id) {
      return { accountId: authClaim.user_id }
    }
    return {}
  } catch {
    return {}
  }
}

// Create a custom fetch for Codex (OpenAI ChatGPT Plus/Pro via OAuth)
// 1. Uses Bearer authorization
// 2. Transforms /responses to /codex/responses
// 3. Adds OpenAI-Beta header
// 4. Adds chatgpt-account-id header
// 5. Proxies through Electron to bypass CORS
const createCodexOAuthFetch = (
  getAccessToken: () => Promise<{ success: boolean; accessToken?: string | null }>,
  getAccountId: () => string | null
): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Get fresh access token
    const result = await getAccessToken()
    if (!result.success || !result.accessToken) {
      throw new Error('Codex OAuth: No valid access token available. Please authenticate first.')
    }

    const accessToken = result.accessToken
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    // Transform URL: /responses -> /codex/responses for ChatGPT backend
    // And redirect to ChatGPT backend API
    if (url.includes('/responses')) {
      // Replace OpenAI API URL with ChatGPT backend
      url = url.replace('https://api.openai.com/v1/responses', `${CODEX_BASE_URL}/codex/responses`)
      url = url.replace('/v1/responses', '/codex/responses')
    }

    // If not already pointing to ChatGPT backend, prepend it
    if (!url.startsWith(CODEX_BASE_URL) && !url.startsWith('https://api.openai.com')) {
      url = `${CODEX_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    }

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

    // Remove API key headers - we use Bearer token
    const headersToDelete = ['x-api-key', 'X-Api-Key', 'X-API-Key', 'X-API-KEY',
                             'authorization', 'Authorization', 'openai-beta', 'OpenAI-Beta']
    for (const key of headersToDelete) {
      delete headers[key]
    }

    // Set Codex-specific headers
    headers['Authorization'] = `Bearer ${accessToken}`
    headers['OpenAI-Beta'] = CODEX_BETA_HEADER
    headers['originator'] = CODEX_ORIGINATOR

    // Get account ID from token or stored value
    let accountId = getAccountId()
    if (!accountId) {
      const decoded = decodeCodexJWT(accessToken)
      accountId = decoded.accountId || null
    }
    if (accountId) {
      headers['chatgpt-account-id'] = accountId
    }

    // Generate session ID for tracking
    headers['session_id'] = crypto.randomUUID()

    // Parse body and strip unsupported parameters for Codex responses endpoint
    let body: Record<string, unknown> | undefined = undefined
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>
        } catch {
          body = { raw: init.body }
        }
      } else {
        body = init.body as Record<string, unknown>
      }

      // IMPORTANT: Strip temperature and max_tokens for Codex models
      // The responses endpoint does NOT support these parameters
      if (body) {
        delete body.temperature
        delete body.max_tokens
        delete body.maxTokens
        delete body.top_p
        delete body.topP
      }
    }

    // Proxy through Electron to bypass CORS
    const proxyResult = await window.electronAPI!.api.proxy({
      url,
      method: init?.method || 'POST',
      headers,
      body,
    })

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

export type ProviderType = 'google' | 'openai' | 'anthropic' | 'claude-code' | 'codex'

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
  'claude-sonnet-4-5': 'claude-code',
  'claude-opus-4-5': 'claude-code',
  'claude-haiku-4-5': 'claude-code',
  // Codex (ChatGPT Plus/Pro via OAuth) - uses ChatGPT backend API
  // Requires Codex OAuth authentication via Electron
  // These models use the responses endpoint and do NOT support temperature/max_tokens
  'codex': 'codex',
  'codex-gpt-4o': 'codex',
  'codex-o1': 'codex',
  'codex-o1-pro': 'codex',
  'gpt-5.1': 'codex',
  'gpt-5.1-mini': 'codex',
  'gpt-5.1-nano': 'codex',
  'gpt-5.1-codex': 'codex',
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

  // Claude Code - map to actual Anthropic model names (Claude 4.5 family)
  if (provider === 'claude-code') {
    const claudeCodeModelMap: Record<string, string> = {
      'claude-code': 'claude-sonnet-4-5-20250929', // Default to Claude 4.5 Sonnet
      'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
      'claude-opus-4-5': 'claude-opus-4-5-20251101',
      'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    }
    return claudeCodeModelMap[modelId] || 'claude-sonnet-4-5-20250929'
  }

  // Codex - map to actual model names for ChatGPT backend responses endpoint
  // These models do NOT support temperature or max_tokens
  if (provider === 'codex') {
    const codexModelMap: Record<string, string> = {
      'codex': 'gpt-4o', // Default to GPT-4o
      'codex-gpt-4o': 'gpt-4o',
      'codex-o1': 'o1',
      'codex-o1-pro': 'o1-pro',
      // GPT-5.1 family - pass through as-is (these are the actual model names)
      'gpt-5.1': 'gpt-5.1',
      'gpt-5.1-mini': 'gpt-5.1-mini',
      'gpt-5.1-nano': 'gpt-5.1-nano',
      'gpt-5.1-codex': 'gpt-5.1-codex',
    }
    return codexModelMap[modelId] || modelId
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
      case 'codex':
        // Codex uses OAuth with ChatGPT backend API
        // The custom fetch handles Bearer auth, URL transformation, and proper headers
        if (!window.electronAPI?.codex?.getAccessToken) {
          throw new Error('Codex OAuth requires Electron environment')
        }
        // Store account ID to avoid decoding JWT on every request
        let codexAccountId: string | null = null
        return createOpenAI({
          apiKey: 'chatgpt-oauth', // Dummy key - auth comes from Bearer header in custom fetch
          baseURL: CODEX_BASE_URL,
          fetch: createCodexOAuthFetch(
            async () => {
              const result = await window.electronAPI!.codex.getAccessToken()
              // Extract account ID on first successful token fetch
              if (result.success && result.accessToken && !codexAccountId) {
                const decoded = decodeCodexJWT(result.accessToken)
                codexAccountId = decoded.accountId || null
              }
              return result
            },
            () => codexAccountId
          ),
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

      // Claude Code and Codex use OAuth, don't need API key from config
      let apiKey: string
      if (providerType === 'claude-code' || providerType === 'codex') {
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

      // Claude Code and Codex use OAuth, don't need API key from config
      let apiKey: string
      if (providerType === 'claude-code' || providerType === 'codex') {
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
