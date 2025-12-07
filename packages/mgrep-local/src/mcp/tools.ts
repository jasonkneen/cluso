/**
 * MCP Tool Definitions for mgrep-local
 *
 * Defines the tools exposed by the MCP server.
 */

import { MCP_TOOLS } from './types.js'

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
 * Index directory tool - index all code files in a directory
 */
export const INDEX_DIRECTORY_TOOL: ToolDefinition = {
  name: MCP_TOOLS.INDEX_DIRECTORY,
  description:
    'Index all code files in a directory for semantic search. ' +
    'Recursively finds and indexes .ts, .js, .py, .rs, .go, and other code files. ' +
    'Skips node_modules, .git, dist, and other build directories. ' +
    'Use "." to index the current working directory.',
  inputSchema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description:
          'Path to the directory to index. Use "." for current directory. ' +
          'Relative paths are resolved from the workspace root.',
      },
    },
    required: ['directory'],
  },
}

/**
 * Index file tool - index a single file
 */
export const INDEX_FILE_TOOL: ToolDefinition = {
  name: MCP_TOOLS.INDEX_FILE,
  description:
    'Index a single file for semantic search. ' +
    'If content is not provided, reads from disk. ' +
    'Useful for indexing newly created files or updating modified ones.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to index',
      },
      content: {
        type: 'string',
        description:
          'Optional file content. If not provided, reads from disk. ' +
          'Providing content is useful when you have unsaved changes.',
      },
    },
    required: ['filePath'],
  },
}

/**
 * Clear index tool - remove all indexed data
 */
export const CLEAR_INDEX_TOOL: ToolDefinition = {
  name: MCP_TOOLS.CLEAR_INDEX,
  description:
    'Clear the entire semantic index. ' +
    'This removes all indexed files and chunks. ' +
    'Use this to start fresh or before re-indexing a project.',
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
  INDEX_DIRECTORY_TOOL,
  INDEX_FILE_TOOL,
  CLEAR_INDEX_TOOL,
]
