/**
 * mgrep-local - Local semantic code search
 *
 * A fast, local-first semantic code search package using:
 * - @xenova/transformers for embedding generation
 * - better-sqlite3 + sqlite-vec for vector storage
 * - Code-aware chunking for accurate results
 *
 * @example
 * ```typescript
 * import { Embedder, VectorStore, Chunker, Indexer, Searcher } from '@ai-cluso/mgrep-local'
 *
 * // Initialize components
 * const embedder = new Embedder()
 * const vectorStore = new VectorStore({ dbPath: './index.db' })
 * const chunker = new Chunker()
 *
 * await embedder.initialize()
 * await vectorStore.initialize()
 *
 * // Create indexer and searcher
 * const indexer = new Indexer({ embedder, vectorStore, chunker })
 * const searcher = new Searcher(embedder, vectorStore)
 *
 * // Index a file
 * await indexer.indexFile('src/main.ts', fileContent)
 *
 * // Search
 * const results = await searcher.search('authentication handler')
 * ```
 */

// Re-export everything from core
export * from './core/index.js'

// Re-export Electron integration
export * from './electron/index.js'

// Re-export MCP server
export * from './mcp/index.js'

// Package version
export const VERSION = '1.0.0'
