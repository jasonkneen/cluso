/**
 * Status State Management Hook
 *
 * Centralizes status indicator state management extracted from App.tsx.
 * Handles Fast Apply status, file watcher status, and indexing status.
 */

import { useState, useCallback } from 'react'
import type { StatusState, StatusStateActions, IndexingStatus } from './types'

export interface UseStatusStateReturn extends StatusState, StatusStateActions {}

/**
 * Hook for managing status indicator state
 *
 * Extracts and centralizes status state management from App.tsx.
 * Provides state and actions for status indicators.
 */
export function useStatusState(): UseStatusStateReturn {
  // Fast Apply Status (Pro Feature)
  const [fastApplyReady, setFastApplyReady] = useState(false)

  // File Watcher Status
  const [fileWatcherActive, setFileWatcherActive] = useState(false)

  // Indexing Status
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>('idle')

  // Action: Start indexing
  const startIndexing = useCallback(() => {
    setIndexingStatus('indexing')
  }, [])

  // Action: Complete indexing
  const completeIndexing = useCallback(() => {
    setIndexingStatus('indexed')
  }, [])

  // Action: Reset indexing to idle
  const resetIndexing = useCallback(() => {
    setIndexingStatus('idle')
  }, [])

  return {
    // State
    fastApplyReady,
    fileWatcherActive,
    indexingStatus,
    // Setters
    setFastApplyReady,
    setFileWatcherActive,
    setIndexingStatus,
    // Actions
    startIndexing,
    completeIndexing,
    resetIndexing,
  }
}
