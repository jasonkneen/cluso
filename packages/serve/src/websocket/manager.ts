// @ts-nocheck
/**
 * WebSocket connection manager
 *
 * Maintains active WebSocket connections, manages subscriptions,
 * and handles message broadcasting to subscribers.
 */

import { WebSocket, WebSocketServer } from 'ws'
import type { WSMessage } from '../types/api.js'

export interface WSConnection {
  ws: WebSocket
  id: string
  channels: Set<string>
  isAlive: boolean
}

/**
 * Manages WebSocket connections and subscriptions
 *
 * @example
 * ```typescript
 * const manager = new WebSocketManager(wss)
 *
 * // Add a new connection
 * manager.addConnection(ws, 'conn-1')
 *
 * // Subscribe to a channel
 * manager.subscribe('conn-1', 'file-changes')
 *
 * // Broadcast to all subscribers
 * manager.broadcast('file-changes', { file: 'test.ts', event: 'change' })
 *
 * // Send direct message
 * manager.send('conn-1', { type: 'response', data: 'hello' })
 * ```
 */
export class WebSocketManager {
  private connections: Map<string, WSConnection>
  private pingInterval: NodeJS.Timeout | null = null
  private wss: WebSocketServer

  constructor(wss: WebSocketServer) {
    this.wss = wss
    this.connections = new Map()
    this.startPingPong()
  }

  /**
   * Add a new WebSocket connection
   */
  addConnection(ws: WebSocket, id: string): void {
    const connection: WSConnection = {
      ws,
      id,
      channels: new Set(),
      isAlive: true,
    }

    this.connections.set(id, connection)

    // Handle pong responses for health checks
    ws.on('pong', () => {
      const conn = this.connections.get(id)
      if (conn) {
        conn.isAlive = true
      }
    })

    // Clean up on close
    ws.on('close', () => {
      this.removeConnection(id)
    })

    // Log errors but don't crash
    ws.on('error', (error) => {
      console.error(`[WebSocket] Connection ${id} error:`, error)
    })
  }

  /**
   * Remove a WebSocket connection and clean up subscriptions
   */
  removeConnection(id: string): void {
    const connection = this.connections.get(id)
    if (connection) {
      try {
        if (connection.ws.readyState === 1) { // OPEN
          connection.ws.close()
        }
      } catch (error) {
        console.error(`[WebSocket] Error closing connection ${id}:`, error)
      }
      this.connections.delete(id)
    }
  }

  /**
   * Subscribe a connection to a channel
   */
  subscribe(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.channels.add(channel)
    }
  }

  /**
   * Unsubscribe a connection from a channel
   */
  unsubscribe(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.channels.delete(channel)
    }
  }

  /**
   * Broadcast a message to all subscribers of a channel
   */
  broadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({
      type: 'event',
      channel,
      data,
      timestamp: new Date().toISOString(),
    })

    let successCount = 0
    let failureCount = 0

    for (const connection of this.connections.values()) {
      if (connection.channels.has(channel)) {
        try {
          if (connection.ws.readyState === 1) { // OPEN
            connection.ws.send(message)
            successCount++
          } else {
            failureCount++
          }
        } catch (error) {
          console.error(
            `[WebSocket] Failed to broadcast to ${connection.id}:`,
            error
          )
          failureCount++
        }
      }
    }

    if (failureCount > 0) {
      console.warn(
        `[WebSocket] Broadcast to "${channel}": ${successCount} success, ${failureCount} failed`
      )
    }
  }

  /**
   * Send a direct message to a specific connection
   */
  send(connectionId: string, data: unknown): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      console.warn(`[WebSocket] Connection ${connectionId} not found`)
      return
    }

    try {
      if (connection.ws.readyState === 1) { // OPEN
        connection.ws.send(JSON.stringify(data))
      } else {
        console.warn(
          `[WebSocket] Connection ${connectionId} is not open (state: ${connection.ws.readyState})`
        )
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send to ${connectionId}:`, error)
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): Map<string, WSConnection> {
    return new Map(this.connections)
  }

  /**
   * Get subscribers for a channel
   */
  getSubscribers(channel: string): string[] {
    const subscribers: string[] = []
    for (const connection of this.connections.values()) {
      if (connection.channels.has(channel)) {
        subscribers.push(connection.id)
      }
    }
    return subscribers
  }

  /**
   * Get channels a connection is subscribed to
   */
  getChannels(connectionId: string): string[] {
    const connection = this.connections.get(connectionId)
    return connection ? Array.from(connection.channels) : []
  }

  /**
   * Start periodic ping/pong for connection health checks
   */
  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now()
      const deadConnections: string[] = []

      for (const connection of this.connections.values()) {
        if (!connection.isAlive) {
          // Connection didn't respond to last ping, mark as dead
          deadConnections.push(connection.id)
        } else {
          // Mark as not alive, will be set to true on pong
          connection.isAlive = false

          // Send ping
          try {
            if (connection.ws.readyState === 1) { // OPEN
              connection.ws.ping()
            }
          } catch (error) {
            console.error(
              `[WebSocket] Failed to ping connection ${connection.id}:`,
              error
            )
            deadConnections.push(connection.id)
          }
        }
      }

      // Clean up dead connections
      for (const id of deadConnections) {
        console.info(`[WebSocket] Removing dead connection ${id}`)
        this.removeConnection(id)
      }
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Handle a new WebSocket connection
   * Called when a client connects to the WebSocket endpoint
   */
  handleConnection(ws: WebSocket, cwd: string): void {
    const connectionId = this.generateId()
    this.addConnection(ws, connectionId)

    // Send connection confirmation
    this.send(connectionId, {
      type: 'response',
      data: {
        status: 'connected',
        connectionId,
        cwd,
      },
    })

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString())

        switch (message.type) {
          case 'subscribe': {
            if (message.channel) {
              this.subscribe(connectionId, message.channel)
              this.send(connectionId, {
                type: 'response',
                id: message.id,
                data: {
                  status: 'subscribed',
                  channel: message.channel,
                },
              })
            }
            break
          }

          case 'unsubscribe': {
            if (message.channel) {
              this.unsubscribe(connectionId, message.channel)
              this.send(connectionId, {
                type: 'response',
                id: message.id,
                data: {
                  status: 'unsubscribed',
                  channel: message.channel,
                },
              })
            }
            break
          }

          case 'request': {
            // Handle request messages (for RPC-style communication)
            // Subclasses or handler functions should override this behavior
            this.send(connectionId, {
              type: 'response',
              id: message.id,
              data: {
                error: 'No handler for request type',
              },
            })
            break
          }

          default:
            console.warn(
              `[WebSocket] Unknown message type: ${(message as any).type}`
            )
        }
      } catch (error) {
        console.error(`[WebSocket] Error parsing message from ${connectionId}:`, error)
        try {
          this.send(connectionId, {
            type: 'response',
            data: {
              error: 'Failed to parse message',
            },
          })
        } catch (sendError) {
          console.error(
            `[WebSocket] Failed to send error response to ${connectionId}:`,
            sendError
          )
        }
      }
    })

    console.info(`[WebSocket] Client connected: ${connectionId}`)
  }

  /**
   * Generate a unique connection ID
   */
  private generateId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  /**
   * Shut down the manager and close all connections
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    for (const connection of this.connections.values()) {
      this.removeConnection(connection.id)
    }

    this.connections.clear()
  }
}
