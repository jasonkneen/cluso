/**
 * MCP Server for mgrep-local
 *
 * Provides semantic search capabilities via the Model Context Protocol.
 * Can be used standalone with Claude Code or other MCP-compatible tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { Embedder } from '../core/Embedder'
import { VectorStore } from '../core/VectorStore'
import { Chunker } from '../core/Chunker'
import { Indexer } from '../core/Indexer'
import { Searcher } from '../core/Searcher'

import { ALL_TOOLS } from './tools'
import { MCP_TOOLS } from './types'
import type {
  McpServerConfig,
  SemanticSearchInput,
  SemanticSearchOutput,
  IndexStatusOutput,
} from './types'

export class MgrepMcpServer {
  private server: Server
  private config: McpServerConfig

  private embedder: Embedder | null = null
  private vectorStore: VectorStore | null = null
  private chunker: Chunker | null = null
  private indexer: Indexer | null = null
  private searcher: Searcher | null = null

  private ready = false

  constructor(config: McpServerConfig = {}) {
    this.config = config

    this.server = new Server(
      {
        name: 'mgrep-local',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_TOOLS,
    }))

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case MCP_TOOLS.SEMANTIC_SEARCH:
            return await this.handleSemanticSearch(args as unknown as SemanticSearchInput)

          case MCP_TOOLS.INDEX_STATUS:
            return await this.handleIndexStatus()

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  /**
   * Initialize the search infrastructure
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return
    }

    this.log('Initializing mgrep-local MCP server...')

    // Initialize components
    this.embedder = new Embedder({
      cacheDir: this.config.modelCacheDir,
      verbose: this.config.verbose,
    })
    await this.embedder.initialize()

    this.vectorStore = new VectorStore({
      dbPath: this.config.dbPath,
    })
    await this.vectorStore.initialize()

    this.chunker = new Chunker()

    this.indexer = new Indexer({
      embedder: this.embedder,
      vectorStore: this.vectorStore,
      chunker: this.chunker,
    })

    this.searcher = new Searcher(this.embedder, this.vectorStore)

    this.ready = true
    this.log('mgrep-local MCP server ready')
  }

  /**
   * Handle semantic_search tool call
   */
  private async handleSemanticSearch(
    input: SemanticSearchInput
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureReady()

    const results = await this.searcher!.hybridSearch(input.query, {
      limit: input.limit ?? 10,
      threshold: input.threshold ?? 0.3,
      returnContext: true,
    })

    const output: SemanticSearchOutput = {
      results,
      total: results.length,
    }

    // Format results for readability
    const formatted = results.map((r, i) => {
      const lines = `L${r.metadata.startLine}-${r.metadata.endLine}`
      const fn = r.metadata.functionName ? ` (${r.metadata.functionName})` : ''
      return (
        `[${i + 1}] ${r.filePath}:${lines}${fn} (${(r.similarity * 100).toFixed(1)}%)\n` +
        '```' +
        r.metadata.language +
        '\n' +
        r.content +
        '\n```'
      )
    })

    const text =
      results.length > 0
        ? `Found ${results.length} results:\n\n${formatted.join('\n\n')}`
        : 'No results found for your query.'

    return {
      content: [{ type: 'text', text }],
    }
  }

  /**
   * Handle index_status tool call
   */
  private async handleIndexStatus(): Promise<{
    content: Array<{ type: string; text: string }>
  }> {
    await this.ensureReady()

    const stats = await this.vectorStore!.getStats()

    const output: IndexStatusOutput = {
      ready: this.ready,
      stats,
      timestamp: new Date().toISOString(),
    }

    const text = [
      '## Index Status',
      '',
      `- **Ready**: ${output.ready ? 'Yes' : 'No'}`,
      `- **Total Files**: ${stats.totalFiles}`,
      `- **Total Chunks**: ${stats.totalChunks}`,
      `- **Database Size**: ${this.formatBytes(stats.databaseSize)}`,
      `- **Last Indexed**: ${stats.lastIndexedAt?.toISOString() ?? 'Never'}`,
      '',
      `_Checked at: ${output.timestamp}_`,
    ].join('\n')

    return {
      content: [{ type: 'text', text }],
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    await this.initialize()

    const transport = new StdioServerTransport()
    await this.server.connect(transport)

    this.log('mgrep-local MCP server connected via stdio')
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.embedder) {
      await this.embedder.dispose()
      this.embedder = null
    }

    if (this.vectorStore) {
      await this.vectorStore.dispose()
      this.vectorStore = null
    }

    this.indexer = null
    this.searcher = null
    this.chunker = null
    this.ready = false
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async ensureReady(): Promise<void> {
    if (!this.ready) {
      await this.initialize()
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private log(...args: unknown[]): void {
    if (this.config.verbose) {
      // Use stderr for logging to not interfere with MCP protocol
      console.error('[mgrep-local]', ...args)
    }
  }
}
