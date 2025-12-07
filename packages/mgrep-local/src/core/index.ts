/**
 * Core library exports for mgrep-local
 *
 * This module provides the pure library functionality
 * with no Electron or MCP dependencies.
 */

// Classes - Standard (single database)
export { Embedder } from './Embedder'
export { VectorStore } from './VectorStore'
export { Chunker } from './Chunker'
export { Indexer } from './Indexer'
export { Searcher } from './Searcher'

// Classes - Sharded (multiple databases with meta-index)
export { ShardedVectorStore } from './ShardedVectorStore'
export { ShardedIndexer } from './ShardedIndexer'
export { ShardedSearcher } from './ShardedSearcher'

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

// Sharded types
export type {
  ShardInfo,
  ShardedSearchResult,
  ShardedVectorStoreOptions,
  ProgressiveSearchCallback,
} from './ShardedVectorStore'

export type {
  ShardedIndexerOptions,
  FileToIndex,
  IndexBatchResult,
  ShardedIndexProgress,
} from './ShardedIndexer'

export type {
  ShardedSearchOptions,
  SearchStats,
} from './ShardedSearcher'
