/**
 * Changes Feature Types
 *
 * Type definitions for pending code changes with preview/approve/reject functionality.
 */

/**
 * Represents a pending code change awaiting user approval
 */
export interface PendingChange {
  /** The new code to be applied */
  code: string
  /** The original code (for undo/revert) */
  undoCode: string
  /** Human-readable description of the change */
  description: string
  /** Number of lines added */
  additions: number
  /** Number of lines removed */
  deletions: number
  /** Source of the change - DOM manipulation or direct code edit */
  source?: 'dom' | 'code'
}

/**
 * Pending change state managed by usePendingChangeState hook
 */
export interface PendingChangeState {
  /** The current pending change, or null if none */
  pendingChange: PendingChange | null
  /** Whether the user is previewing the original (undo) code */
  isPreviewingOriginal: boolean
}

/**
 * Actions returned by usePendingChangeState hook
 */
export interface PendingChangeStateActions {
  /** Set the pending change */
  setPendingChange: React.Dispatch<React.SetStateAction<PendingChange | null>>
  /** Set whether previewing original code */
  setIsPreviewingOriginal: React.Dispatch<React.SetStateAction<boolean>>
  /** Create a new pending change */
  createPendingChange: (change: PendingChange) => void
  /** Clear the pending change (approve or reject) */
  clearPendingChange: () => void
  /** Toggle between preview original and new code */
  togglePreview: () => void
}
