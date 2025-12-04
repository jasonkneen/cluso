/**
 * MCP Tool Definitions for mgrep-local
 *
 * Defines the tools exposed by the MCP server.
 */

import { MCP_TOOLS } from './types'

/**
 * Tool definition type (matches MCP SDK)
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      default?: unknown
    }>
    required?: string[]
  }
}

/**
 * Semantic search tool - search codebase by meaning
 */
export const SEMANTIC_SEARCH_TOOL: ToolDefinition = {
  name: MCP_TOOLS.SEMANTIC_SEARCH,
  description:
    'Search the codebase semantically by meaning and intent. ' +
    'Unlike grep, this understands what you mean, not just keywords. ' +
    'Returns code snippets with similarity scores.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language description of what to find. ' +
          'Example: "authentication handler for JWT tokens"',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        default: 10,
      },
      threshold: {
        type: 'number',
        description:
          'Minimum similarity score 0-1 (default: 0.3). ' +
          'Higher values return fewer but more relevant results.',
        default: 0.3,
      },
    },
    required: ['query'],
  },
}

/**
 * Index status tool - get indexing statistics
 */
export const INDEX_STATUS_TOOL: ToolDefinition = {
  name: MCP_TOOLS.INDEX_STATUS,
  description:
    'Get the current status of the semantic index. ' +
    'Shows total files, chunks, database size, and last indexing time.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

/**
 * All tools exported by the MCP server
 */
export const ALL_TOOLS: ToolDefinition[] = [
  SEMANTIC_SEARCH_TOOL,
  INDEX_STATUS_TOOL,
]
