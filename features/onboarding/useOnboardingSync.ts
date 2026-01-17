/**
 * Onboarding Sync Hook
 *
 * Handles closing onboarding modal when project changes.
 * Extracted from App.tsx lines 1239-1254.
 */

import { useEffect, useRef } from 'react'

interface UseOnboardingSyncOptions {
  projectPath: string | undefined
  showMgrepOnboarding: boolean
  setShowMgrepOnboarding: (show: boolean) => void
}

/**
 * Hook for syncing onboarding modal with project changes
 *
 * Closes the onboarding modal when the project path changes.
 */
export function useOnboardingSync({
  projectPath,
  showMgrepOnboarding,
  setShowMgrepOnboarding,
}: UseOnboardingSyncOptions): void {
  const prevProjectPathRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const currentPath = projectPath

    // Skip on first mount
    if (prevProjectPathRef.current === undefined) {
      prevProjectPathRef.current = currentPath
      return
    }

    // Only close if project actually changed (not just same project reloading)
    if (prevProjectPathRef.current !== currentPath && showMgrepOnboarding) {
      setShowMgrepOnboarding(false)
    }

    prevProjectPathRef.current = currentPath
  }, [projectPath, showMgrepOnboarding, setShowMgrepOnboarding])
}
