/**
 * MCP server exports for mgrep-local
 */

export { MgrepMcpServer } from './server'
export { ALL_TOOLS, SEMANTIC_SEARCH_TOOL, INDEX_STATUS_TOOL } from './tools'

export type {
  McpServerConfig,
  SemanticSearchInput,
  SemanticSearchOutput,
  IndexStatusInput,
  IndexStatusOutput,
} from './types'

export { MCP_TOOLS } from './types'
