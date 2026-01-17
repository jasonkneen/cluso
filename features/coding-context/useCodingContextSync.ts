/**
 * Coding Context Sync Hook
 *
 * Synchronizes coding agent context when selections change.
 *
 * Extracted from App.tsx to centralize context sync logic.
 */

import { useEffect } from 'react'
import type { UseCodingContextSyncOptions } from './types'

/**
 * Hook for syncing coding agent context
 *
 * Updates coding context when element, files, logs, or messages change.
 * Uses ref to avoid triggering effect on function identity change.
 *
 * @param options - Configuration options for context sync
 */
export function useCodingContextSync(options: UseCodingContextSyncOptions): void {
  const {
    selectedElement,
    selectedFiles,
    selectedLogs,
    projectPath,
    messages,
    updateCodingContextRef,
  } = options

  useEffect(() => {
    updateCodingContextRef.current({
      selectedElement: selectedElement || null,
      selectedFiles: selectedFiles,
      selectedLogs: selectedLogs?.map(log => ({
        type: log.type,
        message: log.message,
      })) || [],
      projectPath: projectPath || null,
      recentMessages: messages.slice(-10) as any[],
    })
  }, [selectedElement, selectedFiles, selectedLogs, projectPath, messages, updateCodingContextRef])
}
