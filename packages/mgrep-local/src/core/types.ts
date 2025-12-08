/**
 * Core types for mgrep-local semantic code search
 */

// =============================================================================
// Embedding & Vector Types
// =============================================================================

/**
 * Metadata associated with a code chunk
 */
export interface ChunkMetadata {
  startLine: number
  endLine: number
  language: string
  functionName?: string
  classScope?: string
  isDocstring?: boolean
}

/**
 * A chunk of code before embedding
 */
export interface Chunk {
  content: string
  metadata: ChunkMetadata
}

/**
 * A vector stored in the database with its embedding
 */
export interface Vector {
  id: string
  filePath: string
  chunkIndex: number
  content: string
  embedding: number[] // 384-dimensional for all-MiniLM-L6-v2
  metadata: ChunkMetadata
}

/**
 * Options for vector insertion
 */
export interface VectorInsertOptions {
  filePath: string
  chunkIndex: number
  content: string
  embedding: number[]
  metadata: ChunkMetadata
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * A single search result with similarity score
 */
export interface SearchResult {
  filePath: string
  chunkIndex: number
  content: string
  similarity: number // 0-1 cosine similarity
  metadata: ChunkMetadata
  highlight?: string // Context snippet with query terms highlighted
}

/**
 * Options for search queries
 */
export interface SearchOptions {
  limit?: number // Max results (default: 10)
  threshold?: number // Min similarity 0-1 (default: 0.3)
  returnContext?: boolean // Include surrounding context
  contextLines?: number // Lines of context (default: 3)
}

// =============================================================================
// Indexing Types
// =============================================================================

/**
 * Statistics about the current index
 */
export interface IndexStats {
  totalFiles: number
  totalChunks: number
  totalEmbeddings: number
  databaseSize: number // bytes
  lastIndexedAt: Date | null
}

/**
 * Progress update during indexing operations
 */
export interface IndexProgress {
  phase: 'scanning' | 'chunking' | 'embedding' | 'storing'
  current: number
  total: number
  currentFile?: string
}

/**
 * Callback for index progress updates
 */
export type IndexProgressCallback = (progress: IndexProgress) => void

// =============================================================================
// File Watcher Types (Event-driven API)
// =============================================================================

/**
 * Event types for file changes
 */
export type FileEventType = 'added' | 'modified' | 'deleted'

/**
 * File change event pushed by the host application
 */
export interface FileChangeEvent {
  filePath: string
  eventType: FileEventType
  timestamp: number
  content?: string // Optional: include content to avoid re-reading
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for the Embedder class
 */
export interface EmbedderOptions {
  modelName?: string // default: 'Xenova/all-MiniLM-L6-v2'
  cacheDir?: string // default: ~/.cache/mgrep-local/models
  verbose?: boolean
  onProgress?: (progress: ModelDownloadProgress) => void
}

/**
 * MLX model sizes available
 */
export type MlxModelSize = '0.6B' | '4B' | '8B'

/**
 * Options for MLX GPU-accelerated embedder
 */
export interface MlxEmbedderOptions extends EmbedderOptions {
  serverUrl?: string  // default: http://localhost:8000
  modelSize?: MlxModelSize  // default: '0.6B'
  timeout?: number  // request timeout in ms (default: 30000)
}

/**
 * OpenAI embedding models
 */
export type OpenAIEmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'

/**
 * Options for OpenAI embedder
 */
export interface OpenAIEmbedderOptions extends EmbedderOptions {
  apiKey?: string  // Defaults to OPENAI_API_KEY env var
  model?: OpenAIEmbeddingModel  // Default: text-embedding-3-small
  baseUrl?: string  // For proxies or Azure
  batchSize?: number  // Max inputs per API call (default: 100)
  concurrency?: number  // Parallel API calls (default: 4)
  retries?: number  // Retry attempts on failure (default: 3)
  dimensions?: number  // Optional dimension reduction for text-embedding-3-* models
}

/**
 * Options for embedder factory (auto-selects best available)
 */
export interface EmbedderFactoryOptions extends EmbedderOptions {
  preferMlx?: boolean  // default: true - use MLX if available
  mlxServerUrl?: string  // default: http://localhost:8000
  mlxModelSize?: MlxModelSize  // default: '0.6B'
}

/**
 * Progress during model download
 */
export interface ModelDownloadProgress {
  status: 'downloading' | 'loading' | 'ready'
  progress?: number // 0-100
  file?: string
}

/**
 * Model information
 */
export interface ModelInfo {
  name: string
  dimensions: number
  maxTokens: number
}

/**
 * Options for the VectorStore class
 */
export interface VectorStoreOptions {
  dbPath?: string // default: ~/.cache/mgrep-local/index.db
  readonly?: boolean
}

/**
 * Options for the Chunker class
 */
export interface ChunkerOptions {
  maxChunkSize?: number // default: 500 characters
  overlapSize?: number // default: 50 characters
  respectBoundaries?: boolean // default: true (split on function/class boundaries)
}

/**
 * Options for the Indexer class
 */
export interface IndexerOptions {
  embedder: Embedder
  vectorStore: VectorStore
  chunker?: Chunker
  batchSize?: number // default: 32
  progressCallback?: IndexProgressCallback
}

/**
 * Options for the Searcher class
 */
export interface SearcherOptions {
  embedder: Embedder
  vectorStore: VectorStore
}

// =============================================================================
// Service Types (Electron Integration)
// =============================================================================

/**
 * Options for MgrepLocalService
 */
export interface MgrepLocalServiceOptions {
  workspaceDir: string
  dbPath?: string
  modelCacheDir?: string
  autoIndex?: boolean // default: true
}

/**
 * Service status
 */
export interface ServiceStatus {
  ready: boolean
  indexing: boolean
  stats: IndexStats | null
  error?: string
}

// =============================================================================
// Forward declarations for class references in options
// =============================================================================

// These are declared as interfaces to avoid circular imports
// The actual implementations are in their respective files

export interface Embedder {
  initialize(): Promise<void>
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  getModelInfo(): ModelInfo
  dispose(): Promise<void>
}

export interface VectorStore {
  initialize(): Promise<void>
  insert(options: VectorInsertOptions): Promise<string>
  insertBatch(options: VectorInsertOptions[]): Promise<string[]>
  search(embedding: number[], limit?: number, threshold?: number): Promise<SearchResult[]>
  getVectorsForFile(filePath: string): Promise<Vector[]>
  deleteVectorsForFile(filePath: string): Promise<number>
  getStats(): Promise<IndexStats>
  clear(): Promise<void>
  dispose(): Promise<void>
}

export interface Chunker {
  chunk(code: string, filePath?: string): Chunk[]
  detectLanguage(filePath: string, content?: string): string
}

export interface Indexer {
  indexFile(filePath: string, content: string): Promise<number>
  updateFile(filePath: string, content: string): Promise<number>
  deleteFile(filePath: string): Promise<void>
  getStats(): Promise<IndexStats>
}

export interface Searcher {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>
}
