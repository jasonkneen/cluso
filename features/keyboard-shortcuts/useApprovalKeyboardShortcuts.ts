/**
 * Approval Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for accepting/rejecting pending changes.
 * Supports Cmd+Enter for accept, Escape for reject.
 *
 * Extracted from App.tsx to centralize keyboard shortcut logic.
 */

import { useEffect } from 'react'
import type { UseApprovalKeyboardShortcutsOptions } from './types'

/**
 * Hook for managing approval keyboard shortcuts
 *
 * Sets up global keydown listener for approval-specific shortcuts.
 * Only active when there's a pending change or DOM approval.
 *
 * @param options - Configuration options for keyboard shortcuts
 */
export function useApprovalKeyboardShortcuts(options: UseApprovalKeyboardShortcutsOptions): void {
  const {
    pendingChange,
    pendingDOMApproval,
    handleAcceptDOMApproval,
    handleRejectDOMApproval,
    handleApproveChange,
    handleRejectChange,
  } = options

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
  }, [pendingChange, pendingDOMApproval, handleAcceptDOMApproval, handleRejectDOMApproval, handleApproveChange, handleRejectChange])
}
