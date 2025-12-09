# WebSocket Quick Start Guide

Fast integration guide for using the WebSocket infrastructure in Cluso server.

## Files

All WebSocket code is in `/src/websocket/`:
- `manager.ts` - Connection and subscription management
- `events.ts` - Typed event broadcasting
- `index.ts` - Public exports
- `README.md` - Detailed documentation

## Basic Setup (Already Done)

The `src/server/app.ts` already has:

```typescript
const wss = new WebSocketServer({ server })
const wsManager = new WebSocketManager(wss)

wss.on('connection', (ws) => {
  wsManager.handleConnection(ws, options.cwd)
})
```

## Using in Handlers

### Step 1: Import

```typescript
import { EventBroadcaster } from '../websocket'
import type { WebSocketManager } from '../websocket/manager'
```

### Step 2: Create Broadcaster (in route setup)

```typescript
export function setupFileRoutes(wsManager: WebSocketManager) {
  const broadcaster = new EventBroadcaster(wsManager)

  // ... create routes using broadcaster
}
```

### Step 3: Broadcast Events

```typescript
// File changes
broadcaster.fileChanged('src/main.ts', 'change')

// Diagnostics
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

// AI response streaming
broadcaster.aiChunk('req-123', 'Hello ', 0, false)
broadcaster.aiChunk('req-123', 'world', 1, true)

// Search progress
broadcaster.searchProgress('useState', 50, 200, results)

// Validation
broadcaster.validationComplete(validationResult)

// Git operations
broadcaster.gitEvent('commit', 'Committed changes')
```

## Channel Reference

| Channel | Method | Usage |
|---------|--------|-------|
| `files` | `fileChanged(file, event)` | File watcher events |
| `diagnostics` | `diagnosticsUpdated(diags)` | Lint/type errors |
| `ai-response` | `aiChunk(id, chunk, index, finished)` | AI streaming |
| `search` | `searchProgress(query, count, total, results)` | Search results |
| `validation` | `validationComplete(result)` | Validation results |
| `git` | `gitEvent(type, message)` | Git operations |

## Client Code (Browser)

```typescript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.addEventListener('open', () => {
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'files'
  }))

  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ai-response'
  }))
})

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)

  if (msg.type === 'event') {
    switch (msg.channel) {
      case 'files':
        handleFileChange(msg.data)
        break
      case 'ai-response':
        handleAIChunk(msg.data)
        break
      // ... other channels
    }
  }
})
```

## Integration Points

### 1. File Watcher (chokidar)

```typescript
import chokidar from 'chokidar'
import { EventBroadcaster } from '../websocket'

const watcher = chokidar.watch(cwd, { ignored: 'node_modules' })
const broadcaster = new EventBroadcaster(wsManager)

watcher.on('change', (path) => {
  broadcaster.fileChanged(path, 'change')
})

watcher.on('add', (path) => {
  broadcaster.fileChanged(path, 'add')
})

watcher.on('unlink', (path) => {
  broadcaster.fileChanged(path, 'unlink')
})
```

### 2. LSP Client (Language Server)

```typescript
import { EventBroadcaster } from '../websocket'

lspClient.onNotification('textDocument/publishDiagnostics', (params) => {
  const diagnostics = params.diagnostics.map((diag) => ({
    file: params.uri,
    line: diag.range.start.line,
    column: diag.range.start.character,
    message: diag.message,
    severity: diag.severity === 1 ? 'error' : 'warning',
    source: diag.source || 'lsp'
  }))

  broadcaster.diagnosticsUpdated(diagnostics)
})
```

### 3. AI/Gemini API

```typescript
import { EventBroadcaster } from '../websocket'

// In Gemini streaming handler
async function streamAIResponse(requestId, prompt) {
  const broadcaster = new EventBroadcaster(wsManager)
  let index = 0

  for await (const chunk of geminiStream(prompt)) {
    broadcaster.aiChunk(requestId, chunk.text, index++, false)
  }

  broadcaster.aiChunk(requestId, '', index, true) // finished
}
```

### 4. Search Service (mgrep)

```typescript
import { EventBroadcaster } from '../websocket'

async function search(query) {
  const broadcaster = new EventBroadcaster(wsManager)
  const results = []

  for await (const result of mgrepSearch(query)) {
    results.push(result)
    broadcaster.searchProgress(query, results.length, null, results)
  }
}
```

### 5. Git Operations

