/**
 * MCP Auto-Discovery
 *
 * Automatically discovers MCP server configurations from:
 * 1. Project-level .mcp.json files
 * 2. Global ~/.claude/mcp.json configuration
 *
 * Supports Claude Code's MCP configuration format.
 */

import type { MCPServerConfig } from '../types/mcp'

/**
 * Source of the discovered MCP configuration
 */
export type MCPDiscoverySource = 'project' | 'global' | 'manual'

/**
 * Result of discovering an MCP server
 */
export interface MCPDiscoveryResult {
  source: MCPDiscoverySource
  config: DiscoveredMCPServerConfig
}

/**
 * Claude Code's MCP server configuration format
 */
interface ClaudeCodeMCPServer {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

/**
 * Claude Code's .mcp.json file format
 */
interface ClaudeCodeMCPConfig {
  mcpServers?: Record<string, ClaudeCodeMCPServer>
}

/**
 * Extended MCPServerConfig with auto-connect support
 * The base type doesn't include autoConnect, so we extend it for discovery
 */
export interface DiscoveredMCPServerConfig extends MCPServerConfig {
  /** Whether to auto-connect when discovered */
  autoConnect?: boolean
}

/**
 * Convert Claude Code MCP server config to our MCPServerConfig format
 */
function convertClaudeCodeConfig(
  name: string,
  config: ClaudeCodeMCPServer,
  source: MCPDiscoverySource
): DiscoveredMCPServerConfig {
  return {
    id: `${source}_${name}`,
    name,
    transport: {
      type: 'stdio',
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      cwd: config.cwd,
    },
    enabled: true,
    autoConnect: true,
  }
}

/**
 * Discover MCP servers from a config file (Electron main process)
 */
export async function discoverFromFile(
  filePath: string,
  source: MCPDiscoverySource
): Promise<MCPDiscoveryResult[]> {
  if (!window.electronAPI?.files) {
    return []
  }

  try {
    // Check if file exists
    const exists = await window.electronAPI.files.exists(filePath)
    if (!exists) {
      return []
    }

    // Read and parse the config file
    const content = await window.electronAPI.files.readFile(filePath)
    if (!content || typeof content !== 'string') {
      return []
    }

    const config: ClaudeCodeMCPConfig = JSON.parse(content)
    const results: MCPDiscoveryResult[] = []

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        results.push({
          source,
          config: convertClaudeCodeConfig(name, serverConfig, source),
        })
      }
    }

    return results
  } catch (err) {
    console.warn(`[mcpDiscovery] Failed to read ${filePath}:`, err)
    return []
  }
}

/**
 * Discover MCP servers from project directory
 */
export async function discoverProjectServers(
  projectPath: string
): Promise<MCPDiscoveryResult[]> {
  // Check for .mcp.json in project root
  const mcpJsonPath = `${projectPath}/.mcp.json`
  return discoverFromFile(mcpJsonPath, 'project')
}

/**
 * Discover MCP servers from global Claude config
 */
export async function discoverGlobalServers(): Promise<MCPDiscoveryResult[]> {
  // Get home directory from environment
  // In Electron, we can use process.env.HOME (macOS/Linux) or USERPROFILE (Windows)
  let homePath = ''

  if (typeof process !== 'undefined' && process.env) {
    homePath = process.env.HOME || process.env.USERPROFILE || ''
  }

  if (!homePath) {
    // Try to get it from the Electron API
    try {
      if (window.electronAPI?.files?.getCwd) {
        const cwd = await window.electronAPI.files.getCwd()
        // Parse home from cwd - usually /Users/xxx/something
        const match = cwd?.match(/^(\/Users\/[^/]+|\/home\/[^/]+|C:\\Users\\[^\\]+)/)
        if (match) {
          homePath = match[1]
        }
      }
    } catch {
      return []
    }
  }

  if (!homePath) {
    return []
  }

  // Check for ~/.claude/mcp.json
  const globalConfigPath = `${homePath}/.claude/mcp.json`
  return discoverFromFile(globalConfigPath, 'global')
}

/**
 * Discover all MCP servers from project and global configs
 */
export async function discoverMCPServers(
  projectPath?: string
): Promise<MCPDiscoveryResult[]> {
  const results: MCPDiscoveryResult[] = []

  // Discover from global config first
  const globalServers = await discoverGlobalServers()
  results.push(...globalServers)

  // Discover from project config (overrides global)
  if (projectPath) {
    const projectServers = await discoverProjectServers(projectPath)
    results.push(...projectServers)
  }

  return results
}

/**
 * Merge discovered servers with manual configs
 * Manual configs take precedence over discovered ones
 */
export function mergeServerConfigs(
  manual: MCPServerConfig[],
  discovered: MCPDiscoveryResult[]
): MCPServerConfig[] {
  const configs = new Map<string, MCPServerConfig>()

  // Add discovered configs first
  for (const result of discovered) {
    // Use the server name as key for deduplication
    configs.set(result.config.name, result.config)
  }

  // Override with manual configs
  for (const config of manual) {
    configs.set(config.name, config)
  }

  return Array.from(configs.values())
}

/**
 * Check if MCP discovery is available (requires Electron)
 */
export function isDiscoveryAvailable(): boolean {
  return !!(window.electronAPI?.files?.exists && window.electronAPI?.files?.readFile)
}
