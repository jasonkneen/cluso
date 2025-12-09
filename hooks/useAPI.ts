/**
 * Unified API Hook for Cluso
 * Auto-detects environment (Electron vs Web) and provides API adapter
 * with WebSocket event subscriptions and connection state management
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { APIAdapter, SubscriptionCallback } from '../lib/adapters'
import { getAdapter } from '../lib/adapters'

interface UseAPIOptions {
  /** Override default server URL for web mode */
  serverUrl?: string
  /** Enable debug logging */
  debug?: boolean
}

interface UseAPIResult {
  /** The API adapter instance (null if not initialized) */
  api: APIAdapter | null

  /** True if running in Electron environment */
  isElectron: boolean

  /** True if API adapter is connected and ready */
  isConnected: boolean

  /** Subscribe to events on a channel
   * In Electron: Listens to IPC events
   * In Web: Subscribes to WebSocket events
   * Returns unsubscribe function
   */
  subscribe: (channel: string, callback: SubscriptionCallback) => () => void

  /** Send a request and wait for response */
  invoke: <T = unknown>(channel: string, data?: unknown) => Promise<T>

  /** Send a one-way message */
  send: (channel: string, data?: unknown) => void

  /** Disconnect the adapter and clean up resources */
  disconnect: () => Promise<void>
}

/**
 * React hook for accessing the unified API adapter
 * Automatically detects environment and provides type-safe API access
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { api, isElectron, isConnected, subscribe } = useAPI()
 *
 *   useEffect(() => {
 *     if (!isConnected) return
 *
 *     // Subscribe to file watcher events
 *     const unsubscribe = subscribe('fileWatcher', (data) => {
 *       console.log('File changed:', data)
 *     })
 *
 *     return unsubscribe
 *   }, [isConnected, subscribe])
 *
 *   return <div>API: {isElectron ? 'Electron' : 'Web'}</div>
 * }
 * ```
 */
export function useAPI(options?: UseAPIOptions): UseAPIResult {
  const [adapter, setAdapter] = useState<APIAdapter | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  // Initialize adapter on mount
  useEffect(() => {
    try {
      const api = getAdapter(options?.serverUrl)
      setAdapter(api)
      setIsElectron(api.type === 'electron')

      if (options?.debug) {
        console.debug('[useAPI] Initialized with adapter type:', api.type)
      }

      // For Electron, we're immediately connected
      // For Web, we'll set to true once the WebSocket connects
      if (api.type === 'electron') {
        setIsConnected(true)
      } else {
        // Web adapter connects on first invoke/subscribe
        // Set up a check for connection status
        const interval = setInterval(() => {
          if (api.isConnected) {
            setIsConnected(true)
            clearInterval(interval)
          }
        }, 500)

        return () => clearInterval(interval)
      }
    } catch (error) {
      console.error('[useAPI] Failed to initialize adapter:', error)
    }

    return undefined
  }, [options?.serverUrl, options?.debug])

  // Memoized subscribe function
  const subscribe: UseAPIResult['subscribe'] = useCallback(
    (channel: string, callback: SubscriptionCallback) => {
      if (!adapter) {
        console.warn('[useAPI] Adapter not initialized, cannot subscribe to', channel)
        return () => {}
      }

      if (options?.debug) {
        console.debug('[useAPI] Subscribing to channel:', channel)
      }

      return adapter.subscribe(channel, (data) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[useAPI] Error in subscription callback for ${channel}:`, error)
        }
      })
    },
    [adapter, options?.debug]
  )

  // Memoized invoke function
  const invoke: UseAPIResult['invoke'] = useCallback(
    <T = unknown,>(channel: string, data?: unknown): Promise<T> => {
      if (!adapter) {
        return Promise.reject(new Error('[useAPI] Adapter not initialized'))
      }

      if (options?.debug) {
        console.debug('[useAPI] Invoking channel:', channel, data)
      }

      return adapter.invoke<T>(channel, data)
    },
    [adapter, options?.debug]
  )

  // Memoized send function
  const send: UseAPIResult['send'] = useCallback(
    (channel: string, data?: unknown) => {
      if (!adapter) {
        console.warn('[useAPI] Adapter not initialized, cannot send to', channel)
        return
      }

      if (options?.debug) {
        console.debug('[useAPI] Sending to channel:', channel, data)
      }

      adapter.send(channel, data)
    },
    [adapter, options?.debug]
  )

  // Memoized disconnect function
  const disconnect: UseAPIResult['disconnect'] = useCallback(async () => {
    if (!adapter) {
      return
    }

    if (options?.debug) {
      console.debug('[useAPI] Disconnecting adapter')
    }

    await adapter.disconnect()
    setIsConnected(false)
  }, [adapter, options?.debug])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Don't automatically disconnect on unmount, as the adapter might be
      // shared across multiple components. Let each component manage its
      // own subscriptions and let the global adapter stay alive.
    }
  }, [])

  return useMemo(
    () => ({
      api: adapter,
      isElectron,
      isConnected,
      subscribe,
      invoke,
      send,
      disconnect,
    }),
    [adapter, isElectron, isConnected, subscribe, invoke, send, disconnect]
  )
}

/**
 * Non-hook version for use outside React components
 * Use sparingly - prefer the hook version in React components
 *
 * @example
 * ```ts
 * const api = getAPI()
 * const result = await api.invoke('git.getCurrentBranch')
 * ```
 */
export function getAPI(serverUrl?: string): APIAdapter {
  return getAdapter(serverUrl)
}

/**
 * Type guard to check if a value is an API adapter
 */
export function isAPIAdapter(value: unknown): value is APIAdapter {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'invoke' in value &&
    'subscribe' in value &&
    'send' in value &&
    'disconnect' in value
  )
}
