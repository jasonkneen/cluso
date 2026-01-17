/**
 * Inspector Feature Types
 *
 * Type definitions for inspector tool state management.
 * These tools are mutually exclusive - only one can be active at a time.
 */

/**
 * Move target position for element repositioning
 */
export interface MoveTargetPosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Pre-inspector settings to restore after deactivation
 */
export interface PreInspectorSettings {
  model: unknown // Model definition, type varies
  thinkingLevel: 'off' | 'low' | 'med' | 'high' | 'ultrathink'
}

/**
 * Active tool type - mutually exclusive
 */
export type InspectorTool = 'inspector' | 'screenshot' | 'move' | null

/**
 * Inspector state managed by useInspectorState hook
 */
export interface InspectorState {
  /** Inspector mode active for element selection */
  isInspectorActive: boolean
  /** Screenshot mode active for capturing elements */
  isScreenshotActive: boolean
  /** Move mode active for repositioning elements */
  isMoveActive: boolean
  /** Target position for move mode */
  moveTargetPosition: MoveTargetPosition | null
}

/**
 * Actions returned by useInspectorState hook
 */
export interface InspectorStateActions {
  setIsInspectorActive: React.Dispatch<React.SetStateAction<boolean>>
  setIsScreenshotActive: React.Dispatch<React.SetStateAction<boolean>>
  setIsMoveActive: React.Dispatch<React.SetStateAction<boolean>>
  setMoveTargetPosition: React.Dispatch<React.SetStateAction<MoveTargetPosition | null>>
  /** Toggle inspector mode (deactivates other tools) */
  toggleInspector: () => void
  /** Toggle screenshot mode (deactivates other tools) */
  toggleScreenshot: () => void
  /** Toggle move mode (deactivates other tools) */
  toggleMove: () => void
  /** Deactivate all tools */
  deactivateAll: () => void
}

/**
 * Refs returned by useInspectorState hook for synchronous access
 */
export interface InspectorStateRefs {
  /** Ref to inspector state for synchronous access (e.g., in webview event handlers) */
  isInspectorActiveRef: React.MutableRefObject<boolean>
  /** Ref to screenshot state for synchronous access */
  isScreenshotActiveRef: React.MutableRefObject<boolean>
  /** Ref to move state for synchronous access */
  isMoveActiveRef: React.MutableRefObject<boolean>
  /** Ref to store pre-inspector settings for restoration */
  preInspectorSettingsRef: React.MutableRefObject<PreInspectorSettings | null>
}

/**
 * Minimal webview interface for inspector sync
 * Using a minimal type to avoid conflicts with the full WebviewElement from selection
 */
export interface InspectorWebviewRef {
  send: (channel: string, ...args: unknown[]) => void
  isConnected: boolean
  getWebContentsId: () => number
}

/**
 * Options for useInspectorSync hook
 */
export interface UseInspectorSyncOptions {
  /** Whether running in Electron environment */
  isElectron: boolean
  /** Whether webview is ready to receive messages */
  isWebviewReady: boolean
  /** Active tab ID */
  activeTabId: string
  /** Active tab type */
  activeTabType: string | undefined
  /** Inspector mode state */
  isInspectorActive: boolean
  /** Screenshot mode state */
  isScreenshotActive: boolean
  /** Move mode state */
  isMoveActive: boolean
  /** Ref map to webview elements */
  webviewRefs: React.MutableRefObject<Map<string, InspectorWebviewRef>>
  /** Callback to clear selected element */
  setSelectedElement: (element: null) => void
  /** Callback to hide element chat */
  setShowElementChat: (show: boolean) => void
}
