/**
 * ShardedSearcher - Progressive semantic search across shards
 *
 * Features:
 * - Meta-index routing (search centroids first)
 * - Progressive results (stream as shards complete)
 * - Parallel shard querying
 */

import { ShardedVectorStore, ShardedSearchResult } from './ShardedVectorStore.js'
import { Embedder } from './Embedder.js'
import type { SearchResult, SearchOptions } from './types.js'

/**
 * Extended search options for sharded search
 */
export interface ShardedSearchOptions extends SearchOptions {
  progressive?: boolean  // Stream results as shards complete
  parallelShards?: number  // Max shards to query in parallel
  onProgress?: (results: ShardedSearchResult[], shardId: number, complete: boolean) => void
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalShards: number
  shardsQueried: number
  totalResults: number
  durationMs: number
  shardDurations: Map<number, number>
}

export class ShardedSearcher {
  private embedder: Embedder
  private shardedStore: ShardedVectorStore

  constructor(embedder: Embedder, shardedStore: ShardedVectorStore) {
    this.embedder = embedder
    this.shardedStore = shardedStore
  }

  /**
   * Basic semantic search across all shards
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 10
    const threshold = options.threshold ?? 0.0  // No threshold - let user filter

    // Generate query embedding
    const embedding = await this.embedder.embed(query)

    // Search all shards
    return this.shardedStore.search(embedding, limit, threshold)
  }

  /**
   * Hybrid search (semantic + keyword) across shards
   */
  async hybridSearch(
    query: string,
    options: ShardedSearchOptions = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 10
    const threshold = options.threshold ?? 0.0  // No threshold - let user filter

    // Generate query embedding
    const embedding = await this.embedder.embed(query)

    if (options.progressive && options.onProgress) {
      // Progressive search with callback
      return this.shardedStore.searchProgressive(
        embedding,
        limit,
        threshold,
        options.onProgress
      )
    } else {
      // Parallel search (fastest)
      return this.shardedStore.searchParallel(embedding, limit, threshold)
    }
  }

  /**
   * Search with detailed stats
   */
  async searchWithStats(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; stats: SearchStats }> {
    const startTime = Date.now()
    const limit = options.limit ?? 10
    const threshold = options.threshold ?? 0.0  // No threshold - let user filter

    // Generate query embedding
    const embedding = await this.embedder.embed(query)

    // Track shard timings
    const shardDurations = new Map<number, number>()
    let shardsQueried = 0

    const results = await this.shardedStore.searchProgressive(
      embedding,
      limit,
      threshold,
      (_, shardId) => {
        shardDurations.set(shardId, Date.now() - startTime)
        shardsQueried++
      }
    )

    const stats: SearchStats = {
      totalShards: this.shardedStore.shardCountValue,
      shardsQueried,
      totalResults: results.length,
      durationMs: Date.now() - startTime,
      shardDurations,
    }

    return { results, stats }
  }

  /**
   * Find similar code to a given snippet
   */
  async findSimilar(
    code: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 10
    const threshold = options.threshold ?? 0.5  // Higher threshold for similarity

    const embedding = await this.embedder.embed(code)
    return this.shardedStore.searchParallel(embedding, limit, threshold)
  }
}
