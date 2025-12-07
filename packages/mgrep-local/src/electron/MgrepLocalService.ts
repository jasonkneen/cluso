/**
 * MgrepLocalService - Singleton service for Electron main process
 *
 * Manages the entire mgrep-local lifecycle:
 * - Embedder initialization (via worker thread)
 * - VectorStore management
 * - File change handling
 * - Search queries
 */

import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

import { VectorStore } from '../core/VectorStore.js'
import { Chunker } from '../core/Chunker.js'
import { Searcher } from '../core/Searcher.js'
import { Embedder } from '../core/Embedder.js'
import { Indexer } from '../core/Indexer.js'

import type {
  SearchOptions,
  SearchResult,
  IndexStats,
  FileChangeEvent,
} from '../core/types.js'

import type {
  MgrepServiceOptions,
  MgrepServiceStatus,
  MgrepServiceEvent,
  MgrepServiceEventListener,
  WorkerTask,
  WorkerResult,
  WorkerEmbedBatchResult,
} from './types.js'

// Default paths - LanceDB uses directories
const DEFAULT_DB_DIR = join(homedir(), '.cache', 'mgrep-local', 'vectors')
const DEFAULT_MODEL_CACHE = join(homedir(), '.cache', 'mgrep-local', 'models')

export class MgrepLocalService extends EventEmitter {
  // Static instances for multi-project support - keyed by dbPath
  private static instances: Map<string, MgrepLocalService> = new Map()

  private options: MgrepServiceOptions
  private vectorStore: VectorStore | null = null
  private embedder: Embedder | null = null
  private chunker: Chunker | null = null
  private indexer: Indexer | null = null
  private searcher: Searcher | null = null

  private worker: Worker | null = null
  private pendingTasks: Map<string, {
    resolve: (result: WorkerResult) => void
    reject: (error: Error) => void
  }> = new Map()

  private ready = false
  private indexing = false
  private lastError: string | null = null

  /**
   * Constructor is now public to allow direct instantiation for multi-project
   */
  constructor(options: MgrepServiceOptions) {
    super()
    this.options = options
  }

  /**
   * Get or create an instance for a specific dbPath (multi-project support)
   * Each unique dbPath gets its own service instance
   */
  static getInstance(options: MgrepServiceOptions): MgrepLocalService {
    if (!options) {
      throw new Error('MgrepLocalService requires options')
    }

    const dbPath = options.dbPath ?? DEFAULT_DB_DIR

    // Check if we already have an instance for this dbPath
    let instance = MgrepLocalService.instances.get(dbPath)
    if (!instance) {
      instance = new MgrepLocalService(options)
      MgrepLocalService.instances.set(dbPath, instance)
    }

    return instance
  }

  /**
   * Get all active instances
   */
  static getAllInstances(): MgrepLocalService[] {
    return Array.from(MgrepLocalService.instances.values())
  }

  /**
   * Remove an instance by dbPath
   */
  static removeInstance(dbPath: string): void {
    const instance = MgrepLocalService.instances.get(dbPath)
    if (instance) {
      instance.dispose()
      MgrepLocalService.instances.delete(dbPath)
    }
  }

  /**
   * Reset all instances (for testing)
   */
  static resetAllInstances(): void {
    for (const instance of MgrepLocalService.instances.values()) {
      instance.dispose()
    }
    MgrepLocalService.instances.clear()
  }

  /**
   * @deprecated Use resetAllInstances() instead
   */
  static resetInstance(): void {
    MgrepLocalService.resetAllInstances()
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return
    }

    this.log('Initializing MgrepLocalService...')

