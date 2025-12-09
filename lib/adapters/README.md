# API Adapters

Unified API adapter system for Cluso that abstracts the differences between Electron IPC and Web WebSocket communication.

## Overview

The adapter system provides a single, consistent interface for communication across both Electron and web environments. It automatically detects the runtime environment and uses the appropriate backend (IPC or WebSocket).

## Architecture

### Core Concepts

- **APIAdapter**: Base interface that both Electron and Web adapters implement
- **ElectronAdapter**: Uses Electron IPC for bi-directional communication
- **WebAdapter**: Uses WebSocket for bi-directional communication
- **getAdapter()**: Factory function that creates or returns the appropriate adapter
- **useAPI()**: React hook for accessing the adapter in components

## Usage

### React Components

```tsx
import { useAPI } from '../hooks/useAPI'

function MyComponent() {
  const { api, isElectron, isConnected, invoke, subscribe } = useAPI()

  // Check if connected
  if (!isConnected) {
    return <div>Connecting...</div>
  }

  // Make a request
  async function handleClick() {
    try {
      const branch = await invoke('git.getCurrentBranch')
      console.log('Current branch:', branch)
    } catch (error) {
      console.error('Failed to get branch:', error)
    }
  }

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = subscribe('fileWatcher', (change) => {
      console.log('File changed:', change)
    })

    return unsubscribe
  }, [subscribe])

  return <button onClick={handleClick}>Get Branch</button>
}
```

### Outside React

```ts
import { getAPI } from '../hooks/useAPI'

const api = getAPI()

// Make a request
const branch = await api.invoke('git.getCurrentBranch')

// Send one-way message
api.send('someChannel', { data: 'value' })

// Subscribe to events
const unsubscribe = api.subscribe('fileWatcher', (change) => {
  console.log('File changed:', change)
})

// Cleanup when done
unsubscribe()
await api.disconnect()
```

## API Reference

### useAPI(options?)

React hook for accessing the API adapter.

**Options:**
- `serverUrl?: string` - Override the server URL for web mode (defaults to current origin)
- `debug?: boolean` - Enable debug logging

**Returns:**
- `api: APIAdapter | null` - The adapter instance
- `isElectron: boolean` - True if running in Electron
- `isConnected: boolean` - True if adapter is connected
- `subscribe(channel, callback)` - Subscribe to channel events, returns unsubscribe function
- `invoke<T>(channel, data?)` - Send request and get response
- `send(channel, data?)` - Send one-way message
- `disconnect()` - Close connections and clean up

### getAPI(serverUrl?)

Non-hook version of useAPI, returns the APIAdapter instance directly.

```ts
const adapter = getAPI()
```

### APIAdapter Interface

```ts
interface APIAdapter {
  readonly type: 'electron' | 'web'
  readonly isConnected: boolean

  invoke<T>(channel: string, data?: unknown): Promise<T>
  subscribe(channel: string, callback: SubscriptionCallback): SubscriptionUnsubscribe
  send(channel: string, data?: unknown): void
  disconnect(): Promise<void>
}
```

## Channel Examples

### Electron Channels

The adapter supports any channel available through `window.electronAPI`. Some common examples:

```ts
// Git operations
await invoke('git.getCurrentBranch')
await invoke('git.getStatus')
await invoke('git.commit', { message: 'My commit' })

// File operations
await invoke('files.readFile', '/path/to/file')
await invoke('files.writeFile', { path: '/path/to/file', content: '...' })

// OAuth
await invoke('oauth.getAccessToken')

// Subscriptions
subscribe('fileWatcher', (change) => {})
subscribe('updates', (event) => {})
```

### Web Channels

For web mode, the server should implement a WebSocket protocol that handles these message types:

```ts
// Client -> Server
{ type: 'invoke', id: 123, channel: 'api.getUser', data: { id: '1' } }
{ type: 'subscribe', channel: 'notifications' }
{ type: 'unsubscribe', channel: 'notifications' }
{ type: 'send', channel: 'log', data: { message: '...' } }

// Server -> Client
{ type: 'response', id: 123, data: { name: 'John' } }
{ type: 'response', id: 123, error: 'Not found' }
{ type: 'event', channel: 'notifications', data: { type: 'new_message' } }
```

## Implementation Details

### Electron Adapter

- Uses `window.electronAPI` exposed by the Electron preload script
- Supports nested channels like `'git.getCurrentBranch'` which map to `electronAPI.git.getCurrentBranch()`
- Subscriptions leverage Electron IPC event listeners
- Automatically tracks subscriptions and cleans up listeners

### Web Adapter

- Creates a WebSocket connection to the server
- Implements request-response pattern with timeout (30 seconds)
- Auto-reconnects on connection loss
- Re-subscribes to channels after reconnection
- Converts HTTP/HTTPS URLs to WS/WSS for WebSocket connection

## Connection Management

### Electron
- Immediately connected (no async setup needed)
- `isConnected` is always true

### Web
- Connects lazily on first `invoke()` or `subscribe()`
- Detects connection status automatically
- Handles reconnection internally

## Error Handling

All operations include error handling:

```ts
const { api } = useAPI()

try {
  const result = await api.invoke('git.getCurrentBranch')
} catch (error) {
  // Handle timeout, network, or server errors
  console.error('Request failed:', error)
}
```

## Testing

For testing, you can create specific adapter instances:

```ts
import { createAdapter } from '../lib/adapters'

// Create a specific adapter for testing
const adapter = createAdapter('electron') // or 'web'

// Use resetAdapter() to clear the singleton
import { resetAdapter } from '../lib/adapters'
resetAdapter()
```

## Migration Guide

### From useElectronAPI

```ts
// OLD
const { api, git } = useElectronAPI()
const branch = await api.git.getCurrentBranch()

// NEW
const { invoke } = useAPI()
const branch = await invoke('git.getCurrentBranch')
```

### From direct Electron IPC

```ts
// OLD
const branch = await window.electronAPI.git.getCurrentBranch()

// NEW
const { invoke } = useAPI()
const branch = await invoke('git.getCurrentBranch')

// Or outside React:
const api = getAPI()
const branch = await api.invoke('git.getCurrentBranch')
```

## Performance Considerations

- **Adapter Singleton**: Only one adapter instance is created and reused across the app
- **Lazy Connection**: Web adapter connects on first use
- **Subscription Caching**: Subscriptions are only set up once per channel
- **Request Pooling**: Multiple pending requests are handled efficiently
- **Memory Cleanup**: Subscriptions and requests are cleaned up automatically
