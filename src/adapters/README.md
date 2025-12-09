# API Adapter Layer

The API adapter layer provides a unified interface for React components to work identically in both Electron and Web modes. Components don't need to know whether they're running in Electron or a web browser - they simply use the adapter interface.

## Architecture

```
React Components
     ↓
getAdapter() → APIAdapter Interface
     ↓
  Electron              Web
  Adapter               Adapter
     ↓                     ↓
window.electronAPI    HTTP Fetch
     ↓                     ↓
Electron IPC         Backend API
```

## Core Concepts

### Result<T> Type

All async operations return a `Result<T>` type with consistent error handling:

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

This eliminates the need for try-catch blocks and makes error handling explicit:

```typescript
const result = await adapter.files.readFile('/path/to/file')
if (result.success) {
  console.log('File content:', result.data)
} else {
  console.error('Error:', result.error)
}
```

### Auto-Detection

The adapter layer automatically detects the runtime environment:

```typescript
import { getAdapter, isElectronMode } from '@/adapters'

const adapter = getAdapter() // Returns Electron or Web adapter
const isElectron = isElectronMode() // true/false
```

## Usage Examples

### Reading a File

```typescript
import { getAdapter } from '@/adapters'

export function FileReader() {
  const adapter = getAdapter()
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  async function loadFile(path: string) {
    const result = await adapter.files.readFile(path)
    if (result.success) {
      setContent(result.data)
      setError('')
    } else {
      setError(result.error)
      setContent('')
    }
  }

  return (
    <div>
      <button onClick={() => loadFile('/path')}>Load File</button>
      {error && <p>Error: {error}</p>}
      {content && <pre>{content}</pre>}
    </div>
  )
}
```

### Git Operations

```typescript
import { getAdapter } from '@/adapters'

export function GitPanel() {
  const adapter = getAdapter()

  async function commitChanges(message: string) {
    // Get status first
    const statusResult = await adapter.git.getStatus()
    if (!statusResult.success) {
      console.error(statusResult.error)
      return
    }

    // Stage and commit
    const commitResult = await adapter.git.commit(message)
    if (commitResult.success) {
      const ref = commitResult.data
      console.log(`Committed: ${ref}`)
    } else {
      console.error(`Commit failed: ${commitResult.error}`)
    }
  }

  return (
    <button onClick={() => commitChanges('My commit')}>
      Commit Changes
    </button>
  )
}
```

### OAuth Flow

```typescript
import { getAdapter } from '@/adapters'

export function OAuthLogin() {
  const adapter = getAdapter()

  async function handleLogin() {
    // Start OAuth flow
    const startResult = await adapter.oauth.startLogin('console')
    if (!startResult.success) {
      console.error(startResult.error)
      return
    }

    // Open auth URL
    const { authUrl } = startResult.data
    window.open(authUrl, '_blank')

    // In real app, listen for callback and complete login
    // const completeResult = await adapter.oauth.completeLogin(
    //   code, verifier, state
    // )
  }

  return <button onClick={handleLogin}>Login with Claude</button>
}
```

### Handling Electron-Only Features

```typescript
import { getAdapter, isElectronMode } from '@/adapters'

export function GitComponent() {
  const isElectron = isElectronMode()
  const adapter = getAdapter()

  if (!isElectron) {
    return <p>Git features only available in Electron mode</p>
  }

  async function handleCheckout(branch: string) {
    const result = await adapter.git.checkout(branch)
    if (result.success) {
      console.log(`Switched to ${branch}`)
    } else {
      console.error(result.error)
    }
  }

  return (
    <button onClick={() => handleCheckout('main')}>
      Checkout Main
    </button>
  )
}
```

## Adapter API Reference

### Git Operations

All git operations are only available in Electron mode. In web mode, they return `{ success: false, error: '...' }`.

```typescript
interface GitAdapter {
  getCurrentBranch(): Promise<Result<string>>
  getBranches(): Promise<Result<string[]>>
  getStatus(): Promise<Result<GitStatus>>
  checkout(branch: string): Promise<Result<void>>
  checkoutFile(filePath: string): Promise<Result<void>>
  createBranch(name: string): Promise<Result<void>>
  commit(message: string): Promise<Result<string>>
  push(): Promise<Result<void>>
  pull(): Promise<Result<void>>
  stash(message?: string): Promise<Result<void>>
  stashPop(): Promise<Result<void>>
}
```

### File Operations

File operations work in both Electron and Web modes (web mode requires a backend API).

```typescript
interface FilesAdapter {
  readFile(path: string): Promise<Result<string>>
  writeFile(path: string, content: string): Promise<Result<void>>
  createFile(path: string, content?: string): Promise<Result<void>>
  deleteFile(path: string): Promise<Result<void>>
  renameFile(oldPath: string, newPath: string): Promise<Result<void>>
  copyFile(srcPath: string, destPath: string): Promise<Result<void>>
  saveImage(base64DataUrl: string, destPath: string): Promise<Result<SaveImageResult>>
  exists(path: string): Promise<Result<boolean>>
  stat(path: string): Promise<Result<FileStat>>
  listDirectory(path?: string): Promise<Result<DirectoryEntry[]>>
  createDirectory(path: string): Promise<Result<void>>
  deleteDirectory(path: string): Promise<Result<void>>
  getCwd(): Promise<Result<string>>
  searchInFiles(pattern: string, dirPath?: string, options?: SearchOptions): Promise<Result<SearchMatch[]>>
  glob(pattern: string, dirPath?: string): Promise<Result<GlobMatch[]>>
  getTree(path?: string, options?: TreeOptions): Promise<Result<FileTreeNode[]>>
  readMultiple(paths: string[]): Promise<Result<Array<{ path: string; content: string; error?: string }>>>
}
```

