/**
 * Scroll Feature Types
 *
 * Type definitions for auto-scroll and scroll-to-bottom state.
 */

/**
 * Scroll state managed by useScrollState hook
 */
export interface ScrollState {
  /** Whether auto-scroll is enabled for new messages */
  isAutoScrollEnabled: boolean
  /** Whether to show the scroll-to-bottom button */
  showScrollToBottom: boolean
}

/**
 * Actions returned by useScrollState hook
 */
export interface ScrollStateActions {
  setIsAutoScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setShowScrollToBottom: React.Dispatch<React.SetStateAction<boolean>>
  /** Enable auto-scroll and scroll to bottom */
  enableAutoScroll: () => void
  /** Disable auto-scroll */
  disableAutoScroll: () => void
  /** Show the scroll-to-bottom button */
  showScrollButton: () => void
  /** Hide the scroll-to-bottom button */
  hideScrollButton: () => void
}
