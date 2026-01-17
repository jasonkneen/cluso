/**
 * File Watcher Feature Types
 *
 * Type definitions for file system watching integration.
 */

/**
 * File change event from the file watcher
 */
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  relativePath: string
  projectPath: string
}

/**
 * Edited file entry for tracking modifications
 */
export interface EditedFileEntry {
  path: string
  additions?: number
  deletions?: number
  undoCode?: string
  originalContent?: string
  isFileModification?: boolean
}

/**
 * Options for useFileWatcher hook
 */
export interface UseFileWatcherOptions {
  /** Whether running in Electron environment */
  isElectron: boolean
  /** Current project path to watch */
  projectPath: string | undefined | null
  /** Callback to add edited file to tracking */
  addEditedFile: (file: EditedFileEntry) => void
  /** Callback to set file watcher active status */
  setFileWatcherActive: (active: boolean) => void
}

/**
 * Return type for useFileWatcher hook
 */
export interface UseFileWatcherReturn {
  /** Set of projects with active watchers */
  activeWatchers: Set<string>
}
