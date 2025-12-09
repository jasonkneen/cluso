# WebSocket Infrastructure

Real-time bidirectional communication system for the Cluso server using WebSocket protocol with subscription-based event channels.

## Overview

The WebSocket infrastructure consists of three main components:

1. **WebSocketManager** (`manager.ts`) - Connection lifecycle management, subscription routing, and message broadcasting
2. **EventBroadcaster** (`events.ts`) - Typed event emission methods for different server events
3. **Types** - Message and event type definitions from `types/api.ts`

## Architecture

### Message Flow

```
Client WebSocket Connection
    ↓
WebSocketManager.handleConnection()
    ├─ Validates & routes messages
    ├─ Manages subscriptions
    └─ Broadcasts to subscribers

EventBroadcaster.emit()
    ↓
WebSocketManager.broadcast(channel, data)
    ↓
All connections subscribed to channel
```

### Message Types

All messages follow the `WSMessage` interface:

```typescript
interface WSMessage {
  id?: string                                    // Optional request ID for correlation
  type: 'subscribe' | 'unsubscribe' | 'request' | 'event' | 'response'
  channel?: string                               // Channel name for subscriptions
  handler?: string                               // Handler identifier
  data?: unknown                                 // Message payload
}
```

Events broadcast to subscribers follow the `WSEvent` interface:

```typescript
interface WSEvent {
  type: 'event'
  channel: string                                // Channel name
  data: unknown                                  // Event payload
  timestamp: string                              // ISO timestamp
}
```

## Components

### WebSocketManager

Manages WebSocket connections, tracks subscriptions, and broadcasts messages.

#### Constructor

```typescript
const manager = new WebSocketManager(wss: WebSocketServer)
```

Takes the `ws.WebSocketServer` instance created by the HTTP server.

#### Key Methods

##### Connection Management

- `addConnection(ws, id)` - Register a new WebSocket connection
- `removeConnection(id)` - Unregister and close a connection
- `getConnections()` - Get all active connections

##### Subscription Management

- `subscribe(connectionId, channel)` - Subscribe connection to channel
- `unsubscribe(connectionId, channel)` - Unsubscribe from channel
- `getChannels(connectionId)` - Get channels connection is subscribed to
- `getSubscribers(channel)` - Get all subscribers to a channel

##### Message Handling

- `broadcast(channel, data)` - Send message to all subscribers of channel
- `send(connectionId, data)` - Send direct message to connection
- `handleConnection(ws, cwd)` - Handle new connection (called by WebSocketServer)

##### Lifecycle

- `shutdown()` - Close all connections and cleanup

#### Auto-Handled Features

- **Subscription Messages** - Automatically handles `subscribe`/`unsubscribe` messages
- **Ping/Pong Health Checks** - Periodic ping every 30 seconds, removes dead connections
- **Error Handling** - Logs errors without crashing, cleans up on disconnect
- **Connection Confirmation** - Sends connection confirmation with ID and working directory

### EventBroadcaster

Provides typed event emission methods for broadcasting server events.

#### Constructor

```typescript
const broadcaster = new EventBroadcaster(manager: WebSocketManager)
```

#### Typed Event Methods

Each method broadcasts to a specific channel with typed data.

**File Events**
```typescript
fileChanged(file: string, event: 'add' | 'change' | 'unlink' | 'unlinkDir' | 'addDir')
// Broadcasts to 'files' channel
```

**Diagnostics Events**
```typescript
diagnosticsUpdated(diagnostics: LSPDiagnostic[], cleared?: boolean)
// Broadcasts to 'diagnostics' channel
```

**AI Response Events**
```typescript
aiChunk(id: string, chunk: string, index: number, finished: boolean)
// Broadcasts to 'ai-response' channel
```

**Search Progress Events**
```typescript
searchProgress(query: string, completed: number, total: number | null, results: SearchResult[])
// Broadcasts to 'search' channel
```

**Validation Events**
```typescript
validationComplete(validation: ValidationResult)
// Broadcasts to 'validation' channel
```

**Git Events**
```typescript
gitEvent(type: 'status' | 'commit' | 'push' | 'pull' | 'branch', message: string)
// Broadcasts to 'git' channel
```

**Custom Events**
```typescript
emit(channel: string, data: unknown)
// Broadcasts custom data to arbitrary channel
```

## Channels

Channels are subscription topics. Clients subscribe to channels to receive specific event types.

| Channel | Description | Broadcaster Method |
|---------|-------------|--------------------|
| `files` | File system changes | `fileChanged()` |
| `diagnostics` | LSP diagnostics, errors, warnings | `diagnosticsUpdated()` |
| `ai-response` | AI streaming responses | `aiChunk()` |
| `search` | Search progress updates | `searchProgress()` |
| `validation` | Lint, typecheck, format results | `validationComplete()` |
| `git` | Git operation events | `gitEvent()` |

## Usage Example

### Server Setup

