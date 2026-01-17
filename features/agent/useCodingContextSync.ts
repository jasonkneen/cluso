/**
 * Coding Context Sync Hook
 *
 * Handles syncing coding agent context when selections change.
 * Extracted from App.tsx lines 4558-4569.
 */

import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../chat/types'

interface SelectedElement {
  tagName?: string
  xpath?: string
}

interface SelectedFile {
  path: string
  content?: string
}

interface SelectedLog {
  type: string
  message: string
}

interface CodingContext {
  selectedElement: SelectedElement | null
  selectedFiles: SelectedFile[]
  selectedLogs: Array<{ type: string; message: string }>
  projectPath: string | null
  recentMessages: unknown[]
}

interface UseCodingContextSyncOptions {
  selectedElement: SelectedElement | null
  selectedFiles: SelectedFile[]
  selectedLogs: SelectedLog[] | null
  projectPath: string | undefined
  messages: ChatMessage[]
  updateCodingContext: (context: CodingContext) => void
}

/**
 * Hook for syncing coding agent context
 *
 * Updates the coding agent context whenever selections or messages change.
 */
export function useCodingContextSync({
  selectedElement,
  selectedFiles,
  selectedLogs,
  projectPath,
  messages,
  updateCodingContext,
}: UseCodingContextSyncOptions): void {
  // Ref for updateCodingContext to avoid triggering effect when function identity changes
  const updateCodingContextRef = useRef(updateCodingContext)
  updateCodingContextRef.current = updateCodingContext

  useEffect(() => {
    updateCodingContextRef.current({
      selectedElement: selectedElement || null,
      selectedFiles: selectedFiles,
      selectedLogs: selectedLogs?.map(log => ({
        type: log.type,
        message: log.message,
      })) || [],
      projectPath: projectPath || null,
      recentMessages: messages.slice(-10) as unknown[],
    })
  }, [selectedElement, selectedFiles, selectedLogs, projectPath, messages])
}
