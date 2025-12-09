/**
 * Shared API types for Cluso server
 */

/** Generic result type for all API operations */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

/** Standard API response wrapper */
export interface APIResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
  timestamp: string
}

/** Git operation types */
export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  deleted: string[]
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
}

/** File operation types */
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface FileContent {
  path: string
  content: string
  encoding: 'utf-8' | 'base64'
}

export interface SearchResult {
  file: string
  line: number
  column: number
  match: string
  context: string
}

/** OAuth types */
export interface OAuthStatus {
  isLoggedIn: boolean
  mode: 'max' | 'console' | null
  expiresAt: string | null
}

export interface OAuthStartResult {
  authUrl: string
  verifier: string
  state: string
}

/** WebSocket event types */
export interface WSMessage {
  id?: string
  type: 'subscribe' | 'unsubscribe' | 'request' | 'event' | 'response'
  channel?: string
  handler?: string
  data?: unknown
}

export interface WSEvent {
  type: 'event'
  channel: string
  data: unknown
  timestamp: string
}

/** Server configuration */
export interface ServerConfig {
  port: number
  host: string
  cwd: string
  apiOnly: boolean
  apiKey?: string
}

/** Backup types */
export interface Backup {
  id: string
  description: string
  createdAt: string
  files: string[]
}

/** MCP types */
export interface MCPServer {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  tools: MCPTool[]
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** LSP types */
export interface LSPDiagnostic {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  source: string
}

export interface LSPHoverResult {
  contents: string
  range?: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

/** Validation types */
export interface ValidationResult {
  type: 'lint' | 'typecheck' | 'format'
  passed: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  file: string
  line: number
  column: number
  message: string
  rule?: string
}

/** Helper to create success response */
export function success<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  }
}

/** Helper to create error response */
export function error(message: string, code?: string): APIResponse<null> {
  return {
    success: false,
    data: null,
    error: message,
    timestamp: new Date().toISOString(),
  }
}
