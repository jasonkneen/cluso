/**
 * Theme Handlers Hook
 *
 * Provides theme-related handlers and effects:
 * - toggleDarkMode callback
 * - localStorage persistence effect
 */

import { useCallback, useEffect } from 'react'

export interface UseThemeHandlersProps {
  isDarkMode: boolean
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}

export interface UseThemeHandlersReturn {
  /** Toggle dark mode on/off */
  toggleDarkMode: () => void
}

/**
 * Hook for theme handlers and side effects
 *
 * @param props.isDarkMode - Current dark mode state
 * @param props.setIsDarkMode - Setter for dark mode state
 */
export function useThemeHandlers({
  isDarkMode,
  setIsDarkMode,
}: UseThemeHandlersProps): UseThemeHandlersReturn {
  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [setIsDarkMode])

  // Persist dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode))
  }, [isDarkMode])

  return {
    toggleDarkMode,
  }
}
