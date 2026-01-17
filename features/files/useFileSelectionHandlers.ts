/**
 * File Selection Handlers Hook
 *
 * Handles file selection and command autocomplete operations extracted from App.tsx.
 * Manages file tree selection, @ command file selection, / command selection.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/fileService'
import type { DirectoryFile } from './useFileBrowserState'

/** Selected file attachment type */
export interface SelectedFile {
  path: string
  content: string
  lineStart?: number
  lineEnd?: number
  elementType?: string
}

/** Context chip type */
export interface ContextChip {
  name: string
  type: 'include' | 'exclude'
}

export interface UseFileSelectionHandlersOptions {
  /** Whether running in Electron */
  isElectron: boolean
  /** Current active tab's project path */
  projectPath?: string
  /** Set editor file path */
  setEditorFilePath: (path: string | null) => void
  /** Set has unsaved edits flag */
  setHasUnsavedEdits: (hasEdits: boolean) => void
  /** Set editor file content */
  setEditorFileContent: (content: string) => void
  /** Set editor mode */
  setIsEditorMode: (isEditor: boolean) => void
  /** Set directory files */
  setDirectoryFiles: React.Dispatch<React.SetStateAction<DirectoryFile[]>>
  /** Set current directory */
  setCurrentDirectory: (dir: string) => void
  /** Set selected files */
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>
  /** Set input value */
  setInput: React.Dispatch<React.SetStateAction<string>>
  /** Set file search query */
  setFileSearchQuery: (query: string) => void
  /** Set show file autocomplete */
  setShowFileAutocomplete: (show: boolean) => void
  /** Set autocomplete index */
  setAutocompleteIndex: (index: number) => void
  /** Set command search query */
  setCommandSearchQuery: (query: string) => void
  /** Set show command autocomplete */
  setShowCommandAutocomplete: (show: boolean) => void
  /** Directory stack */
  directoryStack: string[]
  /** Set directory stack */
  setDirectoryStack: React.Dispatch<React.SetStateAction<string[]>>
  /** Current directory */
  currentDirectory: string
  /** Set context chips */
  setContextChips: React.Dispatch<React.SetStateAction<ContextChip[]>>
  /** Set show chip autocomplete */
  setShowChipAutocomplete: (show: boolean) => void
  /** Set chip search query */
  setChipSearchQuery: (query: string) => void
}

export interface UseFileSelectionHandlersReturn {
  /** Handle file selection from file tree */
  handleFileTreeSelect: (filePath: string) => Promise<void>
  /** Load directory files for @ command */
  loadDirectoryFiles: (dirPath?: string) => Promise<void>
  /** Navigate into a subdirectory */
  navigateToDirectory: (dirPath: string) => void
  /** Navigate back to parent directory */
  navigateBack: () => void
  /** Handle @ command - select a file from the list */
  handleFileSelect: (filePath: string) => Promise<void>
  /** Handle / command - execute prompt */
  handleCommandSelect: (commandName: string) => Promise<void>
  /** Handle chip selection from autocomplete */
  handleChipSelect: (chip: ContextChip) => void
}

/**
 * Hook for file selection handlers
 *
 * Extracts and centralizes file selection logic from App.tsx.
 */
