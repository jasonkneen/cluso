/**
 * Electron IPC Adapter
 * Implements APIAdapter interface using Electron's IPC system
 */

import type {
  APIAdapter,
  ElectronAPIAdapter,
  SubscriptionCallback,
  SubscriptionUnsubscribe,
} from './types'

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean
      [key: string]: unknown
    }
  }
}

/**
 * Create an Electron API adapter
 * Wraps window.electronAPI for bi-directional communication
 */
export function createElectronAdapter(): ElectronAPIAdapter {
  const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null

  if (!electronAPI) {
    throw new Error('Electron API not available')
  }

  const subscriptions = new Map<string, Set<SubscriptionCallback>>()
  const listenerUnsubscribers = new Map<string, () => void>()

  const adapter: ElectronAPIAdapter = {
    type: 'electron',

    get isConnected(): boolean {
      return typeof window !== 'undefined' && !!window.electronAPI?.isElectron
    },

    async invoke<T = unknown>(channel: string, data?: unknown): Promise<T> {
      if (!electronAPI) {
        throw new Error('Electron API not available')
      }

      try {
        // Navigate the channel path (e.g., "git.getCurrentBranch" -> electronAPI.git.getCurrentBranch)
        const parts = channel.split('.')
        let target: unknown = electronAPI

        for (const part of parts) {
          if (target && typeof target === 'object' && part in target) {
            target = (target as Record<string, unknown>)[part]
          } else {
            throw new Error(`Channel ${channel} not found in Electron API`)
          }
        }

        if (typeof target !== 'function') {
          throw new Error(`Channel ${channel} is not a function`)
        }

        return await (target as (...args: unknown[]) => Promise<T>)(data)
      } catch (error) {
        console.error(`[ElectronAdapter] invoke failed for ${channel}:`, error)
        throw error
      }
    },

    subscribe(channel: string, callback: SubscriptionCallback): SubscriptionUnsubscribe {
      if (!electronAPI) {
        console.warn('[ElectronAdapter] Electron API not available for subscription')
        return () => {}
      }

      // Add callback to subscriptions set
      if (!subscriptions.has(channel)) {
        subscriptions.set(channel, new Set())
      }
      subscriptions.get(channel)!.add(callback)

      // Set up IPC listener if this is the first subscription to this channel
      if (!listenerUnsubscribers.has(channel)) {
        // For channels like "updates" -> "updates:event" or "fileWatcher" -> "file-watcher:change"
        const eventChannel = toEventChannel(channel)

        // Get the ipcRenderer from electronAPI if available
        // Note: In Electron context, we rely on the preload script having set up
        // event listeners that forward to this API
        // For now, we'll assume the adapter is used with proper IPC setup
        const unsubscriber = setupChannelListener(channel, eventChannel, subscriptions)
        listenerUnsubscribers.set(channel, unsubscriber)
      }

      // Return unsubscribe function
      return () => {
        const callbacks = subscriptions.get(channel)
        if (callbacks) {
          callbacks.delete(callback)
          // If no more callbacks, clean up the IPC listener
          if (callbacks.size === 0) {
            const unsubscriber = listenerUnsubscribers.get(channel)
            if (unsubscriber) {
              unsubscriber()
              listenerUnsubscribers.delete(channel)
            }
            subscriptions.delete(channel)
          }
        }
      }
    },

    send(channel: string, data?: unknown): void {
      if (!electronAPI) {
        console.warn('[ElectronAdapter] Electron API not available for send')
        return
      }

      try {
        // For send operations, navigate the channel path
        const parts = channel.split('.')
        let target: unknown = electronAPI

        for (const part of parts) {
          if (target && typeof target === 'object' && part in target) {
            target = (target as Record<string, unknown>)[part]
          } else {
            console.warn(`[ElectronAdapter] Channel ${channel} not found for send`)
            return
          }
        }

        if (typeof target === 'function') {
          ;(target as (data: unknown) => void)(data)
        }
      } catch (error) {
        console.error(`[ElectronAdapter] send failed for ${channel}:`, error)
      }
    },

    async disconnect(): Promise<void> {
      // Clean up all listeners
      for (const unsubscriber of listenerUnsubscribers.values()) {
        unsubscriber()
      }
      listenerUnsubscribers.clear()
      subscriptions.clear()
    },
  }

  return adapter
}

/**
 * Convert a channel name to an event channel name
 * Examples:
 *   "updates" -> "updates:event"
 *   "fileWatcher" -> "file-watcher:change"
 */
function toEventChannel(channel: string): string {
  const eventMap: Record<string, string> = {
    updates: 'updates:event',
    fileWatcher: 'file-watcher:change',
  }

  return eventMap[channel] || `${channel}:change`
}

/**
 * Set up an IPC listener for a channel
 * This is a helper that would normally be called from the preload script
 * to set up the actual Electron IPC listener
 */
function setupChannelListener(
  channel: string,
  eventChannel: string,
  subscriptions: Map<string, Set<SubscriptionCallback>>
): () => void {
  // This is a placeholder for the actual IPC setup
  // In a real implementation, the preload script would have already
  // set up these listeners through window.electronAPI methods like:
  // - window.electronAPI.updates.onEvent()
  // - window.electronAPI.fileWatcher.onChange()
  //
  // For now, we return a no-op unsubscriber
  console.debug(`[ElectronAdapter] Setting up listener for ${channel}`)

  return () => {
    console.debug(`[ElectronAdapter] Cleaning up listener for ${channel}`)
  }
}
