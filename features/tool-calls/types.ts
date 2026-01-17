/**
 * Tool Calls Types
 *
 * Type definitions for completed tool call management.
 */

export interface CompletedToolCall {
  id: string
  name: string
  status: 'complete' | 'error'
}

export interface UseCompletedToolCallsClearOptions {
  completedToolCalls: CompletedToolCall[]
  setCompletedToolCalls: (calls: CompletedToolCall[]) => void
  clearDelay?: number
}
