/**
 * Chat State Management Hook
 *
 * Centralizes chat-related state management extracted from App.tsx.
 * Handles messages, streaming, connection state, and tool call tracking.
 */

import { useState, useCallback } from 'react'
import type { Message as ChatMessage } from '../../types'
import type {
  StreamingMessage,
  ConnectionState,
  CompletedToolCall,
  StreamingToolCall,
  ChatState,
  ChatStateActions,
} from './types'

export interface UseChatStateReturn extends ChatState, ChatStateActions {}

/**
 * Hook for managing chat state
 *
 * Extracts and centralizes chat state management from App.tsx.
 * Provides state and actions for messages, streaming, and tool tracking.
 */
export function useChatState(): UseChatStateReturn {
  // Core message state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')

  // Streaming state
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // Connection state: tracks AI provider connection status
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // Completed tool calls (persists after streaming ends for final UI state)
  const [completedToolCalls, setCompletedToolCalls] = useState<CompletedToolCall[]>([])

  // Action: Add a new message to the conversation
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  // Action: Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Action: Update a tool call's status during streaming
  const updateToolCallStatus = useCallback((
    toolCallId: string,
    status: StreamingToolCall['status'],
    result?: unknown
  ) => {
    setStreamingMessage(prev => {
      if (!prev) return null
      return {
        ...prev,
        toolCalls: prev.toolCalls.map(tc =>
          tc.id === toolCallId
            ? { ...tc, status, result }
            : tc
        )
      }
    })
  }, [])

  // Action: Start streaming a new response
  const startStreaming = useCallback((streamingId: string) => {
    setIsStreaming(true)
    setConnectionState('streaming')
    setCompletedToolCalls([]) // Clear previous tool states
    setStreamingMessage({
      id: streamingId,
      content: '',
      reasoning: '',
      toolCalls: [],
    })
  }, [])

  // Action: Finish streaming and add the final message
  const finishStreaming = useCallback((text: string, model?: string) => {
    // Capture final tool states before clearing streaming message
    setStreamingMessage(prev => {
      if (prev && prev.toolCalls.length > 0) {
        const finalToolStates = prev.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          status: (tc.status === 'error' ? 'error' : 'success') as 'success' | 'error',
          timestamp: new Date(),
        }))
        setCompletedToolCalls(finalToolStates)
      }
      return null
    })

    setIsStreaming(false)
    setConnectionState('idle')

    // Add the final assistant message
    if (text.trim()) {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        model,
      }
      setMessages(prev => [...prev, assistantMessage])
    }
  }, [])

  return {
    // State
    messages,
    input,
    streamingMessage,
    isStreaming,
    connectionState,
    completedToolCalls,
    // Setters
    setMessages,
    setInput,
    setStreamingMessage,
    setIsStreaming,
    setConnectionState,
    setCompletedToolCalls,
    // Actions
    addMessage,
    clearMessages,
    updateToolCallStatus,
    startStreaming,
    finishStreaming,
  }
}
