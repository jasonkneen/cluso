/**
 * Navigation Feature Types
 *
 * Type definitions for browser navigation state management.
 */

/**
 * Navigation state managed by useNavigationState hook
 */
export interface NavigationState {
  /** URL currently displayed in the address bar (editable by user) */
  urlInput: string
  /** Whether the browser can navigate back in history */
  canGoBack: boolean
  /** Whether the browser can navigate forward in history */
  canGoForward: boolean
  /** Whether the current page is loading */
  isLoading: boolean
  /** Title of the current page */
  pageTitle: string
}

/**
 * Actions returned by useNavigationState hook
 */
export interface NavigationStateActions {
  setUrlInput: React.Dispatch<React.SetStateAction<string>>
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>
  setCanGoForward: React.Dispatch<React.SetStateAction<boolean>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  setPageTitle: React.Dispatch<React.SetStateAction<string>>
  /** Reset all navigation state to defaults */
  resetNavigationState: () => void
  /** Update multiple navigation states at once */
  updateNavigationState: (updates: Partial<NavigationState>) => void
}
