/**
 * AI Chat Hook V2 - Uses Electron IPC for all AI SDK operations
 *
 * This hook provides a unified interface for chat completions with streaming support,
 * tool calling, and MCP integration. All API calls are proxied through Electron's
 * main process to avoid CORS issues.
 *
 * @module hooks/useAIChatV2
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { debugLog } from '../utils/debug'
import { normalizeToJsonSchema } from '../utils/zodSchema'

// Detect if running in web mode (not Electron)
const isWebMode = () => !window.electronAPI?.isElectron

// Web mode API base URL (same origin)
const getWebApiUrl = () => window.location.origin

// ============================================================================
// Types
// ============================================================================

export interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: unknown
}

export interface ToolResultPart {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  result: unknown
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

export interface ReasoningContent {
  type: 'thinking' | 'reasoning'
  content: string
  timestamp?: Date
}

export type StreamEventType =
  | 'text-delta'
  | 'reasoning-delta'
  | 'tool-call'
  | 'tool-result'
  | 'step-finish'
  | 'finish'

export interface StreamEvent {
  type: StreamEventType
  data: unknown
  timestamp: Date
}

export interface UseAIChatOptions {
  onResponse?: (text: string) => void
  onError?: (error: Error) => void
  onFinish?: () => void
  onToolCall?: (toolCall: ToolCallPart) => void
  onToolResult?: (toolResult: ToolResultPart) => void
  onTextDelta?: (delta: string) => void
  onReasoningDelta?: (delta: string) => void
  onReasoningComplete?: (reasoning: ReasoningContent) => void
  onStreamEvent?: (event: StreamEvent) => void
}

export interface ToolDefinition {
  description: string
  parameters: Record<string, unknown>
  execute?: (args: unknown) => Promise<unknown>
}

export type ToolsMap = Record<string, ToolDefinition>

export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  serverId: string
}

export type MCPToolCaller = (
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
) => Promise<{
  success: boolean
  content?: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  error?: string
}>

export interface CoreMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ============================================================================
// Agent SDK Support (Claude 4.5+ models)
// ============================================================================

/**
 * Models that should use Agent SDK instead of Vercel AI SDK
 */
const AGENT_SDK_MODELS = new Set([
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5',
  'claude-opus-4-5-20251101',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-code', // Alias for sonnet-4-5
])

/**
 * Check if model should use Agent SDK
 */
export function shouldUseAgentSDK(modelId: string): boolean {
  if (AGENT_SDK_MODELS.has(modelId)) return true
  const lowerModelId = modelId.toLowerCase()
  if (lowerModelId.includes('sonnet-4-5') ||
      lowerModelId.includes('opus-4-5') ||
      lowerModelId.includes('haiku-4-5')) {
    return true
  }
  return false
}

// ============================================================================
// Model Provider Map (for local validation)
// ============================================================================

const MODEL_PROVIDER_MAP: Record<string, ProviderType> = {
  // Google models
  'gemini-3-pro-preview': 'google',
  'gemini-2.5-pro': 'google',
  'gemini-2.5-flash': 'google',
  'gemini-2.5-flash-lite': 'google',
  // OpenAI models
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4': 'openai',
  'gpt-3.5-turbo': 'openai',
  'o1': 'openai',
  'o1-mini': 'openai',
  'o1-preview': 'openai',
  'o3': 'openai',
  'o3-mini': 'openai',
  // Anthropic models
  'claude-3-5-sonnet': 'anthropic',
  'claude-3-5-sonnet-20241022': 'anthropic',
  'claude-4-sonnet': 'anthropic',
  'claude-4-sonnet-20250514': 'anthropic',
  'claude-sonnet-4-20250514': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
  // Claude Code (OAuth)
  'claude-code': 'claude-code',
  'claude-sonnet-4-5': 'claude-code',
  'claude-sonnet-4-5-20250929': 'claude-code',
  'claude-opus-4-5': 'claude-code',
  'claude-opus-4-5-20251101': 'claude-code',
  'claude-haiku-4-5': 'claude-code',
  'claude-haiku-4-5-20251001': 'claude-code',
  // Codex (ChatGPT Plus/Pro OAuth)
  'codex': 'codex',
  'codex-gpt-4o': 'codex',
  'codex-o1': 'codex',
  'codex-o1-pro': 'codex',
  'gpt-5.1-codex': 'codex',
  'gpt-5.1-codex-mini': 'codex',
  'gpt-5.1-nano': 'codex',
  'gpt-5-codex': 'codex',
  'gpt-5-codex-mini': 'codex',
}

