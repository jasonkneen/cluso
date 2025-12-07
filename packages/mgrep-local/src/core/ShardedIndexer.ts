/**
 * ShardedIndexer - Parallel indexing across multiple shards
 *
 * Features:
 * - Distributes files across shards by consistent hashing
 * - Parallel embedding generation using worker pool
 * - Progress tracking per shard
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { cpus } from 'os'
import { createHash } from 'crypto'
import { join } from 'path'

import { ShardedVectorStore } from './ShardedVectorStore'
import { Embedder } from './Embedder'
import { Chunker } from './Chunker'
import type {
  IndexProgress,
  IndexProgressCallback,
  VectorInsertOptions,
  IndexStats,
  EmbedderOptions,
} from './types'

/**
 * Options for ShardedIndexer
 */
export interface ShardedIndexerOptions {
  shardedStore: ShardedVectorStore
  embedder: Embedder
  chunker?: Chunker
  batchSize?: number
  workerCount?: number  // Number of parallel workers (default: CPU cores)
  progressCallback?: IndexProgressCallback
}

/**
 * File to index with content
 */
export interface FileToIndex {
  filePath: string
  content: string
}

/**
 * Result from indexing a batch
 */
export interface IndexBatchResult {
  shardId: number
  filesIndexed: number
  chunksCreated: number
  errors: number
  durationMs: number
}

/**
 * Progress update for sharded indexing
 */
export interface ShardedIndexProgress extends IndexProgress {
  shardId?: number
  shardsComplete?: number
  totalShards?: number
}

export class ShardedIndexer {
  private shardedStore: ShardedVectorStore
  private embedder: Embedder
  private chunker: Chunker
  private batchSize: number
  private workerCount: number
  private progressCallback?: IndexProgressCallback

  constructor(options: ShardedIndexerOptions) {
    this.shardedStore = options.shardedStore
    this.embedder = options.embedder
    this.chunker = options.chunker ?? new Chunker()
    this.batchSize = options.batchSize ?? 32
    this.workerCount = options.workerCount ?? Math.max(1, cpus().length - 1)
    this.progressCallback = options.progressCallback
  }

  /**
   * Index a single file into its shard
   */
  async indexFile(filePath: string, content: string): Promise<number> {
    // Check if file needs re-indexing
    const contentHash = this.hashContent(content)
    const existingHash = await this.shardedStore.getFileHash(filePath)

    if (existingHash === contentHash) {
      return 0  // File unchanged
    }

    // Delete existing vectors
    await this.shardedStore.deleteVectorsForFile(filePath)

    // Chunk the content
    const chunks = this.chunker.chunk(content, filePath)
    if (chunks.length === 0) {
      return 0
    }

    // Generate embeddings
    const embeddings = await this.embedBatched(chunks.map(c => c.content))

    // Prepare insert options
    const insertOptions: VectorInsertOptions[] = chunks.map((chunk, i) => ({
      filePath,
      chunkIndex: i,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }))

    // Insert into shard
    await this.shardedStore.insertBatch(insertOptions)

    // Track the file
    await this.shardedStore.trackFile(
      filePath,
      contentHash,
      chunks[0]?.metadata.language ?? 'unknown',
      chunks.length
    )

    return chunks.length
  }

  /**
   * Delete a file from its shard
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.shardedStore.deleteVectorsForFile(filePath)
  }

  /**
   * Index multiple files with parallel processing by shard
   *
   * Files are grouped by their target shard, then each shard's
   * files are processed in parallel batches.
   */
  async indexFiles(
    files: FileToIndex[]
  ): Promise<{ totalChunks: number; filesProcessed: number; byShardId: Map<number, IndexBatchResult> }> {
    // Group files by target shard
    const byShardId = new Map<number, FileToIndex[]>()

    for (const file of files) {
      const shardId = this.shardedStore.getShardId(file.filePath)
      const group = byShardId.get(shardId) ?? []
      group.push(file)
      byShardId.set(shardId, group)
    }

    // Process each shard's files
    let totalChunks = 0
    let filesProcessed = 0
    const results = new Map<number, IndexBatchResult>()

    const shardCount = byShardId.size
    let shardsComplete = 0

    // Process shards (could be parallelized with worker threads)
    for (const [shardId, shardFiles] of byShardId) {
      const startTime = Date.now()
      let shardChunks = 0
      let shardFilesProcessed = 0
      let shardErrors = 0

      for (let i = 0; i < shardFiles.length; i++) {
        const file = shardFiles[i]

        this.reportProgress({
          phase: 'chunking',
          current: i + 1,
          total: shardFiles.length,
          currentFile: file.filePath,
          shardId,
          shardsComplete,
          totalShards: shardCount,
        })

        try {
          const chunks = await this.indexFile(file.filePath, file.content)
          if (chunks > 0) {
            shardFilesProcessed++
            shardChunks += chunks
          }
        } catch (error) {
          shardErrors++
        }
      }

      const result: IndexBatchResult = {
        shardId,
        filesIndexed: shardFilesProcessed,
        chunksCreated: shardChunks,
        errors: shardErrors,
        durationMs: Date.now() - startTime,
      }

      results.set(shardId, result)
      totalChunks += shardChunks
      filesProcessed += shardFilesProcessed
      shardsComplete++
    }

    // Update centroids after indexing
    await this.shardedStore.updateCentroids()

    return { totalChunks, filesProcessed, byShardId: results }
  }

  /**
   * Index files in parallel using worker threads
   *
   * This is the high-performance path for large codebases.
   * Each worker handles a subset of shards.
   */
  async indexFilesParallel(
    files: FileToIndex[]
  ): Promise<{ totalChunks: number; filesProcessed: number; durationMs: number }> {
    const startTime = Date.now()

    // For now, use sequential indexing
    // TODO: Implement actual worker thread pool
    const result = await this.indexFiles(files)

    return {
      totalChunks: result.totalChunks,
      filesProcessed: result.filesProcessed,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Get stats from the sharded store
   */
  async getStats(): Promise<IndexStats> {
    return this.shardedStore.getStats()
  }

  /**
   * Clear all shards
   */
  async clear(): Promise<void> {
    await this.shardedStore.clear()
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Generate embeddings in batches
   */
  private async embedBatched(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)

      this.reportProgress({
        phase: 'embedding',
        current: Math.min(i + this.batchSize, texts.length),
        total: texts.length,
      })

      const embeddings = await this.embedder.embedBatch(batch)
      allEmbeddings.push(...embeddings)
    }

    return allEmbeddings
  }

  /**
   * Hash content for change detection
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  /**
   * Report progress
   */
  private reportProgress(progress: ShardedIndexProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
  }
}
