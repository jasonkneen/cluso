/**
 * Agent SDK File Listener Hook
 *
 * Listens for Agent SDK file modifications from the main process.
 * Extracted from App.tsx lines 4854-4895.
 */

import { useEffect } from 'react'

interface FileModificationEvent {
  type: 'write' | 'create' | 'delete'
  path: string
  originalContent?: string
  newContent?: string
}

interface UseAgentSdkFileListenerOptions {
  isElectron: boolean
  addEditedFile: (file: {
    path: string
    additions?: number
    deletions?: number
    originalContent?: string
    isFileModification?: boolean
  }) => void
}

/**
 * Hook for listening to Agent SDK file modifications
 *
 * These come from write_file, create_file, delete_file in ai-sdk-wrapper.
 */
export function useAgentSdkFileListener({
  isElectron,
  addEditedFile,
}: UseAgentSdkFileListenerOptions): void {
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.agentSdk?.onFileModified) return

    const removeListener = window.electronAPI.agentSdk.onFileModified((event: FileModificationEvent) => {
      console.log('[Agent SDK File Modified]', event.type, event.path)

      // Calculate additions/deletions
      let additions = 0
      let deletions = 0

      if (event.type === 'write' && event.originalContent && event.newContent) {
        const oldLines = event.originalContent.split('\n').length
        const newLines = event.newContent.split('\n').length
        additions = Math.max(0, newLines - oldLines)
        deletions = Math.max(0, oldLines - newLines)
        if (additions === 0 && deletions === 0) {
          additions = 1
          deletions = 1
        }
      } else if (event.type === 'create' && event.newContent) {
        additions = event.newContent.split('\n').length
      } else if (event.type === 'delete' && event.originalContent) {
        deletions = event.originalContent.split('\n').length
      }

      // Add to edited files drawer
      addEditedFile({
        path: event.path,
        additions,
        deletions,
        originalContent: event.originalContent,
        isFileModification: true,
      })
    })

    return removeListener
  }, [isElectron, addEditedFile])
}
