/**
 * MCP Handlers Hook
 *
 * Centralizes MCP (Model Context Protocol) state management extracted from App.tsx.
 * Handles server configuration extraction, connection management, and tool conversion.
 */

import { useMemo } from 'react'
import { useMCP } from '../../hooks/useMCP'
import type { MCPToolDefinition } from '../../hooks/useAIChat'
import type { MCPServerConfig } from '../../types/mcp'
import type { MCPServerConnection, AppSettings } from '../../components/SettingsDialog'
import type { MCPState, MCPActions } from './types'

export interface UseMCPHandlersReturn extends MCPState, MCPActions {}

/**
 * Hook for managing MCP handlers
 *
 * Extracts and centralizes MCP configuration and tool management from App.tsx.
 * Provides state and actions for MCP server connections and tool invocation.
 *
 * @param appSettings - The application settings containing connection configurations
 */
export function useMCPHandlers(appSettings: AppSettings): UseMCPHandlersReturn {
  // Extract MCP server configs from settings connections
  const mcpServerConfigs = useMemo((): MCPServerConfig[] => {
    return (appSettings.connections || [])
      .filter((conn): conn is MCPServerConnection => conn.type === 'mcp' && 'transport' in conn)
      .filter(conn => conn.enabled)
      .map(({ id, name, transport, enabled, timeout }): MCPServerConfig => ({
        id,
        name,
        transport,
        enabled,
        timeout,
      }))
  }, [appSettings.connections])

  // Initialize MCP hook for Model Context Protocol server connections
  const {
    allTools: mcpTools,
    callTool: callMCPTool,
    servers: mcpServers,
    isAvailable: mcpAvailable,
  } = useMCP({
    initialServers: mcpServerConfigs,
    autoConnect: true,
    onError: (err, serverId) => {
      console.error(`[MCP] Error${serverId ? ` on server ${serverId}` : ''}:`, err.message)
    },
  })

  // Convert MCP tools to the format expected by useCodingAgent
  // Ensure inputSchema has required 'type: object' field for Anthropic API compatibility
  const mcpToolDefinitions: MCPToolDefinition[] = useMemo(() => {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || [],
      },
      serverId: tool.serverId,
    }))
  }, [mcpTools])

  return {
    // State
    mcpToolDefinitions,
    mcpTools,
    mcpServers,
    mcpAvailable,
    // Actions
    callMCPTool,
  }
}
