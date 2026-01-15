/**
 * Theme State Hook
 *
 * Manages dark mode state with:
 * - localStorage persistence
 * - System preference detection on initial load
 */

import { useState } from 'react'

import type { ThemeState } from './types'

/**
 * Hook for managing theme/dark mode state
 *
 * Uses lazy initialization to:
 * 1. Check localStorage for saved preference
 * 2. Fall back to system preference (prefers-color-scheme)
 * 3. Default to light mode if neither available
 */
export function useThemeState(): ThemeState {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved !== null) return saved === 'true'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  return {
    isDarkMode,
    setIsDarkMode,
  }
}
