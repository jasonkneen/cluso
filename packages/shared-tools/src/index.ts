/**
 * @ai-cluso/shared-tools
 *
 * Tool definitions and router for ai-cluso applications.
 * Used by both the Electron desktop app and Chrome extension.
 */

// Timeout utilities
export { TimeoutError, withTimeout, TIMEOUTS } from './timeout'
export type { TimeoutType } from './timeout'

// Tool types
export type {
  ToolArgs,
  ToolCall,
  ToolResponse,
  ToolHandlers,
  SendToolResponse,
  ToolHandler,
} from './tool-types'

// Tool router
export {
  dispatchToolCall,
  executeToolCall,
  executeToolCalls,
  createToolRouter,
  getAvailableTools,
} from './tool-router'
