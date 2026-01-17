/**
 * Preview State Sync Hook
 *
 * Handles resetting preview state when pending approval/change changes.
 * Extracted from App.tsx lines 3088-3090.
 */

import { useEffect } from 'react'

interface UsePreviewStateSyncOptions {
  pendingDOMApprovalId: string | undefined
  pendingChangeCode: string | undefined
  setIsPreviewingOriginal: (previewing: boolean) => void
}

/**
 * Hook for syncing preview state with pending changes
 *
 * Resets isPreviewingOriginal when approval ID or change code changes.
 */
export function usePreviewStateSync({
  pendingDOMApprovalId,
  pendingChangeCode,
  setIsPreviewingOriginal,
}: UsePreviewStateSyncOptions): void {
  useEffect(() => {
    setIsPreviewingOriginal(false)
  }, [pendingDOMApprovalId, pendingChangeCode, setIsPreviewingOriginal])
}
