import React, { createContext, useContext, useEffect, useState } from 'react'

import type { AppTheme } from '../utils/themes'
import { APP_THEMES, applyThemeToDocument, getTheme, DEFAULT_THEME_ID } from '../utils/themes'

interface ThemeContextType {
  currentTheme: AppTheme
  setTheme: (themeId: string) => void
  themes: AppTheme[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const savedThemeId = localStorage.getItem('app-theme-id')
    return getTheme(savedThemeId || DEFAULT_THEME_ID)
  })

  const setTheme = (themeId: string) => {
    const theme = getTheme(themeId)
    setCurrentTheme(theme)
    localStorage.setItem('app-theme-id', themeId)
    applyThemeToDocument(theme)
  }

  // Apply theme on mount and whenever currentTheme changes
  useEffect(() => {
    applyThemeToDocument(currentTheme)
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: APP_THEMES }}>
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
