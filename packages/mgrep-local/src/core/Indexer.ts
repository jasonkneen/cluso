/**
 * Indexer - Orchestrates the file → chunks → embeddings → store pipeline
 *
 * Features:
 * - Incremental indexing (only re-index changed files)
 * - Batch embedding for efficiency
 * - Progress reporting
 */

import { createHash } from 'crypto'

import type {
  IndexerOptions,
  IndexStats,
  IndexProgress,
  IndexProgressCallback,
  VectorInsertOptions,
  Indexer as IIndexer,
} from './types.js'

import { Embedder } from './Embedder.js'
import { VectorStore } from './VectorStore.js'
import { Chunker } from './Chunker.js'

// Default batch size for embedding
const DEFAULT_BATCH_SIZE = 32

export class Indexer implements IIndexer {
  private embedder: Embedder
  private vectorStore: VectorStore
  private chunker: Chunker
  private batchSize: number
  private progressCallback?: IndexProgressCallback

  constructor(options: IndexerOptions) {
    this.embedder = options.embedder as Embedder
    this.vectorStore = options.vectorStore as VectorStore
    this.chunker = (options.chunker as Chunker) ?? new Chunker()
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
    this.progressCallback = options.progressCallback
  }

  /**
   * Index a single file
   * Returns the number of chunks created
   */
  async indexFile(filePath: string, content: string): Promise<number> {
    // Check if file needs re-indexing
    const contentHash = this.hashContent(content)
    const existingHash = await this.vectorStore.getFileHash(filePath)

    if (existingHash === contentHash) {
      // File hasn't changed, skip
      return 0
    }

    // Delete existing vectors for this file
    await this.vectorStore.deleteVectorsForFile(filePath)

    // Chunk the content
    const chunks = this.chunker.chunk(content, filePath)

    if (chunks.length === 0) {
      return 0
    }

    // Generate embeddings in batches
    const embeddings = await this.embedBatched(chunks.map((c) => c.content))

    // Prepare insert options
    const insertOptions: VectorInsertOptions[] = chunks.map((chunk, index) => ({
      filePath,
      chunkIndex: index,
      content: chunk.content,
      embedding: embeddings[index],
      metadata: chunk.metadata,
    }))

    // Insert all vectors
    await this.vectorStore.insertBatch(insertOptions)

    // Track the file
    await this.vectorStore.trackFile(
      filePath,
      contentHash,
      chunks[0]?.metadata.language ?? 'unknown',
      chunks.length
    )

    return chunks.length
  }

  /**
   * Update a file (same as indexFile, but named for clarity)
   */
  async updateFile(filePath: string, content: string): Promise<number> {
    return this.indexFile(filePath, content)
  }

  /**
   * Delete a file from the index
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.vectorStore.deleteVectorsForFile(filePath)
  }

  /**
   * Index multiple files with progress reporting
   */
  async indexFiles(
    files: Array<{ filePath: string; content: string }>
  ): Promise<{ totalChunks: number; filesProcessed: number }> {
    let totalChunks = 0
    let filesProcessed = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      this.reportProgress({
        phase: 'chunking',
        current: i + 1,
        total: files.length,
        currentFile: file.filePath,
      })

      const chunks = await this.indexFile(file.filePath, file.content)
      totalChunks += chunks

      if (chunks > 0) {
        filesProcessed++
      }
    }

    return { totalChunks, filesProcessed }
  }

  /**
   * Get current index statistics
   */
  async getStats(): Promise<IndexStats> {
    return this.vectorStore.getStats()
  }

  /**
   * Clear the entire index
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear()
  }

  /**
   * Embed texts in batches for efficiency
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
   * Hash file content for change detection
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  /**
   * Report indexing progress
   */
  private reportProgress(progress: IndexProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
  }
}
