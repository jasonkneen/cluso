import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult,
  MCPEvent,
  MCPConnectionStatus,
  MCPServerCapabilities,
  SmartMCPContext,
  ScoredMCPTool,
  ToolUsageStats,
  IndexHealthStatus,
} from '../types/mcp'
import { jsonSchemaToZod as sharedJsonSchemaToZod } from '../utils/zodSchema'
import {
  discoverMCPServers,
  mergeServerConfigs,
  isDiscoveryAvailable,
  MCPDiscoveryResult,
  DiscoveredMCPServerConfig,
} from '../utils/mcpDiscovery'

/**
 * Hook options
 */
export interface UseMCPOptions {
  /** Initial server configurations */
  initialServers?: MCPServerConfig[]
  /** Auto-connect enabled servers on mount */
  autoConnect?: boolean
  /** Enable auto-discovery from .mcp.json files */
  autoDiscover?: boolean
  /** Project path for auto-discovery */
  projectPath?: string
  /** Event callback */
  onEvent?: (event: MCPEvent) => void
  /** Error callback */
  onError?: (error: Error, serverId?: string) => void
  /** Callback when servers are discovered */
  onServersDiscovered?: (results: MCPDiscoveryResult[]) => void
}

/**
 * Hook return type
 */
export interface UseMCPReturn {
  /** All server states keyed by server ID */
  servers: Record<string, MCPServerState>
  /** All tools from all connected servers */
  allTools: Array<MCPTool & { serverId: string }>
  /** Connect to a server */
  connect: (config: MCPServerConfig) => Promise<boolean>
  /** Disconnect from a server */
  disconnect: (serverId: string) => Promise<void>
  /** Add a new server configuration */
  addServer: (config: MCPServerConfig) => void
  /** Remove a server configuration */
  removeServer: (serverId: string) => Promise<void>
  /** Update a server configuration */
  updateServer: (serverId: string, updates: Partial<MCPServerConfig>) => void
  /** Call a tool on a server */
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult>
  /** Refresh tools from a server */
  refreshTools: (serverId: string) => Promise<MCPTool[]>
  /** Re-run MCP auto-discovery */
  rediscover: () => Promise<void>
  // Smart MCP features
  /** Get context-aware tool suggestions */
  getRelevantTools: (context: SmartMCPContext, limit?: number) => Promise<ScoredMCPTool[]>
  /** Track tool usage for analytics */
  trackToolUsage: (serverId: string, toolName: string, executionTime: number, success: boolean) => Promise<void>
  /** Get tool usage statistics */
  getToolUsageStats: (serverId: string, toolName: string) => Promise<ToolUsageStats | null>
  /** Get index health status */
  getIndexHealth: (projectPath?: string) => Promise<IndexHealthStatus>
  /** Check if any server is connecting */
  isConnecting: boolean
  /** Check if we're in Electron environment with MCP support */
  isAvailable: boolean
  /** Check if auto-discovery is available */
  isDiscoveryAvailable: boolean
}

/**
 * Default empty server state
 */
const createEmptyState = (config: MCPServerConfig): MCPServerState => ({
  config,
  status: 'disconnected',
  tools: [],
  resources: [],
  prompts: [],
})

/**
 * Hook for managing MCP server connections
 */
