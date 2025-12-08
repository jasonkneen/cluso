/**
 * Core library exports for mgrep-local
 *
 * This module provides the pure library functionality
 * with no Electron or MCP dependencies.
 */

// Classes - Standard (single database)
export { Embedder } from './Embedder.js'
export { VectorStore } from './VectorStore.js'
export { Chunker } from './Chunker.js'
export { Indexer } from './Indexer.js'
export { Searcher } from './Searcher.js'

// Classes - GPU Acceleration
export { MlxEmbedder, checkMlxServer } from './MlxEmbedder.js'
export { LlamaCppEmbedder, checkGpuAvailable, listEmbeddingModels, EMBEDDING_MODELS } from './LlamaCppEmbedder.js'
export { createEmbedder, createEmbedderWithBackend, type EmbedderBackend, type GpuEmbedderOptions } from './embedder-factory.js'

// Classes - OpenAI API Embeddings
export { OpenAIEmbedder, checkOpenAIAvailable, type OpenAIEmbeddingModel, type OpenAIEmbedderOptions } from './OpenAIEmbedder.js'

// Classes - Sharded (multiple databases with meta-index)
export { ShardedVectorStore } from './ShardedVectorStore.js'
export { ShardedIndexer } from './ShardedIndexer.js'
export { ShardedSearcher } from './ShardedSearcher.js'

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
  MlxEmbedderOptions,
  MlxModelSize,
  EmbedderFactoryOptions,
  ModelDownloadProgress,
  ModelInfo,
  VectorStoreOptions,
  ChunkerOptions,
  IndexerOptions,
  SearcherOptions,

  // Service types
  MgrepLocalServiceOptions,
  ServiceStatus,
} from './types.js'

// Re-export LlamaCpp types
export type { LlamaCppEmbedderOptions, EmbeddingModelName } from './LlamaCppEmbedder.js'

// Sharded types
export type {
  ShardInfo,
  ShardedSearchResult,
  ShardedVectorStoreOptions,
  ProgressiveSearchCallback,
} from './ShardedVectorStore.js'

export type {
  ShardedIndexerOptions,
  FileToIndex,
  IndexBatchResult,
  ShardedIndexProgress,
} from './ShardedIndexer.js'

export type {
  ShardedSearchOptions,
  SearchStats,
} from './ShardedSearcher.js'
