/**
 * DOM Approval Auto-Apply Hook
 *
 * Automatically applies DOM patches when user has pre-approved
 * and the patch is ready.
 *
 * Extracted from App.tsx to centralize auto-apply logic.
 */

import { useEffect } from 'react'
import type { UseDOMApprovalAutoApplyOptions } from './types'

/**
 * Hook for auto-applying DOM patches
 *
 * Triggers handleAcceptDOMApproval when:
 * - User has pre-approved
 * - Patch status is 'ready'
 * - Patch object exists
 *
 * @param options - Configuration options for auto-apply
 */
export function useDOMApprovalAutoApply(options: UseDOMApprovalAutoApplyOptions): void {
  const { pendingDOMApproval, handleAcceptDOMApproval } = options

  useEffect(() => {
    if (pendingDOMApproval?.userApproved && pendingDOMApproval.patchStatus === 'ready' && pendingDOMApproval.patch) {
      console.log('[DOM Approval] Auto-applying: patch ready and user already approved')
      handleAcceptDOMApproval()
    }
  }, [pendingDOMApproval?.patchStatus, pendingDOMApproval?.userApproved, handleAcceptDOMApproval])
}
