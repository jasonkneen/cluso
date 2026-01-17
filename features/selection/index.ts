/**
 * Selection Feature Module
 *
 * Exports selection state management, handlers, and types.
 */

export { useSelectionState } from './useSelectionState'
export type { UseSelectionStateReturn } from './useSelectionState'
export { useSelectionHandlers } from './useSelectionHandlers'
export type {
  UseSelectionHandlersReturn,
  SelectionHandlersDeps,
  WebviewElement,
  AiSelectedElement as SelectionAiSelectedElement,
} from './useSelectionHandlers'
export type {
  SelectionState,
  SelectionStateActions,
  SelectionStateRefs,
  SelectedElementSourceSnippet,
  HoveredElement,
} from './types'
