/**
 * API Adapter Types
 * Defines the interface for different API backends (Electron IPC vs WebSocket)
 */

export interface APIRequest {
  channel: string
  data?: unknown
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface SubscriptionCallback {
  (data: unknown): void
}

export interface SubscriptionUnsubscribe {
  (): void
}

/**
 * Base API adapter interface
 * Both Electron and Web adapters implement this contract
 */
export interface APIAdapter {
  /** Unique identifier for the adapter type */
  readonly type: 'electron' | 'web'

  /** Whether the adapter is currently connected */
  readonly isConnected: boolean

  /**
   * Send a request and wait for response
   * In Electron: Uses IPC invoke
   * In Web: Sends message over WebSocket
   */
  invoke<T = unknown>(channel: string, data?: unknown): Promise<T>

  /**
   * Subscribe to events on a channel
   * In Electron: Listens to IPC events
   * In Web: Sends subscribe message and listens for updates
   * Returns unsubscribe function
   */
  subscribe(channel: string, callback: SubscriptionCallback): SubscriptionUnsubscribe

  /**
   * Send a one-way message (fire-and-forget)
   * In Electron: Uses IPC send
   * In Web: Sends message over WebSocket
   */
  send(channel: string, data?: unknown): void

  /**
   * Clean up resources and close connections
   */
  disconnect(): Promise<void>
}

/**
 * Electron-specific API adapter
 * Wraps Electron IPC for bi-directional communication
 */
export interface ElectronAPIAdapter extends APIAdapter {
  readonly type: 'electron'
}

/**
 * Web-based API adapter
 * Uses WebSocket for bi-directional communication
 */
export interface WebAPIAdapter extends APIAdapter {
  readonly type: 'web'
}
