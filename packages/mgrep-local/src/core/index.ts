/**
 * Core library exports for mgrep-local
 *
 * This module provides the pure library functionality
 * with no Electron or MCP dependencies.
 */

// Classes
export { Embedder } from './Embedder'
export { VectorStore } from './VectorStore'
export { Chunker } from './Chunker'
export { Indexer } from './Indexer'
export { Searcher } from './Searcher'

// Types
export type {
  // Embedding & Vector types
  Vector,
  VectorInsertOptions,
  Chunk,
  ChunkMetadata,

  // Search types
  SearchResult,
  SearchOptions,

  // Index types
  IndexStats,
  IndexProgress,
  IndexProgressCallback,

  // File watcher types
  FileEventType,
  FileChangeEvent,

  // Configuration types
  EmbedderOptions,
  ModelDownloadProgress,
  ModelInfo,
  VectorStoreOptions,
  ChunkerOptions,
  IndexerOptions,
  SearcherOptions,

  // Service types
  MgrepLocalServiceOptions,
  ServiceStatus,
} from './types'
