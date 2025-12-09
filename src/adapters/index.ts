/**
 * API Adapter Export
 * Auto-detects environment and provides the appropriate adapter
 * Components should use the default export to get the adapter
 */

import type { APIAdapter } from './types'
import { createElectronAdapter } from './electron-adapter'
import { createWebAdapter } from './web-adapter'

// Cached adapter instance to avoid recreating on every call
let cachedAdapter: APIAdapter | null = null

/**
 * Get the appropriate API adapter for the current environment
 * Auto-detects Electron vs Web mode
 * Caches the adapter instance for reuse
 *
 * Usage in components:
 * ```typescript
 * import { getAdapter } from '@/adapters'
 * const adapter = getAdapter()
 * const result = await adapter.files.readFile('/path/to/file')
 * ```
 */
export function getAdapter(): APIAdapter {
  if (cachedAdapter) {
    return cachedAdapter
  }

  // Check if running in Electron
  const isElectron =
    typeof window !== 'undefined' && window.electronAPI?.isElectron === true

  if (isElectron) {
    cachedAdapter = createElectronAdapter()
  } else {
    // Use web adapter with API server on same host
    const baseUrl = getApiBaseUrl()
    cachedAdapter = createWebAdapter(baseUrl)
  }

  return cachedAdapter
}

/**
 * Determine the API base URL for web mode
 * In production, assumes the API is served from the same host
 * In development, connects to localhost:3001 by default
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001'
  }

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    // In dev, assume API is running on port 3001
    return 'http://localhost:3001'
  }

  // In production, use same origin
  return window.location.origin
}

/**
 * Reset the cached adapter instance
 * Useful for testing or switching between adapters
 */
export function resetAdapter(): void {
  cachedAdapter = null
}

/**
 * Force use of a specific adapter
 * Primarily useful for testing
 */
export function setAdapter(adapter: APIAdapter): void {
  cachedAdapter = adapter
}

/**
 * Check if the app is running in Electron mode
 */
export function isElectronMode(): boolean {
  return (
    typeof window !== 'undefined' && window.electronAPI?.isElectron === true
  )
}

// Re-export types for convenience
export type { APIAdapter, Result } from './types'
export type {
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