export function useFileSelectionHandlers({
  isElectron,
  projectPath,
  setEditorFilePath,
  setHasUnsavedEdits,
  setEditorFileContent,
  setIsEditorMode,
  setDirectoryFiles,
  setCurrentDirectory,
  setSelectedFiles,
  setInput,
  setFileSearchQuery,
  setShowFileAutocomplete,
  setAutocompleteIndex,
  setCommandSearchQuery,
  setShowCommandAutocomplete,
  directoryStack,
  setDirectoryStack,
  currentDirectory,
  setContextChips,
  setShowChipAutocomplete,
  setChipSearchQuery,
}: UseFileSelectionHandlersOptions): UseFileSelectionHandlersReturn {
  // Handle file selection from file tree
  const handleFileTreeSelect = useCallback(
    async (filePath: string) => {
      console.log('[App] File selected from tree:', filePath)
      setEditorFilePath(filePath)
      setHasUnsavedEdits(false)

      // Load file content
      try {
        let result = await window.electronAPI.files.readFile(filePath)

        // If file not found, try searching for it by filename
        if (!result.success && result.error?.includes('ENOENT') && projectPath) {
          const filename = filePath.split('/').pop()
          console.log(
            '[App] File not found at',
            filePath,
            '- searching for:',
            filename
          )

          const searchResult = await window.electronAPI.files.findFiles(
            projectPath,
            filename!
          )
          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            const foundPath = searchResult.data[0]
            console.log('[App] Found file at:', foundPath)
            setEditorFilePath(foundPath)
            result = await window.electronAPI.files.readFile(foundPath)
          }
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to read file')
        }
        const content = result.data || ''
        console.log('[App] File loaded:', content.length, 'bytes')
        setEditorFileContent(content)
        setIsEditorMode(true) // Switch center pane to editor
      } catch (error) {
        console.error('[App] Failed to load file:', error)
        setEditorFileContent(
          `// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        setIsEditorMode(true)
      }
    },
    [
      projectPath,
      setEditorFilePath,
      setHasUnsavedEdits,
      setEditorFileContent,
      setIsEditorMode,
    ]
  )

  // Load directory listing for @ command
  const loadDirectoryFiles = useCallback(
    async (dirPath?: string) => {
      if (!isElectron) return
      console.log('[@ Files] Loading directory:', dirPath || '(default)')
      const result = await fileService.listDirectory(dirPath)
      if (result.success && result.data) {
        console.log(
          '[@ Files] Loaded',
          result.data.length,
          'files from:',
          dirPath || '(default)'
        )
        setDirectoryFiles(result.data as DirectoryFile[])
        if (dirPath) {
          setCurrentDirectory(dirPath)
        }
      }
    },
    [isElectron, setDirectoryFiles, setCurrentDirectory]
  )

  // Navigate into a subdirectory
  const navigateToDirectory = useCallback(
    (dirPath: string) => {
      setDirectoryStack((prev) => [...prev, currentDirectory])
      loadDirectoryFiles(dirPath)
      setFileSearchQuery('')
      setAutocompleteIndex(0)
    },
    [currentDirectory, loadDirectoryFiles, setDirectoryStack, setFileSearchQuery, setAutocompleteIndex]
  )

  // Navigate back to parent directory - use project path as root
  const navigateBack = useCallback(() => {
    const newStack = [...directoryStack]
    const parentDir = newStack.pop()
    setDirectoryStack(newStack)
    // If no parent in stack, go back to project root (or system root if no project)
    loadDirectoryFiles(parentDir || projectPath || undefined)
    setFileSearchQuery('')
    setAutocompleteIndex(0)
  }, [directoryStack, loadDirectoryFiles, projectPath, setDirectoryStack, setFileSearchQuery, setAutocompleteIndex])

  // Handle @ command - select a file from the list
  const handleFileSelect = useCallback(
    async (filePath: string) => {
      if (!isElectron) return

      const result = await fileService.selectFile(filePath)
      if (result.success && result.data) {
        const { path, content } = result.data

        // Parse line range from path if present
        let lineStart: number | undefined
        let lineEnd: number | undefined
        let elementType: string | undefined

        const lineMatch = path.match(/\((\d+)-(\d+)\)$/)
        if (lineMatch) {
          lineStart = parseInt(lineMatch[1], 10)
          lineEnd = parseInt(lineMatch[2], 10)
        } else {
          // Try single line format: "(1426)"
          const singleLineMatch = path.match(/\((\d+)\)$/)
          if (singleLineMatch) {
            lineStart = parseInt(singleLineMatch[1], 10)
          }
        }

        // Try to detect element type from content
        if (content && lineStart) {
          const lines = content.split('\n')
          const startLine = lines[0] || ''
          const funcMatch = startLine.match(
            /(?:function|const|export\s+(?:default\s+)?(?:function|const)?)\s+(\w+)/
          )
          if (funcMatch) {
            elementType = funcMatch[1]
          }
        }

        setSelectedFiles((prev) => [
          ...prev,
          { path, content, lineStart, lineEnd, elementType },
        ])

        // Replace the @query with the file reference in the input
        setInput((prevInput) => {
          const lastAtIndex = prevInput.lastIndexOf('@')
          if (lastAtIndex === -1) return '' // Fallback: clear input

          // Get everything before the @
          const beforeAt = prevInput.substring(0, lastAtIndex)

          // Create a short display name for the file reference
          const fileName = path.split('/').pop() || path

          // Return the text before @ + a reference marker
          return `${beforeAt}[${fileName}] `
        })

        setShowFileAutocomplete(false)
        setFileSearchQuery('')
        setAutocompleteIndex(0)
      }
    },
    [isElectron, setSelectedFiles, setInput, setShowFileAutocomplete, setFileSearchQuery, setAutocompleteIndex]
  )

  // Handle / command - execute prompt
  const handleCommandSelect = useCallback(
    async (commandName: string) => {
      if (!isElectron) return

      const result = await fileService.readPrompt(commandName)
      if (result.success && result.data) {
        setInput(result.data) // Replace input with prompt content
        setShowCommandAutocomplete(false)
        setCommandSearchQuery('')
        setAutocompleteIndex(0)
      }
    },
    [isElectron, setInput, setShowCommandAutocomplete, setCommandSearchQuery, setAutocompleteIndex]
  )

  // Handle chip selection from autocomplete
  const handleChipSelect = useCallback(
    (chip: ContextChip) => {
      // Add the chip
      setContextChips((prev) => {
        const exists = prev.some((c) => c.name === chip.name && c.type === chip.type)
        if (exists) return prev
        return [...prev, chip]
      })
      // Remove the +/- prefix from input
      setInput((prev) => {
        const prefix = chip.type === 'include' ? '+' : '-'
        const pattern = new RegExp(`\\${prefix}[a-zA-Z0-9_-]*$`)
        return prev.replace(pattern, '')
      })
      // Hide autocomplete
      setShowChipAutocomplete(false)
      setChipSearchQuery('')
    },
    [setContextChips, setInput, setShowChipAutocomplete, setChipSearchQuery]
  )

  return {
    handleFileTreeSelect,
    loadDirectoryFiles,
    navigateToDirectory,
    navigateBack,
    handleFileSelect,
    handleCommandSelect,
    handleChipSelect,
  }
}
