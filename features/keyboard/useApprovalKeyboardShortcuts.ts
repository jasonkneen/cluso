/**
 * Approval Keyboard Shortcuts Hook
 *
 * Handles CMD+Enter to accept and Escape to reject pending changes.
 * Extracted from App.tsx lines 7216-7244.
 */

import { useEffect } from 'react'

interface PendingChange {
  code: string
  undoCode?: string
}

interface PendingDOMApproval {
  id: string
  undoCode?: string
}

interface UseApprovalKeyboardShortcutsOptions {
  pendingChange: PendingChange | null
  pendingDOMApproval: PendingDOMApproval | null
  handleApproveChange: () => void
  handleRejectChange: () => void
  handleAcceptDOMApproval: () => void
  handleRejectDOMApproval: () => void
}

/**
 * Hook for approval keyboard shortcuts
 *
 * CMD/Ctrl+Enter = Accept, Escape = Reject
 */
export function useApprovalKeyboardShortcuts({
  pendingChange,
  pendingDOMApproval,
  handleApproveChange,
  handleRejectChange,
  handleAcceptDOMApproval,
  handleRejectDOMApproval,
}: UseApprovalKeyboardShortcutsOptions): void {
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
  }, [pendingChange, pendingDOMApproval, handleApproveChange, handleRejectChange, handleAcceptDOMApproval, handleRejectDOMApproval])
}
