# API Adapters - Complete File Index

This directory contains the unified API adapter system for Cluso.

## Core Implementation Files

### `types.ts` (124 lines)
Type definitions and interfaces for the adapter system.

**Key exports:**
- `APIAdapter` - Base interface for all adapters
- `APIRequest` / `APIResponse` - Message types
- `SubscriptionCallback` / `SubscriptionUnsubscribe` - Event handling types
- `ElectronAPIAdapter` - Electron-specific interface
- `WebAPIAdapter` - Web-specific interface

**When to update:** When adding new adapter capabilities or changing the core interface.

### `electron-adapter.ts` (163 lines)
Electron IPC implementation of the APIAdapter interface.

**Key exports:**
- `createElectronAdapter()` - Factory function

**How it works:**
- Wraps `window.electronAPI` exposed by Electron preload script
- Maps channel strings (e.g., `'git.getCurrentBranch'`) to nested API calls
- Manages subscriptions with automatic cleanup
- Handles errors with console logging

**When to update:** 
- When Electron API structure changes
- To add new subscription channels
- For performance improvements

### `web-adapter.ts` (310 lines)
WebSocket client implementation of the APIAdapter interface.

**Key exports:**
- `createWebAdapter(serverUrl?)` - Factory function with optional URL

**How it works:**
- Establishes WebSocket connection to server
- Implements request-response pattern with ID-based tracking
- Handles subscriptions with server synchronization
- Auto-reconnects on connection loss
- Re-subscribes to channels after reconnection
- Converts HTTP/HTTPS URLs to WS/WSS

**When to update:**
- To adjust timeout duration (default: 30s)
- To modify reconnection behavior
- For message protocol changes
- To add metrics/monitoring

### `index.ts` (56 lines)
Factory and singleton pattern management.

**Key exports:**
- `getAdapter(serverUrl?)` - Get or create singleton adapter
- `createAdapter(type, serverUrl?)` - Create new adapter instance
- `resetAdapter()` - Clear singleton (testing)
- Re-exports all type definitions
- Re-exports adapter constructors

**When to update:**
- When adding new adapter types
- To change singleton behavior
- For export structure changes

## React Hook

### `../hooks/useAPI.ts` (210 lines)
React hook for accessing the unified API adapter.

**Key exports:**
- `useAPI(options?)` - React hook
- `getAPI(serverUrl?)` - Non-hook version for outside React
- `isAPIAdapter(value)` - Type guard function

**How it works:**
- Auto-detects Electron vs Web on mount
- Initializes adapter lazily
- Provides memoized callbacks
- Tracks connection state
- Cleans up resources
- Wraps adapter methods with error handling

**When to update:**
- To adjust initialization logic
- For additional state tracking
- To optimize performance
- For new adapter methods

## Documentation Files

### `README.md` (400+ lines)
Complete API reference and architecture guide.

**Contents:**
- Overview and core concepts
- Usage patterns (React and non-React)
- API reference with signatures
- Channel examples
- Implementation details for each adapter
- Connection management
- Error handling
- Testing guide
- Migration from useElectronAPI
- Performance considerations

**When to update:**
- When API changes
- To document new channels
- For clarification requests
- Performance benchmarks

### `EXAMPLES.md` (500+ lines)
Comprehensive usage examples and patterns.

**Contents:**
- Basic React component examples
- File watcher with real-time updates
- OAuth login flow
- Multi-request operations
- Custom domain-specific hooks
- Polling pattern
- Conditional environment logic
- Error handling with retry
- Usage outside React
- Type safety examples
- Testing patterns

**When to update:**
- When adding new features
- To demonstrate best practices
- For common use case examples
- When patterns change

### `MIGRATION_GUIDE.md` (300+ lines)
Migration guide from old patterns to new useAPI.

**Contents:**
- Migration from useElectronAPI
- Migration from direct window.electronAPI access
- Migration from IPC direct calls
- Custom wrapper migration
- Pattern-by-pattern migrations
- File-by-file migration examples
- Channel naming reference
- Deprecation timeline
- Troubleshooting

**When to update:**
- When deprecating old patterns
- To add new migration examples
- For troubleshooting issues
- Timeline updates

### `EXAMPLES.md` (500+ lines)
Comprehensive usage examples.

**When to update:**
- New feature examples
- Best practice updates
- Common pattern documentation

## Test Files

### `__tests__/adapter.test.ts` (80+ lines)
Basic test suite for adapter functionality.

**Test coverage:**
- Adapter creation
- Singleton pattern
- Required methods and properties
- Web adapter specifics
- Subscribe/unsubscribe behavior

**When to update:**
- When adding new functionality
- To cover edge cases
- For regression tests
- Performance testing

## Quick Navigation

**I want to...**
- **Understand the system** → Start with README.md
- **Use it in my component** → Check EXAMPLES.md
- **Migrate from old code** → Read MIGRATION_GUIDE.md
- **Implement a custom hook** → See EXAMPLES.md (Custom Hook section)
- **Debug an issue** → Check EXAMPLES.md (Error Handling section)
- **Understand the code** → Read the adapter files (well-commented)
- **Extend the system** → Modify types.ts first, then implementations

## File Dependencies

```
types.ts
  ↓
  ├── electron-adapter.ts → index.ts → hooks/useAPI.ts
  ├── web-adapter.ts ─────→ index.ts → hooks/useAPI.ts
  └── index.ts ──────────→ hooks/useAPI.ts
```

## Statistics

| File | Lines | Purpose |
|------|-------|---------|
| types.ts | 124 | Type definitions |
| electron-adapter.ts | 163 | Electron implementation |
| web-adapter.ts | 310 | WebSocket implementation |
| index.ts | 56 | Factory pattern |
| hooks/useAPI.ts | 210 | React hook |
| README.md | 400+ | API reference |
| EXAMPLES.md | 500+ | Usage examples |
| MIGRATION_GUIDE.md | 300+ | Migration help |
| adapter.test.ts | 80+ | Tests |
| **Total** | **~2,100** | **Complete system** |

## Environment Variables

For web mode configuration:

```bash
# Override default server URL
VITE_API_URL=http://api.example.com

# Or pass directly to hook
useAPI({ serverUrl: 'http://api.example.com' })
```

## Key Concepts

1. **Singleton Pattern**: One adapter instance shared across the app
2. **Auto-Detection**: Chooses Electron or Web based on runtime
3. **Unified Interface**: Both adapters have identical public API
4. **Type Safety**: Full TypeScript support throughout
5. **Error Handling**: Built-in try-catch and error reporting
6. **Memory Management**: Subscriptions auto-cleanup
7. **Performance**: Lazy connection, request pooling, memoization

## Future Enhancements

See ADAPTER_IMPLEMENTATION.md for planned features:
- Exponential backoff reconnection
- Configurable timeouts
- Message compression
- Request batching
- Built-in logging
- Cache layer
- Rate limiting
- Custom serialization
