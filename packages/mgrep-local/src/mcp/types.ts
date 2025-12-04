/**
 * MCP-specific types for mgrep-local
 */

import type { SearchResult, IndexStats } from '../core/types'

/**
 * Tool names exposed by the MCP server
 */
export const MCP_TOOLS = {
  SEMANTIC_SEARCH: 'semantic_search',
  INDEX_STATUS: 'index_status',
} as const

/**
 * Input schema for semantic_search tool
 */
export interface SemanticSearchInput {
  query: string
  limit?: number
  threshold?: number
}

/**
 * Output for semantic_search tool
 */
export interface SemanticSearchOutput {
  results: SearchResult[]
  total: number
}

/**
 * Input schema for index_status tool
 */
export interface IndexStatusInput {}

/**
 * Output for index_status tool
 */
export interface IndexStatusOutput {
  ready: boolean
  stats: IndexStats | null
  timestamp: string
}

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  /** Working directory for indexing */
  workspaceDir?: string

  /** Path to the SQLite database */
  dbPath?: string

  /** Directory to cache embedding models */
  modelCacheDir?: string

  /** Enable verbose logging */
  verbose?: boolean
}
