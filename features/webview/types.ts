/**
 * Webview Feature Types
 *
 * Type definitions for the webview preload state management.
 */

/**
 * Webview state managed by useWebviewState hook
 */
export interface WebviewState {
  /** Path to the webview preload script (Electron only) */
  webviewPreloadPath: string
  /** Whether the preload path has been loaded */
  isPreloadReady: boolean
}

/**
 * Actions returned by useWebviewState hook
 */
export interface WebviewStateActions {
  setWebviewPreloadPath: React.Dispatch<React.SetStateAction<string>>
}
