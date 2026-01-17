/**
 * Extension Feature Types
 *
 * Type definitions for Chrome extension bridge state management.
 */

/**
 * Cursor position data from the extension
 * Contains multiple coordinate systems for accurate cursor positioning
 */
export interface ExtensionCursor {
  /** Element-anchored position (most accurate) */
  elementAnchor?: {
    selector: string
    relativeX: number
    relativeY: number
    elementText?: string
  }
  /** Viewport percentage coordinates (works across screen sizes) */
  viewportPercentX?: number
  viewportPercentY?: number
  /** Page coordinates (absolute position including scroll) */
  pageX: number
  pageY: number
  /** Client coordinates (relative to viewport) */
  clientX: number
  clientY: number
  /** Scroll position of the page */
  scrollX: number
  scrollY: number
  /** Viewport dimensions */
  viewportWidth: number
  viewportHeight: number
  /** Document dimensions */
  documentWidth: number
  documentHeight: number
  /** URL of the page the cursor is on */
  pageUrl: string
  /** Timestamp of the cursor update */
  timestamp?: number
}

/**
 * Extension state managed by useExtensionState hook
 */
export interface ExtensionState {
  /** Whether the Chrome extension bridge is connected */
  extensionConnected: boolean
  /** Whether cursor sharing is active */
  extensionSharing: boolean
  /** Current cursor position from extension user (null if not sharing) */
  extensionCursor: ExtensionCursor | null
}

/**
 * Actions returned by useExtensionState hook
 */
export interface ExtensionStateActions {
  setExtensionConnected: React.Dispatch<React.SetStateAction<boolean>>
  setExtensionSharing: React.Dispatch<React.SetStateAction<boolean>>
  setExtensionCursor: React.Dispatch<React.SetStateAction<ExtensionCursor | null>>
  /** Toggle cursor sharing on/off */
  toggleSharing: () => void
  /** Clear cursor data (when sharing stops) */
  clearCursor: () => void
}

/**
 * Cursor data sent to extension (outgoing)
 */
export interface OutgoingCursorData {
  pageX: number
  pageY: number
  clientX: number
  clientY: number
  scrollX: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  documentWidth: number
  documentHeight: number
  pageUrl: string
}

/**
 * Options for useExtensionCursorSync hook
 */
export interface UseExtensionCursorSyncOptions {
  /** Whether cursor sharing is active */
  extensionSharing: boolean
  /** Current active tab URL */
  activeTabUrl: string | undefined
}
