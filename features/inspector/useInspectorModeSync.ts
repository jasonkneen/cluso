/**
 * Inspector Mode Sync Hook
 *
 * Handles disabling thinking mode while inspector is active for responsiveness.
 * Extracted from App.tsx lines 1961-1977.
 */

import { useEffect, useRef } from 'react'

interface SelectedModel {
  id: string
  name?: string
}

type ThinkingLevel = 'off' | 'low' | 'med' | 'high'

interface PreInspectorSettings {
  model: SelectedModel
  thinkingLevel: ThinkingLevel
}

interface UseInspectorModeSyncOptions {
  isInspectorActive: boolean
  selectedModel: SelectedModel
  thinkingLevel: ThinkingLevel
  setThinkingLevel: (level: ThinkingLevel) => void
}

/**
 * Hook for syncing inspector mode with thinking settings
 *
 * Disables thinking mode while inspector is active for faster responses.
 * Restores previous thinking level when inspector is deactivated.
 */
export function useInspectorModeSync({
  isInspectorActive,
  selectedModel,
  thinkingLevel,
  setThinkingLevel,
}: UseInspectorModeSyncOptions) {
  const preInspectorSettingsRef = useRef<PreInspectorSettings | null>(null)

  useEffect(() => {
    if (isInspectorActive) {
      preInspectorSettingsRef.current = {
        model: selectedModel,
        thinkingLevel: thinkingLevel,
      }

      if (thinkingLevel !== 'off') {
        console.log('[Inspector] Disabling thinking mode')
        setThinkingLevel('off')
      }
    } else if (preInspectorSettingsRef.current) {
      console.log('[Inspector] Restoring previous thinking level:', preInspectorSettingsRef.current.thinkingLevel)
      setThinkingLevel(preInspectorSettingsRef.current.thinkingLevel)
      preInspectorSettingsRef.current = null
    }
  }, [isInspectorActive]) // Only trigger on inspector state change - ignore other deps to avoid loops

  return { preInspectorSettingsRef }
}
