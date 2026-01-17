/**
 * Mgrep Feature Types
 *
 * Type definitions for mgrep project indexing integration.
 */

import type { IndexingStatus } from '../status/types'

/**
 * Options for useMgrepInit hook
 */
export interface UseMgrepInitOptions {
  /** Project path to check/initialize mgrep for */
  projectPath: string | undefined | null
  /** Callback to set indexing status */
  setIndexingStatus: (status: IndexingStatus) => void
  /** Callback to show onboarding modal */
  setShowOnboarding: (show: boolean) => void
}

/**
 * Return type for useMgrepInit hook
 */
export interface UseMgrepInitReturn {
  /** Set of projects that have been initialized (for tracking) */
  initializedProjects: Set<string>
}