export function getProviderForModel(modelId: string): ProviderType | null {
  // Check exact match first
  if (MODEL_PROVIDER_MAP[modelId]) {
    return MODEL_PROVIDER_MAP[modelId]
  }

  // Pattern-based matching for model variants
  const lowerModelId = modelId.toLowerCase()
  if (lowerModelId.startsWith('gemini-')) return 'google'
  if (lowerModelId.startsWith('gpt-') || lowerModelId.startsWith('o1') || lowerModelId.startsWith('o3')) return 'openai'
  if (lowerModelId.startsWith('claude-')) {
    // Check for OAuth variants
    if (lowerModelId.includes('sonnet-4-5') || lowerModelId.includes('opus-4-5') || lowerModelId.includes('haiku-4-5')) {
      return 'claude-code'
    }
    return 'anthropic'
  }
  if (lowerModelId.includes('codex')) return 'codex'

  return null
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAIChatV2(options: UseAIChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false) // True only while AI is actively responding
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const currentRequestIdRef = useRef<string | null>(null)
  const cleanupFnsRef = useRef<Array<() => void>>([])
  const optionsRef = useRef(options)

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Initialize AI SDK on mount
  useEffect(() => {
    // In web mode, check server availability
    if (isWebMode()) {
      debugLog.aiChat.log('[Web Mode] Checking AI providers availability')
      fetch(`${getWebApiUrl()}/api/ai/providers`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            const providers = result.data
            debugLog.aiChat.log('[Web Mode] Available providers:', providers)
            setIsInitialized(true)
          }
        })
        .catch(err => {
          debugLog.aiChat.warn('[Web Mode] AI providers check failed:', err)
          // Still mark as initialized so the UI loads, errors will show on actual use
          setIsInitialized(true)
        })
      return
    }

    // Electron mode
    if (!window.electronAPI?.aiSdk) {
      debugLog.aiChat.warn('Electron AI SDK not available')
      return
    }

    window.electronAPI.aiSdk.initialize()
      .then(() => {
        setIsInitialized(true)
        debugLog.aiChat.log('AI SDK initialized')
      })
      .catch((err: Error) => {
        debugLog.aiChat.error('Failed to initialize AI SDK:', err)
      })

    // Cleanup on unmount
    return () => {
      cleanupFnsRef.current.forEach(fn => fn())
      cleanupFnsRef.current = []
      window.electronAPI?.aiSdk?.removeAllListeners?.()
    }
  }, [])

  /**
   * Convert provider configs to a simple map
   */
  const providersToMap = useCallback((providers: ProviderConfig[]): Record<string, string> => {
    const map: Record<string, string> = {}
    for (const p of providers) {
      map[p.id] = p.apiKey
    }
    return map
  }, [])

  /**
   * Stream a chat completion
   */
  const stream = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
    tools,
    maxSteps = 5,
    onChunk,
    onStepFinish,
    enableReasoning = false,
    onReasoningChunk,
    mcpTools = [],
    projectFolder,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    tools?: ToolsMap
    maxSteps?: number
    onChunk?: (chunk: string) => void
    onStepFinish?: (step: { text: string; toolCalls?: ToolCallPart[]; toolResults?: ToolResultPart[] }) => void
    enableReasoning?: boolean
    onReasoningChunk?: (chunk: string) => void
    mcpTools?: MCPToolDefinition[]
    projectFolder?: string
  }): Promise<{
    text: string | null
    toolCalls?: ToolCallPart[]
    toolResults?: ToolResultPart[]
    reasoning?: string
  }> => {
    // =========================================================================
    // Web Mode: Use REST API instead of Electron IPC
    // =========================================================================
    if (isWebMode()) {
      debugLog.aiChat.log('[Web Mode] Using REST API for AI chat')
      setIsLoading(true)
      setIsGenerating(true)
      setError(null)

      try {
        const apiUrl = getWebApiUrl()

        // Convert messages to AI SDK format
        const apiMessages = messages.map(m => ({
          role: m.role,
          content: m.content,
        }))

        // Convert providers array to providers map for server
        const providersMap: Record<string, string> = {}
        for (const p of providers) {
          providersMap[p.id] = p.apiKey
        }

        // Use streaming endpoint
        const response = await fetch(`${apiUrl}/api/ai/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            modelId,
            system,
            providers: providersMap,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        // Process SSE stream
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'text-delta' && parsed.text) {
                  fullText += parsed.text
                  onChunk?.(parsed.text)
                  optionsRef.current.onTextDelta?.(parsed.text)
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error)
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        setIsLoading(false)
        setIsGenerating(false)
        optionsRef.current.onResponse?.(fullText)
        optionsRef.current.onFinish?.()

        return { text: fullText }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setIsLoading(false)
        setIsGenerating(false)
        optionsRef.current.onError?.(error)
        return { text: null }
      }
    }

    // =========================================================================
    // Electron Mode: Use IPC
    // =========================================================================
    if (!window.electronAPI?.aiSdk) {
      const err = new Error('AI SDK not available - requires Electron environment')
      setError(err)
      optionsRef.current.onError?.(err)
      return { text: null }
    }

    // Store reference after null check to avoid repeated non-null assertions
    const aiSdk = window.electronAPI.aiSdk

    // Clean up any existing stream listeners before starting a new one (prevents race conditions)
    cleanupFnsRef.current.forEach(fn => fn())
    cleanupFnsRef.current = []

    setIsLoading(true)
    setIsGenerating(true) // Start of active generation
    setError(null)

    const requestId = crypto.randomUUID()
    currentRequestIdRef.current = requestId

    // =========================================================================
    // Agent SDK Route (Claude 4.5+ models)
    // =========================================================================
    if (shouldUseAgentSDK(modelId) && window.electronAPI?.agentSdk) {
      const agentSdk = window.electronAPI.agentSdk
      debugLog.aiChat.log(`[Agent SDK] Using Agent SDK for model: ${modelId}`)

      return new Promise((resolve) => {
        let fullText = ''
        let fullReasoning = ''
        const allToolCalls: ToolCallPart[] = []
        const allToolResults: ToolResultPart[] = []
        const pendingToolInputs: Map<string, { name: string; partialJson: string }> = new Map()

        // Set up Agent SDK event listeners
        const removeTextChunk = agentSdk.onTextChunk((data: { requestId: string; chunk: string }) => {
          if (data.requestId !== requestId) return
          fullText += data.chunk
          onChunk?.(data.chunk)
          optionsRef.current.onTextDelta?.(data.chunk)
          optionsRef.current.onStreamEvent?.({
            type: 'text-delta',
            data: data.chunk,
            timestamp: new Date(),
          })
        })

        const removeThinkingStart = agentSdk.onThinkingStart((data: { requestId: string; index: number }) => {
          if (data.requestId !== requestId) return
          debugLog.aiChat.log(`[Agent SDK] Thinking started at index ${data.index}`)
        })

        const removeThinkingChunk = agentSdk.onThinkingChunk((data: { requestId: string; chunk: string; index: number }) => {
          if (data.requestId !== requestId) return
          fullReasoning += data.chunk
          onReasoningChunk?.(data.chunk)
          optionsRef.current.onReasoningDelta?.(data.chunk)
          optionsRef.current.onStreamEvent?.({
            type: 'reasoning-delta',
            data: data.chunk,
            timestamp: new Date(),
          })
        })

        const removeToolStart = agentSdk.onToolStart((data: { requestId: string; toolCallId: string; toolName: string; index: number }) => {
          if (data.requestId !== requestId) return
          debugLog.aiChat.log(`[Agent SDK] Tool started: ${data.toolName} (${data.toolCallId})`)
          pendingToolInputs.set(data.toolCallId, { name: data.toolName, partialJson: '' })

          // Call onStepFinish to update tool chips in UI (same as Vercel AI SDK does)
          onStepFinish?.({
            text: fullText,
            toolCalls: [{
              type: 'tool-call',
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: {},
            }],
          })
        })

        const removeToolInputDelta = agentSdk.onToolInputDelta((data: { requestId: string; toolCallId: string; delta: string; index: number }) => {
          if (data.requestId !== requestId) return
          const pending = pendingToolInputs.get(data.toolCallId)
          if (pending) {
            pending.partialJson += data.delta
          }
        })

        const removeToolResult = agentSdk.onToolResult((data: { requestId: string; toolCallId: string; result: string; isError: boolean }) => {
          if (data.requestId !== requestId) return

          const pending = pendingToolInputs.get(data.toolCallId)
          const toolName = pending?.name || 'unknown'

          // Parse the accumulated args
          let args: unknown = {}
          if (pending?.partialJson) {
            try {
              args = JSON.parse(pending.partialJson)
            } catch {
              args = { raw: pending.partialJson }
            }
          }

          // Create tool call
          const toolCall: ToolCallPart = {
            type: 'tool-call',
            toolCallId: data.toolCallId,
            toolName,
            args,
          }
          allToolCalls.push(toolCall)
          optionsRef.current.onToolCall?.(toolCall)
          optionsRef.current.onStreamEvent?.({
            type: 'tool-call',
            data: toolCall,
            timestamp: new Date(),
          })

          // Parse result
          let parsedResult: unknown
          try {
            parsedResult = JSON.parse(data.result)
          } catch {
            parsedResult = data.result
          }

          // Create tool result
          const toolResult: ToolResultPart = {
            type: 'tool-result',
            toolCallId: data.toolCallId,
            toolName,
            result: data.isError ? { error: parsedResult } : parsedResult,
          }
          allToolResults.push(toolResult)
          optionsRef.current.onToolResult?.(toolResult)
          optionsRef.current.onStreamEvent?.({
            type: 'tool-result',
            data: toolResult,
            timestamp: new Date(),
          })

          pendingToolInputs.delete(data.toolCallId)

          // Call onStepFinish to update tool chips status in UI
          onStepFinish?.({
            text: fullText,
            toolResults: [toolResult],
          })
        })

        const removeBlockStop = agentSdk.onBlockStop((data: { requestId: string; index: number }) => {
          if (data.requestId !== requestId) return
          debugLog.aiChat.log(`[Agent SDK] Block stopped at index ${data.index}`)
        })

        const removeComplete = agentSdk.onComplete((data: { requestId: string; text: string; thinking?: string }) => {
          if (data.requestId !== requestId) return

          debugLog.aiChat.log('[Agent SDK] Complete received, resetting isGenerating')

          // Cleanup all listeners
          removeTextChunk()
          removeThinkingStart()
          removeThinkingChunk()
          removeToolStart()
          removeToolInputDelta()
          removeToolResult()
          removeBlockStop()
          removeComplete()
          removeError()
          removeInterrupted()

          // Handle reasoning completion
          if (data.thinking || fullReasoning) {
            const reasoning = data.thinking || fullReasoning
            optionsRef.current.onReasoningComplete?.({
              type: 'thinking',
              content: reasoning,
              timestamp: new Date(),
            })
          }

          optionsRef.current.onResponse?.(data.text || fullText)
          optionsRef.current.onFinish?.()
          optionsRef.current.onStreamEvent?.({
            type: 'finish',
            data: { finishReason: 'stop' },
            timestamp: new Date(),
          })

          setIsGenerating(false) // AI finished responding
          setIsLoading(false)
          currentRequestIdRef.current = null

          resolve({
            text: data.text || fullText,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            toolResults: allToolResults.length > 0 ? allToolResults : undefined,
            reasoning: data.thinking || fullReasoning || undefined,
          })
        })

        const removeError = agentSdk.onError((data: { requestId: string; error: string }) => {
          if (data.requestId !== requestId) return

          // Cleanup all listeners
          removeTextChunk()
          removeThinkingStart()
          removeThinkingChunk()
          removeToolStart()
          removeToolInputDelta()
          removeToolResult()
          removeBlockStop()
          removeComplete()
          removeError()
          removeInterrupted()

          const err = new Error(data.error)
          setError(err)
          optionsRef.current.onError?.(err)
          setIsGenerating(false) // AI stopped due to error
          setIsLoading(false)
          currentRequestIdRef.current = null

          resolve({ text: null })
        })

        const removeInterrupted = agentSdk.onInterrupted((data: { requestId: string }) => {
          if (data.requestId !== requestId) return

          debugLog.aiChat.log('[Agent SDK] Session interrupted')
          setIsGenerating(false) // AI was interrupted
          // Don't resolve - wait for complete/error
        })

        // Store cleanup functions
        cleanupFnsRef.current = [
          removeTextChunk,
          removeThinkingStart,
          removeThinkingChunk,
          removeToolStart,
          removeToolInputDelta,
          removeToolResult,
          removeBlockStop,
          removeComplete,
          removeError,
          removeInterrupted,
        ]

        // Start the Agent SDK stream
        agentSdk.stream({
          requestId,
          modelId,
          messages,
          system,
          maxThinkingTokens: enableReasoning ? 16384 : 0,
          projectFolder,
          mcpTools,
        }).catch((err: Error) => {
          setError(err)
          optionsRef.current.onError?.(err)
          setIsGenerating(false)
          setIsLoading(false)
          resolve({ text: null })
        })
      })
    }

    // =========================================================================
    // Vercel AI SDK Route (OpenAI, Google, Legacy Anthropic)
    // =========================================================================
    return new Promise((resolve) => {
      let fullText = ''
      let fullReasoning = ''
      const allToolCalls: ToolCallPart[] = []
      const allToolResults: ToolResultPart[] = []

      // Set up event listeners
      const removeTextChunk = aiSdk.onTextChunk((data: { requestId: string; chunk: string }) => {
        if (data.requestId !== requestId) return
        fullText += data.chunk
        onChunk?.(data.chunk)
        optionsRef.current.onTextDelta?.(data.chunk)
        optionsRef.current.onStreamEvent?.({
          type: 'text-delta',
          data: data.chunk,
          timestamp: new Date(),
        })
      })

      const removeStepFinish = aiSdk.onStepFinish((data: {
        requestId: string
        text: string
        toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>
        toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>
      }) => {
        if (data.requestId !== requestId) return

        const stepToolCalls: ToolCallPart[] = data.toolCalls?.map(tc => ({
          type: 'tool-call' as const,
          ...tc,
        })) || []

        const stepToolResults: ToolResultPart[] = data.toolResults?.map(tr => ({
          type: 'tool-result' as const,
          ...tr,
        })) || []

        allToolCalls.push(...stepToolCalls)
        allToolResults.push(...stepToolResults)

        stepToolCalls.forEach(tc => optionsRef.current.onToolCall?.(tc))
        stepToolResults.forEach(tr => optionsRef.current.onToolResult?.(tr))

        onStepFinish?.({
          text: data.text,
          toolCalls: stepToolCalls.length > 0 ? stepToolCalls : undefined,
          toolResults: stepToolResults.length > 0 ? stepToolResults : undefined,
        })
      })

      const removeComplete = aiSdk.onComplete((data: {
        requestId: string
        text: string
        reasoning?: string
        toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>
        toolResults?: Array<{ toolCallId: string; toolName: string; result: unknown }>
        finishReason: string
      }) => {
        if (data.requestId !== requestId) return

        // Cleanup listeners
        removeTextChunk()
        removeStepFinish()
        removeComplete()
        removeError()

        // Handle reasoning
        if (data.reasoning) {
          fullReasoning = data.reasoning
          onReasoningChunk?.(data.reasoning)
          optionsRef.current.onReasoningDelta?.(data.reasoning)
          optionsRef.current.onReasoningComplete?.({
            type: 'thinking',
            content: data.reasoning,
            timestamp: new Date(),
          })
        }

        // Merge any final tool calls/results
        if (data.toolCalls) {
          for (const tc of data.toolCalls) {
            if (!allToolCalls.find(t => t.toolCallId === tc.toolCallId)) {
              const toolCall: ToolCallPart = { type: 'tool-call', ...tc }
              allToolCalls.push(toolCall)
              optionsRef.current.onToolCall?.(toolCall)
            }
          }
        }
        if (data.toolResults) {
          for (const tr of data.toolResults) {
            if (!allToolResults.find(t => t.toolCallId === tr.toolCallId)) {
              const toolResult: ToolResultPart = { type: 'tool-result', ...tr }
              allToolResults.push(toolResult)
              optionsRef.current.onToolResult?.(toolResult)
            }
          }
        }

        optionsRef.current.onResponse?.(data.text)
        optionsRef.current.onFinish?.()
        optionsRef.current.onStreamEvent?.({
          type: 'finish',
          data: { finishReason: data.finishReason },
          timestamp: new Date(),
        })

        setIsGenerating(false) // AI finished responding
        setIsLoading(false)
        currentRequestIdRef.current = null

        resolve({
          text: data.text,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          toolResults: allToolResults.length > 0 ? allToolResults : undefined,
          reasoning: fullReasoning || undefined,
        })
      })

      const removeError = aiSdk.onError((data: { requestId: string; error: string }) => {
        if (data.requestId !== requestId) return

        // Cleanup listeners
        removeTextChunk()
        removeStepFinish()
        removeComplete()
        removeError()

        const err = new Error(data.error)
        setError(err)
        optionsRef.current.onError?.(err)
        setIsGenerating(false) // AI stopped due to error
        setIsLoading(false)
        currentRequestIdRef.current = null

        resolve({ text: null })
      })

      // Store cleanup functions
      cleanupFnsRef.current = [removeTextChunk, removeStepFinish, removeComplete, removeError]

      // Convert tools to serializable format (remove execute functions, convert Zod to JSON Schema)
      const serializableTools: Record<string, { description: string; parameters: Record<string, unknown> }> = {}
      if (tools) {
        for (const [name, def] of Object.entries(tools)) {
          // Use shared utility to convert Zod schemas or normalize plain objects to JSON Schema
          const jsonSchemaParams = normalizeToJsonSchema(def.parameters)

          serializableTools[name] = {
            description: def.description,
            parameters: jsonSchemaParams,
          }
          debugLog.aiChat.log(`Tool ${name} params:`, JSON.stringify(jsonSchemaParams))
        }
      }

      // Start the stream
      aiSdk.stream({
        requestId,
        modelId,
        messages,
        providers: providersToMap(providers),
        system,
        tools: serializableTools,
        maxSteps,
        enableReasoning,
        mcpTools,
        projectFolder,
      }).catch((err: Error) => {
        setError(err)
        optionsRef.current.onError?.(err)
        setIsLoading(false)
        resolve({ text: null })
      })
    })
  }, [providersToMap])

  /**
   * Generate a chat completion (non-streaming)
   */
  const generate = useCallback(async ({
    modelId,
    messages,
    providers,
    system,
    tools,
    maxSteps = 5,
    mcpTools = [],
    projectFolder,
  }: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    tools?: ToolsMap
    maxSteps?: number
    mcpTools?: MCPToolDefinition[]
    projectFolder?: string
  }): Promise<{
    text: string | null
    toolCalls?: ToolCallPart[]
    toolResults?: ToolResultPart[]
  }> => {
    // =========================================================================
    // Web Mode: Use REST API (simplified, no tool calling support yet)
    // =========================================================================
    if (isWebMode()) {
      debugLog.aiChat.log('[Web Mode] Using REST API for conversation')
      setIsLoading(true)
      setError(null)

      try {
        const apiUrl = getWebApiUrl()

        // Convert providers array to providers map for server
        const providersMap: Record<string, string> = {}
        for (const p of providers) {
          providersMap[p.id] = p.apiKey
        }

        const response = await fetch(`${apiUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            modelId,
            system,
            providers: providersMap,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()
        setIsLoading(false)

        if (result.success) {
          return { text: result.data.text }
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setIsLoading(false)
        optionsRef.current.onError?.(error)
        return { text: null }
      }
    }

    // =========================================================================
    // Electron Mode: Use IPC
    // =========================================================================
    if (!window.electronAPI?.aiSdk) {
      const err = new Error('AI SDK not available - requires Electron environment')
      setError(err)
      optionsRef.current.onError?.(err)
      return { text: null }
    }

    // Store reference after null check to avoid repeated non-null assertions
    const aiSdk = window.electronAPI.aiSdk

    setIsLoading(true)
    setError(null)

    try {
      // Convert tools to serializable format (remove execute functions, convert Zod to JSON Schema)
      const serializableTools: Record<string, { description: string; parameters: Record<string, unknown> }> = {}
      if (tools) {
        for (const [name, def] of Object.entries(tools)) {
          // Check if parameters is a Zod schema (has _def property) and convert to JSON Schema
          let jsonSchemaParams: Record<string, unknown>
          if (def.parameters && typeof def.parameters === 'object' && '_def' in def.parameters) {
            try {
              if ('shape' in def.parameters) {
                const shape = (def.parameters as { shape: Record<string, unknown> }).shape
                const properties: Record<string, unknown> = {}
                const required: string[] = []

                for (const [propName, propSchema] of Object.entries(shape)) {
                  const propDef = propSchema as { _def?: { typeName?: string; description?: string }; isOptional?: () => boolean; description?: string }
                  const typeName = propDef._def?.typeName || 'ZodString'
                  const typeMap: Record<string, string> = {
                    ZodString: 'string',
                    ZodNumber: 'number',
                    ZodBoolean: 'boolean',
                    ZodArray: 'array',
                    ZodObject: 'object',
                  }
                  properties[propName] = {
                    type: typeMap[typeName] || 'string',
                    description: propDef._def?.description || propDef.description || '',
                  }
                  if (!propDef.isOptional?.()) {
                    required.push(propName)
                  }
                }

                jsonSchemaParams = {
                  type: 'object',
                  properties,
                  required: required.length > 0 ? required : undefined,
                }
              } else {
                jsonSchemaParams = { type: 'object', properties: {} }
              }
            } catch {
              jsonSchemaParams = { type: 'object', properties: {} }
            }
          } else if (def.parameters && typeof def.parameters === 'object') {
            jsonSchemaParams = def.parameters as Record<string, unknown>
          } else {
            jsonSchemaParams = { type: 'object', properties: {} }
          }

          serializableTools[name] = {
            description: def.description,
            parameters: jsonSchemaParams,
          }
        }
      }

      const result = await aiSdk.generate({
        modelId,
        messages,
        providers: providersToMap(providers),
        system,
        tools: serializableTools,
        maxSteps,
        mcpTools,
        projectFolder,
      })

      if (!result.success) {
        const err = new Error(result.error || 'Unknown error')
        setError(err)
        optionsRef.current.onError?.(err)
        return { text: null }
      }

      // Emit callbacks for tool calls/results
      if (result.toolCalls) {
        for (const tc of result.toolCalls) {
          const toolCall: ToolCallPart = { type: 'tool-call', ...tc }
          optionsRef.current.onToolCall?.(toolCall)
        }
      }
      if (result.toolResults) {
        for (const tr of result.toolResults) {
          const toolResult: ToolResultPart = { type: 'tool-result', ...tr }
          optionsRef.current.onToolResult?.(toolResult)
        }
      }

      optionsRef.current.onResponse?.(result.text)
      optionsRef.current.onFinish?.()

      return {
        text: result.text,
        toolCalls: result.toolCalls?.map((tc: { toolCallId: string; toolName: string; args: unknown }) => ({
          type: 'tool-call' as const,
          ...tc,
        })),
        toolResults: result.toolResults?.map((tr: { toolCallId: string; toolName: string; result: unknown }) => ({
          type: 'tool-result' as const,
          ...tr,
        })),
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      optionsRef.current.onError?.(error)
      return { text: null }
    } finally {
      setIsLoading(false)
    }
  }, [providersToMap])

  /**
   * Cancel the current streaming request
   */
  const cancel = useCallback(() => {
    // Clean up listeners
    cleanupFnsRef.current.forEach(fn => fn())
    cleanupFnsRef.current = []

    // Clear request tracking
    currentRequestIdRef.current = null

    // Reset loading state
    setIsGenerating(false)
    setIsLoading(false)

    // Notify via callback
    optionsRef.current.onFinish?.()

    debugLog.aiChat.log('Request cancelled')
  }, [])

  return {
    stream,
    generate,
    cancel,
    isLoading,
    isGenerating, // True only while AI is actively responding (for stop button)
    error,
    isInitialized,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert app messages to CoreMessage format
 */
export function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * Convert MCP tools to the format expected by the AI SDK wrapper
 */
export function mcpToolsToAISDKFormat(
  mcpTools: Array<{ name: string; description?: string; inputSchema?: { type: string; properties?: Record<string, unknown>; required?: string[] }; serverId?: string } & { serverId: string }>,
  _callTool: MCPToolCaller, // Not used - execution happens in main process
  _prefix = 'mcp'
): ToolsMap {
  // For V2, we just pass the MCP tools directly to the stream/generate calls
  // The main process handles the conversion and execution
  const result: ToolsMap = {}

  for (const mcpTool of mcpTools) {
    const uniqueName = `mcp_${mcpTool.serverId}_${mcpTool.name}`
    result[uniqueName] = {
      description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
      parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
    }
  }

  return result
}

/**
 * Merge multiple ToolsMap objects into one
 */
export function mergeTools(...toolMaps: ToolsMap[]): ToolsMap {
  return Object.assign({}, ...toolMaps)
}

// Re-export z from zod for convenience (if needed by consumers)
export { z } from 'zod'

// TypeScript declarations are in types/electron.d.ts
