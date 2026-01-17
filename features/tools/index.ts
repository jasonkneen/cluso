/**
 * Tools Feature
 *
 * Exports tool handlers for AI tool execution.
 */

export { useToolHandlers } from './useToolHandlers'
export type {
  UseToolHandlersDeps,
  UseToolHandlersReturn,
  WebviewElement,
} from './useToolHandlers'

export { useToolExecution } from './useToolExecution'
export type {
  UseToolExecutionDeps,
  UseToolExecutionReturn,
  WebviewElement as ToolWebviewElement,
} from './useToolExecution'
