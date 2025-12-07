/**
 * Worker pool exports for parallel processing
 */

export {
  runParallelIndex,
  runParallelSearch,
  type PoolOptions,
  type IndexWorkerData,
  type SearchWorkerData,
  type IndexProgress,
  type IndexResult,
  type SearchResult as WorkerSearchResult,
} from './pool.js'
