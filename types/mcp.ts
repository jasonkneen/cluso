// MCP (Model Context Protocol) Types and Interfaces

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
  tools: MCPTool[]
  /** Discovered resources */
  resources: MCPResource[]
  /** Discovered prompts */
  prompts: MCPPrompt[]
  /** Last successful connection timestamp */
  lastConnected?: number
}

/**
 * Tool call request to an MCP server
 */
export interface MCPToolCall {
  /** Server ID */
  serverId: string
  /** Tool name */
  toolName: string
  /** Tool arguments */
  arguments: Record<string, unknown>
}

/**
 * Tool call result from an MCP server
 */
export interface MCPToolResult {
  /** Whether the call succeeded */
  success: boolean
  /** Result content (can be text, image, or other types) */
  content?: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  /** Error message if success is false */
  error?: string
  /** Whether this is an error response from the tool itself (not transport error) */
  isError?: boolean
}

/**
 * Events emitted by MCP connections
 */
export type MCPEventType =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'tools-changed'
  | 'resources-changed'
  | 'prompts-changed'
  | 'log'

export interface MCPEvent {
  type: MCPEventType
  serverId: string
  timestamp: number
  data?: unknown
}

/**
 * Options for creating an MCP client
 */
export interface MCPClientOptions {
  /** Timeout for operations in milliseconds */
  timeout?: number
  /** Event callback */
  onEvent?: (event: MCPEvent) => void
}

/**
 * IPC message types for Electron MCP communication
 */
export interface MCPIPCMessages {
  // Requests (renderer -> main)
  'mcp:connect': { config: MCPServerConfig }
  'mcp:disconnect': { serverId: string }
  'mcp:list-tools': { serverId: string }
  'mcp:list-resources': { serverId: string }
  'mcp:list-prompts': { serverId: string }
  'mcp:call-tool': MCPToolCall
  'mcp:read-resource': { serverId: string; uri: string }
  'mcp:get-prompt': { serverId: string; name: string; arguments?: Record<string, string> }

  // Responses (main -> renderer)
  'mcp:connect-result': { serverId: string; success: boolean; error?: string; capabilities?: MCPServerCapabilities }
  'mcp:disconnect-result': { serverId: string; success: boolean }
  'mcp:tools-result': { serverId: string; tools: MCPTool[] }
  'mcp:resources-result': { serverId: string; resources: MCPResource[] }
  'mcp:prompts-result': { serverId: string; prompts: MCPPrompt[] }
  'mcp:tool-result': MCPToolResult & { serverId: string; toolName: string }
  'mcp:resource-result': { serverId: string; uri: string; content?: unknown; error?: string }
  'mcp:prompt-result': { serverId: string; name: string; messages?: unknown[]; error?: string }
  'mcp:event': MCPEvent
}

/**
 * Electron API extension for MCP
 */
export interface ElectronMCPAPI {
  /** Connect to an MCP server */
  connect: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string; capabilities?: MCPServerCapabilities }>
  /** Disconnect from an MCP server */
  disconnect: (serverId: string) => Promise<{ success: boolean }>
  /** List tools from a connected server */
  listTools: (serverId: string) => Promise<{ tools: MCPTool[]; error?: string }>
  /** List resources from a connected server */
  listResources: (serverId: string) => Promise<{ resources: MCPResource[]; error?: string }>
  /** List prompts from a connected server */
  listPrompts: (serverId: string) => Promise<{ prompts: MCPPrompt[]; error?: string }>
  /** Call a tool on a connected server */
  callTool: (call: MCPToolCall) => Promise<MCPToolResult>
  /** Read a resource from a connected server */
  readResource: (serverId: string, uri: string) => Promise<{ content?: unknown; error?: string }>
  /** Get a prompt from a connected server */
  getPrompt: (serverId: string, name: string, args?: Record<string, string>) => Promise<{ messages?: unknown[]; error?: string }>
  /** Subscribe to MCP events */
  onEvent: (callback: (event: MCPEvent) => void) => () => void
  /** Get all connected servers' status */
  getStatus: () => Promise<Record<string, MCPServerState>>
}

/**
 * Extend the existing ElectronAPI interface
 */
declare global {
  interface Window {
    electronAPI?: {
      mcp?: ElectronMCPAPI
    } & Window['electronAPI']
  }
}
