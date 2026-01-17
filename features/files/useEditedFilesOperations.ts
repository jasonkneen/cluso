/**
 * Edited Files Operations Hook
 *
 * Handles edited files tracking and undo operations extracted from App.tsx.
 * Manages the edited files drawer and provides undo functionality.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/fileService'
import { getElectronAPI } from '../../hooks/useElectronAPI'
import type { EditedFile } from './useFileBrowserState'

/** WebviewElement interface for undo execution */
interface WebviewElement {
  executeJavaScript: (code: string) => Promise<unknown>
}

export interface UseEditedFilesOperationsOptions {
  /** Current edited files */
  editedFiles: EditedFile[]
  /** Set edited files */
  setEditedFiles: React.Dispatch<React.SetStateAction<EditedFile[]>>
  /** Set drawer open state */
  setIsEditedFilesDrawerOpen: (open: boolean) => void
  /** Current active tab ID */
  activeTabId: string
  /** Ref to webview elements map */
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
}

export interface UseEditedFilesOperationsReturn {
  /** Add or update an edited file */
  addEditedFile: (file: {
    path: string
    additions?: number
    deletions?: number
    undoCode?: string
    originalContent?: string
    isFileModification?: boolean
  }) => void
  /** Undo a single file edit */
  undoFileEdit: (path: string) => Promise<void>
  /** Undo all file edits */
  undoAllEdits: () => Promise<void>
  /** Keep all edits and clear the drawer */
  keepAllEdits: () => void
}

/**
 * Hook for edited files operations
 *
 * Extracts and centralizes edited files management from App.tsx.
 */
export function useEditedFilesOperations({
  editedFiles,
  setEditedFiles,
  setIsEditedFilesDrawerOpen,
  activeTabId,
  webviewRefs,
}: UseEditedFilesOperationsOptions): UseEditedFilesOperationsReturn {
  // Add or update an edited file
  const addEditedFile = useCallback(
    (file: {
      path: string
      additions?: number
      deletions?: number
      undoCode?: string
      originalContent?: string
      isFileModification?: boolean
    }) => {
      // Extract filename without query strings (e.g., "?t=123456")
      const rawFileName = file.path.split('/').pop() || file.path
      const fileName = rawFileName.split('?')[0]
      setEditedFiles((prev) => {
        // Check if file already exists, update it
        const existing = prev.findIndex((f) => f.path === file.path)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = {
            ...updated[existing],
            additions: updated[existing].additions + (file.additions || 0),
            deletions: updated[existing].deletions + (file.deletions || 0),
            undoCode: file.undoCode || updated[existing].undoCode,
            // Keep original content from first modification for undo
            originalContent:
              updated[existing].originalContent || file.originalContent,
            isFileModification:
              file.isFileModification || updated[existing].isFileModification,
            timestamp: new Date(),
          }
          return updated
        }
        return [
          ...prev,
          {
            path: file.path,
            fileName,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            undoCode: file.undoCode,
            originalContent: file.originalContent,
            isFileModification: file.isFileModification,
            timestamp: new Date(),
          },
        ]
      })
    },
    [setEditedFiles]
  )

  // Undo a single file edit
  const undoFileEdit = useCallback(
    async (path: string) => {
      const file = editedFiles.find((f) => f.path === path)
      if (!file) return

      // Handle file-based undo (restore original content)
      if (file.isFileModification && file.originalContent !== undefined) {
        console.log('[Undo] Restoring file:', path)
        const result = await fileService.writeFile(path, file.originalContent)
        if (result.success) {
          console.log('[Undo] File restored successfully')
          setEditedFiles((prev) => prev.filter((f) => f.path !== path))
        } else {
          console.error('[Undo] Failed to restore file:', result.error)
        }
        return
      }

      // Handle DOM-based undo (execute JavaScript in webview)
      if (file.undoCode) {
        const webview = webviewRefs.current.get(activeTabId)
        if (webview) {
          webview
            .executeJavaScript(file.undoCode)
            .then(() => {
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            })
            .catch((err: Error) => console.error('[Undo] Error:', err))
        }
      } else if (file.isFileModification) {
        // File was modified but we don't have originalContent - use git to restore
        console.log('[Undo] Using git checkoutFile to restore:', path)
        const { api: electronAPI } = getElectronAPI()
        if (electronAPI?.git?.checkoutFile) {
          try {
            const result = await electronAPI.git.checkoutFile(path)
            if (result.success) {
              console.log('[Undo] File restored via git checkoutFile')
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            } else {
              console.error('[Undo] Git checkoutFile failed:', result.error)
              // Still remove from list - user will need to manually revert
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            }
          } catch (err) {
            console.error('[Undo] Git checkoutFile error:', err)
            setEditedFiles((prev) => prev.filter((f) => f.path !== path))
          }
        } else {
          console.warn('[Undo] Git checkoutFile not available, cannot restore file')
          setEditedFiles((prev) => prev.filter((f) => f.path !== path))
        }
      } else {
        // No undo mechanism, just remove from list
        setEditedFiles((prev) => prev.filter((f) => f.path !== path))
      }
    },
    [editedFiles, activeTabId, webviewRefs, setEditedFiles]
  )

  // Undo all file edits
  const undoAllEdits = useCallback(async () => {
    const webview = webviewRefs.current.get(activeTabId)
    const { api: electronAPI } = getElectronAPI()

    // Undo in reverse order
    const filesToUndo = [...editedFiles].reverse()

    for (const file of filesToUndo) {
      // Handle file-based undo with original content
      if (file.isFileModification && file.originalContent !== undefined) {
        await fileService.writeFile(file.path, file.originalContent).catch((err) => {
          console.warn(`[Undo] Failed to restore file ${file.path}:`, err)
        })
      } else if (file.isFileModification) {
        // No original content - use git to restore
        if (electronAPI?.git?.checkoutFile) {
          await electronAPI.git.checkoutFile(file.path).catch((err) => {
            console.warn(`[Undo] Failed to git checkout ${file.path}:`, err)
          })
        }
      } else if (file.undoCode && webview) {
        // Handle DOM-based undo
        await webview.executeJavaScript(file.undoCode).catch((err) => {
          console.warn(`[Undo] Failed to execute undo script for ${file.path}:`, err)
        })
      }
    }

    setEditedFiles([])
    setIsEditedFilesDrawerOpen(false)
  }, [editedFiles, activeTabId, webviewRefs, setEditedFiles, setIsEditedFilesDrawerOpen])

  // Keep all edits and clear the drawer
  const keepAllEdits = useCallback(() => {
    setEditedFiles([])
    setIsEditedFilesDrawerOpen(false)
  }, [setEditedFiles, setIsEditedFilesDrawerOpen])

  return {
    addEditedFile,
    undoFileEdit,
    undoAllEdits,
    keepAllEdits,
  }
}
