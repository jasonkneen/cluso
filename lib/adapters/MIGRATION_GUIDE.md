# Migration Guide: useAPI

This guide helps you migrate from existing API patterns to the new unified `useAPI` hook.

## From useElectronAPI

The old `useElectronAPI` hook provided access to individual API namespaces:

```tsx
// OLD: useElectronAPI
import { useElectronAPI } from './hooks/useElectronAPI'

function MyComponent() {
  const { git, files, oauth } = useElectronAPI()

  const branch = await git.getCurrentBranch()
  const content = await files.readFile('/path/to/file')
  const token = await oauth.getAccessToken()
}
```

With `useAPI`, access all APIs through a unified `invoke()` method:

```tsx
// NEW: useAPI
import { useAPI } from './hooks/useAPI'

function MyComponent() {
  const { invoke } = useAPI()

  const branch = await invoke('git.getCurrentBranch')
  const content = await invoke('files.readFile', '/path/to/file')
  const token = await invoke('oauth.getAccessToken')
}
```

### Benefits
- Works in both Electron and Web environments
- Consistent naming across all APIs
- Easier to test and mock
- Better TypeScript support

## From Direct window.electronAPI

If you were accessing Electron APIs directly:

```tsx
// OLD: Direct access
function MyComponent() {
  const branch = await window.electronAPI.git.getCurrentBranch()
}
```

Use the hook instead:

```tsx
// NEW: useAPI hook
import { useAPI } from './hooks/useAPI'

function MyComponent() {
  const { invoke } = useAPI()
  const branch = await invoke('git.getCurrentBranch')
}
```

Or in non-React code:

```ts
// NEW: getAPI non-hook version
import { getAPI } from './hooks/useAPI'

const api = getAPI()
const branch = await api.invoke('git.getCurrentBranch')
```

## From IPC Invoke/Send

If you were using Electron IPC directly:

```tsx
// OLD: Direct IPC
import { ipcRenderer } from 'electron'

const branch = await ipcRenderer.invoke('git:getCurrentBranch')
ipcRenderer.send('someChannel', data)
```

Use the adapter:

```tsx
// NEW: useAPI
import { useAPI } from './hooks/useAPI'

function MyComponent() {
  const { invoke, send } = useAPI()

  const branch = await invoke('git.getCurrentBranch')
  send('someChannel', data)
}
```

## From Custom API Wrappers

If you had custom utilities wrapping Electron APIs:

```ts
// OLD: Custom wrapper
// utils/git.ts
export async function getCurrentBranch() {
  return await window.electronAPI?.git?.getCurrentBranch?.()
}
```

Now use `getAPI()`:

```ts
// NEW: Using getAPI
// utils/git.ts
import { getAPI } from './hooks/useAPI'

export async function getCurrentBranch() {
  const api = getAPI()
  return await api.invoke<string>('git.getCurrentBranch')
}
```

Or create a custom hook:

```ts
// hooks/useGit.ts
import { useAPI } from './useAPI'
import { useCallback } from 'react'

export function useGit() {
  const { invoke } = useAPI()

  return {
    getCurrentBranch: useCallback(
      () => invoke<string>('git.getCurrentBranch'),
      [invoke]
    ),
    getStatus: useCallback(() => invoke('git.getStatus'), [invoke]),
  }
}
```

## Pattern Migrations

### Checking Environment

Before:
```tsx
const { isElectron } = useElectronAPI()
```

After:
```tsx
const { isElectron } = useAPI()
```

### Subscription Handling

Before (with older patterns):
```tsx
// Electron only pattern
const unsubscribe = window.electronAPI.fileWatcher.onChange((data) => {
  console.log('File changed:', data)
})
```

After (works in both):
```tsx
const { subscribe } = useAPI()

const unsubscribe = subscribe('fileWatcher', (data) => {
  console.log('File changed:', data)
})
```

### Error Handling

Before:
```tsx
try {
  const result = await window.electronAPI.files.readFile(path)
} catch (error) {
  console.error('Failed:', error)
}
```

After:
```tsx
try {
  const result = await invoke('files.readFile', path)
} catch (error) {
  console.error('Failed:', error)
}
```

