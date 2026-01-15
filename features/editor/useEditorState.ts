/**
 * Editor State Management Hook
 *
 * Centralizes code editor state management extracted from App.tsx.
 * Handles editor mode, file path, content, and unsaved edits tracking.
 */

import { useState, useEffect, useCallback } from 'react'
import type { EditorState, EditorStateActions } from './types'

export interface UseEditorStateReturn extends EditorState, EditorStateActions {}

/**
 * Hook for managing code editor state
 *
 * Extracts and centralizes editor state management from App.tsx.
 * Provides state and actions for editor mode, file management, and edit tracking.
 * Includes escape key handler to exit editor mode.
 */
export function useEditorState(): UseEditorStateReturn {
  // Core editor state
  const [isEditorMode, setIsEditorMode] = useState(false)
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null)
  const [editorFileContent, setEditorFileContent] = useState<string>('')
  const [editorInitialLine, setEditorInitialLine] = useState<number | undefined>(undefined)
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)

  // Keyboard shortcut: Escape to exit editor mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditorMode) {
        setIsEditorMode(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isEditorMode])

  // Action: Open a file in the editor
  const openFile = useCallback((filePath: string, content: string, initialLine?: number) => {
    setEditorFilePath(filePath)
    setEditorFileContent(content)
    setEditorInitialLine(initialLine)
    setHasUnsavedEdits(false)
    setIsEditorMode(true)
  }, [])

  // Action: Close the editor and reset state
  const closeEditor = useCallback(() => {
    setIsEditorMode(false)
    // Optionally reset other state - keeping file info for potential reopen
  }, [])

  // Action: Mark content as having unsaved changes
  const markUnsaved = useCallback(() => {
    setHasUnsavedEdits(true)
  }, [])

  // Action: Mark content as saved
  const markSaved = useCallback(() => {
    setHasUnsavedEdits(false)
  }, [])

  return {
    // State
    isEditorMode,
    editorFilePath,
    editorFileContent,
    editorInitialLine,
    hasUnsavedEdits,
    // Setters
    setIsEditorMode,
    setEditorFilePath,
    setEditorFileContent,
    setEditorInitialLine,
    setHasUnsavedEdits,
    // Actions
    openFile,
    closeEditor,
    markUnsaved,
    markSaved,
  }
}