```typescript
import { EventBroadcaster } from '../websocket'

export function createGitRoutes(wsManager: WebSocketManager) {
  const broadcaster = new EventBroadcaster(wsManager)
  const routes = new Hono()

  routes.post('/commit', async (c) => {
    // ... commit logic
    broadcaster.gitEvent('commit', `Committed: ${message}`)
    return c.json({ success: true })
  })

  routes.post('/push', async (c) => {
    // ... push logic
    broadcaster.gitEvent('push', 'Pushed to remote')
    return c.json({ success: true })
  })

  return routes
}
```

## Common Patterns

### Broadcasting with Data

```typescript
// Just the change
broadcaster.fileChanged('src/main.ts', 'change')

// File with metadata
broadcaster.emit('files', {
  file: 'src/main.ts',
  event: 'change',
  size: 1234,
  modified: new Date().toISOString()
})
```

### Streaming Responses

```typescript
// Chunk 1: First part
broadcaster.aiChunk(requestId, 'Hello ', 0, false)

// Chunk 2: Middle
broadcaster.aiChunk(requestId, 'world ', 1, false)

// Chunk 3: End
broadcaster.aiChunk(requestId, '!', 2, true)  // finished: true
```

### Batch Updates

```typescript
// Send all diagnostics at once
broadcaster.diagnosticsUpdated([
  { file: 'a.ts', line: 1, column: 0, message: 'Error 1', severity: 'error', source: 'tsc' },
  { file: 'b.ts', line: 5, column: 10, message: 'Error 2', severity: 'warning', source: 'eslint' }
])
```

### Custom Channels

```typescript
// For non-standard events, use emit()
broadcaster.emit('custom-event', {
  type: 'my-event',
  data: { foo: 'bar' }
})

// Client subscribes
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'custom-event'
}))
```

## Testing

### Mock WebSocket Manager

```typescript
import { EventBroadcaster } from '../websocket'
import { EventEmitter } from 'events'
import { vi } from 'vitest'

// Create mock
const mockWss = new EventEmitter() as any
const manager = new WebSocketManager(mockWss)

// Spy on send
const sendSpy = vi.spyOn(manager, 'send')

// Test
const broadcaster = new EventBroadcaster(manager)
broadcaster.fileChanged('test.ts', 'change')

expect(sendSpy).toHaveBeenCalled()
```

## Debugging

### See all connections
```typescript
const connections = wsManager.getConnections()
console.log(`Active connections: ${connections.size}`)
```

### See subscribers to channel
```typescript
const subscribers = wsManager.getSubscribers('files')
console.log(`Files channel subscribers: ${subscribers.length}`)
```

### See channels for connection
```typescript
const channels = wsManager.getChannels(connectionId)
console.log(`Connection subscribed to: ${channels}`)
```

### Enable verbose logging
All errors and important events are logged to console:
- `[WebSocket] Client connected: conn-...`
- `[WebSocket] Failed to broadcast to conn-...: Error`
- `[WebSocket] Connection error: ...`

## Performance Notes

- **Broadcasting**: Scales with number of subscribers (not total connections)
- **Memory**: ~200 bytes per connection + channel set
- **Ping overhead**: ~30KB per 30 seconds (one ping per connection)
- **No queuing**: Messages sent directly to WebSocket

Typical usage:
- 100 connections = ~20KB memory
- 1000 file change broadcasts/min = negligible CPU
- 100 concurrent AI streams = O(subscribers) scaling

## Type Safety

Full TypeScript support:

```typescript
import type {
  FileChangeEvent,
  DiagnosticsUpdateEvent,
  AIChunkEvent,
  SearchProgressEvent,
  ValidationEvent,
  GitEvent
} from '../websocket'

// Types are auto-inferred when using broadcaster methods
const event: FileChangeEvent = {
  file: 'test.ts',
  event: 'change',
  timestamp: new Date().toISOString()
}
```

## Troubleshooting

**No events received?**
- Check browser console for connection errors
- Verify client sent `{ type: 'subscribe', channel: '...' }`
- Check server logs for broadcast errors

**Connection closes?**
- Check if no pong received (health check every 30s)
- Look for network errors in logs
- Verify client reconnection logic

**High memory usage?**
- Dead connections should auto-clean after 30s of no pong
- Check if close handlers are being called
- Monitor connection count with `wsManager.getConnections().size`

**Slow broadcasts?**
- Check number of subscribers: `wsManager.getSubscribers(channel).length`
- Broadcasting is O(n) where n = subscribers
- Can be optimized by filtering subscribers before broadcast

## Next Steps

1. **Connect file watcher** to `broadcaster.fileChanged()`
2. **Connect LSP client** to `broadcaster.diagnosticsUpdated()`
3. **Connect AI service** to `broadcaster.aiChunk()`
4. **Add client example** showing WebSocket subscription
5. **Write tests** for manager and broadcaster
