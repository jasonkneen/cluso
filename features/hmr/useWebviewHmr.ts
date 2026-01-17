/**
 * Webview HMR Hook
 *
 * Handles auto-reloading webview on Hot Module Replacement.
 * Extracted from App.tsx lines 4945-4965.
 */

import { useEffect } from 'react'

interface WebviewElement {
  reload: () => void
}

interface UseWebviewHmrOptions {
  isElectron: boolean
  activeTabId: string
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
}

/**
 * Hook for auto-reloading webview on HMR
 *
 * Reloads the webview when Vite HMR fires.
 */
export function useWebviewHmr({
  isElectron,
  activeTabId,
  webviewRefs,
}: UseWebviewHmrOptions): void {
  useEffect(() => {
    const webview = webviewRefs.current.get(activeTabId)
    if (!isElectron || !webview) return

    // Vite HMR - reload webview when app code changes
    if (import.meta.hot) {
      const handleHmrUpdate = () => {
        console.log('[HMR] Reloading webview...')
        const currentWebview = webviewRefs.current.get(activeTabId)
        if (currentWebview) {
          currentWebview.reload()
        }
      }

      import.meta.hot.on('vite:afterUpdate', handleHmrUpdate)

      return () => {
        import.meta.hot?.off('vite:afterUpdate', handleHmrUpdate)
      }
    }
  }, [isElectron, activeTabId, webviewRefs])
}
