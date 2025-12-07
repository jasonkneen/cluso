/**
 * Electron-specific types for mgrep-local
 *
 * Defines worker thread communication protocol and service configuration.
 */

import type { SearchOptions, SearchResult, IndexStats, FileChangeEvent } from '../core/types.js'

// =============================================================================
// Worker Thread Types
// =============================================================================

/**
 * Task types that can be sent to the worker
 */
export type WorkerTaskType = 'embed' | 'embed-batch' | 'initialize' | 'dispose'

/**
 * Base task structure
 */
export interface WorkerTaskBase {
  id: string
  type: WorkerTaskType
}

/**
 * Initialize the embedder
 */
export interface WorkerInitializeTask extends WorkerTaskBase {
  type: 'initialize'
  modelName?: string
  cacheDir?: string
}

/**
 * Embed a single text
 */
export interface WorkerEmbedTask extends WorkerTaskBase {
  type: 'embed'
  text: string
}

/**
 * Embed multiple texts
 */
export interface WorkerEmbedBatchTask extends WorkerTaskBase {
  type: 'embed-batch'
  texts: string[]
}

/**
 * Dispose resources
 */
export interface WorkerDisposeTask extends WorkerTaskBase {
  type: 'dispose'
}

/**
 * Union of all worker task types
 */
export type WorkerTask =
  | WorkerInitializeTask
  | WorkerEmbedTask
  | WorkerEmbedBatchTask
  | WorkerDisposeTask

/**
 * Worker result base
 */
export interface WorkerResultBase {
  id: string
  success: boolean
  error?: string
}

/**
 * Result from initialize
 */
export interface WorkerInitializeResult extends WorkerResultBase {
  modelInfo?: {
    name: string
    dimensions: number
    maxTokens: number
  }
}

/**
 * Result from embed
 */
export interface WorkerEmbedResult extends WorkerResultBase {
  embedding?: number[]
}

/**
 * Result from embed-batch
 */
export interface WorkerEmbedBatchResult extends WorkerResultBase {
  embeddings?: number[][]
}

/**
 * Result from dispose
 */
export interface WorkerDisposeResult extends WorkerResultBase {}

/**
 * Union of all worker result types
 */
export type WorkerResult =
  | WorkerInitializeResult
  | WorkerEmbedResult
  | WorkerEmbedBatchResult
  | WorkerDisposeResult

// =============================================================================
// Service Types
// =============================================================================

/**
 * Service configuration options
 */
export interface MgrepServiceOptions {
  /** Workspace directory to index */
  workspaceDir: string

  /** Path to the SQLite database */
  dbPath?: string

  /** Directory to cache embedding models */
  modelCacheDir?: string

  /** Whether to auto-index on file changes */
  autoIndex?: boolean

  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Service status
 */
export interface MgrepServiceStatus {
  /** Whether the service is ready to accept queries */
  ready: boolean

  /** Whether indexing is in progress */
  indexing: boolean

  /** Current index statistics */
  stats: IndexStats | null

  /** Last error message if any */
  error?: string
}

// =============================================================================
// IPC Types
// =============================================================================

/**
 * IPC channel names
 */
export const IPC_CHANNELS = {
  SEARCH: 'mgrep:search',
  INDEX_FILE: 'mgrep:index-file',
  INDEX_WORKSPACE: 'mgrep:index-workspace',
  DELETE_FILE: 'mgrep:delete-file',
  GET_STATUS: 'mgrep:get-status',
  GET_STATS: 'mgrep:get-stats',
  FILE_CHANGE: 'mgrep:file-change',
  PROGRESS: 'mgrep:progress',
} as const

/**
 * IPC request/response types
 */
export interface MgrepIPCHandlers {
  [IPC_CHANNELS.SEARCH]: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
  [IPC_CHANNELS.INDEX_FILE]: (filePath: string, content: string) => Promise<number>
  [IPC_CHANNELS.INDEX_WORKSPACE]: () => Promise<{ totalChunks: number; filesProcessed: number }>
  [IPC_CHANNELS.DELETE_FILE]: (filePath: string) => Promise<void>
  [IPC_CHANNELS.GET_STATUS]: () => Promise<MgrepServiceStatus>
  [IPC_CHANNELS.GET_STATS]: () => Promise<IndexStats>
  [IPC_CHANNELS.FILE_CHANGE]: (event: FileChangeEvent) => Promise<void>
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by the service
 */
export type MgrepServiceEvent =
  | { type: 'ready' }
  | { type: 'indexing-start'; totalFiles: number }
  | { type: 'indexing-progress'; current: number; total: number; currentFile?: string }
  | { type: 'indexing-complete'; totalChunks: number; filesProcessed: number }
  | { type: 'file-indexed'; filePath: string; chunks: number }
  | { type: 'file-deleted'; filePath: string }
  | { type: 'error'; error: string }

/**
 * Event listener type
 */
export type MgrepServiceEventListener = (event: MgrepServiceEvent) => void
