/**
 * File Watcher Hook
 *
 * Manages file system watching for project directories.
 * Tracks file changes and updates the edited files drawer.
 *
 * Extracted from App.tsx to centralize file watcher logic.
 */

import { useRef, useEffect } from 'react'
import type { UseFileWatcherOptions, UseFileWatcherReturn, FileChangeEvent } from './types'

/**
 * Hook for managing file system watching
 *
 * Sets up file watchers that persist until app exit.
 * Tracks which projects have active watchers to avoid duplicates.
 *
 * @param options - Configuration options for file watcher
 * @returns Active watchers set for external tracking
 */
export function useFileWatcher(options: UseFileWatcherOptions): UseFileWatcherReturn {
  const { isElectron, projectPath, addEditedFile, setFileWatcherActive } = options

  // Track which projects have active watchers (persistent across tab switches)
  const activeWatchersRef = useRef<Set<string>>(new Set())

  // Ref to hold latest addEditedFile callback (avoids stale closure)
  const addEditedFileRef = useRef(addEditedFile)
  addEditedFileRef.current = addEditedFile

  // File watcher - global listener (runs once, never cleaned up)
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.fileWatcher) {
      return
    }

    // Set up global listener for all file changes
    const removeListener = window.electronAPI.fileWatcher.onChange((event: FileChangeEvent) => {
      console.log('[FileWatcher] File changed:', event.type, event.relativePath)

      // Add to edited files drawer
      addEditedFileRef.current({
        path: event.path,
        additions: event.type === 'add' ? 1 : event.type === 'change' ? 1 : 0,
        deletions: event.type === 'unlink' ? 1 : event.type === 'change' ? 1 : 0,
        isFileModification: true,
      })
    })

    // DON'T cleanup - let watchers run until app closes
    // This is intentional to avoid start/stop churn
    return () => {
      console.log('[FileWatcher] App unmounting')
      removeListener()
    }
  }, [isElectron])

  // Start watcher for current project if not already watching
  useEffect(() => {
    if (!isElectron || !projectPath || !window.electronAPI?.fileWatcher) {
      setFileWatcherActive(false)
      return
    }

    // Check if we're already watching this project
    if (activeWatchersRef.current.has(projectPath)) {
      console.log('[FileWatcher] Already watching:', projectPath)
      setFileWatcherActive(true)
      return
    }

    // Start new watcher for this project (never stopped until app exit)
    console.log('[FileWatcher] Starting watcher for:', projectPath)
    window.electronAPI.fileWatcher.start(projectPath).then((result: { success: boolean }) => {
      if (result.success) {
        activeWatchersRef.current.add(projectPath)
        setFileWatcherActive(true)
        console.log('[FileWatcher] ✓ Watching:', projectPath)
      }
    }).catch((err: unknown) => {
      console.error('[FileWatcher] Start failed:', err)
    })

    // NO CLEANUP - watchers stay active until app closes
  }, [isElectron, projectPath, setFileWatcherActive])

  return {
    activeWatchers: activeWatchersRef.current,
  }
}
