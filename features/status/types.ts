/**
 * Status Feature Types
 *
 * Type definitions for status indicator state management.
 * Includes indexing, file watcher, and fast apply status.
 */

/**
 * Indexing status values
 * - idle: Not indexing, no index available
 * - indexing: Currently building the index
 * - indexed: Index is built and ready
 */
export type IndexingStatus = 'idle' | 'indexing' | 'indexed'

/**
 * Status state managed by useStatusState hook
 */
export interface StatusState {
  /** Whether Fast Apply (Pro feature) is ready */
  fastApplyReady: boolean
  /** Whether the file watcher is active */
  fileWatcherActive: boolean
  /** Current indexing status */
  indexingStatus: IndexingStatus
}

/**
 * Actions returned by useStatusState hook
 */
export interface StatusStateActions {
  setFastApplyReady: React.Dispatch<React.SetStateAction<boolean>>
  setFileWatcherActive: React.Dispatch<React.SetStateAction<boolean>>
  setIndexingStatus: React.Dispatch<React.SetStateAction<IndexingStatus>>
  /** Mark indexing as started */
  startIndexing: () => void
  /** Mark indexing as complete */
  completeIndexing: () => void
  /** Reset indexing to idle */
  resetIndexing: () => void
}
