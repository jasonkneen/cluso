/**
 * Editor Handlers Hook
 *
 * Provides handler functions for editor operations extracted from App.tsx.
 * Centralizes file selection, saving, and navigation logic.
 */

import { useCallback } from 'react'

import type { EditorStateActions } from './types'

interface SourceLocation {
  file?: string
  line?: number
}

interface UseEditorHandlersDeps {
  /** Project path from active tab */
  projectPath: string | null
  /** Editor file path */
  editorFilePath: string | null
  /** Editor file content */
  editorFileContent: string
  /** Editor state actions */
  setEditorFilePath: EditorStateActions['setEditorFilePath']
  setEditorFileContent: EditorStateActions['setEditorFileContent']
  setEditorInitialLine: EditorStateActions['setEditorInitialLine']
  setIsEditorMode: EditorStateActions['setIsEditorMode']
  setHasUnsavedEdits: EditorStateActions['setHasUnsavedEdits']
  /** Callback when left panel should open */
  onOpenLeftPanel?: () => void
}

export interface UseEditorHandlersReturn {
  /** Handle file selection from file tree - loads and opens file */
  handleFileTreeSelect: (filePath: string) => Promise<void>
  /** Handle editor save - writes current content to file */
  handleEditorSave: () => Promise<boolean>
  /** Handle editor save with value - writes provided content to file (for CodeEditor onSave) */
  handleEditorSaveWithValue: (value: string) => Promise<void>
  /** Handle editor content change - updates content and marks unsaved */
  handleEditorContentChange: (value: string | undefined) => void
  /** Handle editor close - switches back to preview mode */
  handleEditorClose: () => void
  /** Handle jump to source - finds and opens source file at line */
  handleJumpToSource: (sources: SourceLocation[]) => Promise<void>
}

/**
 * Hook providing editor handler functions
 *
 * Extracts editor operation logic from App.tsx into reusable handlers.
 * Handles file loading with fallback search, saving, and source navigation.
 */
export function useEditorHandlers(deps: UseEditorHandlersDeps): UseEditorHandlersReturn {
  const {
    projectPath,
    editorFilePath,
    editorFileContent,
    setEditorFilePath,
    setEditorFileContent,
    setEditorInitialLine,
    setIsEditorMode,
    setHasUnsavedEdits,
    onOpenLeftPanel,
  } = deps

  /**
   * Handle file selection from file tree
   * Loads file content with fallback search if not found at original path
   */
  const handleFileTreeSelect = useCallback(async (filePath: string) => {
    console.log('[Editor] File selected from tree:', filePath)
    setEditorFilePath(filePath)
    setHasUnsavedEdits(false)

    try {
      let result = await window.electronAPI.files.readFile(filePath)

      // If file not found, try searching for it by filename
      if (!result.success && result.error?.includes('ENOENT') && projectPath) {
        const filename = filePath.split('/').pop()
        console.log('[Editor] File not found at', filePath, '- searching for:', filename)

        const searchResult = await window.electronAPI.files.findFiles(projectPath, filename!)
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const foundPath = searchResult.data[0]
          console.log('[Editor] Found file at:', foundPath)
          setEditorFilePath(foundPath)
          result = await window.electronAPI.files.readFile(foundPath)
        }
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to read file')
      }
      const content = result.data || ''
      console.log('[Editor] File loaded:', content.length, 'bytes')
      setEditorFileContent(content)
      setIsEditorMode(true)
    } catch (error) {
      console.error('[Editor] Failed to load file:', error)
      setEditorFileContent(`// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsEditorMode(true)
    }
  }, [projectPath, setEditorFilePath, setEditorFileContent, setIsEditorMode, setHasUnsavedEdits])

  /**
   * Handle editor save
   * Writes current content to file and marks as saved
   */
  const handleEditorSave = useCallback(async (): Promise<boolean> => {
    if (!editorFilePath) return false
    try {
      const result = await window.electronAPI.files.writeFile(editorFilePath, editorFileContent)
      if (result.success) {
        setHasUnsavedEdits(false)
        return true
      }
      return false
    } catch (error) {
      console.error('[Editor] Failed to save:', error)
      return false
    }
  }, [editorFilePath, editorFileContent, setHasUnsavedEdits])

  /**
   * Handle editor save with value (for CodeEditor's onSave callback)
   * Writes the provided value to file and marks as saved
   */
  const handleEditorSaveWithValue = useCallback(async (value: string): Promise<void> => {
    if (!editorFilePath) return
    try {
      const result = await window.electronAPI.files.writeFile(editorFilePath, value)
      if (result.success) {
        setHasUnsavedEdits(false)
      }
    } catch (error) {
      console.error('[Editor] Failed to save:', error)
    }
  }, [editorFilePath, setHasUnsavedEdits])

  /**
   * Handle editor content change
   * Updates content state and marks as having unsaved changes
   */
  const handleEditorContentChange = useCallback((value: string | undefined) => {
    setEditorFileContent(value || '')
    setHasUnsavedEdits(true)
  }, [setEditorFileContent, setHasUnsavedEdits])

  /**
   * Handle editor close
   * Switches back to preview mode
   */
  const handleEditorClose = useCallback(() => {
    setIsEditorMode(false)
  }, [setIsEditorMode])

  /**
   * Handle jump to source
   * Finds source file using glob and opens it at the specified line
   */
  const handleJumpToSource = useCallback(async (sources: SourceLocation[]) => {
    if (sources.length === 0 || !projectPath) return

    // Try each source until we find a file that exists
    for (const source of sources) {
      if (!source?.file) continue

      const filename = source.file.split('/').pop() || source.file
      console.log('[Editor] Jump to Source - Trying:', filename)

      const searchResult = await window.electronAPI.files.glob(`**/${filename}`, projectPath)
      const files = searchResult.data || []

      if (searchResult.success && files.length > 0) {
        const foundPath = typeof files[0] === 'string' ? files[0] : files[0]?.path
        console.log('[Editor] Jump to Source - Found at:', foundPath, 'line:', source.line)
        setEditorInitialLine(source.line)
        await handleFileTreeSelect(foundPath)
        onOpenLeftPanel?.()
        return
      }
    }
    console.error('[Editor] Jump to Source - No files found from sources:', sources.map(s => s?.file))
  }, [projectPath, setEditorInitialLine, handleFileTreeSelect, onOpenLeftPanel])

  return {
    handleFileTreeSelect,
    handleEditorSave,
    handleEditorSaveWithValue,
    handleEditorContentChange,
    handleEditorClose,
    handleJumpToSource,
  }
}
