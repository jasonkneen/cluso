/**
 * Window Initialization Hook
 *
 * Handles initializing window info on mount for multi-window project locking.
 * Extracted from App.tsx lines 423-456.
 */

import { useEffect } from 'react'

interface UseWindowInitOptions {
  setWindowId: React.Dispatch<React.SetStateAction<number | null>>
  setLockedProjectPath: React.Dispatch<React.SetStateAction<string | null>>
  setLockedProjectName: React.Dispatch<React.SetStateAction<string | null>>
}

interface WindowInfo {
  windowId?: number
  projectPath?: string
  projectName?: string
}

/**
 * Hook for initializing window info on mount
 *
 * Gets window ID and project lock status from Electron.
 * Also listens for window info sent on ready-to-show.
 */
export function useWindowInit({
  setWindowId,
  setLockedProjectPath,
  setLockedProjectName,
}: UseWindowInitOptions): void {
  useEffect(() => {
    async function initWindowInfo() {
      if (!window.electronAPI?.window) return

      try {
        const info: WindowInfo = await window.electronAPI.window.getInfo()
        if (info.windowId) {
          setWindowId(info.windowId)
        }
        if (info.projectPath) {
          setLockedProjectPath(info.projectPath)
          setLockedProjectName(info.projectName || null)
          console.log(`[Window] Window ${info.windowId} locked to project: ${info.projectPath}`)
        }
      } catch (e) {
        console.warn('[Window] Failed to get window info:', e)
      }
    }

    initWindowInfo()

    // Also listen for window info sent on ready-to-show
    const unsubscribe = window.electronAPI?.window?.onInfo?.((info: WindowInfo) => {
      if (info.windowId) setWindowId(info.windowId)
      if (info.projectPath) {
        setLockedProjectPath(info.projectPath)
        setLockedProjectName(info.projectName || null)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [setWindowId, setLockedProjectPath, setLockedProjectName])
}
