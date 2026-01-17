/**
 * Webview Feature Module
 *
 * Exports webview state management and types.
 */

export { useWebviewState } from './useWebviewState'
export type { UseWebviewStateReturn } from './useWebviewState'
export type { WebviewState, WebviewStateActions } from './types'

export { useWebviewSetup } from './useWebviewSetup'
export type {
  UseWebviewSetupDeps,
  UseWebviewSetupReturn,
  WebviewElement,
  WebviewTab,
  ConsoleLogEntry,
  AISelectedElementState,
  MoveTargetPosition,
  PendingChange,
  HoveredElementState,
} from './useWebviewSetup'
