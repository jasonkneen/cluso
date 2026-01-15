/**
 * File Browser State Management Hook
 *
 * Centralizes file browser state management extracted from App.tsx.
 * Handles directory navigation, file search, autocomplete, and edited files tracking.
 */

import { useState } from 'react'

/**
 * Represents a file or directory entry in the file browser
 */
export interface DirectoryFile {
  name: string
  path: string
  isDirectory: boolean
}

/**
 * Represents a file that has been edited during the session
 */
export interface EditedFile {
  path: string
  fileName: string
  additions: number
  deletions: number
  undoCode?: string
  timestamp: Date
  // For file-based undo (tool modifications)
  originalContent?: string
  isFileModification?: boolean
}

/**
 * File browser state values
 */
export interface FileBrowserState {
  // Directory state
  directoryFiles: DirectoryFile[]
  currentDirectory: string
  // Search/autocomplete state
  fileSearchQuery: string
  showFileAutocomplete: boolean
  // Edited files drawer state
  editedFiles: EditedFile[]
  isEditedFilesDrawerOpen: boolean
}

/**
 * File browser state setters
 */
export interface FileBrowserStateSetters {
  setDirectoryFiles: React.Dispatch<React.SetStateAction<DirectoryFile[]>>
  setCurrentDirectory: React.Dispatch<React.SetStateAction<string>>
  setFileSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setShowFileAutocomplete: React.Dispatch<React.SetStateAction<boolean>>
  setEditedFiles: React.Dispatch<React.SetStateAction<EditedFile[]>>
  setIsEditedFilesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export interface UseFileBrowserStateReturn extends FileBrowserState, FileBrowserStateSetters {}

/**
 * Hook for managing file browser state
 *
 * Extracts and centralizes file browser state management from App.tsx.
 * Provides state and setters for directory navigation, file search, and edited files tracking.
 */
export function useFileBrowserState(): UseFileBrowserStateReturn {
  // Directory state
  const [directoryFiles, setDirectoryFiles] = useState<DirectoryFile[]>([])
  const [currentDirectory, setCurrentDirectory] = useState<string>('')

  // Search/autocomplete state
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [showFileAutocomplete, setShowFileAutocomplete] = useState(false)

  // Edited files drawer state
  const [editedFiles, setEditedFiles] = useState<EditedFile[]>([])
  const [isEditedFilesDrawerOpen, setIsEditedFilesDrawerOpen] = useState(false)

  return {
    // State
    directoryFiles,
    currentDirectory,
    fileSearchQuery,
    showFileAutocomplete,
    editedFiles,
    isEditedFilesDrawerOpen,
    // Setters
    setDirectoryFiles,
    setCurrentDirectory,
    setFileSearchQuery,
    setShowFileAutocomplete,
    setEditedFiles,
    setIsEditedFilesDrawerOpen,
  }
}
