/**
 * Pending Change State Management Hook
 *
 * Centralizes pending code change state management extracted from App.tsx.
 * Handles preview/approve/reject workflow for code modifications.
 */

import { useState, useCallback } from 'react'
import type {
  PendingChange,
  PendingChangeState,
  PendingChangeStateActions,
} from './types'

export interface UsePendingChangeStateReturn extends PendingChangeState, PendingChangeStateActions {}

/**
 * Hook for managing pending code change state
 *
 * Extracts and centralizes pending change state management from App.tsx.
 * Provides state and actions for preview/approve/reject workflow.
 */
export function usePendingChangeState(): UsePendingChangeStateReturn {
  // Pending change awaiting approval
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)

  // Whether user is previewing original (undo) code
  const [isPreviewingOriginal, setIsPreviewingOriginal] = useState(false)

  // Action: Create a new pending change
  const createPendingChange = useCallback((change: PendingChange) => {
    setPendingChange(change)
    setIsPreviewingOriginal(false)
  }, [])

  // Action: Clear the pending change (after approve or reject)
  const clearPendingChange = useCallback(() => {
    setPendingChange(null)
    setIsPreviewingOriginal(false)
  }, [])

  // Action: Toggle between original and new code preview
  const togglePreview = useCallback(() => {
    setIsPreviewingOriginal(prev => !prev)
  }, [])

  return {
    // State
    pendingChange,
    isPreviewingOriginal,
    // Setters
    setPendingChange,
    setIsPreviewingOriginal,
    // Actions
    createPendingChange,
    clearPendingChange,
    togglePreview,
  }
}
