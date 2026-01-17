/**
 * Mgrep Initialization Hook
 *
 * Manages mgrep project indexing initialization.
 * Handles status checks, auto-initialization, and onboarding flow.
 *
 * Extracted from App.tsx to centralize mgrep initialization logic.
 */

import { useRef, useEffect } from 'react'
import type { UseMgrepInitOptions, UseMgrepInitReturn } from './types'

/**
 * Hook for managing mgrep project indexing initialization
 *
 * @param options - Configuration options for mgrep initialization
 * @returns Initialized projects set for external tracking
 */
export function useMgrepInit(options: UseMgrepInitOptions): UseMgrepInitReturn {
  const { projectPath, setIndexingStatus, setShowOnboarding } = options

  // Track which projects have been handled (persists across tab switches)
  const mgrepInitializedProjects = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!projectPath || !window.electronAPI?.mgrep) return

    // Check if already handled for this project
    if (mgrepInitializedProjects.current.has(projectPath)) {
      console.log('[mgrep] Already handled for:', projectPath)
      return
    }

    let isCancelled = false

    // Check if this project needs initialization
    const checkStatus = async () => {
      try {
        const result = await Promise.race([
          window.electronAPI.mgrep.getStatus(projectPath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]) as { success: boolean; status?: { ready: boolean } }

        if (isCancelled) return

        if (result.success && result.status && !result.status.ready) {
          // Not initialized yet - check if user wants to enable indexing
          const hasSeenPrompt = localStorage.getItem('mgrep-onboarding-seen')
          if (!hasSeenPrompt) {
            // First time - show onboarding with demo (but only once per app session)
            const onboardingShown = mgrepInitializedProjects.current.has('__onboarding_shown__')
            if (!onboardingShown) {
              setTimeout(() => {
                if (!isCancelled) setShowOnboarding(true)
              }, 1500)
              mgrepInitializedProjects.current.add('__onboarding_shown__')
            }
            return
          }

          // Auto-init if user previously opted in
          const autoInit = localStorage.getItem('mgrep-auto-init')
          if (autoInit === 'true') {
            console.log('[mgrep] Initializing for:', projectPath)
            setIndexingStatus('indexing')
            window.electronAPI.mgrep.initialize(projectPath).then(() => {
              // Mark as initialized - won't init again even if we switch back to this tab
              mgrepInitializedProjects.current.add(projectPath)
              setIndexingStatus('indexed')
              console.log('[mgrep] ✓ Initialized for:', projectPath)
            }).catch(err => {
              console.error('[mgrep] Auto-init failed:', err)
              setIndexingStatus('idle')
            })
          } else {
            // User opted out - mark as "handled" so we don't keep checking
            mgrepInitializedProjects.current.add(projectPath)
          }
        } else if (result.success && result.status && result.status.ready) {
          // Already initialized - mark it so we don't check again
          mgrepInitializedProjects.current.add(projectPath)
          setIndexingStatus('indexed')
          console.log('[mgrep] Already ready for:', projectPath)
        }
      } catch (err) {
        console.error('[mgrep] Status check failed:', err)
      }
    }

    checkStatus()

    // NO CLEANUP - let initialization persist across tab switches
    return () => {
      isCancelled = true
    }
  }, [projectPath, setIndexingStatus, setShowOnboarding])

  return {
    initializedProjects: mgrepInitializedProjects.current,
  }
}
