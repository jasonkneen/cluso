/**
 * MCP server exports for mgrep-local
 */

export { MgrepMcpServer } from './server.js'
export { ALL_TOOLS, SEMANTIC_SEARCH_TOOL, INDEX_STATUS_TOOL } from './tools.js'

export type {
  McpServerConfig,
  SemanticSearchInput,
  SemanticSearchOutput,
  IndexStatusInput,
  IndexStatusOutput,
} from './types.js'

export { MCP_TOOLS } from './types.js'
