/**
 * MCP Feature Types
 *
 * Type definitions for MCP state management hooks.
 */

import type { MCPToolDefinition } from '../../hooks/useAIChat'
import type { MCPServerConfig, MCPServerState, MCPToolResult } from '../../types/mcp'

/**
 * MCP State - the state values managed by the hook
 */
export interface MCPState {
  /** Converted MCP tools in format expected by AI SDK/useCodingAgent */
  mcpToolDefinitions: MCPToolDefinition[]
  /** Raw MCP tools from all connected servers */
  mcpTools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; serverId: string }>
  /** All server states keyed by server ID */
  mcpServers: Record<string, MCPServerState>
  /** Whether MCP is available (Electron only) */
  mcpAvailable: boolean
}

/**
 * MCP Actions - the functions to interact with MCP
 */
export interface MCPActions {
  /** Call a tool on an MCP server */
  callMCPTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult>
}
