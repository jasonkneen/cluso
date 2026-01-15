/**
 * Debug Feature Types
 *
 * Type definitions for debug mode and terminal/PTY state management.
 */

/**
 * Debug state managed by useDebugState hook
 */
export interface DebugState {
  /** Whether debug mode is enabled (shows activity in console panel) */
  debugMode: boolean
  setDebugMode: React.Dispatch<React.SetStateAction<boolean>>

  /** PTY server port for terminal connections */
  ptyPort: number | null
  setPtyPort: React.Dispatch<React.SetStateAction<number | null>>

  /** Debug logger function that logs to console and optionally to console panel */
  debugLog: (prefix: string, message: string, data?: unknown) => void
}