    try {
      // Initialize vector store
      const dbPath = this.options.dbPath ?? join(DEFAULT_DB_DIR, 'index.db')
      this.vectorStore = new VectorStore({ dbPath })
      await this.vectorStore.initialize()

      // Initialize embedder (direct, not worker for now - simpler)
      const modelCacheDir = this.options.modelCacheDir ?? DEFAULT_MODEL_CACHE
      this.embedder = new Embedder({ cacheDir: modelCacheDir })
      await this.embedder.initialize()

      // Initialize chunker
      this.chunker = new Chunker()

      // Initialize indexer
      this.indexer = new Indexer({
        embedder: this.embedder,
        vectorStore: this.vectorStore,
        chunker: this.chunker,
        progressCallback: (progress) => {
          this.emitEvent({
            type: 'indexing-progress',
            current: progress.current,
            total: progress.total,
            currentFile: progress.currentFile,
          })
        },
      })

      // Initialize searcher
      this.searcher = new Searcher(this.embedder, this.vectorStore)

      this.ready = true
      this.emitEvent({ type: 'ready' })
      this.log('MgrepLocalService initialized successfully')
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.emitEvent({ type: 'error', error: this.lastError })
      throw error
    }
  }

  /**
   * Search the index
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureReady()
    return this.searcher!.hybridSearch(query, options)
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string, content: string): Promise<number> {
    this.ensureReady()

    const chunks = await this.indexer!.indexFile(filePath, content)

    if (chunks > 0) {
      this.emitEvent({ type: 'file-indexed', filePath, chunks })
    }

    return chunks
  }

  /**
   * Delete a file from the index
   */
  async deleteFile(filePath: string): Promise<void> {
    this.ensureReady()

    await this.indexer!.deleteFile(filePath)
    this.emitEvent({ type: 'file-deleted', filePath })
  }

  /**
   * Handle a file change event (event-driven API)
   */
  async onFileChange(event: FileChangeEvent): Promise<void> {
    this.ensureReady()

    switch (event.eventType) {
      case 'added':
      case 'modified':
        if (event.content) {
          await this.indexFile(event.filePath, event.content)
        }
        break

      case 'deleted':
        await this.deleteFile(event.filePath)
        break
    }
  }

  /**
   * Index multiple files
   */
  async indexFiles(
    files: Array<{ filePath: string; content: string }>
  ): Promise<{ totalChunks: number; filesProcessed: number }> {
    this.ensureReady()

    this.indexing = true
    this.emitEvent({ type: 'indexing-start', totalFiles: files.length })

    try {
      const result = await this.indexer!.indexFiles(files)

      this.emitEvent({
        type: 'indexing-complete',
        totalChunks: result.totalChunks,
        filesProcessed: result.filesProcessed,
      })

      return result
    } finally {
      this.indexing = false
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<MgrepServiceStatus> {
    return {
      ready: this.ready,
      indexing: this.indexing,
      stats: this.ready ? await this.getStats() : null,
      error: this.lastError ?? undefined,
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    this.ensureReady()
    return this.indexer!.getStats()
  }

  /**
   * Clear the entire index
   */
  async clear(): Promise<void> {
    this.ensureReady()
    await this.indexer!.clear()
  }

  /**
   * Add event listener
   */
  onEvent(listener: MgrepServiceEventListener): () => void {
    this.on('service-event', listener)
    return () => this.off('service-event', listener)
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.log('Disposing MgrepLocalService...')

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

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

    this.log('MgrepLocalService disposed')
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error('MgrepLocalService not initialized. Call initialize() first.')
    }
  }

  private emitEvent(event: MgrepServiceEvent): void {
    this.emit('service-event', event)
  }

  private log(...args: unknown[]): void {
    if (this.options.verbose) {
      console.log('[MgrepLocalService]', ...args)
    }
  }

  // ==========================================================================
  // Worker thread management (for future use)
  // ==========================================================================

  private async initWorker(): Promise<void> {
    if (this.worker) {
      return
    }

    const workerPath = join(__dirname, 'worker.js')
    this.worker = new Worker(workerPath)

    this.worker.on('message', (result: WorkerResult) => {
      const pending = this.pendingTasks.get(result.id)
      if (pending) {
        this.pendingTasks.delete(result.id)
        if (result.success) {
          pending.resolve(result)
        } else {
          pending.reject(new Error(result.error ?? 'Unknown worker error'))
        }
      }
    })

    this.worker.on('error', (error) => {
      this.log('Worker error:', error)
      this.lastError = error.message
    })

    this.worker.on('exit', (code) => {
      this.log('Worker exited with code:', code)
      this.worker = null
    })
  }

  private async sendWorkerTask<T extends WorkerResult>(task: WorkerTask): Promise<T> {
    if (!this.worker) {
      throw new Error('Worker not initialized')
    }

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(task.id, {
        resolve: resolve as (result: WorkerResult) => void,
        reject,
      })
      this.worker!.postMessage(task)
    })
  }
}
