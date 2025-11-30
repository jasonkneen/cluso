/**
 * React Hook for AI SDK Wrapper
 * Provides easy integration into React applications
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CoreMessage } from 'ai'
import {
  AISDKWrapper,
  createAISDKWrapper,
  type AISDKWrapperConfig,
  type StreamEvent,
  type GenerationResponse,
  type AITool,
  AISDKError,
} from './index'

/**
 * Hook state
 */
export interface UseAISDKState {
  loading: boolean
  error: AISDKError | null
  currentResponse: GenerationResponse | null
  messages: CoreMessage[]
}

/**
 * Hook result
 */
export interface UseAISDKResult {
  // State
  state: UseAISDKState

  // Methods
  generateText: (userMessage: string, options?: any) => Promise<GenerationResponse>
  streamText: (userMessage: string, onEvent?: (event: StreamEvent) => void) => Promise<void>
  streamWithTools: (userMessage: string, options?: any) => Promise<GenerationResponse>
  addMessage: (message: CoreMessage) => void
  clearMessages: () => void
  setMessages: (messages: CoreMessage[]) => void

  // Tool management
  registerTool: (tool: AITool) => void
  registerTools: (tools: AITool[]) => void
  getTool: (name: string) => AITool | undefined
  getAllTools: () => AITool[]

  // Info
  getModelCapabilities: (modelId?: string) => any
  getAvailableModels: () => string[]
}

/**
 * Main hook for using AI SDK wrapper in React
 */
export function useAISDK(config: AISDKWrapperConfig): UseAISDKResult {
  // Initialize wrapper once
  const wrapperRef = useRef<AISDKWrapper | null>(null)
  const [state, setState] = useState<UseAISDKState>({
    loading: false,
    error: null,
    currentResponse: null,
    messages: [],
  })

  // Initialize wrapper
  useEffect(() => {
    try {
      wrapperRef.current = createAISDKWrapper(config)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof AISDKError ? error : new AISDKError(String(error), 'INIT_ERROR'),
      }))
    }
  }, [config])

  const wrapper = wrapperRef.current
  if (!wrapper) {
    throw new Error('Failed to initialize AI SDK wrapper')
  }

  // Generate text response
  const generateText = useCallback(
    async (userMessage: string, options?: any): Promise<GenerationResponse> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        // Add user message
        const messages = [...state.messages, { role: 'user', content: userMessage }]

        // Generate response
        const response = await wrapper.generateText(messages, options)

        // Update state
        setState((prev) => ({
          ...prev,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: response.text,
            },
          ],
          currentResponse: response,
          loading: false,
        }))

        return response
      } catch (error) {
        const aiError = error instanceof AISDKError ? error : new AISDKError(String(error), 'GENERATION_ERROR')
        setState((prev) => ({
          ...prev,
          error: aiError,
          loading: false,
        }))
        throw aiError
      }
    },
    [state.messages, wrapper]
  )

  // Stream text response
  const streamText = useCallback(
    async (userMessage: string, onEvent?: (event: StreamEvent) => void): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        // Add user message
        const messages = [...state.messages, { role: 'user', content: userMessage }]

        // Track events
        let fullText = ''
        let thinking = ''
        const toolCalls = []

        for await (const event of wrapper.streamText(messages)) {
          onEvent?.(event)

          switch (event.type) {
            case 'text':
              fullText += event.content
              break
            case 'thinking':
              thinking += event.content
              break
            case 'tool-call':
              toolCalls.push({
                id: event.toolCallId,
                name: event.toolName,
                args: event.args,
              })
              break
          }
        }

        // Create final response
        const response: GenerationResponse = {
          text: fullText,
          thinking: thinking || undefined,
          toolCalls,
          toolResults: [],
          usage: { inputTokens: 0, outputTokens: 0 },
          finishReason: 'stop',
        }

        // Update state
        setState((prev) => ({
          ...prev,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: fullText,
            },
          ],
          currentResponse: response,
          loading: false,
        }))
      } catch (error) {
        const aiError = error instanceof AISDKError ? error : new AISDKError(String(error), 'STREAMING_ERROR')
        setState((prev) => ({
          ...prev,
          error: aiError,
          loading: false,
        }))
        throw aiError
      }
    },
    [state.messages, wrapper]
  )

  // Stream with automatic tool execution
  const streamWithTools = useCallback(
    async (userMessage: string, options?: any): Promise<GenerationResponse> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const messages = [...state.messages, { role: 'user', content: userMessage }]

        const response = await wrapper.streamWithTools(messages, {
          ...options,
          autoExecuteTools: true,
        })

        setState((prev) => ({
          ...prev,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: response.text,
            },
          ],
          currentResponse: response,
          loading: false,
        }))

        return response
      } catch (error) {
        const aiError = error instanceof AISDKError ? error : new AISDKError(String(error), 'TOOL_STREAMING_ERROR')
        setState((prev) => ({
          ...prev,
          error: aiError,
          loading: false,
        }))
        throw aiError
      }
    },
    [state.messages, wrapper]
  )

  // Message management
  const addMessage = useCallback((message: CoreMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }))
  }, [])

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
    }))
  }, [])

  const setMessages = useCallback((messages: CoreMessage[]) => {
    setState((prev) => ({
      ...prev,
      messages,
    }))
  }, [])

  // Tool management
  const registerTool = useCallback((tool: AITool) => {
    wrapper.registerTool(tool)
  }, [wrapper])

  const registerTools = useCallback((tools: AITool[]) => {
    wrapper.registerTools(tools)
  }, [wrapper])

  const getTool = useCallback((name: string) => {
    return wrapper.getTool(name)
  }, [wrapper])

  const getAllTools = useCallback(() => {
    return wrapper.getAllTools()
  }, [wrapper])

  // Info methods
  const getModelCapabilities = useCallback((modelId?: string) => {
    return wrapper.getModelCapabilities(modelId)
  }, [wrapper])

  const getAvailableModels = useCallback(() => {
    return wrapper.getAvailableModels()
  }, [wrapper])

  return {
    state,
    generateText,
    streamText,
    streamWithTools,
    addMessage,
    clearMessages,
    setMessages,
    registerTool,
    registerTools,
    getTool,
    getAllTools,
    getModelCapabilities,
    getAvailableModels,
  }
}

