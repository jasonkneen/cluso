/**
 * Tool Router - Re-exports from @ai-cluso/shared-tools
 *
 * This file provides backward compatibility while the shared package
 * is used for actual implementation.
 */

// Re-export everything from shared-tools
export {
  TimeoutError,
  withTimeout,
  TIMEOUTS,
  dispatchToolCall,
  executeToolCall,
  executeToolCalls,
  createToolRouter,
  getAvailableTools,
} from '@ai-cluso/shared-tools'

export type {
  TimeoutType,
  ToolArgs,
  ToolCall,
  ToolResponse,
  ToolHandlers,
  SendToolResponse,
  ToolHandler,
} from '@ai-cluso/shared-tools'

// Legacy alias for backward compatibility
export type SendResponse = import('@ai-cluso/shared-tools').SendToolResponse
