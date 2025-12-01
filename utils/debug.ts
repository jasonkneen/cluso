/**
 * Debug logging utility - disabled in production builds
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

type LogLevel = 'log' | 'warn' | 'error' | 'info'

interface DebugLogger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
}

function createLogger(prefix: string): DebugLogger {
  const createMethod = (level: LogLevel) => (...args: unknown[]) => {
    if (isDev) {
      console[level](`[${prefix}]`, ...args)
    }
  }

  return {
    log: createMethod('log'),
    warn: createMethod('warn'),
    error: (...args: unknown[]) => {
      // Always log errors, even in production
      console.error(`[${prefix}]`, ...args)
    },
    info: createMethod('info'),
  }
}

// Pre-configured loggers for different modules
export const debugLog = {
  ai: createLogger('AI'),
  aiSdk: createLogger('AI SDK'),
  exec: createLogger('Exec'),
  inspector: createLogger('Inspector'),
  sourcePatch: createLogger('Source Patch'),
  tabData: createLogger('TabData'),
  fileBrowser: createLogger('FileBrowser'),
  instantUI: createLogger('Instant UI'),
  domApproval: createLogger('DOM Approval'),
  liveGemini: createLogger('useLiveGemini'),
  aiChat: createLogger('useAIChatV2'),
  codingAgent: createLogger('Coding Agent'),
  webview: createLogger('Webview'),
  input: createLogger('Input'),
  preview: createLogger('Preview'),
  mcp: createLogger('MCP'),
  general: createLogger('App'),
}

// Simple one-off debug log (for console.log replacements without prefix)
export function debug(...args: unknown[]): void {
  if (isDev) {
    console.log(...args)
  }
}

/**
 * Wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds
 * @param operation Name of the operation for error messages
 * @returns The promise result or throws a TimeoutError
 */
export class TimeoutError extends Error {
  constructor(operation: string, ms: number) {
    super(`Operation "${operation}" timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, ms))
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}

// Default timeout values for different operation types
export const TIMEOUTS = {
  TOOL_CALL: 30000,      // 30 seconds for tool calls
  FILE_READ: 10000,      // 10 seconds for file reads
  FILE_LIST: 10000,      // 10 seconds for directory listings
  API_CALL: 60000,       // 60 seconds for API calls
  QUICK: 5000,           // 5 seconds for quick operations
} as const