### OAuth Operations

```typescript
interface OAuthAdapter {
  startLogin(mode: 'max' | 'console'): Promise<Result<OAuthStartResult>>
  completeLogin(code: string, verifier: string, state: string): Promise<Result<void>>
  getStatus(): Promise<Result<OAuthStatus>>
  logout(): Promise<Result<void>>
  getAccessToken(): Promise<Result<string>>
}
```

### Backup Operations

```typescript
interface BackupAdapter {
  create(): Promise<Result<string>>
  list(): Promise<Result<Array<{ name: string; timestamp: number; size: number }>>>
  restore(backupName: string): Promise<Result<void>>
  delete(backupName: string): Promise<Result<void>>
}
```

## Testing

For testing, you can mock the adapter:

```typescript
import { setAdapter } from '@/adapters'
import type { APIAdapter } from '@/adapters'

// Create a mock adapter
const mockAdapter: APIAdapter = {
  files: {
    readFile: () => Promise.resolve({
      success: true,
      data: 'Mock file content'
    }),
    // ... implement other methods
  },
  git: { /* ... */ },
  oauth: { /* ... */ },
  backup: { /* ... */ },
}

// Use it in tests
setAdapter(mockAdapter)
```

## Implementing Web Backend API

When running in web mode, the adapter expects these HTTP endpoints:

### Git Endpoints

- `POST /api/git/current-branch` → `{ success: boolean; data?: string; error?: string }`
- `GET /api/git/branches` → `{ success: boolean; data?: string[]; error?: string }`
- `GET /api/git/status` → `{ success: boolean; data?: GitStatus; error?: string }`
- `POST /api/git/checkout` → `{ success: boolean; error?: string }` (body: `{ branch: string }`)
- `POST /api/git/checkout-file` → `{ success: boolean; error?: string }` (body: `{ filePath: string }`)
- `POST /api/git/create-branch` → `{ success: boolean; error?: string }` (body: `{ name: string }`)
- `POST /api/git/commit` → `{ success: boolean; data?: string; error?: string }` (body: `{ message: string }`)
- `POST /api/git/push` → `{ success: boolean; error?: string }`
- `POST /api/git/pull` → `{ success: boolean; error?: string }`
- `POST /api/git/stash` → `{ success: boolean; error?: string }` (body: `{ message?: string }`)
- `POST /api/git/stash-pop` → `{ success: boolean; error?: string }`

### Files Endpoints

- `POST /api/files/read` (body: `{ path: string }`)
- `POST /api/files/write` (body: `{ path: string; content: string }`)
- `POST /api/files/create` (body: `{ path: string; content?: string }`)
- `POST /api/files/delete` (body: `{ path: string }`)
- `POST /api/files/rename` (body: `{ oldPath: string; newPath: string }`)
- `POST /api/files/copy` (body: `{ srcPath: string; destPath: string }`)
- `POST /api/files/save-image` (body: `{ base64DataUrl: string; destPath: string }`)
- `POST /api/files/exists` (body: `{ path: string }`)
- `POST /api/files/stat` (body: `{ path: string }`)
- `POST /api/files/list-directory` (body: `{ path?: string }`)
- `POST /api/files/create-directory` (body: `{ path: string }`)
- `POST /api/files/delete-directory` (body: `{ path: string }`)
- `GET /api/files/cwd`
- `POST /api/files/search` (body: `{ pattern: string; dirPath?: string; options?: SearchOptions }`)
- `POST /api/files/glob` (body: `{ pattern: string; dirPath?: string }`)
- `POST /api/files/tree` (body: `{ path?: string; options?: TreeOptions }`)
- `POST /api/files/read-multiple` (body: `{ paths: string[] }`)

### OAuth Endpoints

- `POST /api/oauth/start-login` (body: `{ mode: 'max' | 'console' }`)
- `POST /api/oauth/complete-login` (body: `{ code: string; verifier: string; state: string }`)
- `GET /api/oauth/status`
- `POST /api/oauth/logout`
- `GET /api/oauth/access-token`

## Migration Guide

### For Existing Components Using window.electronAPI

Before:
```typescript
const result = await window.electronAPI.files.readFile('/path')
if (result.success) {
  setContent(result.data)
}
```

After:
```typescript
import { getAdapter } from '@/adapters'
const adapter = getAdapter()
const result = await adapter.files.readFile('/path')
if (result.success) {
  setContent(result.data)
}
```

### For useGit Hook

Update useGit hook to use the adapter instead of directly calling window.electronAPI.

## Performance Considerations

1. **Caching**: The adapter instance is cached after first call to `getAdapter()`
2. **Result Type**: No exception throwing needed - errors are returned in the Result type
3. **Web Mode**: In web mode, all operations go through HTTP - consider batching multiple operations
4. **Error Handling**: Always check `result.success` before accessing `result.data`

## Limitations

### Electron Mode Only
- Git operations
- File system operations are faster (direct access vs HTTP)
- OAuth tokens can be securely stored in the Electron app config

### Web Mode Only
- Requires a backend API server
- Git operations not available (would require remote git server)
- File paths are relative to backend working directory

## Future Enhancements

- [ ] Implement backup operations
- [ ] Add progress callbacks for long operations
- [ ] Support for streaming file operations
- [ ] Webhook support for file changes in web mode
- [ ] Queue system for offline operations
