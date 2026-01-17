/**
 * Inspector Sync Hook
 *
 * Synchronizes inspector mode state with webview content scripts.
 * Handles sending inspector/screenshot/move mode messages to webviews.
 *
 * Extracted from App.tsx to centralize inspector-webview sync logic.
 */

import { useEffect, useRef } from 'react'
import type { UseInspectorSyncOptions, InspectorWebviewRef } from './types'

/**
 * Hook for synchronizing inspector state with webview
 *
 * Sends inspector mode changes to webview content scripts.
 * Clears selection when modes are deactivated.
 *
 * @param options - Configuration options for inspector sync
 */
export function useInspectorSync(options: UseInspectorSyncOptions): void {
  const {
    isElectron,
    isWebviewReady,
    activeTabId,
    activeTabType,
    isInspectorActive,
    isScreenshotActive,
    isMoveActive,
    webviewRefs,
    setSelectedElement,
    setShowElementChat,
  } = options

  // Track last sent values to prevent duplicate sends
  const lastSentRef = useRef<{
    tabId: string
    inspector: boolean
    screenshot: boolean
    move: boolean
  } | null>(null)

  // Store callbacks in refs to avoid dependency churn
  const setSelectedElementRef = useRef(setSelectedElement)
  const setShowElementChatRef = useRef(setShowElementChat)
  setSelectedElementRef.current = setSelectedElement
  setShowElementChatRef.current = setShowElementChat

  useEffect(() => {
    // Only sync for browser tabs
    if (activeTabType !== 'browser') {
      return
    }

    const webview = webviewRefs.current.get(activeTabId)

    if (!isElectron || !webview || !isWebviewReady) {
      return
    }

    // Extra safety check - ensure webview is attached to DOM
    try {
      if (!webview.isConnected) {
        return
      }
    } catch (e) {
      return
    }

    // Check if webview is actually ready to receive messages
    try {
      webview.getWebContentsId()
    } catch (e) {
      return
    }

    // Skip if values haven't changed for this tab
    const last = lastSentRef.current
    if (
      last &&
      last.tabId === activeTabId &&
      last.inspector === isInspectorActive &&
      last.screenshot === isScreenshotActive &&
      last.move === isMoveActive
    ) {
      return
    }

    // Update last sent values
    lastSentRef.current = {
      tabId: activeTabId,
      inspector: isInspectorActive,
      screenshot: isScreenshotActive,
      move: isMoveActive,
    }

    console.log('[Inspector Sync] Sending inspector modes to webview:', {
      isInspectorActive,
      isScreenshotActive,
      isMoveActive,
    })

    try {
      webview.send('set-inspector-mode', isInspectorActive)
      webview.send('set-screenshot-mode', isScreenshotActive)
      webview.send('set-move-mode', isMoveActive)

      if (!isInspectorActive && !isMoveActive) {
        setSelectedElementRef.current(null)
        setShowElementChatRef.current(false)
        webview.send('clear-selection')
      }
    } catch (e) {
      console.warn('[Inspector Sync] Failed to send to webview:', e)
    }
  }, [
    isInspectorActive,
    isScreenshotActive,
    isMoveActive,
    isElectron,
    isWebviewReady,
    activeTabId,
    activeTabType,
    webviewRefs,
  ])
}
