/**
 * Fast Apply Status Hook
 *
 * Handles checking Fast Apply (local model) status and listening for model events.
 * Extracted from App.tsx lines 1928-1957.
 */

import { useEffect } from 'react'

interface UseFastApplyStatusOptions {
  clusoCloudEditsEnabled: boolean
  setFastApplyReady: (ready: boolean) => void
}

/**
 * Hook for managing Fast Apply status
 *
 * Checks Fast Apply status on mount and listens for model loaded/unloaded events.
 */
export function useFastApplyStatus({
  clusoCloudEditsEnabled,
  setFastApplyReady,
}: UseFastApplyStatusOptions): void {
  useEffect(() => {
    const checkFastApplyStatus = async () => {
      if (clusoCloudEditsEnabled) {
        setFastApplyReady(false)
        return
      }
      if (!window.electronAPI?.fastApply) return
      try {
        const status = await window.electronAPI.fastApply.getStatus()
        setFastApplyReady(status.ready)
      } catch (err) {
        console.log('[FastApply] Status check error:', err)
      }
    }

    checkFastApplyStatus()

    // Listen for model loaded/unloaded events
    const unsubLoaded = window.electronAPI?.fastApply?.onModelLoaded(() => {
      setFastApplyReady(true)
    })
    const unsubUnloaded = window.electronAPI?.fastApply?.onModelUnloaded(() => {
      setFastApplyReady(false)
    })

    return () => {
      unsubLoaded?.()
      unsubUnloaded?.()
    }
  }, [clusoCloudEditsEnabled, setFastApplyReady])
}
