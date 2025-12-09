/**
 * API Adapter Type Declarations
 * Provides TypeScript type definitions for the API adapter layer
 */

import type {
  APIAdapter,
  Result,
  GitStatus,
  DirectoryEntry,
  FileStat,
  FileTreeNode,
  SearchMatch,
  GlobMatch,
  OAuthStartResult,
  OAuthStatus,
  SearchOptions,
  TreeOptions,
  SaveImageResult,
} from './types'

/**
 * Get the appropriate API adapter for the current environment
 * Auto-detects Electron vs Web mode and returns the correct adapter
 */
export declare function getAdapter(): APIAdapter

/**
 * Reset the cached adapter instance
 * Useful for testing or switching between adapters
 */
export declare function resetAdapter(): void

/**
 * Force use of a specific adapter
 * Primarily useful for testing
 */
export declare function setAdapter(adapter: APIAdapter): void

/**
 * Check if the app is running in Electron mode
 */
export declare function isElectronMode(): boolean

// Re-export all types
export type {
  APIAdapter,
  Result,
  GitStatus,
  DirectoryEntry,
  FileStat,
  FileTreeNode,
  SearchMatch,
  GlobMatch,
  OAuthStartResult,
  OAuthStatus,
  SearchOptions,
  TreeOptions,
  SaveImageResult,
}
