/**
 * File Browser Panel Types
 *
 * Type definitions for the file browser panel overlay state.
 * This is separate from the general file browser state (features/files)
 * as it specifically handles the panel/overlay navigation stack.
 */

/**
 * Represents a file or directory item in the file browser panel
 */
export interface FileBrowserItem {
  /** File or directory name */
  name: string
  /** Whether this item is a directory */
  isDirectory: boolean
  /** Full path to the file or directory */
  path: string
}

/**
 * Represents a panel in the file browser overlay stack
 */
export interface FileBrowserPanel {
  /** Type of content displayed in this panel */
  type: 'directory' | 'file' | 'image'
  /** Full path to the file or directory */
  path: string
  /** Display title for the panel */
  title: string
  /** Directory contents (for directory type) */
  items?: FileBrowserItem[]
  /** File contents (for file type) */
  content?: string
}

/**
 * File browser panel state values
 */
export interface FileBrowserPanelState {
  /** Stack of panels for navigation (supports back navigation) */
  fileBrowserStack: FileBrowserPanel[]
  /** Whether the file browser overlay is visible */
  fileBrowserVisible: boolean
  /** Base path for the file browser (root of navigation) */
  fileBrowserBasePath: string
}

/**
 * File browser panel state setters
 */
export interface FileBrowserPanelStateSetters {
  setFileBrowserStack: React.Dispatch<React.SetStateAction<FileBrowserPanel[]>>
  setFileBrowserVisible: React.Dispatch<React.SetStateAction<boolean>>
  setFileBrowserBasePath: React.Dispatch<React.SetStateAction<string>>
}
