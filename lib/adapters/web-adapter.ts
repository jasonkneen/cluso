/**
 * Web WebSocket Adapter
 * Implements APIAdapter interface using WebSocket for bi-directional communication
 */

import type {
  APIAdapter,
  WebAPIAdapter,
  SubscriptionCallback,
  SubscriptionUnsubscribe,
} from './types'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Create a Web API adapter using WebSocket
 * @param serverUrl The server URL (e.g., "http://localhost:3000" or "wss://api.example.com")
 */
export function createWebAdapter(serverUrl?: string): WebAPIAdapter {
  const url = serverUrl || getDefaultServerUrl()
  let ws: WebSocket | null = null
  let requestId = 0
  const pendingRequests = new Map<number, PendingRequest>()
  const subscriptions = new Map<string, Set<SubscriptionCallback>>()
  const subscribedChannels = new Set<string>()

  let connectionPromise: Promise<void> | null = null
  let isConnecting = false

  const adapter: WebAPIAdapter = {
    type: 'web',

    get isConnected(): boolean {
      return ws !== null && ws.readyState === WebSocket.OPEN
    },

    async invoke<T = unknown>(channel: string, data?: unknown): Promise<T> {
      await ensureConnected()

      const id = requestId++
      const message = {
        type: 'invoke',
        id,
        channel,
        data,
      }

      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(id)
          reject(new Error(`Request timeout for channel ${channel}`))
        }, 30000) // 30 second timeout

        pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout })

        try {
          ws!.send(JSON.stringify(message))
        } catch (error) {
          pendingRequests.delete(id)
          clearTimeout(timeout)
          reject(error)
        }
      })
    },

    subscribe(channel: string, callback: SubscriptionCallback): SubscriptionUnsubscribe {
      if (!subscriptions.has(channel)) {
        subscriptions.set(channel, new Set())
      }
      subscriptions.get(channel)!.add(callback)

      // Send subscribe message if this is the first subscription
      if (!subscribedChannels.has(channel)) {
        subscribedChannels.add(channel)
        void (async () => {
          try {
            await ensureConnected()
            const message = {
              type: 'subscribe',
              channel,
            }
            ws!.send(JSON.stringify(message))
          } catch (error) {
            console.error(`[WebAdapter] Failed to subscribe to ${channel}:`, error)
          }
        })()
      }

      // Return unsubscribe function
      return () => {
        const callbacks = subscriptions.get(channel)
        if (callbacks) {
          callbacks.delete(callback)

          // If no more callbacks, unsubscribe from the server
          if (callbacks.size === 0) {
            subscriptions.delete(channel)
            subscribedChannels.delete(channel)

            // Send unsubscribe message if connected
            if (adapter.isConnected) {
              const message = {
                type: 'unsubscribe',
                channel,
              }
              try {
                ws!.send(JSON.stringify(message))
              } catch (error) {
                console.error(`[WebAdapter] Failed to unsubscribe from ${channel}:`, error)
              }
            }
          }
        }
      }
    },

    send(channel: string, data?: unknown): void {
      if (!adapter.isConnected) {
        console.warn('[WebAdapter] Not connected, cannot send')
        return
      }

      const message = {
        type: 'send',
        channel,
        data,
      }

      try {
        ws!.send(JSON.stringify(message))
      } catch (error) {
        console.error(`[WebAdapter] Failed to send on ${channel}:`, error)
      }
    },

    async disconnect(): Promise<void> {
      subscriptions.clear()
      subscribedChannels.clear()

      if (ws) {
        ws.close()
        ws = null
      }

      // Clear pending requests
      for (const { timeout } of pendingRequests.values()) {
        clearTimeout(timeout)
      }
      pendingRequests.clear()

      connectionPromise = null
      isConnecting = false
    },
  }

  /**
   * Ensure WebSocket is connected
   */
  async function ensureConnected(): Promise<void> {
    if (adapter.isConnected) {
      return
    }

    // Reuse existing connection promise if already connecting
    if (connectionPromise) {
      return connectionPromise
    }

    if (isConnecting) {
      // Wait for current connection attempt to finish
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isConnecting || adapter.isConnected) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 50)
      })
    }

    isConnecting = true
    connectionPromise = new Promise((resolve, reject) => {
      try {
        const wsUrl = toWebSocketUrl(url)
        ws = new WebSocket(wsUrl)

        ws.addEventListener('open', () => {
          console.debug('[WebAdapter] Connected to server')
          isConnecting = false

          // Re-subscribe to all channels
          for (const channel of subscribedChannels) {
            const message = {
              type: 'subscribe',
              channel,
            }
            try {
              ws!.send(JSON.stringify(message))
            } catch (error) {
              console.error(`[WebAdapter] Failed to re-subscribe to ${channel}:`, error)
            }
          }

          resolve()
        })

        ws.addEventListener('message', (event) => {
          handleMessage(event.data)
        })

        ws.addEventListener('error', (error) => {
          console.error('[WebAdapter] WebSocket error:', error)
          isConnecting = false
          ws = null
          reject(error)
        })

        ws.addEventListener('close', () => {
          console.debug('[WebAdapter] Disconnected from server')
          ws = null
          isConnecting = false

          // Clear all pending requests
          for (const { timeout, reject: rejectFn } of pendingRequests.values()) {
            clearTimeout(timeout)
            rejectFn(new Error('WebSocket closed'))
          }
          pendingRequests.clear()
        })
      } catch (error) {
        isConnecting = false
        reject(error)
      }
    })

    return connectionPromise
  }

  /**
   * Handle incoming WebSocket message
   */
  function handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as Record<string, unknown>

      if (message.type === 'response') {
        const id = message.id as number
        const pending = pendingRequests.get(id)
        if (pending) {
          clearTimeout(pending.timeout)
          pendingRequests.delete(id)

          if (message.error) {
            pending.reject(new Error(String(message.error)))
          } else {
            pending.resolve(message.data)
          }
        }
      } else if (message.type === 'event') {
        const channel = message.channel as string
        const callbacks = subscriptions.get(channel)
        if (callbacks) {
          for (const callback of callbacks) {
            try {
              callback(message.data)
            } catch (error) {
              console.error(
                `[WebAdapter] Error in subscription callback for ${channel}:`,
                error
              )
            }
          }
        }
      }
    } catch (error) {
      console.error('[WebAdapter] Failed to parse message:', error)
    }
  }

  return adapter
}

/**
 * Get the default server URL based on environment
 */
function getDefaultServerUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000'
  }

  // Check for environment variable
  const envUrl = (globalThis as Record<string, unknown>).VITE_API_URL ||
    (globalThis as Record<string, unknown>).API_SERVER_URL as string | undefined

  if (envUrl) {
    return envUrl
  }

  // Use current origin by default
  return window.location.origin
}

/**
 * Convert HTTP/HTTPS URL to WebSocket URL
 */
function toWebSocketUrl(httpUrl: string): string {
  try {
    const url = new URL(httpUrl)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}/ws`
  } catch (error) {
    console.warn('[WebAdapter] Invalid URL, using default:', error)
    return 'ws://localhost:3000/ws'
  }
}
