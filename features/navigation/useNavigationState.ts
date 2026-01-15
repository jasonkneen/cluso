/**
 * Navigation State Management Hook
 *
 * Centralizes browser navigation state management extracted from App.tsx.
 * Handles URL input, back/forward state, loading state, and page title.
 */

import { useState, useCallback } from 'react'
import type { NavigationState, NavigationStateActions } from './types'

/** Default URL for new tabs (empty shows NewTabPage) */
const DEFAULT_URL = ''

export interface UseNavigationStateReturn extends NavigationState, NavigationStateActions {}

/**
 * Hook for managing browser navigation state
 *
 * Extracts and centralizes navigation state management from App.tsx.
 * Provides state and actions for URL input, history navigation, and loading state.
 */
export function useNavigationState(): UseNavigationStateReturn {
  // URL in address bar (editable by user)
  const [urlInput, setUrlInput] = useState(DEFAULT_URL)

  // History navigation state
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  // Loading state
  const [isLoading, setIsLoading] = useState(false)

  // Page title
  const [pageTitle, setPageTitle] = useState('')

  // Action: Reset all navigation state to defaults
  const resetNavigationState = useCallback(() => {
    setUrlInput(DEFAULT_URL)
    setCanGoBack(false)
    setCanGoForward(false)
    setIsLoading(false)
    setPageTitle('')
  }, [])

  // Action: Update multiple navigation states at once
  const updateNavigationState = useCallback((updates: Partial<NavigationState>) => {
    if (updates.urlInput !== undefined) setUrlInput(updates.urlInput)
    if (updates.canGoBack !== undefined) setCanGoBack(updates.canGoBack)
    if (updates.canGoForward !== undefined) setCanGoForward(updates.canGoForward)
    if (updates.isLoading !== undefined) setIsLoading(updates.isLoading)
    if (updates.pageTitle !== undefined) setPageTitle(updates.pageTitle)
  }, [])

  return {
    // State
    urlInput,
    canGoBack,
    canGoForward,
    isLoading,
    pageTitle,
    // Setters
    setUrlInput,
    setCanGoBack,
    setCanGoForward,
    setIsLoading,
    setPageTitle,
    // Actions
    resetNavigationState,
    updateNavigationState,
  }
}