```typescript
import { WebSocketManager, EventBroadcaster } from '../websocket'
import { WebSocketServer } from 'ws'

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server })

// Initialize manager and broadcaster
const wsManager = new WebSocketManager(wss)
const broadcaster = new EventBroadcaster(wsManager)

// Handle new connections
wss.on('connection', (ws) => {
  wsManager.handleConnection(ws, process.cwd())
})

// Export for use in route handlers and event listeners
export { wsManager, broadcaster }
```

### Broadcasting Events

In file watchers, LSP handlers, etc:

```typescript
// File change event
broadcaster.fileChanged('src/main.ts', 'change')

// AI response streaming
broadcaster.aiChunk('request-123', 'Hello ', 0, false)
broadcaster.aiChunk('request-123', 'world', 1, true)

// Diagnostics update
broadcaster.diagnosticsUpdated([
  {
    file: 'src/main.ts',
    line: 10,
    column: 5,
    message: 'Type error',
    severity: 'error',
    source: 'tsc'
  }
])

// Search progress
broadcaster.searchProgress('useState', 150, 500, [
  { file: 'src/hooks.ts', line: 45, column: 12, match: 'useState', context: '...' }
])
```

### Client Side (Example)

```typescript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.addEventListener('open', () => {
  // Subscribe to file changes
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'files'
  }))

  // Subscribe to diagnostics
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'diagnostics'
  }))
})

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)

  if (msg.type === 'event') {
    if (msg.channel === 'files') {
      console.log('File changed:', msg.data.file)
    } else if (msg.channel === 'diagnostics') {
      console.log('Diagnostics:', msg.data.diagnostics)
    }
  }
})
```

## Message Protocol

### Client to Server

**Subscribe to channel:**
```json
{
  "id": "req-1",
  "type": "subscribe",
  "channel": "files"
}
```

**Unsubscribe from channel:**
```json
{
  "id": "req-2",
  "type": "unsubscribe",
  "channel": "files"
}
```

**Send request (for RPC-style handlers):**
```json
{
  "id": "req-3",
  "type": "request",
  "handler": "get-status",
  "data": { "path": "/src" }
}
```

### Server to Client

**Connection confirmation:**
```json
{
  "type": "response",
  "data": {
    "status": "connected",
    "connectionId": "conn-1733747230000-abc123",
    "cwd": "/Users/dev/project"
  }
}
```

**Subscription confirmation:**
```json
{
  "type": "response",
  "id": "req-1",
  "data": {
    "status": "subscribed",
    "channel": "files"
  }
}
```

**Event broadcast:**
```json
{
  "type": "event",
  "channel": "files",
  "data": {
    "file": "src/main.ts",
    "event": "change",
    "timestamp": "2024-12-09T15:30:45.123Z"
  },
  "timestamp": "2024-12-09T15:30:45.123Z"
}
```

## Connection Lifecycle

1. **Connect**: Client connects to WebSocket endpoint
2. **Confirm**: Server sends connection confirmation with ID
3. **Subscribe**: Client sends subscription messages for channels
4. **Listen**: Client receives events on subscribed channels
5. **Unsubscribe**: Client can unsubscribe from channels
6. **Close**: Connection closes, server cleans up

## Health Checks

The WebSocketManager automatically monitors connection health:

- **Ping Interval**: 30 seconds
- **Timeout**: If no pong received on next ping cycle, connection is marked dead and removed
- **Automatic Cleanup**: Dead connections are removed and garbage collected

## Error Handling

All errors are caught and logged without crashing:

- **Parse Errors**: JSON parse errors are caught and error response sent
- **Send Errors**: Broadcast failures are logged with success/failure counts
- **Connection Errors**: WebSocket errors are logged per connection
- **Cleanup**: Connection close always triggers cleanup

## Performance Considerations

- **Broadcasting**: O(n) where n = subscribers to channel (not total connections)
- **Memory**: Each connection stores only its ID, WebSocket reference, and Set of channels
- **CPU**: Ping/pong runs every 30 seconds, not per message
- **Concurrency**: All message handling is synchronous, suitable for Node.js event loop

## Integration Points

The WebSocket infrastructure integrates with:

1. **HTTP Server** (Hono + Node adapter) - Shares HTTP port
2. **File Watcher** (chokidar) - Emits file events
3. **LSP Client** - Receives diagnostics
4. **AI/Gemini API** - Streams responses
5. **Search Service** - Broadcasts progress
6. **Git Operations** - Emits git events
7. **Validation Tools** - Sends validation results

All of these should use the `broadcaster` instance to emit events.

## Testing

The manager can be tested without real WebSocket connections:

```typescript
import { WebSocketManager } from '../websocket/manager'
import { EventEmitter } from 'events'

// Create mock WebSocket
const mockWs = new EventEmitter() as any
mockWs.readyState = 1 // OPEN
mockWs.send = vi.fn()

// Test
const wss = new EventEmitter() as any
const manager = new WebSocketManager(wss)
manager.addConnection(mockWs, 'test-1')
manager.subscribe('test-1', 'files')
manager.broadcast('files', { file: 'test.ts' })

expect(mockWs.send).toHaveBeenCalled()
```
