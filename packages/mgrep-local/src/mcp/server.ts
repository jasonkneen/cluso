/**
 * MCP Server for mgrep-local
 *
 * Provides semantic search and indexing capabilities via the Model Context Protocol.
 * Can be used standalone with Claude Code or other MCP-compatible tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { resolve, join, extname, relative } from 'path'
import { readFileSync, statSync, readdirSync } from 'fs'
import { homedir } from 'os'

import { Embedder } from '../core/Embedder.js'
import { VectorStore } from '../core/VectorStore.js'
import { Chunker } from '../core/Chunker.js'
import { Indexer } from '../core/Indexer.js'
import { Searcher } from '../core/Searcher.js'

import { ALL_TOOLS } from './tools.js'
import { MCP_TOOLS } from './types.js'
import type {
  McpServerConfig,
  SemanticSearchInput,
  SemanticSearchOutput,
  IndexStatusOutput,
  IndexDirectoryInput,
  IndexDirectoryOutput,
  IndexFileInput,
  IndexFileOutput,
} from './types.js'

// Default paths
const DEFAULT_DB_DIR = join(homedir(), '.cache', 'mgrep-local', 'vectors')
const DEFAULT_MODEL_CACHE = join(homedir(), '.cache', 'mgrep-local', 'models')

// File extensions to index
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.rs',
  '.go',
  '.java', '.kt', '.kts',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.scala',
  '.clj', '.cljs', '.cljc',
  '.ex', '.exs',
  '.hs',
  '.ml', '.mli',
  '.lua',
  '.r', '.R',
  '.jl',
  '.sh', '.bash', '.zsh',
  '.sql',
  '.graphql', '.gql',
  '.vue', '.svelte',
  '.md', '.mdx',
  '.json', '.yaml', '.yml', '.toml',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm',
])

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'target',
  'vendor',
  '.cache',
  'coverage',
  '.nyc_output',
])

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

          case MCP_TOOLS.INDEX_DIRECTORY:
            return await this.handleIndexDirectory(args as unknown as IndexDirectoryInput)

          case MCP_TOOLS.INDEX_FILE:
            return await this.handleIndexFile(args as unknown as IndexFileInput)

          case MCP_TOOLS.CLEAR_INDEX:
            return await this.handleClearIndex()

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
      cacheDir: this.config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
      verbose: this.config.verbose,
    })
    await this.embedder.initialize()

    this.vectorStore = new VectorStore({
      dbPath: this.config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
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
      threshold: input.threshold ?? 0.0,
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
   * Handle index_directory tool call
   */
  private async handleIndexDirectory(
    input: IndexDirectoryInput
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureReady()

    const startTime = Date.now()
    const workspaceDir = this.config.workspaceDir ?? process.cwd()
    const directory = resolve(workspaceDir, input.directory)

    this.log(`Indexing directory: ${directory}`)

    // Discover files
    const files = this.discoverFiles(directory)

    if (files.length === 0) {
      return {
        content: [{ type: 'text', text: `No code files found in ${directory}` }],
      }
    }

    let indexed = 0
    let chunks = 0
    let errors = 0

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const fileChunks = await this.indexer!.indexFile(file, content)

        if (fileChunks > 0) {
          indexed++
          chunks += fileChunks
        }
      } catch (error) {
        errors++
        this.log(`Error indexing ${file}:`, error)
      }
    }

    const durationMs = Date.now() - startTime
    const output: IndexDirectoryOutput = {
      filesIndexed: indexed,
      totalChunks: chunks,
      errors,
      durationMs,
    }

    const text = [
      '## Indexing Complete',
      '',
      `- **Directory**: ${relative(workspaceDir, directory) || '.'}`,
      `- **Files Found**: ${files.length}`,
      `- **Files Indexed**: ${indexed}`,
      `- **Total Chunks**: ${chunks}`,
      errors > 0 ? `- **Errors**: ${errors}` : null,
      `- **Duration**: ${(durationMs / 1000).toFixed(2)}s`,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      content: [{ type: 'text', text }],
    }
  }

  /**
   * Handle index_file tool call
   */
  private async handleIndexFile(
    input: IndexFileInput
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureReady()

    const workspaceDir = this.config.workspaceDir ?? process.cwd()
    const filePath = resolve(workspaceDir, input.filePath)

    // Get content from input or read from disk
    let content: string
    if (input.content) {
      content = input.content
    } else {
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch (error) {
        throw new Error(`Cannot read file: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const chunks = await this.indexer!.indexFile(filePath, content)

    const output: IndexFileOutput = {
      chunks,
      indexed: chunks > 0,
    }

    const text = chunks > 0
      ? `Indexed **${relative(workspaceDir, filePath)}** (${chunks} chunks)`
      : `File **${relative(workspaceDir, filePath)}** unchanged (already indexed)`

    return {
      content: [{ type: 'text', text }],
    }
  }

  /**
   * Handle clear_index tool call
   */
  private async handleClearIndex(): Promise<{
    content: Array<{ type: string; text: string }>
  }> {
    await this.ensureReady()

    await this.indexer!.clear()

    return {
      content: [{ type: 'text', text: 'Index cleared. All files and chunks have been removed.' }],
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

  /**
   * Discover all code files in a directory
   */
  private discoverFiles(directory: string): string[] {
    const files: string[] = []

    const walk = (dir: string): void => {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry)

        let stat
        try {
          stat = statSync(fullPath)
        } catch {
          continue
        }

        if (stat.isDirectory()) {
          if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) {
            walk(fullPath)
          }
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase()
          if (CODE_EXTENSIONS.has(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    walk(directory)
    return files
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
