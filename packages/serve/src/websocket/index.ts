/**
 * WebSocket infrastructure
 *
 * Provides connection management, event broadcasting, and typed
 * event emission for real-time server communication.
 *
 * @example
 * ```typescript
 * import { WebSocketManager, EventBroadcaster } from './websocket'
 * import { WebSocketHandler } from 'hono/adapter'
 *
 * const manager = new WebSocketManager()
 * const broadcaster = new EventBroadcaster(manager)
 *
 * // In your Hono route handler:
 * app.ws('/ws', (c) => {
 *   const connId = crypto.randomUUID()
 *   const ws = c.raw as WebSocket
 *
 *   manager.addConnection(ws, connId)
 *
 *   ws.on('message', (data) => {
 *     const msg = JSON.parse(data) as WSMessage
 *     if (msg.type === 'subscribe') {
 *       manager.subscribe(connId, msg.channel!)
 *     }
 *   })
 * })
 *
 * // Broadcast events:
 * broadcaster.fileChanged('src/main.ts', 'change')
 * broadcaster.aiChunk('req-1', 'Hello ', 0, false)
 * ```
 */

export { WebSocketManager } from './manager.js'
export type { WSConnection } from './manager.js'

export { EventBroadcaster } from './events.js'
export type {
  FileChangeEvent,
  DiagnosticsUpdateEvent,
  AIChunkEvent,
  SearchProgressEvent,
  ValidationEvent,
  GitEvent,
} from './events.js'

// Re-export types from api.ts for convenience
export type { WSMessage, WSEvent } from '../types/api.js'
