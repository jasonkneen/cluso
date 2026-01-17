/**
 * Extension Cursor Sync Hook
 *
 * Sends Cluso's cursor position to the Chrome extension when sharing is active.
 * Throttles mouse movement events to 30fps for performance.
 *
 * Extracted from App.tsx to centralize extension cursor sync logic.
 */

import { useEffect } from 'react'
import type { UseExtensionCursorSyncOptions, OutgoingCursorData } from './types'

/**
 * Hook for syncing cursor position with Chrome extension
 *
 * Tracks mouse movement across the app and sends position data
 * to the extension bridge when cursor sharing is enabled.
 *
 * @param options - Configuration options for cursor sync
 */
export function useExtensionCursorSync(options: UseExtensionCursorSyncOptions): void {
  const { extensionSharing, activeTabUrl } = options

  useEffect(() => {
    if (!extensionSharing || !window.electronAPI?.extensionBridge?.sendCursor) return

    let lastUpdate = 0

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle to 30fps
      const now = Date.now()
      if (now - lastUpdate < 33) return
      lastUpdate = now

      // Build cursor data
      const cursorData: OutgoingCursorData = {
        pageX: e.pageX,
        pageY: e.pageY,
        clientX: e.clientX,
        clientY: e.clientY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        pageUrl: activeTabUrl || window.location.href,
      }

      // Send cursor data to extension
      window.electronAPI?.extensionBridge?.sendCursor?.(cursorData)
    }

    // Track cursor movement across the app
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [extensionSharing, activeTabUrl])
}