Same pattern, but now works in web too!

## File-by-File Migration

### Services and Utilities

Update service files to use `getAPI()`:

```ts
// services/git-service.ts
import { getAPI } from '../hooks/useAPI'

export class GitService {
  async getCurrentBranch() {
    const api = getAPI()
    return api.invoke<string>('git.getCurrentBranch')
  }
}

export const gitService = new GitService()
```

### React Components

Replace `useElectronAPI` with `useAPI`:

```tsx
// components/GitStatus.tsx
import { useAPI } from '../hooks/useAPI'

export function GitStatus() {
  const { invoke, isConnected } = useAPI()
  // ... rest of component
}
```

### Test Files

Update test setup:

```ts
// tests/my-component.test.ts
import { createAdapter } from '../lib/adapters'

describe('MyComponent', () => {
  it('should fetch git status', async () => {
    const adapter = createAdapter('web', 'http://localhost:3001')
    const status = await adapter.invoke('git.getStatus')
    expect(status).toBeDefined()
  })
})
```

## Channel Naming Reference

Common channel paths you'll use:

```ts
// Git
'git.getCurrentBranch'
'git.getBranches'
'git.getStatus'
'git.commit'
'git.push'
'git.pull'
'git.checkout'
'git.createBranch'

// Files
'files.readFile'
'files.writeFile'
'files.createFile'
'files.deleteFile'
'files.listDirectory'
'files.getTree'

// OAuth
'oauth.startLogin'
'oauth.completeLogin'
'oauth.getAccessToken'
'oauth.getStatus'

// File Watcher
'fileWatcher.start'
'fileWatcher.stop'

// Subscriptions
subscribe('fileWatcher', callback)
subscribe('updates', callback)
```

See `lib/adapters/README.md` for complete channel reference.

## Deprecation Timeline

### Phase 1: Support Both (Current)
- Both `useElectronAPI` and `useAPI` are supported
- New code should use `useAPI`
- Existing code can be migrated at your pace

### Phase 2: Deprecation Notice (Future)
- `useElectronAPI` will be marked as deprecated
- Warnings in console for deprecated usage
- Migration tools provided
- Timeline: ~3 months

### Phase 3: Removal (Future)
- `useElectronAPI` removed entirely
- All code must use `useAPI`
- Timeline: ~6 months after deprecation

## Troubleshooting

### "Adapter not initialized" Error

This means components are trying to use the API before it's ready.

```tsx
// WRONG: Using API before checking connection
const { invoke } = useAPI()
invoke('git.getCurrentBranch') // May fail if not connected

// RIGHT: Check connection first
const { invoke, isConnected } = useAPI()
if (isConnected) {
  invoke('git.getCurrentBranch')
}
```

### "Channel not found" Error

You're using the wrong channel name:

```tsx
// WRONG: Missing dot notation
const { invoke } = useAPI()
invoke('gitGetCurrentBranch') // ❌

// RIGHT: Use dot notation
invoke('git.getCurrentBranch') // ✅
```

### Web Mode Connection Issues

The web adapter needs a server to connect to:

```tsx
// In web mode, you need:
const { invoke } = useAPI('http://api.example.com')
// or set VITE_API_URL environment variable
```

## Quick Reference

| Old | New |
|-----|-----|
| `useElectronAPI()` | `useAPI()` |
| `window.electronAPI.git.getCurrentBranch()` | `invoke('git.getCurrentBranch')` |
| `git.getCurrentBranch()` | `invoke('git.getCurrentBranch')` |
| `electronAPI.fileWatcher.onChange()` | `subscribe('fileWatcher', callback)` |
| Environment check: `isElectron` | Environment check: `isElectron` ✅ |

## Questions?

- See `lib/adapters/README.md` for detailed API reference
- See `lib/adapters/EXAMPLES.md` for more usage patterns
- Check existing tests in `lib/adapters/__tests__/`

## Related Documents

- [API Adapter README](./README.md)
- [Usage Examples](./EXAMPLES.md)
- [Main Implementation Doc](../ADAPTER_IMPLEMENTATION.md)
