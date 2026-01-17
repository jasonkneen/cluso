/**
 * Auto Apply On Ready Hook
 *
 * Handles auto-applying patch when it's ready and user has pre-approved.
 * Extracted from App.tsx lines 7190-7195.
 */

import { useEffect } from 'react'

interface PendingDOMApproval {
  id: string
  userApproved?: boolean
  patchStatus?: 'preparing' | 'ready' | 'error'
  patch?: unknown
}

interface UseAutoApplyOnReadyOptions {
  pendingDOMApproval: PendingDOMApproval | null
  handleAcceptDOMApproval: () => void
}

/**
 * Hook for auto-applying patches when ready
 *
 * Triggers accept flow when patch is ready and user has already approved.
 */
export function useAutoApplyOnReady({
  pendingDOMApproval,
  handleAcceptDOMApproval,
}: UseAutoApplyOnReadyOptions): void {
  useEffect(() => {
    if (pendingDOMApproval?.userApproved && pendingDOMApproval.patchStatus === 'ready' && pendingDOMApproval.patch) {
      console.log('[DOM Approval] Auto-applying: patch ready and user already approved')
      handleAcceptDOMApproval()
    }
  }, [pendingDOMApproval?.patchStatus, pendingDOMApproval?.userApproved, handleAcceptDOMApproval])
}
