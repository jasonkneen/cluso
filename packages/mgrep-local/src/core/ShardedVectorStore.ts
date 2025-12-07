/**
 * ShardedVectorStore - Hierarchical sharded vector storage
 *
 * Architecture:
 * - Meta-index: Contains shard centroids for fast routing
 * - Shards: N separate VectorStores, each handling a partition
 *
 * Benefits:
 * - Parallel indexing across shards
 * - Faster search (query relevant shards only)
 * - Progressive results ("image coming into focus")
 */

import { join } from 'path'
import { mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { createHash } from 'crypto'

import { VectorStore } from './VectorStore.js'
import type {
  VectorStoreOptions,
  VectorInsertOptions,
  SearchResult,
  IndexStats,
  Vector,
} from './types.js'

/**
 * Shard metadata stored in meta-index
 */
export interface ShardInfo {
  id: number
  path: string
  fileCount: number
  chunkCount: number
  centroid: number[] | null  // Average of all vectors in shard
}

/**
 * Search result with shard info for progressive loading
 */
export interface ShardedSearchResult extends SearchResult {
  shardId: number
}

/**
 * Options for ShardedVectorStore
 */
export interface ShardedVectorStoreOptions extends VectorStoreOptions {
  shardCount?: number  // Number of shards (default: 8)
}

/**
 * Callback for progressive search results
 */
export type ProgressiveSearchCallback = (
  results: ShardedSearchResult[],
  shardId: number,
  complete: boolean
) => void

export class ShardedVectorStore {
  private basePath: string
  private shardCount: number
  private shards: Map<number, VectorStore> = new Map()
  private metaStore: VectorStore | null = null
  private shardInfos: Map<number, ShardInfo> = new Map()
  private initialized = false

  constructor(options: ShardedVectorStoreOptions = {}) {
    this.basePath = options.dbPath ?? join(process.cwd(), '.mgrep-shards')
    this.shardCount = options.shardCount ?? 8

    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true })
    }
  }

  /**
   * Initialize all shards and meta-index
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Initialize meta-index
    const metaPath = join(this.basePath, 'meta')
    this.metaStore = new VectorStore({ dbPath: metaPath })
    await this.metaStore.initialize()

    // Initialize shards
    for (let i = 0; i < this.shardCount; i++) {
      const shardPath = join(this.basePath, `shard-${i}`)
      const shard = new VectorStore({ dbPath: shardPath })
      await shard.initialize()
      this.shards.set(i, shard)

      // Initialize shard info
      this.shardInfos.set(i, {
        id: i,
        path: shardPath,
        fileCount: 0,
        chunkCount: 0,
        centroid: null,
      })
    }

    // Load existing shard stats
    await this.refreshShardInfos()

    this.initialized = true
  }

  /**
   * Get shard ID for a file path (consistent hashing)
   */
  getShardId(filePath: string): number {
    const hash = createHash('md5').update(filePath).digest('hex')
    const num = parseInt(hash.substring(0, 8), 16)
    return num % this.shardCount
  }

  /**
   * Get paths to all shard databases for worker threads
   */
  getShardPaths(): Map<number, string> {
    const paths = new Map<number, string>()
    for (let i = 0; i < this.shardCount; i++) {
      paths.set(i, join(this.basePath, `shard-${i}`))
    }
    return paths
  }

  /**
   * Get number of shards
   */
  getShardCount(): number {
    return this.shardCount
  }

  /**
   * Get a specific shard's VectorStore
   */
  getShard(shardId: number): VectorStore {
    this.ensureInitialized()
    const shard = this.shards.get(shardId)
    if (!shard) {
      throw new Error(`Shard ${shardId} not found`)
    }
    return shard
  }

  /**
   * Insert vectors into the appropriate shard
   */
  async insert(options: VectorInsertOptions): Promise<string> {
    this.ensureInitialized()
    const shardId = this.getShardId(options.filePath)
    const shard = this.getShard(shardId)
    return shard.insert(options)
  }

  /**
   * Batch insert - groups by shard for efficiency
   */
  async insertBatch(options: VectorInsertOptions[]): Promise<string[]> {
    this.ensureInitialized()

    // Group by shard
    const byShardId = new Map<number, VectorInsertOptions[]>()
    for (const opt of options) {
      const shardId = this.getShardId(opt.filePath)
      const group = byShardId.get(shardId) ?? []
      group.push(opt)
      byShardId.set(shardId, group)
    }

    // Insert into each shard
    const allIds: string[] = []
    for (const [shardId, shardOptions] of byShardId) {
      const shard = this.getShard(shardId)
      const ids = await shard.insertBatch(shardOptions)
      allIds.push(...ids)
    }

    return allIds
  }

  /**
   * Search across all shards with progressive results
   *
   * Returns results as each shard completes, "coming into focus"
   */
  async searchProgressive(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.0,
    onProgress?: ProgressiveSearchCallback
  ): Promise<ShardedSearchResult[]> {
    this.ensureInitialized()

    // First, find relevant shards using meta-index (if we have centroids)
    const shardOrder = await this.rankShards(embedding)

    // Search shards in order of relevance
    const allResults: ShardedSearchResult[] = []
    let shardsComplete = 0

    for (const shardId of shardOrder) {
      const shard = this.getShard(shardId)
      const shardResults = await shard.search(embedding, limit, threshold)

      // Add shard info to results
      const taggedResults: ShardedSearchResult[] = shardResults.map(r => ({
        ...r,
        shardId,
      }))

      allResults.push(...taggedResults)
      shardsComplete++

      // Sort all results so far
      allResults.sort((a, b) => b.similarity - a.similarity)

      // Callback with progressive results
      if (onProgress) {
        onProgress(
          allResults.slice(0, limit),
          shardId,
          shardsComplete === this.shardCount
        )
      }
    }

    return allResults.slice(0, limit)
  }

  /**
   * Standard search (non-progressive) - for compatibility
   */
  async search(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.0
  ): Promise<SearchResult[]> {
    return this.searchProgressive(embedding, limit, threshold)
  }

  /**
   * Parallel search - search all shards concurrently
   */
  async searchParallel(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.0
  ): Promise<ShardedSearchResult[]> {
    this.ensureInitialized()

    // Search all shards in parallel
    const searchPromises = Array.from(this.shards.entries()).map(
      async ([shardId, shard]) => {
        const results = await shard.search(embedding, limit, threshold)
        return results.map(r => ({ ...r, shardId }))
      }
    )

    const shardResults = await Promise.all(searchPromises)
    const allResults = shardResults.flat()

    // Sort by similarity and return top results
    allResults.sort((a, b) => b.similarity - a.similarity)
    return allResults.slice(0, limit)
  }

  /**
   * Delete vectors for a file from its shard
   */
  async deleteVectorsForFile(filePath: string): Promise<number> {
    this.ensureInitialized()
    const shardId = this.getShardId(filePath)
    const shard = this.getShard(shardId)
    return shard.deleteVectorsForFile(filePath)
  }

  /**
   * Get vectors for a file from its shard
   */
  async getVectorsForFile(filePath: string): Promise<Vector[]> {
    this.ensureInitialized()
    const shardId = this.getShardId(filePath)
    const shard = this.getShard(shardId)
    return shard.getVectorsForFile(filePath)
  }

  /**
   * Track a file in its shard
   */
  async trackFile(
    filePath: string,
    hash: string,
    language: string,
    chunksCount: number
  ): Promise<void> {
    this.ensureInitialized()
    const shardId = this.getShardId(filePath)
    const shard = this.getShard(shardId)
    await shard.trackFile(filePath, hash, language, chunksCount)
  }

  /**
   * Get file hash from its shard
   */
  async getFileHash(filePath: string): Promise<string | null> {
    this.ensureInitialized()
    const shardId = this.getShardId(filePath)
    const shard = this.getShard(shardId)
    return shard.getFileHash(filePath)
  }

  /**
   * Get combined stats from all shards
   */
  async getStats(): Promise<IndexStats & { shardCount: number; shardStats: ShardInfo[] }> {
    this.ensureInitialized()

    await this.refreshShardInfos()

    let totalFiles = 0
    let totalChunks = 0
    let totalSize = 0
    let lastIndexedAt: Date | null = null

    for (const [, shard] of this.shards) {
      const stats = await shard.getStats()
      totalFiles += stats.totalFiles
      totalChunks += stats.totalChunks
      totalSize += stats.databaseSize

      if (stats.lastIndexedAt) {
        if (!lastIndexedAt || stats.lastIndexedAt > lastIndexedAt) {
          lastIndexedAt = stats.lastIndexedAt
        }
      }
    }

    return {
      totalFiles,
      totalChunks,
      totalEmbeddings: totalChunks,
      databaseSize: totalSize,
      lastIndexedAt,
      shardCount: this.shardCount,
      shardStats: Array.from(this.shardInfos.values()),
    }
  }

  /**
   * Clear all shards and meta-index
   */
  async clear(): Promise<void> {
    this.ensureInitialized()

    for (const [, shard] of this.shards) {
      await shard.clear()
    }

    if (this.metaStore) {
      await this.metaStore.clear()
    }

    // Reset shard infos
    for (const [id, info] of this.shardInfos) {
      info.fileCount = 0
      info.chunkCount = 0
      info.centroid = null
    }
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    for (const [, shard] of this.shards) {
      await shard.dispose()
    }
    this.shards.clear()

    if (this.metaStore) {
      await this.metaStore.dispose()
      this.metaStore = null
    }

    this.initialized = false
  }

  /**
   * Update shard centroids for better search routing
   *
   * Call this after indexing to improve search performance
   */
  async updateCentroids(): Promise<void> {
    this.ensureInitialized()

    for (const [shardId, shard] of this.shards) {
      const stats = await shard.getStats()
      if (stats.totalChunks === 0) continue

      // Sample vectors to compute centroid
      // For now, we'll skip actual centroid computation
      // (would need to iterate all vectors)
      const info = this.shardInfos.get(shardId)
      if (info) {
        info.chunkCount = stats.totalChunks
        info.fileCount = stats.totalFiles
      }
    }
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ShardedVectorStore not initialized. Call initialize() first.')
    }
  }

  /**
   * Rank shards by similarity to query (using centroids if available)
   *
   * Falls back to round-robin if no centroids
   */
  private async rankShards(embedding: number[]): Promise<number[]> {
    // For now, search all shards in order
    // TODO: Use centroids for smarter routing
    return Array.from({ length: this.shardCount }, (_, i) => i)
  }

  /**
   * Refresh shard info from actual stats
   */
  private async refreshShardInfos(): Promise<void> {
    for (const [shardId, shard] of this.shards) {
      try {
        const stats = await shard.getStats()
        const info = this.shardInfos.get(shardId)
        if (info) {
          info.fileCount = stats.totalFiles
          info.chunkCount = stats.totalChunks
        }
      } catch {
        // Shard might be empty
      }
    }
  }

  /**
   * Get the number of shards
   */
  get shardCountValue(): number {
    return this.shardCount
  }
}
