/**
 * Keyboard Event Handlers Hook
 *
 * Centralizes global keyboard event handling extracted from App.tsx.
 * Handles shortcuts for pending change approval/rejection and other global keys.
 */

import { useEffect } from 'react'
import type { PendingChange } from '../changes/types'
import type { PendingDOMApproval } from '../patches'

export interface UseKeyboardHandlersParams {
  // State
  pendingChange: PendingChange | null
  pendingDOMApproval: PendingDOMApproval | null

  // Handlers for pending changes
  handleApproveChange: () => void
  handleRejectChange: () => void

  // Handlers for DOM approvals
  handleAcceptDOMApproval: () => void
  handleRejectDOMApproval: () => void
}

/**
 * Hook for managing global keyboard event handlers
 *
 * Extracts and centralizes keyboard shortcut handling from App.tsx.
 * Currently handles:
 * - CMD+Enter (Mac) / Ctrl+Enter (Windows) = Accept pending changes
 * - Escape = Reject pending changes
 */
export function useKeyboardHandlers({
  pendingChange,
  pendingDOMApproval,
  handleApproveChange,
  handleRejectChange,
  handleAcceptDOMApproval,
  handleRejectDOMApproval,
}: UseKeyboardHandlersParams): void {
  // Keyboard shortcuts for Accept/Reject pending changes
  // CMD+Enter = Accept, Escape = Reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if there's a pending change
      if (!pendingChange && !pendingDOMApproval) return

      // CMD+Enter (Mac) or Ctrl+Enter (Windows) = Accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (pendingDOMApproval) {
          handleAcceptDOMApproval()
        } else {
          handleApproveChange()
        }
      }

      // Escape = Reject
      if (e.key === 'Escape') {
        e.preventDefault()
        if (pendingDOMApproval) {
          handleRejectDOMApproval()
        } else {
          handleRejectChange()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    pendingChange,
    pendingDOMApproval,
    handleApproveChange,
    handleRejectChange,
    handleAcceptDOMApproval,
    handleRejectDOMApproval,
  ])
}