export function useMCP(options: UseMCPOptions = {}): UseMCPReturn {
  const {
    initialServers = [],
    autoConnect = false,
    autoDiscover = false,
    projectPath,
    onEvent,
    onError,
    onServersDiscovered,
  } = options

  // Server states
  const [servers, setServers] = useState<Record<string, MCPServerState>>(() => {
    const initial: Record<string, MCPServerState> = {}
    for (const config of initialServers) {
      initial[config.id] = createEmptyState(config)
    }
    return initial
  })

  // Track if discovery has been run
  const discoveryRanRef = useRef(false)

  // Track if we're in Electron with MCP support
  const [isAvailable, setIsAvailable] = useState(false)

  // Event listener cleanup ref
  const eventCleanupRef = useRef<(() => void) | null>(null)

  // Check for Electron MCP API availability
  useEffect(() => {
    setIsAvailable(!!window.electronAPI?.mcp)
  }, [])

  // Subscribe to MCP events from Electron
  useEffect(() => {
    if (!window.electronAPI?.mcp) return

    const cleanup = window.electronAPI.mcp.onEvent((event: MCPEvent) => {
      // Update server state based on event
      setServers(prev => {
        const server = prev[event.serverId]
        if (!server) return prev

        switch (event.type) {
          case 'connecting':
            return {
              ...prev,
              [event.serverId]: { ...server, status: 'connecting' as MCPConnectionStatus },
            }
          case 'connected':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                status: 'connected' as MCPConnectionStatus,
                error: undefined,
                lastConnected: event.timestamp,
              },
            }
          case 'disconnected':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                status: 'disconnected' as MCPConnectionStatus,
                tools: [],
                resources: [],
                prompts: [],
              },
            }
          case 'error':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                status: 'error' as MCPConnectionStatus,
                error: String(event.data),
              },
            }
          case 'tools-changed':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                tools: event.data as MCPTool[],
              },
            }
          case 'resources-changed':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                resources: event.data as MCPResource[],
              },
            }
          case 'prompts-changed':
            return {
              ...prev,
              [event.serverId]: {
                ...server,
                prompts: event.data as MCPPrompt[],
              },
            }
          default:
            return prev
        }
      })

      // Forward event to callback
      onEvent?.(event)
    })

    eventCleanupRef.current = cleanup
    return () => {
      cleanup()
      eventCleanupRef.current = null
    }
  }, [onEvent])

  // Auto-connect enabled servers
  useEffect(() => {
    if (!autoConnect || !isAvailable) return

    for (const config of initialServers) {
      if (config.enabled) {
        connect(config).catch(err => {
          onError?.(err instanceof Error ? err : new Error(String(err)), config.id)
        })
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable])

  /**
   * Run MCP server auto-discovery
   */
  const runDiscovery = useCallback(async () => {
    if (!autoDiscover || !isDiscoveryAvailable()) return

    try {
      const discovered = await discoverMCPServers(projectPath)
      if (discovered.length > 0) {
        // Notify about discovered servers
        onServersDiscovered?.(discovered)

        // Merge with existing servers and update state
        const merged = mergeServerConfigs(initialServers, discovered)
        setServers(prev => {
          const updated = { ...prev }
          for (const config of merged) {
            if (!updated[config.id]) {
              updated[config.id] = createEmptyState(config)
            }
          }
          return updated
        })

        // Auto-connect discovered servers if enabled
        if (autoConnect) {
          for (const config of merged) {
            const discoveredConfig = config as DiscoveredMCPServerConfig
            if (discoveredConfig.autoConnect && config.enabled) {
              connect(config).catch(err => {
                onError?.(err instanceof Error ? err : new Error(String(err)), config.id)
              })
            }
          }
        }
      }
    } catch (err) {
      console.warn('[useMCP] Auto-discovery failed:', err)
    }
  }, [autoDiscover, projectPath, initialServers, autoConnect, onServersDiscovered, onError])

  // Run auto-discovery on mount or when project path changes
  useEffect(() => {
    if (!autoDiscover || !isAvailable || discoveryRanRef.current) return
    discoveryRanRef.current = true
    runDiscovery()
  }, [autoDiscover, isAvailable, projectPath, runDiscovery])

  /**
   * Re-run MCP discovery manually
   */
  const rediscover = useCallback(async () => {
    discoveryRanRef.current = false
    await runDiscovery()
  }, [runDiscovery])

  /**
   * Connect to an MCP server
   */
  const connect = useCallback(async (config: MCPServerConfig): Promise<boolean> => {
    if (!window.electronAPI?.mcp) {
      onError?.(new Error('MCP is only available in Electron environment'), config.id)
      return false
    }

    // Update state to connecting
    setServers(prev => ({
      ...prev,
      [config.id]: {
        ...(prev[config.id] || createEmptyState(config)),
        config,
        status: 'connecting',
        error: undefined,
      },
    }))

    try {
      const result = await window.electronAPI.mcp.connect(config)

      if (!result.success) {
        setServers(prev => ({
          ...prev,
          [config.id]: {
            ...prev[config.id],
            status: 'error',
            error: result.error || 'Connection failed',
          },
        }))
        onError?.(new Error(result.error || 'Connection failed'), config.id)
        return false
      }

      // Fetch tools after successful connection
      const toolsResult = await window.electronAPI.mcp.listTools(config.id)
      const resourcesResult = await window.electronAPI.mcp.listResources(config.id)
      const promptsResult = await window.electronAPI.mcp.listPrompts(config.id)

      setServers(prev => ({
        ...prev,
        [config.id]: {
          ...prev[config.id],
          status: 'connected',
          capabilities: result.capabilities,
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || [],
          lastConnected: Date.now(),
        },
      }))

      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setServers(prev => ({
        ...prev,
        [config.id]: {
          ...prev[config.id],
          status: 'error',
          error: error.message,
        },
      }))
      onError?.(error, config.id)
      return false
    }
  }, [onError])

  /**
   * Disconnect from an MCP server
   */
  const disconnect = useCallback(async (serverId: string): Promise<void> => {
    if (!window.electronAPI?.mcp) return

    try {
      await window.electronAPI.mcp.disconnect(serverId)
      setServers(prev => ({
        ...prev,
        [serverId]: {
          ...prev[serverId],
          status: 'disconnected',
          tools: [],
          resources: [],
          prompts: [],
        },
      }))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error, serverId)
    }
  }, [onError])

  /**
   * Add a new server configuration
   */
  const addServer = useCallback((config: MCPServerConfig): void => {
    setServers(prev => ({
      ...prev,
      [config.id]: createEmptyState(config),
    }))
  }, [])

  /**
   * Remove a server configuration
   */
  const removeServer = useCallback(async (serverId: string): Promise<void> => {
    // Disconnect first if connected
    const server = servers[serverId]
    if (server?.status === 'connected' || server?.status === 'connecting') {
      await disconnect(serverId)
    }

    setServers(prev => {
      const { [serverId]: _, ...rest } = prev
      return rest
    })
  }, [servers, disconnect])

  /**
   * Update a server configuration
   */
  const updateServer = useCallback((serverId: string, updates: Partial<MCPServerConfig>): void => {
    setServers(prev => {
      const server = prev[serverId]
      if (!server) return prev

      return {
        ...prev,
        [serverId]: {
          ...server,
          config: { ...server.config, ...updates },
        },
      }
    })
  }, [])

  /**
   * Call a tool on a connected server
   */
  const callTool = useCallback(async (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> => {
    if (!window.electronAPI?.mcp) {
      return { success: false, error: 'MCP is only available in Electron environment' }
    }

    const server = servers[serverId]
    if (!server || server.status !== 'connected') {
      return { success: false, error: 'Server not connected' }
    }

    try {
      const result = await window.electronAPI.mcp.callTool({
        serverId,
        toolName,
        arguments: args,
      })
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error, serverId)
      return { success: false, error: error.message }
    }
  }, [servers, onError])

  /**
   * Refresh tools from a server
   */
  const refreshTools = useCallback(async (serverId: string): Promise<MCPTool[]> => {
    if (!window.electronAPI?.mcp) return []

    const server = servers[serverId]
    if (!server || server.status !== 'connected') return []

    try {
      const result = await window.electronAPI.mcp.listTools(serverId)
      const tools = result.tools || []

      setServers(prev => ({
        ...prev,
        [serverId]: {
          ...prev[serverId],
          tools,
        },
      }))

      return tools
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error, serverId)
      return []
    }
  }, [servers, onError])

  /**
   * Get context-aware tool suggestions
   */
  const getRelevantTools = useCallback(async (
    context: SmartMCPContext,
    limit: number = 10
  ): Promise<ScoredMCPTool[]> => {
    if (!window.electronAPI?.mcp?.scoreToolRelevance) {
      console.warn('[useMCP] Smart MCP features not available')
      return []
    }

    try {
      // Compute allTools here to avoid temporal dead zone
      const relevantTools = Object.entries(servers).flatMap(([serverId, server]) =>
        server.status === 'connected'
          ? server.tools.map(tool => ({ ...tool, serverId }))
          : []
      )
      const tools = relevantTools.filter(t => t.serverId === relevantTools[0]?.serverId)
      const scored = await window.electronAPI.mcp.scoreToolRelevance(tools, context)
      return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit)
    } catch (err) {
      console.error('[useMCP] Failed to get relevant tools:', err)
      return []
    }
  }, [servers])

  /**
   * Track tool usage for analytics
   */
  const trackToolUsage = useCallback(async (
    serverId: string,
    toolName: string,
    executionTime: number,
    success: boolean
  ): Promise<void> => {
    if (!window.electronAPI?.mcp?.trackToolUsage) return

    try {
      await window.electronAPI.mcp.trackToolUsage(serverId, toolName, executionTime, success)
    } catch (err) {
      console.error('[useMCP] Failed to track tool usage:', err)
    }
  }, [])

  /**
   * Get tool usage statistics
   */
  const getToolUsageStats = useCallback(async (
    serverId: string,
    toolName: string
  ): Promise<ToolUsageStats | null> => {
    if (!window.electronAPI?.mcp?.getToolUsageStats) return null

    try {
      return await window.electronAPI.mcp.getToolUsageStats(serverId, toolName)
    } catch (err) {
      console.error('[useMCP] Failed to get tool usage stats:', err)
      return null
    }
  }, [])

  /**
   * Get index health status
   */
  const getIndexHealth = useCallback(async (projectPath?: string): Promise<IndexHealthStatus> => {
    if (!window.electronAPI?.mcp?.getIndexHealth) {
      return {
        ready: false,
        indexing: false,
        totalChunks: 0,
        totalFiles: 0,
        healthPercentage: 0,
      }
    }

    try {
      return await window.electronAPI.mcp.getIndexHealth(projectPath)
    } catch (err) {
      console.error('[useMCP] Failed to get index health:', err)
      return {
        ready: false,
        indexing: false,
        totalChunks: 0,
        totalFiles: 0,
        healthPercentage: 0,
      }
    }
  }, [])

  // Compute aggregate values
  const allTools = Object.entries(servers).flatMap(([serverId, server]) =>
    server.status === 'connected'
      ? server.tools.map(tool => ({ ...tool, serverId }))
      : []
  )

  const isConnecting = Object.values(servers).some(s => s.status === 'connecting')

  return {
    servers,
    allTools,
    connect,
    disconnect,
    addServer,
    removeServer,
    updateServer,
    callTool,
    refreshTools,
    rediscover,
    // Smart MCP features
    getRelevantTools,
    trackToolUsage,
    getToolUsageStats,
    getIndexHealth,
    isConnecting,
    isAvailable,
    isDiscoveryAvailable: isDiscoveryAvailable(),
  }
}

