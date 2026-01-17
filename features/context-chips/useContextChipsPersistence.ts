/**
 * Context Chips Persistence Hook
 *
 * Handles loading recent context chips from localStorage when project changes.
 * Extracted from App.tsx lines 4908-4928.
 */

import { useEffect } from 'react'

interface ContextChip {
  name: string
  type: string
}

interface UseContextChipsPersistenceOptions {
  projectPath: string | undefined
  setRecentContextChips: (chips: ContextChip[]) => void
  setContextChips: (chips: ContextChip[]) => void
}

/**
 * Hook for persisting context chips
 *
 * Loads recent context chips from localStorage and clears current chips when project changes.
 */
export function useContextChipsPersistence({
  projectPath,
  setRecentContextChips,
  setContextChips,
}: UseContextChipsPersistenceOptions): void {
  useEffect(() => {
    try {
      const storageKey = `cluso-context-chips-${projectPath || 'global'}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const chips = JSON.parse(stored)
        if (Array.isArray(chips)) {
          setRecentContextChips(chips)
          console.log('[ContextChips] Loaded', chips.length, 'recent chips for', storageKey)
        }
      } else {
        // No chips stored for this project, start fresh
        setRecentContextChips([])
      }
    } catch (e) {
      console.warn('[ContextChips] Failed to load from localStorage:', e)
      setRecentContextChips([])
    }
    // Also clear current context chips when switching projects
    setContextChips([])
  }, [projectPath, setRecentContextChips, setContextChips])
}
