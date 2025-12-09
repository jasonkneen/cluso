/**
 * Example Usage of the API Adapter Layer
 * Shows how to use the adapter in React components
 */

import React, { useState } from 'react'
import { getAdapter, isElectronMode } from './index'

/**
 * Example 1: File Reader Component
 * Demonstrates reading and writing files
 */
export function FileReaderExample() {
  const adapter = getAdapter()
  const [filePath, setFilePath] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRead() {
    setLoading(true)
    setError('')
    const result = await adapter.files.readFile(filePath)
    setLoading(false)

    if (result.success) {
      setContent(result.data)
    } else {
      setError(result.error)
      setContent('')
    }
  }

  async function handleWrite(newContent: string) {
    setLoading(true)
    setError('')
    const result = await adapter.files.writeFile(filePath, newContent)
    setLoading(false)

    if (result.success) {
      setContent(newContent)
    } else {
      setError(result.error)
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <h2>File Reader</h2>
      <input
        type="text"
        placeholder="File path"
        value={filePath}
        onChange={(e) => setFilePath(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
      />
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleRead} disabled={loading}>
          {loading ? 'Loading...' : 'Read File'}
        </button>
        <button
          onClick={() => handleWrite(content)}
          disabled={loading || !content}
          style={{ marginLeft: '10px' }}
        >
          {loading ? 'Saving...' : 'Save File'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {content && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: '100%', height: '200px' }}
        />
      )}
    </div>
  )
}

/**
 * Example 2: Git Status Component
 * Demonstrates git operations (Electron only)
 */
export function GitStatusExample() {
  const adapter = getAdapter()
  const isElectron = isElectronMode()
  const [status, setStatus] = useState<string | null>(null)
  const [branch, setBranch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGetStatus() {
    setLoading(true)
    setError('')
    const result = await adapter.git.getStatus()
    setLoading(false)

    if (result.success) {
      setStatus(
        `Files changed: ${result.data.files.length}, Has changes: ${result.data.hasChanges}`
      )
    } else {
      setError(result.error)
      setStatus(null)
    }
  }

  async function handleGetBranch() {
    setLoading(true)
    setError('')
    const result = await adapter.git.getCurrentBranch()
    setLoading(false)

    if (result.success) {
      setBranch(result.data)
    } else {
      setError(result.error)
      setBranch('')
    }
  }

  async function handleCheckout(branchName: string) {
    setLoading(true)
    setError('')
    const result = await adapter.git.checkout(branchName)
    setLoading(false)

    if (result.success) {
      setBranch(branchName)
    } else {
      setError(result.error)
    }
  }

  if (!isElectron) {
    return <p>Git operations are only available in Electron mode</p>
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', marginTop: '20px' }}>
      <h2>Git Status</h2>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleGetStatus} disabled={loading}>
          {loading ? 'Loading...' : 'Get Status'}
        </button>
        <button
          onClick={handleGetBranch}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          {loading ? 'Loading...' : 'Get Branch'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {branch && <p>Current branch: <strong>{branch}</strong></p>}
      {status && <p>Status: {status}</p>}
      <div style={{ marginTop: '10px' }}>
        <input
          type="text"
          placeholder="Branch name"
          style={{ padding: '8px', marginRight: '10px' }}
          id="branchInput"
        />
        <button
          onClick={() => {
            const input = document.getElementById('branchInput') as HTMLInputElement
            if (input.value) {
              handleCheckout(input.value)
            }
          }}
          disabled={loading}
        >
          Checkout Branch
        </button>
      </div>
    </div>
  )
}

/**
 * Example 3: OAuth Login Component
 * Demonstrates OAuth flow
 */
export function OAuthLoginExample() {
  const adapter = getAdapter()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const result = await adapter.oauth.startLogin('console')
    setLoading(false)

    if (result.success) {
      setStatus('OAuth started - check console for auth URL')
      // In a real app, you'd open the auth URL and listen for the callback
      console.log('Auth URL:', result.data.authUrl)
    } else {
      setError(result.error)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setError('')
    const result = await adapter.oauth.logout()
    setLoading(false)

    if (result.success) {
      setStatus('Logged out')
    } else {
      setError(result.error)
    }
  }

  async function handleGetStatus() {
    setLoading(true)
    setError('')
    const result = await adapter.oauth.getStatus()
    setLoading(false)

    if (result.success) {
      setStatus(
        `Authenticated: ${result.data.authenticated}, Expires: ${new Date(result.data.expiresAt || 0).toLocaleString()}`
      )
    } else {
      setError(result.error)
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', marginTop: '20px' }}>
      <h2>OAuth Login</h2>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Processing...' : 'Login'}
        </button>
        <button
          onClick={handleGetStatus}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          {loading ? 'Loading...' : 'Get Status'}
        </button>
        <button
          onClick={handleLogout}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          {loading ? 'Processing...' : 'Logout'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {status && <p>Status: {status}</p>}
    </div>
  )
}

/**
 * Example 4: Directory Listing Component
 * Demonstrates file system operations
 */
export function DirectoryListExample() {
  const adapter = getAdapter()
  const [dirPath, setDirPath] = useState('.')
  const [files, setFiles] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleListDirectory() {
    setLoading(true)
    setError('')
    const result = await adapter.files.listDirectory(dirPath)
    setLoading(false)

    if (result.success) {
      setFiles(result.data)
    } else {
      setError(result.error)
      setFiles([])
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', marginTop: '20px' }}>
      <h2>Directory Listing</h2>
      <input
        type="text"
        placeholder="Directory path"
        value={dirPath}
        onChange={(e) => setDirPath(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
      />
      <button onClick={handleListDirectory} disabled={loading}>
        {loading ? 'Loading...' : 'List Directory'}
      </button>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {files.length > 0 && (
        <ul style={{ marginTop: '10px' }}>
          {files.map((file) => (
            <li key={file.path}>
              {file.isDirectory ? '📁' : '📄'} {file.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Example 5: Combined App
 * Shows all examples together
 */
export function AdapterExamplesApp() {
  const isElectron = isElectronMode()

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>API Adapter Examples</h1>
      <p>
        Running in <strong>{isElectron ? 'Electron' : 'Web'}</strong> mode
      </p>

      <FileReaderExample />
      <GitStatusExample />
      <OAuthLoginExample />
      <DirectoryListExample />
    </div>
  )
}
