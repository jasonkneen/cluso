/**
 * Extension Feature Module
 *
 * Exports Chrome extension bridge state management and types.
 */

export { useExtensionState } from './useExtensionState'
export { useExtensionCursorSync } from './useExtensionCursorSync'
export type { UseExtensionStateReturn } from './useExtensionState'
export type {
  ExtensionState,
  ExtensionStateActions,
  ExtensionCursor,
  OutgoingCursorData,
  UseExtensionCursorSyncOptions,
} from './types'