/**
 * Convert MCP tools to AI SDK compatible format
 */
export function mcpToolsToAISDK(
  tools: Array<MCPTool & { serverId: string }>,
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult>
) {
  // Import zod dynamically to avoid module resolution issues
  const { z } = require('zod')

  const result: Record<string, {
    description: string
    parameters: unknown
    execute?: (args: unknown) => Promise<unknown>
  }> = {}

  for (const tool of tools) {
    // Convert JSON Schema to Zod schema using shared utility
    const parameters = sharedJsonSchemaToZod(tool.inputSchema, z)

    // Create unique tool name with server prefix to avoid collisions
    const uniqueName = `mcp_${tool.serverId}_${tool.name}`

    result[uniqueName] = {
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters,
      execute: async (args: unknown) => {
        const result = await callTool(tool.serverId, tool.name, args as Record<string, unknown>)
        if (!result.success) {
          throw new Error(result.error || 'Tool call failed')
        }
        // Return the content as a string for the AI to process
        if (result.content) {
          return result.content.map(c => {
            if (c.type === 'text') return c.text
            if (c.type === 'image') return `[Image: ${c.mimeType}]`
            if (c.type === 'resource') return `[Resource: ${c.uri}]`
            return '[Unknown content]'
          }).join('\n')
        }
        return 'Tool executed successfully'
      },
    }
  }

  return result
}

// jsonSchemaToZod moved to utils/zodSchema.ts

export default useMCP
