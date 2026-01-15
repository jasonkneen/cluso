/**
 * Project Feature Types
 *
 * Type definitions for project setup and window locking state.
 */

/**
 * Project being set up (intermediate state during setup flow)
 */
export interface SetupProject {
  /** Full filesystem path to the project */
  path: string
  /** Display name for the project */
  name: string
  /** Previously used port (optional, for resuming projects) */
  port?: number
}

/**
 * Window-level project lock info
 * Used for multi-window project isolation
 */
export interface WindowProjectLock {
  /** Unique window identifier */
  windowId: number | null
  /** Path to locked project (null if window is not locked) */
  lockedProjectPath: string | null
  /** Display name of locked project */
  lockedProjectName: string | null
}

/**
 * Directory navigation stack for file browser
 * Used for back navigation in @ command file selection
 */
export type DirectoryStack = string[]

/**
 * Project state managed by useProjectState hook
 */
export interface ProjectState extends WindowProjectLock {
  /** Project currently in setup flow (null when not setting up) */
  setupProject: SetupProject | null
  /** Directory navigation history for file browser */
  directoryStack: DirectoryStack
}

/**
 * Actions returned by useProjectState hook
 */
export interface ProjectStateActions {
  setWindowId: React.Dispatch<React.SetStateAction<number | null>>
  setLockedProjectPath: React.Dispatch<React.SetStateAction<string | null>>
  setLockedProjectName: React.Dispatch<React.SetStateAction<string | null>>
  setSetupProject: React.Dispatch<React.SetStateAction<SetupProject | null>>
  setDirectoryStack: React.Dispatch<React.SetStateAction<DirectoryStack>>
  /** Lock window to a specific project */
  lockProject: (path: string, name: string) => void
  /** Clear project lock (unlock window) */
  unlockProject: () => void
  /** Start project setup flow */
  startSetup: (path: string, name: string, port?: number) => void
  /** Complete project setup flow */
  completeSetup: () => void
  /** Cancel project setup flow */
  cancelSetup: () => void
  /** Push directory onto navigation stack */
  pushDirectory: (dir: string) => void
  /** Pop directory from navigation stack */
  popDirectory: () => string | undefined
  /** Clear directory navigation stack */
  clearDirectoryStack: () => void
}
