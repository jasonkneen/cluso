# WebSocket Architecture

Visual diagrams and architectural overview of the WebSocket infrastructure.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cluso Server (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  HTTP Server (Hono + Node Adapter)                               │
│  ├─ /api/git/*                                                   │
│  ├─ /api/files/*                                                 │
│  └─ WebSocket Endpoint                                           │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ WebSocket Infrastructure                                    │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  WebSocketManager (manager.ts)                              │ │
│  │  ├─ Connection Map: { id → WSConnection }                  │ │
│  │  │  └─ WSConnection: { ws, channels, isAlive }            │ │
│  │  ├─ Subscription Management                                │ │
│  │  │  └─ getSubscribers(channel) → connectionIds[]          │ │
│  │  ├─ Message Routing                                        │ │
│  │  │  ├─ subscribe message → add to channel                │ │
│  │  │  └─ unsubscribe message → remove from channel          │ │
│  │  ├─ Broadcasting                                           │ │
│  │  │  └─ broadcast(channel, data) → all subscribers         │ │
│  │  ├─ Health Monitoring                                      │ │
│  │  │  └─ ping/pong every 30s → remove dead                 │ │
│  │  └─ Error Handling                                         │ │
│  │     └─ Log all errors, no crashes                         │ │
│  │                                                              │ │
│  │  EventBroadcaster (events.ts)                               │ │
│  │  ├─ Wraps WebSocketManager                                │ │
│  │  └─ Type-Safe Methods                                      │ │
│  │     ├─ fileChanged(file, event)                           │ │
│  │     ├─ diagnosticsUpdated(diags)                          │ │
│  │     ├─ aiChunk(id, chunk, index, finished)               │ │
│  │     ├─ searchProgress(query, count, total, results)       │ │
│  │     ├─ validationComplete(result)                         │ │
│  │     ├─ gitEvent(type, message)                            │ │
│  │     └─ emit(channel, data)  [custom events]               │ │
│  │                                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Integration Points                                               │
│  ├─ File Watcher (chokidar)                                      │
│  │  └─ fileChanged() → broadcaster                             │ │
│  ├─ LSP Client                                                   │
│  │  └─ diagnosticsUpdated() → broadcaster                      │ │
│  ├─ AI Service (Gemini)                                          │
│  │  └─ aiChunk() → broadcaster                                 │ │
│  ├─ Search Service (mgrep)                                       │
│  │  └─ searchProgress() → broadcaster                          │ │
│  ├─ Validation Tools                                             │
│  │  └─ validationComplete() → broadcaster                      │ │
│  └─ Git Commands                                                 │
│     └─ gitEvent() → broadcaster                                │ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

Browser / Web Client
├─ WebSocket connection to /ws
├─ Send: { type: 'subscribe', channel: 'files' }
├─ Receive: { type: 'event', channel: 'files', data: {...} }
└─ Handle events in UI
```

## Message Flow

### 1. Client Subscription

```
Client                          Server
  │                               │
  │  WebSocket Connect            │
  ├──────────────────────────────→│
  │                               │ [addConnection()]
  │                          [generates ID]
  │  Connection Confirmation      │
  │<──────────────────────────────┤
  │  { status: 'connected', ... } │
  │                               │
  │  Subscribe Message            │
  │{ type: 'subscribe',            │
  │  channel: 'files' }            │
  ├──────────────────────────────→│
  │                               │ [subscribe()]
  │  Subscribe Confirmation       │
  │<──────────────────────────────┤
  │  { status: 'subscribed', ... } │
  │                               │
```

### 2. Event Broadcasting

```
Source Component          WebSocketManager          Subscribers
      │                         │                         │
      │ broadcaster.fileChanged()
      ├────────────────────────→│
      │                         │ [broadcast('files', data)]
      │                         │
      │                         │ For each subscriber of 'files':
      │                         ├──────→ Sub 1 (WebSocket.send)
      │                         ├──────→ Sub 2 (WebSocket.send)
      │                         └──────→ Sub 3 (WebSocket.send)
      │                         │
      │                    [log success/failure]
      │
```

### 3. Full Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CONNECTION ESTABLISHED                                        │
├─────────────────────────────────────────────────────────────────┤
│ Client                          Server                            │
│   │                              │                                │
│   │ ws = new WebSocket(url)      │                                │
│   │                              │                                │
│   ├─ 'open' event               │                                │
│   │                              │ 'connection' event             │
│   │                              ├─ new WebSocketManager()       │
│   │                              ├─ addConnection(ws, id)        │
│   │                              └─ send(id, 'connected')        │
│   │                              │                                │
│   │ Receives { status: 'connected', connectionId: '...' }        │
│   │                              │                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. SUBSCRIPTION                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Client                          Server                            │
│   │                              │                                │
│   │ send({                        │                                │
│   │   type: 'subscribe',          │                                │
│   │   channel: 'files'            │                                │
│   │ })                            │                                │
│   ├──────────────────────────────→│                                │
│   │                              │ [on 'message']                 │
│   │                              ├─ parse message                │
│   │                              ├─ subscribe(connId, 'files')   │
│   │                              └─ send(connId, response)       │
│   │                              │                                │
│   │ Receives { status: 'subscribed' }                            │
│   │                              │                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. EVENT BROADCASTING                                            │
├─────────────────────────────────────────────────────────────────┤
│ Source          Manager                    Client                 │
│   │               │                           │                   │
│   │ broadcaster   │                           │                   │
│   │ .fileChanged()│                           │                   │
│   ├──────────────→│                           │                   │
│   │               │ broadcast()               │                   │
│   │               ├─ for each subscriber      │                   │
│   │               ├───────────────────────────→ (WebSocket.send)  │
│   │               │                           │                   │
│   │               │                    { type: 'event' }          │
│   │               │                    { channel: 'files' }       │
│   │               │                    { data: {...} }            │
│   │               │                           │                   │
│   │               │                    [onmessage handler]        │
│   │               │                    [update UI]                │
│   │               │                           │                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 4. HEALTH CHECK (Every 30 seconds)                               │
├─────────────────────────────────────────────────────────────────┤
│ Server                          Client                            │
│   │                              │                                │
│   │ [startPingPong interval]      │                                │
│   │ for each connection:          │                                │
│   │   mark isAlive = false        │                                │
│   │   ping()                      │                                │
│   ├─────────────────────────────→│                                │
│   │                              │ [on 'ping']                    │
│   │                              │ pong()                         │
│   │←─────────────────────────────┤                                │
│   │ [on 'pong']                  │                                │
│   │ mark isAlive = true           │                                │
│   │                              │                                │
│   │ [after ping cycle]            │                                │
│   │ if !isAlive:                  │                                │
│   │   removeConnection(id)        │                                │
│   │                              │                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 5. DISCONNECT                                                    │
├─────────────────────────────────────────────────────────────────┤
│ Client                          Server                            │
│   │                              │                                │
│   │ [browser close / network err]│                                │
│   ├─ 'close' event              │                                │
│   │                              │ 'close' event on ws            │
│   │                              ├─ removeConnection(id)          │
│   │                              └─ cleanup channels              │
│   │                              │                                │
│   │ [connection removed]          │ [memory freed]                │
│   │                              │                                │
└─────────────────────────────────────────────────────────────────┘
```

## Channel Architecture

```
Broadcasting Layer
├─ broadcast(channel, data)
│  └─ Sends to all subscribers of channel
│
Channel Subscriptions
├─ files: { connId1, connId2, ... }
├─ diagnostics: { connId1, connId3, ... }
├─ ai-response: { connId2, connId4, ... }
├─ search: { connId1, ... }
├─ validation: { connId3, ... }
└─ git: { connId1, connId2, connId3, ... }

Connection Storage
├─ connId1: { ws, channels: Set['files', 'git', ...] }
├─ connId2: { ws, channels: Set['ai-response', ...] }
├─ connId3: { ws, channels: Set['diagnostics', 'validation', ...] }
└─ connId4: { ws, channels: Set['ai-response', ...] }
```

## Event Broadcasting Flow

```
Server Component
    │
    ├─ File Watcher
    │  └─ broadcaster.fileChanged('src/main.ts', 'change')
    │
    ├─ LSP Client
    │  └─ broadcaster.diagnosticsUpdated([{...}])
    │
    ├─ AI Service
    │  └─ broadcaster.aiChunk(id, chunk, index, finished)
    │
    ├─ Search Service
    │  └─ broadcaster.searchProgress(query, count, total, results)
    │
    ├─ Validation Tools
    │  └─ broadcaster.validationComplete(result)
    │
    └─ Git Commands
       └─ broadcaster.gitEvent(type, message)
    │
    ↓
EventBroadcaster
    │
    ├─ Wraps event data with timestamp
    ├─ Calls manager.broadcast(channel, data)
    │
    ↓
WebSocketManager
    │
    ├─ Finds all subscribers to channel
    │  └─ getSubscribers(channel) → [connId1, connId2, ...]
    │
    ├─ Sends to each subscriber
    │  └─ ws.send(JSON.stringify(message))
    │
    └─ Logs success/failure count
    │
    ↓
Client WebSocket
    │
    └─ onmessage handler
       └─ Update UI with data
```

## Connection State Machine

```
┌──────────────┐
│    Created   │
└──────┬───────┘
       │ ws = new WebSocket()
       ↓
┌──────────────────┐
│  Connecting      │
└──────┬───────────┘
       │ 'open' event
       ↓
┌──────────────────────────────────┐
│  Connected                       │
│  - Assigned ID                   │
│  - Ready for messages            │
└──────┬──────────────┬───────┬────┘
       │              │       │
       │ subscribe    │ send  │ [ping/pong every 30s]
       │ request      │ events│
       ↓              ↓       ↓
┌─────────────────────────────────┐
│  Active                          │
│  - Subscribed to channels        │
│  - Receiving events              │
│  - Health checks passing         │
└─────────┬───────────────────────┘
          │ unsubscribe │ close
          ↓             ↓
      ┌──────────────┐ ┌──────────────┐
      │ Unsubscribed │ │  Closing     │
      └──────┬───────┘ └──────┬───────┘
             │                │
             └───────┬────────┘
                     ↓
        ┌────────────────────────┐
        │  Closed/Dead           │
        │  - Cleaned Up          │
        │  - Memory Freed        │
        └────────────────────────┘
```

## Memory Layout

```
WebSocketManager Instance
├─ connections: Map
│  ├─ 'conn-1': WSConnection
│  │  ├─ id: 'conn-1'
│  │  ├─ ws: WebSocket
│  │  ├─ isAlive: true
│  │  └─ channels: Set
│  │     ├─ 'files'
│  │     └─ 'diagnostics'
│  │
│  └─ 'conn-2': WSConnection
│     ├─ id: 'conn-2'
│     ├─ ws: WebSocket
│     ├─ isAlive: false
│     └─ channels: Set
│        └─ 'ai-response'
│
├─ pingInterval: NodeJS.Timeout
└─ wss: WebSocketServer

Per-Connection Memory:
├─ id: ~50 bytes
├─ channels Set: ~16 bytes + (8 bytes per channel)
├─ WebSocket reference: ~16 bytes
└─ Total: ~150-200 bytes per connection
```

## Error Handling Flow

```
Error Occurs
    │
    ├─ Parse Error
    │  └─ JSON.parse fails
    │     └─ Log error
    │     └─ Send error response
    │
    ├─ Send Error
    │  └─ ws.send() fails
    │     └─ Log with connection ID
    │     └─ Mark for cleanup
    │
    ├─ Connection Error
    │  └─ ws.on('error')
    │     └─ Log error
    │     └─ Connection still valid
    │
    ├─ Health Check Fail
    │  └─ No pong after ping
    │     └─ Log dead connection
    │     └─ removeConnection()
    │
    └─ Broadcast Failure
       └─ Partial send failure
          └─ Log count of failures
          └─ Continue with other subscribers
```

## Scalability

```
Single Server Instance
├─ 100 connections: ~20 KB memory
├─ 1,000 connections: ~200 KB memory
├─ 10,000 connections: ~2 MB memory
│  └─ Limited by OS file descriptors
│
Per-Broadcast Operation
├─ 10 subscribers: ~10 send() calls
├─ 100 subscribers: ~100 send() calls
├─ 1,000 subscribers: ~1,000 send() calls
│  └─ Each send is async, non-blocking
│
Health Check Overhead
├─ Ping every 30 seconds
├─ One ping per connection
├─ ~2-4 KB per 30 seconds total
├─ Negligible CPU overhead
│
Typical Usage
├─ 5-10 concurrent users
├─ Each subscribes to 2-3 channels
├─ Memory: <1 MB
├─ CPU: <1% for ping/pong
└─ Network: ~10 KB/30s baseline
```

## Integration Points

```
app.ts
  │
  ├─ createApp(options)
  │  └─ Returns Hono instance
  │     └─ Routes to handlers
  │
  └─ startServer(options)
     └─ Create HTTP server
     └─ Create WebSocketServer
     └─ new WebSocketManager(wss)
     └─ wss.on('connection', (ws) => manager.handleConnection(ws, cwd))
     └─ Return { close() }

handlers/files.ts
  ├─ Import EventBroadcaster
  ├─ Receive wsManager instance
  ├─ Create broadcaster = new EventBroadcaster(wsManager)
  └─ Use broadcaster.fileChanged() in file handlers

handlers/git.ts
  ├─ Import EventBroadcaster
  ├─ Receive wsManager instance
  ├─ Create broadcaster = new EventBroadcaster(wsManager)
  └─ Use broadcaster.gitEvent() in git handlers

file-watcher.ts
  ├─ chokidar.watch()
  ├─ Receive broadcaster instance
  └─ On change/add/delete → broadcaster.fileChanged()

lsp-client.ts
  ├─ LSP initialization
  ├─ Receive broadcaster instance
  └─ On diagnostics → broadcaster.diagnosticsUpdated()

ai-service.ts
  ├─ Gemini API streaming
  ├─ Receive broadcaster instance
  └─ On chunk → broadcaster.aiChunk()
```
