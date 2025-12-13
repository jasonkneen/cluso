/**
 * MCP (Model Context Protocol) Types and Interfaces
 * Extracted from ai-cluso/types/mcp.ts for shared use
 */

/**
 * Transport type for MCP server connections
 * - stdio: Local process communication via stdin/stdout (requires Electron)
 * - sse: Server-Sent Events over HTTP/HTTPS
 */
export type MCPTransportType = 'stdio' | 'sse'

/**
 * Connection status for MCP servers
 */
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Configuration for stdio-based MCP servers (local processes)
 */
export interface MCPStdioConfig {
  type: 'stdio'
  /** Command to run (e.g., 'node', 'python', 'npx') */
  command: string
  /** Arguments to pass to the command */
  args?: string[]
  /** Environment variables for the process */
  env?: Record<string, string>
  /** Working directory for the process */
  cwd?: string
}

/**
 * Configuration for SSE-based MCP servers (HTTP/HTTPS endpoints)
 */
export interface MCPSSEConfig {
  type: 'sse'
  /** URL of the SSE endpoint */
  url: string
  /** Optional headers for authentication or other purposes */
  headers?: Record<string, string>
}

/**
 * Union type for MCP transport configuration
 */
export type MCPTransportConfig = MCPStdioConfig | MCPSSEConfig

/**
 * MCP Tool parameter schema (JSON Schema format)
 */
export interface MCPToolParameter {
  type: string
  description?: string
  enum?: string[]
  items?: MCPToolParameter
  properties?: Record<string, MCPToolParameter>
  required?: string[]
  default?: unknown
}

/**
 * MCP Tool definition as discovered from a server
 */
export interface MCPTool {
  /** Unique name of the tool */
  name: string
  /** Human-readable description */
  description?: string
  /** JSON Schema for the tool's input parameters */
  inputSchema: {
    type: 'object'
    properties?: Record<string, MCPToolParameter>
    required?: string[]
    additionalProperties?: boolean
  }
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  /** URI identifying the resource */
  uri: string
  /** Human-readable name */
  name?: string
  /** Description of the resource */
  description?: string
  /** MIME type of the resource */
  mimeType?: string
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  /** Name of the prompt */
  name: string
  /** Description of the prompt */
  description?: string
  /** Arguments the prompt accepts */
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

/**
 * MCP Server capabilities as reported by the server
 */
export interface MCPServerCapabilities {
  /** Available tools */
  tools?: boolean | { listChanged?: boolean }
  /** Available resources */
  resources?: boolean | { subscribe?: boolean; listChanged?: boolean }
  /** Available prompts */
  prompts?: boolean | { listChanged?: boolean }
  /** Logging support */
  logging?: boolean
}

/**
 * MCP Server configuration stored in settings
 */
export interface MCPServerConfig {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Transport configuration */
  transport: MCPTransportConfig
  /** Whether the server is enabled */
  enabled: boolean
  /** Optional timeout in milliseconds */
  timeout?: number
  /** Server-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Runtime state of an MCP server connection
 */
export interface MCPServerState {
  /** Server configuration */
  config: MCPServerConfig
  /** Current connection status */
  status: MCPConnectionStatus
  /** Error message if status is 'error' */
  error?: string
  /** Server capabilities once connected */
  capabilities?: MCPServerCapabilities
  /** Discovered tools */
  tools?: MCPTool[]
  /** Discovered resources */
  resources?: MCPResource[]
  /** Discovered prompts */
  prompts?: MCPPrompt[]
}

/**
 * MCP Tool call request
 */
export interface MCPToolCall {
  /** Tool name */
  name: string
  /** Tool arguments */
  arguments: Record<string, unknown>
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  /** Whether the call succeeded */
  isError: boolean
  /** Result content */
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
}
