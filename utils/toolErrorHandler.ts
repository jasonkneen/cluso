/**
 * Tool Error Handler
 * 
 * Provides unified error categorization and recovery suggestions for tool execution failures.
 * Helps users understand why tools fail and what they can do about it.
 * 
 * Usage:
 *   try {
 *     await executeTool(...)
 *   } catch (err) {
 *     const toolError = createToolError(toolId, toolName, err)
 *     logToolError(toolError, { turnId, args })
 *     // Display toolError.message and toolError.recoveryActions to user
 *   }
 */

export type ToolErrorCode = 
  | 'VALIDATION'  // Input validation failed
  | 'EXECUTION'   // Tool execution failed
  | 'TIMEOUT'     // Tool took too long
  | 'NOT_FOUND'   // Tool or resource not found
  | 'UNKNOWN'     // Unknown error

export interface ToolError {
  id: string
  toolName: string
  code: ToolErrorCode
  message: string
  context?: Record<string, unknown>
  recoveryActions: string[]
  timestamp: number
}

/**
 * Categorize an error and create a ToolError with recovery suggestions
 */
export function createToolError(
  id: string,
  toolName: string,
  error: unknown
): ToolError {
  const timestamp = Date.now()
  
  // Handle timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    
    if (msg.includes('timeout')) {
      return {
        id,
        toolName,
        code: 'TIMEOUT',
        message: `Tool "${toolName}" timed out after 30 seconds. The operation took too long to complete.`,
        recoveryActions: [
          'Retry the operation',
          'Try a simpler/smaller request',
          'Check your system resources (CPU, memory)',
          'Try again after waiting a moment'
        ],
        timestamp
      }
    }
    
    if (msg.includes('not found') || msg.includes('does not exist')) {
      return {
        id,
        toolName,
        code: 'NOT_FOUND',
        message: `Tool "${toolName}" is not available or the target resource was not found.`,
        recoveryActions: [
          'Check that the file or element exists',
          'Verify the path or selector is correct',
          'Restart the application to reload tools',
          'Check the browser console for details'
        ],
        timestamp
      }
    }
    
    if (msg.includes('validation') || msg.includes('invalid')) {
      return {
        id,
        toolName,
        code: 'VALIDATION',
        message: `Invalid input for tool "${toolName}": ${error.message}`,
        recoveryActions: [
          'Check the input parameters are correct',
          'Try with different arguments',
          'Review the error message for hints'
        ],
        timestamp
      }
    }
    
    // Generic execution error
    return {
      id,
      toolName,
      code: 'EXECUTION',
      message: `Tool "${toolName}" failed: ${error.message}`,
      recoveryActions: [
        'Retry the operation',
        'Try a different approach',
        'Check the browser console for more details'
      ],
      timestamp
    }
  }
  
  // Unknown error type
  return {
    id,
    toolName,
    code: 'UNKNOWN',
    message: `Tool "${toolName}" encountered an unexpected error: ${String(error)}`,
    recoveryActions: [
      'Retry the operation',
      'Try reloading the page',
      'Check the browser console for details'
    ],
    timestamp
  }
}

/**
 * Log a tool error for debugging and analytics
 */
export function logToolError(
  error: ToolError,
  context: { turnId?: string; args?: unknown }
): void {
  const logEntry = {
    timestamp: new Date(error.timestamp).toISOString(),
    tool: error.toolName,
    code: error.code,
    message: error.message,
    turnId: context.turnId,
    inputArgs: context.args
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[ToolError]', logEntry)
  }
  
  // Could send to analytics/monitoring service here
  // Example: Sentry.captureException(error, { 
  //   tags: { tool: error.toolName, code: error.code }
  // })
  
  // Store in window for inspection
  if (typeof window !== 'undefined') {
    (window as any).__toolErrors ??= []
    ;(window as any).__toolErrors.push(logEntry)
    // Keep last 50 errors
    if ((window as any).__toolErrors.length > 50) {
      (window as any).__toolErrors.shift()
    }
  }
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverable(error: ToolError): boolean {
  // Timeout and execution errors are usually recoverable
  return error.code === 'TIMEOUT' || error.code === 'EXECUTION'
}

/**
 * Get the most helpful recovery action for an error
 */
export function getPrimaryRecoveryAction(error: ToolError): string {
  if (error.recoveryActions.length === 0) {
    return 'Try again'
  }
  return error.recoveryActions[0]
}

/**
 * Format error for user display
 */
export function formatErrorForDisplay(error: ToolError): {
  title: string
  description: string
  actions: string[]
} {
  const titles: Record<ToolErrorCode, string> = {
    'TIMEOUT': '⏱️ Tool Timeout',
    'NOT_FOUND': '🔍 Not Found',
    'VALIDATION': '⚠️ Invalid Input',
    'EXECUTION': '❌ Tool Failed',
    'UNKNOWN': '⚠️ Unknown Error'
  }
  
  return {
    title: titles[error.code],
    description: error.message,
    actions: error.recoveryActions
  }
}
