/**
 * Theme Persistence Hook
 *
 * Handles persisting dark mode preference to localStorage.
 * Extracted from App.tsx line 1923.
 */

import { useEffect } from 'react'

interface UseThemePersistenceOptions {
  isDarkMode: boolean
}

/**
 * Hook for persisting theme preference
 *
 * Syncs isDarkMode state to localStorage whenever it changes.
 */
export function useThemePersistence({ isDarkMode }: UseThemePersistenceOptions): void {
  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode))
  }, [isDarkMode])
}