/**
 * Hook for managing chat state specifically
 * Includes additional features like system prompt
 */
export function useAIChatWithSystem(
  config: AISDKWrapperConfig,
  systemPrompt?: string
): UseAISDKResult & { setSystemPrompt: (prompt: string) => void } {
  const [systemPromptState, setSystemPromptState] = useState(systemPrompt || '')
  const sdk = useAISDK(config)

  // Override generateText to include system prompt
  const generateTextWithSystem = useCallback(
    async (userMessage: string, options?: any) => {
      const messages: CoreMessage[] = [
        { role: 'user', content: systemPromptState },
        ...sdk.state.messages,
        { role: 'user', content: userMessage },
      ]

      return sdk.generateText(userMessage, options)
    },
    [sdk, systemPromptState]
  )

  return {
    ...sdk,
    generateText: generateTextWithSystem,
    setSystemPrompt: setSystemPromptState,
  }
}

/**
 * Hook for managing conversation history
 */
export interface UseChatHistoryOptions {
  maxMessages?: number
  storageKey?: string
}

export function useChatHistory(
  sdk: UseAISDKResult,
  options: UseChatHistoryOptions = {}
) {
  const { maxMessages = 50, storageKey = 'ai_sdk_messages' } = options

  // Load from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const messages = JSON.parse(stored) as CoreMessage[]
        sdk.setMessages(messages)
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }, [sdk, storageKey])

  // Save to storage whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined') return

    const messagesToSave = sdk.state.messages.slice(-maxMessages)

    try {
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave))
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }, [sdk.state.messages, maxMessages, storageKey])

  const clearHistory = useCallback(() => {
    sdk.clearMessages()
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }, [sdk, storageKey])

  return {
    messages: sdk.state.messages,
    clearHistory,
  }
}

/**
 * Hook for streaming responses with visual feedback
 */
export interface UseStreamingOptions {
  chunkSize?: number
  delayMs?: number
}

export function useStreaming(
  sdk: UseAISDKResult,
  options: UseStreamingOptions = {}
) {
  const { chunkSize = 1, delayMs = 0 } = options
  const [displayedText, setDisplayedText] = useState('')
  const [displayedThinking, setDisplayedThinking] = useState('')

  const streamWithDisplay = useCallback(
    async (userMessage: string) => {
      setDisplayedText('')
      setDisplayedThinking('')

      let buffer = ''
      let thinkingBuffer = ''

      await sdk.streamText(userMessage, (event) => {
        switch (event.type) {
          case 'text':
            buffer += event.content

            // Display in chunks
            if (buffer.length >= chunkSize) {
              setDisplayedText((prev) => prev + buffer)
              buffer = ''
            }

            // Add delay for visual effect
            if (delayMs > 0) {
              new Promise((resolve) => setTimeout(resolve, delayMs))
            }
            break

          case 'thinking':
            thinkingBuffer += event.content
            setDisplayedThinking((prev) => prev + event.content)
            break
        }
      })

      // Flush remaining buffer
      if (buffer) {
        setDisplayedText((prev) => prev + buffer)
      }
    },
    [sdk, chunkSize, delayMs]
  )

  return {
    displayedText,
    displayedThinking,
    streamWithDisplay,
    resetDisplay: () => {
      setDisplayedText('')
      setDisplayedThinking('')
    },
  }
}

/**
 * Hook for managing tool execution
 */
export function useToolExecution(sdk: UseAISDKResult) {
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set())
  const [toolResults, setToolResults] = useState<
    Record<string, { status: 'success' | 'error'; result: any }>
  >({})

  const executeTool = useCallback(
    async (toolName: string, args: unknown) => {
      setExecutingTools((prev) => new Set(prev).add(toolName))

      try {
        const result = await sdk.getAllTools()
          .find((t) => t.name === toolName)
          ?.execute(args)

        setToolResults((prev) => ({
          ...prev,
          [toolName]: { status: 'success', result },
        }))

        return result
      } catch (error) {
        setToolResults((prev) => ({
          ...prev,
          [toolName]: {
            status: 'error',
            result: error instanceof Error ? error.message : String(error),
          },
        }))
        throw error
      } finally {
        setExecutingTools((prev) => {
          const next = new Set(prev)
          next.delete(toolName)
          return next
        })
      }
    },
    [sdk]
  )

  return {
    executingTools,
    toolResults,
    executeTool,
    isExecuting: (toolName: string) => executingTools.has(toolName),
    getToolResult: (toolName: string) => toolResults[toolName],
  }
}
