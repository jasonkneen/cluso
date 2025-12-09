# API Adapter Usage Examples

## Basic Usage in React Components

### Simple Component with Git Operations

```tsx
import { useAPI } from '../../hooks/useAPI'

function GitStatus() {
  const { invoke, isConnected } = useAPI()
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return

    async function fetchBranch() {
      try {
        const currentBranch = await invoke<string>('git.getCurrentBranch')
        setBranch(currentBranch)
      } catch (error) {
        console.error('Failed to fetch branch:', error)
      }
    }

    fetchBranch()
  }, [isConnected, invoke])

  if (!isConnected) return <div>Connecting...</div>
  return <div>Current branch: {branch || 'loading...'}</div>
}
```

### File Watcher with Real-Time Updates

```tsx
import { useAPI } from '../../hooks/useAPI'

function FileWatcher({ projectPath }: { projectPath: string }) {
  const { invoke, subscribe } = useAPI()
  const [changes, setChanges] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    async function startWatching() {
      try {
        // Start file watcher
        await invoke('fileWatcher.start', projectPath)

        // Subscribe to changes
        const unsubscribe = subscribe('fileWatcher', (change: unknown) => {
          if (!mounted) return

          const fileChange = change as { path: string; type: 'add' | 'change' | 'unlink' }
          setChanges((prev) => [...prev, `${fileChange.type}: ${fileChange.path}`])
        })

        return unsubscribe
      } catch (error) {
        console.error('Failed to start file watcher:', error)
      }
    }

    const unsubscribePromise = startWatching()

    return () => {
      mounted = false
      void unsubscribePromise.then((unsub) => unsub?.())
    }
  }, [invoke, subscribe, projectPath])

  return (
    <div>
      <h3>File Changes</h3>
      <ul>
        {changes.map((change, i) => (
          <li key={i}>{change}</li>
        ))}
      </ul>
    </div>
  )
}
```

### OAuth Login Flow

```tsx
import { useAPI } from '../../hooks/useAPI'

function OAuthLogin() {
  const { invoke, isElectron } = useAPI()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleLogin() {
    if (!isElectron) {
      alert('OAuth is only available in Electron')
      return
    }

    try {
      setStatus('loading')
      const result = await invoke('oauth.startLogin', 'console')
      console.log('Login URL:', result)
      setStatus('success')
    } catch (error) {
      console.error('Login failed:', error)
      setStatus('error')
    }
  }

  return (
    <div>
      <button onClick={handleLogin} disabled={status === 'loading'}>
        {status === 'loading' ? 'Logging in...' : 'Login with Claude'}
      </button>
      {status === 'success' && <p>Check your browser for authorization!</p>}
      {status === 'error' && <p>Login failed. Try again.</p>}
    </div>
  )
}
```

### Multi-Request Operations

```tsx
import { useAPI } from '../../hooks/useAPI'

function GitOperations() {
  const { invoke } = useAPI()

  async function commitAndPush(message: string) {
    try {
      // Get current status
      const status = await invoke('git.getStatus')
      if (!status.dirty) {
        alert('No changes to commit')
        return
      }

      // Commit
      await invoke('git.commit', message)

      // Push
      await invoke('git.push')

      alert('Committed and pushed successfully!')
    } catch (error) {
      console.error('Operation failed:', error)
      alert('Failed: ' + String(error))
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const message = new FormData(e.currentTarget).get('message')
        void commitAndPush(String(message))
      }}
    >
      <input name="message" placeholder="Commit message" required />
      <button type="submit">Commit & Push</button>
    </form>
  )
}
```

## Advanced Usage Patterns

### Custom Hook for Specific Domain

```tsx
import { useAPI } from '../../hooks/useAPI'
import { useCallback } from 'react'

/**
 * Custom hook for Git operations
 * Provides a cleaner API for git-specific operations
 */
export function useGit() {
  const { invoke, isConnected } = useAPI()

  const getCurrentBranch = useCallback(async () => {
    return await invoke<string>('git.getCurrentBranch')
  }, [invoke])

  const getBranches = useCallback(async () => {
    return await invoke<string[]>('git.getBranches')
  }, [invoke])

  const getStatus = useCallback(async () => {
    return await invoke('git.getStatus')
  }, [invoke])

  const commit = useCallback(
    async (message: string) => {
      return await invoke('git.commit', message)
    },
    [invoke]
  )

  const push = useCallback(async () => {
    return await invoke('git.push')
  }, [invoke])

  const pull = useCallback(async () => {
    return await invoke('git.pull')
  }, [invoke])

  return {
    isConnected,
    getCurrentBranch,
    getBranches,
    getStatus,
    commit,
    push,
    pull,
  }
}

// Usage:
function MyComponent() {
  const git = useGit()

  return (
    <button onClick={() => git.getCurrentBranch().then(console.log)}>
      Get Current Branch
    </button>
  )
}
```

### Polling Pattern

