/**
 * Coding Context Types
 *
 * Type definitions for coding agent context synchronization.
 */

export interface SelectedFile {
  path: string
  content?: string
}

export interface SelectedLog {
  type: string
  message: string
}

export interface CodingContextUpdate {
  selectedElement: unknown
  selectedFiles: SelectedFile[]
  selectedLogs: Array<{ type: string; message: string }>
  projectPath: string | null
  recentMessages: unknown[]
}

export interface UseCodingContextSyncOptions {
  selectedElement: unknown
  selectedFiles: SelectedFile[]
  selectedLogs: SelectedLog[] | null
  projectPath: string | undefined
  messages: unknown[]
  updateCodingContextRef: React.MutableRefObject<(update: CodingContextUpdate) => void>
}
