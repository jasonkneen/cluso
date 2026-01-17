/**
 * Webview Handlers Hook
 *
 * Centralizes webview navigation handlers extracted from App.tsx.
 * Handles URL navigation, back/forward, reload.
 *
 * Note: Ref management (webviewRefs, getWebviewRef, getWebviewRefCallback) stays in App.tsx
 * because the complex setupWebviewHandlers has too many dependencies.
 */

import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type {
  WebviewElement,
  WebviewTab,
  WebviewNavigationActions,
} from './types'

export interface UseWebviewHandlersProps {
  /** Whether running in Electron */
  isElectron: boolean
  /** Current active tab ID */
  activeTabId: string
  /** All tabs for finding matching project paths */
  tabs: WebviewTab[]
  /** Active tab's projectPath */
  activeTabProjectPath?: string
  /** Current URL input value */
  urlInput: string
  /** Setter for URL input */
  setUrlInput: (url: string) => void
  /** Update current tab with new data */
  updateCurrentTab: (data: Partial<WebviewTab>) => void
  /** External webview refs map - managed by App.tsx */
  webviewRefs: MutableRefObject<Map<string, WebviewElement>>
}

export interface UseWebviewHandlersReturn extends WebviewNavigationActions {}

/**
 * Hook for managing webview navigation
 *
 * Extracts navigation handlers (navigateTo, goBack, goForward, reload) from App.tsx.
 * webviewRefs is passed in from App.tsx since the complex setup logic stays there.
 */
export function useWebviewHandlers({
  isElectron,
  activeTabId,
  tabs,
  activeTabProjectPath,
  urlInput,
  setUrlInput,
  updateCurrentTab,
  webviewRefs,
}: UseWebviewHandlersProps): UseWebviewHandlersReturn {
  // Navigate to URL - normalizes URL and updates tab state
  const navigateTo = useCallback(
    (url: string) => {
      let finalUrl = url.trim()
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'http://' + finalUrl
      }
      console.log('Navigating to:', finalUrl)

      // Check if any existing tab has this URL with a projectPath - inherit it
      const matchingProjectTab = tabs.find(
        (t) =>
          t.projectPath &&
          t.url &&
          t.url.toLowerCase() === finalUrl.toLowerCase(),
      )

      // Update both display URL and tab's navigation URL
      setUrlInput(finalUrl)
      if (matchingProjectTab && !activeTabProjectPath) {
        // Inherit projectPath from matching project tab
        console.log(
          'Inheriting projectPath from matching tab:',
          matchingProjectTab.projectPath,
        )
        updateCurrentTab({ url: finalUrl, projectPath: matchingProjectTab.projectPath })
      } else {
        updateCurrentTab({ url: finalUrl })
      }
    },
    [tabs, activeTabProjectPath, setUrlInput, updateCurrentTab],
  )

  // Handle URL form submission
  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigateTo(urlInput)
    },
    [urlInput, navigateTo],
  )

  // Go back in history
  const goBack = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isElectron) {
      webview.goBack()
    }
  }, [isElectron, activeTabId, webviewRefs])

  // Go forward in history
  const goForward = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isElectron) {
      webview.goForward()
    }
  }, [isElectron, activeTabId, webviewRefs])

  // Reload the current page
  const reload = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isElectron) {
      webview.reload()
    }
  }, [isElectron, activeTabId, webviewRefs])

  return {
    navigateTo,
    handleUrlSubmit,
    goBack,
    goForward,
    reload,
  }
}
