/**
 * Window Feature Types
 *
 * Types for window management hooks including:
 * - Multi-window project locking
 * - Window info and appearance
 */

export interface WindowInfo {
  windowId?: number
  projectPath?: string
  projectName?: string
}

export interface WindowAppearance {
  transparencyEnabled: boolean
  opacity: number
  blur: number
}

export interface WindowState {
  /** Unique window ID for multi-window support */
  windowId: number | null
  /** Project path this window is locked to */
  lockedProjectPath: string | null
  /** Project name this window is locked to */
  lockedProjectName: string | null
  /** Setters */
  setWindowId: React.Dispatch<React.SetStateAction<number | null>>
  setLockedProjectPath: React.Dispatch<React.SetStateAction<string | null>>
  setLockedProjectName: React.Dispatch<React.SetStateAction<string | null>>
}
