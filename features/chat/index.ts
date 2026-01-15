/**
 * Chat Feature Module
 *
 * Exports chat state management and types.
 */

export { useChatState } from './useChatState'
export type { UseChatStateReturn } from './useChatState'
export type {
  ChatMessage,
  StreamingMessage,
  StreamingToolCall,
  CompletedToolCall,
  ConnectionState,
  ChatState,
  ChatStateActions,
} from './types'
