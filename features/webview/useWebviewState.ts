/**
 * Webview State Management Hook
 *
 * Centralizes webview preload path state management extracted from App.tsx.
 * Handles fetching and storing the webview preload path for Electron webviews.
 */

import { useState, useEffect } from 'react'
import type { WebviewState, WebviewStateActions } from './types'

export interface UseWebviewStateReturn extends WebviewState, WebviewStateActions {}

/**
 * Hook for managing webview state
 *
 * Extracts and centralizes webview preload path state management from App.tsx.
 * Automatically fetches the preload path on mount when running in Electron.
 *
 * @param isElectron - Whether the app is running in Electron
 */
export function useWebviewState(isElectron: boolean): UseWebviewStateReturn {
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string>('')

  // Fetch webview preload path on mount (Electron only)
  useEffect(() => {
    if (isElectron && window.electronAPI?.getWebviewPreloadPath) {
      window.electronAPI.getWebviewPreloadPath().then(path => {
        console.log('Webview preload path:', path)
        setWebviewPreloadPath(path)
      })
    }
  }, [isElectron])

  return {
    // State
    webviewPreloadPath,
    isPreloadReady: webviewPreloadPath !== '',
    // Setters
    setWebviewPreloadPath,
  }
}
