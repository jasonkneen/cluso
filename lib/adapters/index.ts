/**
 * API Adapter Factory and Exports
 */

export type { APIAdapter, APIRequest, APIResponse, SubscriptionCallback, SubscriptionUnsubscribe, ElectronAPIAdapter, WebAPIAdapter } from './types'

import type { APIAdapter } from './types'
import { createElectronAdapter } from './electron-adapter'
import { createWebAdapter } from './web-adapter'

let adapterInstance: APIAdapter | null = null

/**
 * Get or create the appropriate API adapter based on environment
 * @param serverUrl Optional server URL for web mode
 */
export function getAdapter(serverUrl?: string): APIAdapter {
  // Reuse existing adapter instance
  if (adapterInstance) {
    return adapterInstance
  }

  // Auto-detect environment
  const isElectron = isElectronEnvironment()

  if (isElectron) {
    adapterInstance = createElectronAdapter()
  } else {
    adapterInstance = createWebAdapter(serverUrl)
  }

  return adapterInstance
}

/**
 * Reset the adapter instance (useful for testing)
 */
export function resetAdapter(): void {
  if (adapterInstance) {
    void adapterInstance.disconnect()
  }
  adapterInstance = null
}

/**
 * Check if running in Electron environment
 */
function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return !!window.electronAPI?.isElectron
}

/**
 * Force use of a specific adapter type (useful for testing)
 */
export function createAdapter(type: 'electron' | 'web', serverUrl?: string): APIAdapter {
  if (type === 'electron') {
    return createElectronAdapter()
  } else {
    return createWebAdapter(serverUrl)
  }
}

// Re-export adapter implementations for direct use if needed
export { createElectronAdapter } from './electron-adapter'
export { createWebAdapter } from './web-adapter'