```tsx
import { useAPI } from '../../hooks/useAPI'

function RepositoryStatus({ interval = 5000 }: { interval?: number }) {
  const { invoke } = useAPI()
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchStatus() {
      try {
        const result = await invoke('git.getStatus')
        if (mounted) {
          setStatus(result)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(String(err))
          setStatus(null)
        }
      }
    }

    // Fetch immediately
    void fetchStatus()

    // Then poll at interval
    const timer = setInterval(fetchStatus, interval)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [invoke, interval])

  if (error) return <div className="error">{error}</div>
  if (!status) return <div>Loading...</div>

  return (
    <div>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  )
}
```

### Conditional Logic Based on Environment

```tsx
import { useAPI } from '../../hooks/useAPI'

function APIConsumer() {
  const { api, isElectron, invoke, send } = useAPI()

  async function performOperation() {
    if (isElectron) {
      // Use Electron-specific features
      await invoke('files.createDirectory', '/path/to/dir')
      const content = await invoke('files.readFile', '/path/to/file')
    } else {
      // Use web-based API
      const response = await fetch('/api/files', { method: 'POST' })
      const data = await response.json()
    }
  }

  return (
    <div>
      <p>Environment: {isElectron ? 'Electron' : 'Web'}</p>
      <button onClick={performOperation}>Perform Operation</button>
    </div>
  )
}
```

### Error Handling with Retry Logic

```tsx
import { useAPI } from '../../hooks/useAPI'

async function invokeWithRetry(
  invoke: (channel: string, data?: unknown) => Promise<unknown>,
  channel: string,
  data?: unknown,
  maxAttempts = 3,
  delayMs = 1000
): Promise<unknown> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await invoke(channel, data)
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
}

function CriticalOperation() {
  const { invoke } = useAPI()

  async function handleClick() {
    try {
      const result = await invokeWithRetry(invoke, 'api.criticalOperation', { data: 'value' })
      console.log('Success:', result)
    } catch (error) {
      console.error('Failed after retries:', error)
    }
  }

  return <button onClick={handleClick}>Perform Critical Operation</button>
}
```

## Usage Outside React

### In Utilities/Services

```ts
// utils/git.ts
import { getAPI } from '../../hooks/useAPI'

export async function getCurrentGitBranch(): Promise<string> {
  const api = getAPI()
  return await api.invoke<string>('git.getCurrentBranch')
}

export async function getRepositoryStatus() {
  const api = getAPI()
  return await api.invoke('git.getStatus')
}

export async function commitChanges(message: string) {
  const api = getAPI()
  return await api.invoke('git.commit', message)
}
```

### In Event Handlers

```ts
// services/file-service.ts
import { getAPI } from '../../hooks/useAPI'

class FileService {
  async readFile(path: string): Promise<string> {
    const api = getAPI()
    return await api.invoke<string>('files.readFile', path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    const api = getAPI()
    await api.invoke('files.writeFile', { path, content })
  }

  watchDirectory(path: string, onChange: (change: unknown) => void) {
    const api = getAPI()
    void api.invoke('fileWatcher.start', path)
    return api.subscribe('fileWatcher', onChange)
  }
}

export const fileService = new FileService()
```

### In Data Fetching

```ts
// lib/data-fetcher.ts
import { getAPI } from '../../hooks/useAPI'

export async function fetchProjectData(projectPath: string) {
  const api = getAPI()

  // Parallel requests
  const [files, gitStatus, mgrepStatus] = await Promise.all([
    api.invoke('files.getTree', projectPath),
    api.invoke('git.getStatus'),
    api.invoke('mgrep.getStatus', projectPath),
  ])

  return { files, gitStatus, mgrepStatus }
}
```

## Type Safety Examples

### Typed API Wrapper

```ts
// types/api.ts
export interface FileChangeEvent {
  path: string
  type: 'add' | 'change' | 'unlink'
}

export interface GitStatus {
  branch: string
  dirty: boolean
  files: string[]
}

// lib/typed-api.ts
import { getAPI } from '../../hooks/useAPI'
import type { FileChangeEvent, GitStatus } from './types'

class TypedAPI {
  private api = getAPI()

  async getGitStatus(): Promise<GitStatus> {
    return await this.api.invoke<GitStatus>('git.getStatus')
  }

  onFileChange(callback: (event: FileChangeEvent) => void) {
    return this.api.subscribe('fileWatcher', (data) => {
      callback(data as FileChangeEvent)
    })
  }
}

export const typedAPI = new TypedAPI()
```

## Testing Examples

```ts
import { createAdapter } from '../adapters'
import { describe, it, expect, vi } from 'vitest'

describe('My API Consumer', () => {
  it('should handle errors gracefully', async () => {
    const mockAdapter = createAdapter('web')
    const spy = vi.spyOn(mockAdapter, 'invoke').mockRejectedValueOnce(new Error('Network error'))

    try {
      await mockAdapter.invoke('some.channel')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
    }

    expect(spy).toHaveBeenCalledWith('some.channel')
  })
})
```
