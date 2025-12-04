import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

import type { AppTheme } from '../utils/themes'
import { APP_THEMES, applyThemeToDocument, getTheme, DEFAULT_THEME_ID } from '../utils/themes'

interface ThemeContextType {
  currentTheme: AppTheme
  setTheme: (themeId: string) => void
  themes: AppTheme[]
  reapplyTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const savedThemeId = localStorage.getItem('app-theme-id')
    return getTheme(savedThemeId || DEFAULT_THEME_ID)
  })

  const setTheme = useCallback((themeId: string) => {
    const theme = getTheme(themeId)
    setCurrentTheme(theme)
    localStorage.setItem('app-theme-id', themeId)
    applyThemeToDocument(theme)
  }, [])

  const reapplyTheme = useCallback(() => {
    applyThemeToDocument(currentTheme)
  }, [currentTheme])

  // Apply theme on mount and whenever currentTheme changes
  useEffect(() => {
    applyThemeToDocument(currentTheme)
  }, [currentTheme])

  // Watch for dark mode class changes on document and re-apply theme
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          // Re-apply theme when dark class changes (for system-default theme)
          applyThemeToDocument(currentTheme)
        }
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: APP_THEMES, reapplyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
