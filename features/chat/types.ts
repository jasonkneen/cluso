/**
 * Chat Feature Types
 *
 * Type definitions for the chat/messaging system.
 */

// Re-export Message as ChatMessage from types.ts for consistency
// The app uses Message from types.ts which has extended fields
export { type Message as ChatMessage } from '../../types'

/**
 * Tool call tracking during streaming
 */
export interface StreamingToolCall {
  id: string
  name: string
  args: unknown
  status: 'pending' | 'running' | 'complete' | 'error'
  result?: unknown
}

/**
 * Streaming message state during AI response generation
 */
export interface StreamingMessage {
  id: string
  content: string
  reasoning: string
  toolCalls: StreamingToolCall[]
}

/**
 * Completed tool call record (persists after streaming ends)
 */
export interface CompletedToolCall {
  id: string
  name: string
  status: 'success' | 'error'
  timestamp: Date
}

/**
 * Connection state for the AI chat
 * - 'disconnected': Not connected to AI provider
 * - 'idle': Connected but not actively generating
 * - 'streaming': Actively processing/generating response
 */
export type ConnectionState = 'disconnected' | 'idle' | 'streaming'

/**
 * Chat state managed by useChatState hook
 */
export interface ChatState {
  messages: import('../../types').Message[]
  input: string
  streamingMessage: StreamingMessage | null
  isStreaming: boolean
  connectionState: ConnectionState
  completedToolCalls: CompletedToolCall[]
}

/**
 * Actions returned by useChatState hook
 */
export interface ChatStateActions {
  setMessages: React.Dispatch<React.SetStateAction<import('../../types').Message[]>>
  setInput: React.Dispatch<React.SetStateAction<string>>
  setStreamingMessage: React.Dispatch<React.SetStateAction<StreamingMessage | null>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
  setConnectionState: React.Dispatch<React.SetStateAction<ConnectionState>>
  setCompletedToolCalls: React.Dispatch<React.SetStateAction<CompletedToolCall[]>>
  addMessage: (message: import('../../types').Message) => void
  clearMessages: () => void
  updateToolCallStatus: (toolCallId: string, status: StreamingToolCall['status'], result?: unknown) => void
  startStreaming: (streamingId: string) => void
  finishStreaming: (text: string, model?: string) => void
}
