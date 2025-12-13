/**
 * Messaging and communication types
 * For streaming, tool calls, and inter-process communication
 */

/**
 * Stream connection state
 */
export interface StreamState {
  isConnected: boolean
  isStreaming: boolean
  error: string | null
}

/**
 * Audio visualizer data
 */
export interface AudioVisualizerData {
  volume: number
}

/**
 * Tool usage tracking
 */
export interface ToolUsage {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  isError?: boolean

  // Execution tracking
  turnId?: string // Which turn this tool belongs to
  startTime?: number // When execution started
  endTime?: number // When execution completed
  duration?: number // Total execution time in milliseconds
}

/**
 * Chat message
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  selectedElement?: import('./element').SelectedElement
  model?: string
  intent?: string
  toolUsage?: ToolUsage[]
  reasoning?: string // AI's reasoning/thinking content

  // Turn tracking for correlating related messages and tool calls
  turnId?: string // Unique ID for this turn (shared by user request + agent response)
  parentTurnId?: string // Links to the user message this is responding to
  sequenceNumber?: number // 0 for user, 1+ for agent turns and continuations
}

/**
 * Source patch for file editing
 */
export interface SourcePatch {
  filePath: string
  originalContent: string
  patchedContent: string
  lineNumber: number
  generatedBy?: 'fast-apply' | 'gemini' | 'fast-path'
  durationMs?: number
}

/**
 * Patch approval state
 */
export interface PatchApprovalState {
  pendingPatches: SourcePatch[]
  currentPatchIndex: number
  isDialogOpen: boolean
}

/**
 * Inspector message types for content script communication
 */
export type InspectorMessageType =
  | 'inspector-hover'
  | 'inspector-hover-end'
  | 'inspector-select'
  | 'screenshot-select'
  | 'move-select'
  | 'move-update'
  | 'move-confirmed'
  | 'console-log'
  | 'ai-selection-confirmed'
  | 'ai-selection-failed'

/**
 * Inspector message payload
 */
export interface InspectorMessage {
  type: InspectorMessageType
  element?: import('./element').SelectedElement
  rect?: {
    top: number
    left: number
    width: number
    height: number
  }
  x?: number
  y?: number
  selector?: string
  count?: number
  elements?: import('./element').SelectedElement[]
  error?: string
  level?: 'log' | 'warn' | 'error'
  message?: string
}
