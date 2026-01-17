/**
 * Browser Navigation Operations Hook
 *
 * Handles browser navigation actions extracted from App.tsx.
 * Provides callbacks for URL navigation, history (back/forward), and reload.
 */

import { useCallback } from 'react'
import type { TabData } from '../../types/tabs'

/** WebviewElement interface for navigation */
interface WebviewElement {
  goBack: () => void
  goForward: () => void
  reload: () => void
  loadURL: (url: string) => void
  getURL: () => string
}

export interface UseBrowserNavigationOptions {
  /** Current active tab ID */
  activeTabId: string
  /** All tabs */
  tabs: TabData[]
  /** Current active tab */
  activeTab: TabData
  /** Function to update current tab */
  updateCurrentTab: (updates: Partial<TabData>) => void
  /** URL input state setter */
  setUrlInput: (url: string) => void
  /** URL input value */
  urlInput: string
  /** Whether running in Electron */
  isElectron: boolean
  /** Ref to webview elements map */
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
}

export interface UseBrowserNavigationReturn {
  /** Navigate to a URL */
  navigateTo: (url: string) => void
  /** Handle URL form submission */
  handleUrlSubmit: (e: React.FormEvent) => void
  /** Go back in history */
  goBack: () => void
  /** Go forward in history */
  goForward: () => void
  /** Reload current page */
  reload: () => void
}

/**
 * Hook for browser navigation operations
 *
 * Extracts and centralizes browser navigation logic from App.tsx.
 */
export function useBrowserNavigation({
  activeTabId,
  tabs,
  activeTab,
  updateCurrentTab,
  setUrlInput,
  urlInput,
  isElectron,
  webviewRefs,
}: UseBrowserNavigationOptions): UseBrowserNavigationReturn {
  // Navigate to a URL - update active tab's URL
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
          t.projectPath && t.url && t.url.toLowerCase() === finalUrl.toLowerCase()
      )

      // Update both display URL and tab's navigation URL
      setUrlInput(finalUrl)
      if (matchingProjectTab && !activeTab.projectPath) {
        // Inherit projectPath from matching project tab
        console.log(
          'Inheriting projectPath from matching tab:',
          matchingProjectTab.projectPath
        )
        updateCurrentTab({ url: finalUrl, projectPath: matchingProjectTab.projectPath })
      } else {
        updateCurrentTab({ url: finalUrl })
      }
    },
    [updateCurrentTab, tabs, activeTab.projectPath, setUrlInput]
  )

  // Handle URL form submission
  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigateTo(urlInput)
    },
    [urlInput, navigateTo]
  )

  // Go back in browser history
  const goBack = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isElectron) {
      webview.goBack()
    }
  }, [isElectron, activeTabId, webviewRefs])

  // Go forward in browser history
  const goForward = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isElectron) {
      webview.goForward()
    }
  }, [isElectron, activeTabId, webviewRefs])

  // Reload current page
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
