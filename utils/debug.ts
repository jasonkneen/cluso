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
