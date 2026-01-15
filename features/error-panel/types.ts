/**
 * Error Panel Types
 *
 * Type definitions for error panel state management.
 */

/**
 * Return type for the useErrorPanelState hook
 */
export interface UseErrorPanelStateReturn {
  /** Whether the error panel is visible */
  isVisible: boolean

  /** Set the visibility state */
  setIsVisible: React.Dispatch<React.SetStateAction<boolean>>

  /** Toggle the error panel visibility */
  toggle: () => void

  /** Show the error panel */
  show: () => void

  /** Hide the error panel */
  hide: () => void
}
