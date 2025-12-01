const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { execSync, exec, spawnSync } = require('child_process')
const fs = require('fs').promises
const oauth = require('./oauth.cjs')
const codex = require('./codex-oauth.cjs')
const claudeSession = require('./claude-session.cjs')
const mcp = require('./mcp.cjs')
const aiSdkWrapper = require('./ai-sdk-wrapper.cjs')

const isDev = process.env.NODE_ENV === 'development'

// Simple rate limiter for file operations
class RateLimiter {
  constructor(maxConcurrent = 2, minIntervalMs = 500) {
    this.maxConcurrent = maxConcurrent
    this.minIntervalMs = minIntervalMs
    this.activeCount = 0
    this.queue = []
    this.lastCallTime = 0
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    const now = Date.now()
    const timeSinceLast = now - this.lastCallTime
    if (timeSinceLast < this.minIntervalMs) {
      setTimeout(() => this.processQueue(), this.minIntervalMs - timeSinceLast)
      return
    }

    const { fn, resolve, reject } = this.queue.shift()
    this.activeCount++
    this.lastCallTime = Date.now()

    try {
      const result = await fn()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.activeCount--
      this.processQueue()
    }
  }
}

// Rate limiter for file search operations (max 2 concurrent, 500ms between starts)
const fileSearchLimiter = new RateLimiter(2, 500)

// Track the main window for sending events
let mainWindow = null

// Git helper - execute git commands
function gitExec(command) {
  try {
    const cwd = process.cwd()
    const result = execSync(`git ${command}`, { cwd, encoding: 'utf-8' })
    return { success: true, data: result.trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Safe git exec with args array - prevents command injection
function gitExecSafe(args) {
  try {
    const cwd = process.cwd()
    const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
    if (result.status !== 0) {
      return { success: false, error: result.stderr || 'Git command failed' }
    }
    return { success: true, data: (result.stdout || '').trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Path validation - prevents directory traversal attacks
const os = require('os')
function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid path' }
  }
  const resolved = path.resolve(filePath)
  const projectRoot = path.resolve(process.cwd())
  const homeDir = os.homedir()
  // Allow paths within project root or user home directory
  if (resolved.startsWith(projectRoot) || resolved.startsWith(homeDir)) {
    return { valid: true, path: resolved }
  }
  return { valid: false, error: 'Path outside allowed directories' }
}

// Register all IPC handlers
function registerHandlers() {
  // Webview preload path
  ipcMain.handle('get-webview-preload-path', () => {
    return path.join(__dirname, 'webview-preload.cjs')
  })
}

// Register OAuth IPC handlers
function registerOAuthHandlers() {
  // Start OAuth login flow with automatic callback capture
  ipcMain.handle('oauth:start-login', async (_event, mode) => {
    try {
      // Generate PKCE challenge and state
      const pkce = oauth.generatePKCEChallenge()
      oauth.setPKCEVerifier(pkce.verifier)
      oauth.setState(pkce.state)

      // Get authorization URL with local callback
      const authUrl = oauth.getAuthorizationUrl(mode, pkce, true)

      console.log('[OAuth] Starting login flow with local callback server')
      console.log('[OAuth] Auth URL:', authUrl)

      // Start the callback server to capture the code automatically
      const codePromise = oauth.startCallbackServer()

      // Open the authorization URL in the default browser
      await shell.openExternal(authUrl)

      // Wait for the callback with the code and state
      try {
        const { code, state } = await codePromise
        console.log('[OAuth] Received code from callback server')
        console.log('[OAuth] State from callback:', state ? state.substring(0, 20) + '...' : 'none')

        // Validate state matches what we sent (CSRF protection)
        const expectedState = oauth.getState()
        if (state !== expectedState) {
          console.error('[OAuth] State mismatch - possible CSRF attack')
          oauth.clearPKCEVerifier()
          oauth.clearState()
          return {
            success: false,
            error: 'OAuth state mismatch - authentication failed'
          }
        }

        // Automatically exchange code for tokens
        const verifier = oauth.getPKCEVerifier()
        const tokens = await oauth.exchangeCodeForTokens(code, verifier, state, true)

        if (!tokens) {
          oauth.clearPKCEVerifier()
          oauth.clearState()
          return {
            success: false,
            error: 'Failed to exchange authorization code for tokens'
          }
        }

        // Clear the temporary verifier and state
        oauth.clearPKCEVerifier()
        oauth.clearState()

        // Save OAuth tokens
        oauth.saveOAuthTokens(tokens)
        console.log('[OAuth] Saved OAuth tokens for Claude Code')

        // Try to create API key (only works with Console OAuth, not Max)
        const apiKey = await oauth.createApiKey(tokens.access)
        if (apiKey) {
          oauth.saveClaudeCodeApiKey(apiKey)
          console.log('[OAuth] Also created and saved API key')
          return {
            success: true,
            apiKey,
            mode: 'api-key',
            autoCompleted: true
          }
        }

        // Max OAuth doesn't have org:create_api_key scope
        console.log('[OAuth] Claude Max OAuth - using Bearer token auth')
        return {
          success: true,
          mode: 'oauth',
          autoCompleted: true
        }
      } catch (callbackError) {
        console.error('[OAuth] Callback server error:', callbackError)
        oauth.stopCallbackServer()
        oauth.clearPKCEVerifier()
        return {
          success: false,
          error: callbackError instanceof Error ? callbackError.message : 'OAuth callback failed'
        }
      }
    } catch (error) {
      console.error('Error starting OAuth login:', error)
      oauth.stopCallbackServer()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Complete OAuth login by exchanging code for tokens
  ipcMain.handle('oauth:complete-login', async (_event, code, createKey = false) => {
    try {
      const verifier = oauth.getPKCEVerifier()
      if (!verifier) {
        return {
          success: false,
          error: 'No active OAuth flow. Please start the login process again.'
        }
      }

      // Exchange code for tokens
      const tokens = await oauth.exchangeCodeForTokens(code, verifier)

      if (!tokens) {
        return {
          success: false,
          error: 'Failed to exchange authorization code for tokens'
        }
      }

      // Clear the temporary verifier
      oauth.clearPKCEVerifier()

      // If creating an API key for Anthropic provider (createKey=true)
      // This only works with Console OAuth (console.anthropic.com) which has org:create_api_key scope
      if (createKey) {
        const apiKey = await oauth.createApiKey(tokens.access)
        if (!apiKey) {
          return {
            success: false,
            error: 'Failed to create API key. Make sure you authorized via Console (not Claude Max).'
          }
        }
        return {
          success: true,
          apiKey,
          mode: 'api-key'
        }
      }

      // For Claude Code (createKey=false): Save OAuth tokens for direct API use
      // Claude Max OAuth tokens can be used directly with the API using Bearer auth
      // and the anthropic-beta: oauth-2025-04-20 header
      oauth.saveOAuthTokens(tokens)
      console.log('[OAuth] Saved OAuth tokens for Claude Code (direct API access)')

      // Try to create API key (only works with Console OAuth, not Max)
      const apiKey = await oauth.createApiKey(tokens.access)
      if (apiKey) {
        oauth.saveClaudeCodeApiKey(apiKey)
        console.log('[OAuth] Also created and saved API key from Console OAuth tokens')
        return {
          success: true,
          apiKey,
          mode: 'api-key'
        }
      }

      // Max OAuth (claude.ai) doesn't have org:create_api_key scope
      // But OAuth tokens can be used directly with Bearer auth
      console.log('[OAuth] Claude Max OAuth - using Bearer token auth (no API key needed)')
      return {
        success: true,
        mode: 'oauth'
      }
    } catch (error) {
      console.error('Error completing OAuth login:', error)
      oauth.clearPKCEVerifier()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Cancel OAuth flow
  ipcMain.handle('oauth:cancel', () => {
    oauth.stopCallbackServer()
    oauth.clearPKCEVerifier()
    return { success: true }
  })

  // Get OAuth status
  ipcMain.handle('oauth:get-status', () => {
    const tokens = oauth.getOAuthTokens()
    return {
      authenticated: !!tokens,
      expiresAt: tokens?.expires || null
    }
  })

  // Logout (clear OAuth tokens)
  ipcMain.handle('oauth:logout', () => {
    try {
      oauth.clearOAuthTokens()
      return { success: true }
    } catch (error) {
      console.error('Error during OAuth logout:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Get valid access token (handles refresh if needed)
  ipcMain.handle('oauth:get-access-token', async () => {
    try {
      const accessToken = await oauth.getValidAccessToken()
      return {
        success: !!accessToken,
        accessToken
      }
    } catch (error) {
      console.error('Error getting access token:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Get Claude Code API key (created from OAuth)
  ipcMain.handle('oauth:get-claude-code-api-key', () => {
    const apiKey = oauth.getClaudeCodeApiKey()
    return {
      success: !!apiKey,
      apiKey
    }
  })

  // Direct test of Anthropic API with OAuth token (bypasses AI SDK)
  ipcMain.handle('oauth:test-api', async () => {
    try {
      // Get fresh access token
      const accessToken = await oauth.getValidAccessToken()
      if (!accessToken) {
        return {
          success: false,
          error: 'No valid access token available'
        }
      }

      // Make a minimal test request to the Anthropic API
      // CRITICAL: The system prompt "You are Claude Code..." is what makes the server
      // accept the OAuth token as a valid Claude Code request!
      const testBody = {
        model: 'claude-opus-4-5-20251101',
        max_tokens: 10,
        system: "You are Claude Code, Anthropic's official CLI for Claude.",
        messages: [
          { role: 'user', content: 'Reply with OK only.' }
        ]
      }

      // Match vibe-kit/auth's exact header format for Claude Code OAuth
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'Authorization': `Bearer ${accessToken}`,
        'X-API-Key': ''
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(testBody)
      })

      const responseText = await response.text()

      if (response.ok) {
        try {
          return {
            success: true,
            response: JSON.parse(responseText)
          }
        } catch (parseError) {
          console.error('[OAuth Test] Invalid JSON response:', responseText.substring(0, 200))
          return {
            success: false,
            error: 'Invalid JSON in API response'
          }
        }
      } else {
        return {
          success: false,
          error: responseText,
          status: response.status
        }
      }
    } catch (error) {
      console.error('[OAuth Test] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // API proxy to bypass CORS for Anthropic API calls
  ipcMain.handle('api:proxy', async (_event, { url, method, headers, body }) => {
    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: headers || {},
        body: body ? JSON.stringify(body) : undefined,
      })

      const responseHeaders = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Handle streaming responses
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/event-stream')) {
        // For streaming, read all chunks and return as text
        const text = await response.text()
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: text,
          isStream: true,
        }
      }

      // Regular JSON response
      const data = await response.json()
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: data,
        isStream: false,
      }
    } catch (error) {
      console.error('API proxy error:', error)
      return {
        ok: false,
        status: 500,
        statusText: 'Proxy Error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}

// Register Codex (OpenAI) OAuth IPC handlers
function registerCodexHandlers() {
  // Start Codex OAuth login flow with automatic callback capture
  ipcMain.handle('codex:start-login', async () => {
    try {
      // Generate PKCE challenge and state
      const pkce = codex.generatePKCEChallenge()
      const state = codex.createState()
      codex.setPKCEVerifier(pkce.verifier)
      codex.setState(state)

      // Get authorization URL
      const authUrl = codex.getAuthorizationUrl(pkce, state)

      // Start the callback server to capture the code automatically
      const codePromise = codex.startCallbackServer(state)

      // Open the authorization URL in the default browser
      shell.openExternal(authUrl)

      // Wait for the code from the callback server
      const result = await codePromise

      if (result && result.code) {
        // Exchange code for tokens
        const verifier = codex.getPKCEVerifier()
        const tokens = await codex.exchangeCodeForTokens(result.code, verifier)

        if (tokens) {
          codex.saveCodexTokens(tokens)
          codex.clearPKCEVerifier()
          codex.clearState()
          return {
            success: true,
            autoCompleted: true
          }
        } else {
          return {
            success: false,
            error: 'Failed to exchange code for tokens'
          }
        }
      }

      return {
        success: false,
        authUrl,
        error: 'Failed to capture authorization code'
      }
    } catch (error) {
      codex.stopCallbackServer()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Cancel Codex OAuth flow
  ipcMain.handle('codex:cancel', async () => {
    codex.stopCallbackServer()
    codex.clearPKCEVerifier()
    codex.clearState()
    return { success: true }
  })

  // Get Codex OAuth status
  ipcMain.handle('codex:get-status', async () => {
    const tokens = codex.getCodexTokens()
    if (!tokens) {
      return { authenticated: false, expiresAt: null }
    }
    return {
      authenticated: true,
      expiresAt: tokens.expires
    }
  })

  // Logout (clear Codex OAuth tokens)
  ipcMain.handle('codex:logout', async () => {
    codex.clearCodexTokens()
    return { success: true }
  })

  // Get valid access token (handles refresh if needed)
  ipcMain.handle('codex:get-access-token', async () => {
    const accessToken = await codex.getValidAccessToken()
    if (!accessToken) {
      return {
        success: false,
        error: 'No valid access token available'
      }
    }
    return {
      success: true,
      accessToken
    }
  })

  // Test Codex API with OAuth token
  ipcMain.handle('codex:test-api', async () => {
    try {
      const accessToken = await codex.getValidAccessToken()
      if (!accessToken) {
        return {
          success: false,
          error: 'No valid access token available'
        }
      }

      // Extract account ID from JWT token
      const accountId = codex.extractAccountId(accessToken)

      // Make a test request to the Codex backend API
      const response = await fetch(`${codex.CODEX_BASE_URL}/codex/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'OpenAI-Beta': 'responses=experimental',
          'chatgpt-account-id': accountId || '',
          'originator': 'codex_cli_rs'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: 'Reply with OK only.',
          instructions: 'You are a helpful assistant. Reply concisely.'
        })
      })

      const responseText = await response.text()

      if (response.ok) {
        try {
          return {
            success: true,
            response: JSON.parse(responseText)
          }
        } catch (parseError) {
          console.error('[API Proxy] Invalid JSON response:', responseText.substring(0, 200))
          return {
            success: false,
            error: 'Invalid JSON in API response'
          }
        }
      } else {
        return {
          success: false,
          error: responseText,
          status: response.status
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}

// Register git IPC handlers
function registerGitHandlers() {
  ipcMain.handle('git:getCurrentBranch', async () => {
    return gitExec('rev-parse --abbrev-ref HEAD')
  })

  ipcMain.handle('git:getBranches', async () => {
    const result = gitExec('branch -a')
    if (result.success) {
      const branches = result.data
        .split('\n')
        .map(b => b.trim().replace(/^\* /, ''))
        .filter(b => b && !b.includes('->'))
      return { success: true, data: branches }
    }
    return result
  })

  ipcMain.handle('git:checkout', async (event, branch) => {
    return gitExec(`checkout ${branch}`)
  })

  ipcMain.handle('git:createBranch', async (event, name) => {
    return gitExec(`checkout -b ${name}`)
  })

  ipcMain.handle('git:getStatus', async () => {
    const result = gitExec('status --porcelain')
    if (result.success) {
      const files = result.data
        .split('\n')
        .filter(f => f.trim())
        .map(f => ({
          status: f.substring(0, 2).trim(),
          file: f.substring(3)
        }))
      return { success: true, data: { files, hasChanges: files.length > 0 } }
    }
    return result
  })

  ipcMain.handle('git:commit', async (event, message) => {
    // Stage all changes first
    const addResult = gitExec('add -A')
    if (!addResult.success) return addResult

    return gitExecSafe(['commit', '-m', message])
  })

  ipcMain.handle('git:push', async () => {
    return gitExec('push')
  })

  ipcMain.handle('git:pull', async () => {
    return gitExec('pull')
  })

  ipcMain.handle('git:stash', async () => {
    return gitExec('stash')
  })

  ipcMain.handle('git:stashWithMessage', async (event, message) => {
    return gitExecSafe(['stash', 'push', '-m', message])
  })

  ipcMain.handle('git:stashPop', async () => {
    return gitExec('stash pop')
  })

  // File operations handlers
  ipcMain.handle('files:readFile', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:selectFile', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: { path: filePath, content } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:listDirectory', async (event, dirPath) => {
    try {
      // Default to project root (parent of electron folder)
      const projectRoot = path.join(__dirname, '..')
      const targetDir = dirPath || projectRoot
      console.log('[Files] Listing directory:', targetDir)
      const entries = await fs.readdir(targetDir, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        path: path.join(targetDir, entry.name),
        isDirectory: entry.isDirectory()
      }))
      // Sort: directories first, then files, both alphabetically
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      console.log('[Files] Found', files.length, 'entries')
      return { success: true, data: files }
    } catch (error) {
      console.error('[Files] Error listing directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:listPrompts', async () => {
    try {
      const promptsDir = path.join(__dirname, '../prompts')
      await fs.mkdir(promptsDir, { recursive: true })
      const files = await fs.readdir(promptsDir)
      const prompts = files.filter(f => f.endsWith('.txt') || f.endsWith('.md'))
      return { success: true, data: prompts.map(f => f.replace(/\.(txt|md)$/, '')) }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:readPrompt', async (event, name) => {
    try {
      const promptsDir = path.join(__dirname, '../prompts')
      const txtPath = path.join(promptsDir, `${name}.txt`)
      const mdPath = path.join(promptsDir, `${name}.md`)

      let content = ''
      try {
        content = await fs.readFile(txtPath, 'utf-8')
      } catch {
        content = await fs.readFile(mdPath, 'utf-8')
      }

      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Write file
  ipcMain.handle('files:writeFile', async (event, filePath, content) => {
    const validation = validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.writeFile(validation.path, content, 'utf-8')
      console.log('[Files] Wrote file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error writing file:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Create file (fails if exists)
  ipcMain.handle('files:createFile', async (event, filePath, content = '') => {
    const validation = validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      // Check if file exists
      try {
        await fs.access(validation.path)
        return { success: false, error: 'File already exists' }
      } catch {
        // File doesn't exist, good to create
      }
      await fs.writeFile(validation.path, content, 'utf-8')
      console.log('[Files] Created file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error creating file:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Delete file
  ipcMain.handle('files:deleteFile', async (event, filePath) => {
    const validation = validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.unlink(validation.path)
      console.log('[Files] Deleted file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error deleting file:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Rename/move file
  ipcMain.handle('files:renameFile', async (event, oldPath, newPath) => {
    const oldValidation = validatePath(oldPath)
    const newValidation = validatePath(newPath)
    if (!oldValidation.valid) {
      return { success: false, error: oldValidation.error }
    }
    if (!newValidation.valid) {
      return { success: false, error: newValidation.error }
    }
    try {
      await fs.rename(oldValidation.path, newValidation.path)
      console.log('[Files] Renamed file:', oldValidation.path, '->', newValidation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error renaming file:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Create directory
  ipcMain.handle('files:createDirectory', async (event, dirPath) => {
    const validation = validatePath(dirPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.mkdir(validation.path, { recursive: true })
      console.log('[Files] Created directory:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error creating directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Delete directory
  ipcMain.handle('files:deleteDirectory', async (event, dirPath) => {
    const validation = validatePath(dirPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.rm(validation.path, { recursive: true, force: true })
      console.log('[Files] Deleted directory:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error deleting directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Check if path exists
  ipcMain.handle('files:exists', async (event, filePath) => {
    try {
      await fs.access(filePath)
      return { success: true, exists: true }
    } catch {
      return { success: true, exists: false }
    }
  })

  // Get file stats (size, modified time, etc)
  ipcMain.handle('files:stat', async (event, filePath) => {
    try {
      const stats = await fs.stat(filePath)
      return {
        success: true,
        data: {
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Copy file
  ipcMain.handle('files:copyFile', async (event, srcPath, destPath) => {
    try {
      await fs.copyFile(srcPath, destPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Search in files (grep-like) - rate limited to prevent excessive disk I/O
  ipcMain.handle('files:searchInFiles', async (event, searchPattern, dirPath, options = {}) => {
    return fileSearchLimiter.execute(async () => {
      try {
        const { filePattern = '*', maxResults = 100, caseSensitive = false } = options
        const results = []
        const searchDir = dirPath || process.cwd()
        const regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi')

      // Recursive search function
      async function searchDirectory(dir, depth = 0) {
        if (depth > 10 || results.length >= maxResults) return

        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= maxResults) break

          const fullPath = path.join(dir, entry.name)

          // Skip node_modules, .git, etc.
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
            continue
          }

          if (entry.isDirectory()) {
            await searchDirectory(fullPath, depth + 1)
          } else if (entry.isFile()) {
            // Check file pattern match
            if (filePattern !== '*') {
              const patterns = filePattern.split(',').map(p => p.trim())
              const matches = patterns.some(p => {
                if (p.startsWith('*.')) {
                  return entry.name.endsWith(p.slice(1))
                }
                return entry.name.includes(p)
              })
              if (!matches) continue
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8')
              const lines = content.split('\n')
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim().substring(0, 200),
                  })
                  if (results.length >= maxResults) break
                }
              }
            } catch {
              // Skip files that can't be read as text
            }
          }
        }
      }

      await searchDirectory(searchDir)
      return { success: true, data: results }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  })

  // Glob pattern matching for finding files - rate limited
  ipcMain.handle('files:glob', async (event, pattern, dirPath) => {
    return fileSearchLimiter.execute(async () => {
      try {
        const searchDir = dirPath || process.cwd()
        const results = []

      // Simple glob matching (supports *, **, and ?)
      function matchGlob(filename, pattern) {
        const regexPattern = pattern
          .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
          .replace(/\*/g, '[^/]*')
          .replace(/<<<DOUBLESTAR>>>/g, '.*')
          .replace(/\?/g, '.')
        return new RegExp(`^${regexPattern}$`).test(filename)
      }

      async function searchDirectory(dir, relativePath = '') {
        if (results.length >= 1000) return

        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= 1000) break

          const fullPath = path.join(dir, entry.name)
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

          // Skip node_modules, .git
          if (entry.name === 'node_modules' || entry.name === '.git') {
            continue
          }

          if (entry.isDirectory()) {
            // Check if pattern includes **
            if (pattern.includes('**')) {
              await searchDirectory(fullPath, relPath)
            }
          }

          if (matchGlob(relPath, pattern) || matchGlob(entry.name, pattern)) {
            results.push({
              path: fullPath,
              relativePath: relPath,
              isDirectory: entry.isDirectory(),
            })
          }

          if (entry.isDirectory() && !pattern.includes('**')) {
            // Only recurse one level for simple patterns
            if (pattern.includes('/')) {
              await searchDirectory(fullPath, relPath)
            }
          }
        }
      }

      await searchDirectory(searchDir)
      return { success: true, data: results }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  })

  // Read multiple files at once
  ipcMain.handle('files:readMultiple', async (event, filePaths) => {
    try {
      const results = await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            return { path: filePath, success: true, content }
          } catch (err) {
            return { path: filePath, success: false, error: err.message }
          }
        })
      )
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Get file tree (recursive directory listing)
  ipcMain.handle('files:getTree', async (event, dirPath, options = {}) => {
    try {
      const { maxDepth = 5, includeHidden = false } = options
      const searchDir = dirPath || process.cwd()

      async function buildTree(dir, depth = 0) {
        if (depth >= maxDepth) return null

        const entries = await fs.readdir(dir, { withFileTypes: true })
        const children = []

        for (const entry of entries) {
          if (!includeHidden && entry.name.startsWith('.')) continue
          if (entry.name === 'node_modules') continue

          const fullPath = path.join(dir, entry.name)
          const node = {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
          }

          if (entry.isDirectory()) {
            const subTree = await buildTree(fullPath, depth + 1)
            if (subTree) {
              node.children = subTree
            }
          }

          children.push(node)
        }

        return children.sort((a, b) => {
          // Directories first, then alphabetical
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      }

      const tree = await buildTree(searchDir)
      return { success: true, data: tree }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Get current working directory
  ipcMain.handle('files:getCwd', async () => {
    try {
      return { success: true, data: process.cwd() }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Folder picker dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    const folderPath = result.filePaths[0]
    const folderName = path.basename(folderPath)
    return { success: true, data: { path: folderPath, name: folderName } }
  })

  // Voice logging handlers
  const os = require('os')
  const voiceLogDir = path.join(os.homedir(), '.cluso', 'voice', 'logs')
  const learningsDir = path.join(os.homedir(), '.cluso', 'learning')

  // Ensure voice log directories exist
  ipcMain.handle('voice:ensureLogDir', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      await fs.mkdir(learningsDir, { recursive: true })
      console.log('[Voice] Log directories ensured:', voiceLogDir)
      return { success: true, path: voiceLogDir }
    } catch (error) {
      console.error('[Voice] Error creating log directories:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save voice session log
  ipcMain.handle('voice:saveLog', async (event, sessionId, content) => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const filePath = path.join(voiceLogDir, `${sessionId}.json`)
      await fs.writeFile(filePath, content, 'utf-8')
      console.log('[Voice] Saved session log:', sessionId)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[Voice] Error saving log:', error.message)
      return { success: false, error: error.message }
    }
  })

  // List voice session logs
  ipcMain.handle('voice:listLogs', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const files = await fs.readdir(voiceLogDir)
      const logs = files
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          sessionId: f.replace('.json', ''),
          path: path.join(voiceLogDir, f)
        }))
      return { success: true, data: logs }
    } catch (error) {
      console.error('[Voice] Error listing logs:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Read voice session log
  ipcMain.handle('voice:readLog', async (event, sessionId) => {
    try {
      const filePath = path.join(voiceLogDir, `${sessionId}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: JSON.parse(content) }
    } catch (error) {
      console.error('[Voice] Error reading log:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get unprocessed logs (for learning worker)
  ipcMain.handle('voice:getUnprocessedLogs', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const processedFile = path.join(voiceLogDir, '.processed')
      let processedSessions = []
      try {
        const content = await fs.readFile(processedFile, 'utf-8')
        processedSessions = content.split('\n').filter(Boolean)
      } catch {
        // No processed file yet
      }

      const files = await fs.readdir(voiceLogDir)
      const unprocessed = []

      for (const f of files) {
        if (!f.endsWith('.json')) continue
        const sessionId = f.replace('.json', '')
        if (processedSessions.includes(sessionId)) continue

        try {
          const content = await fs.readFile(path.join(voiceLogDir, f), 'utf-8')
          unprocessed.push(JSON.parse(content))
        } catch {
          // Skip invalid files
        }
      }

      return { success: true, data: unprocessed }
    } catch (error) {
      console.error('[Voice] Error getting unprocessed logs:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Mark logs as processed
  ipcMain.handle('voice:markProcessed', async (event, sessionIds) => {
    try {
      const processedFile = path.join(voiceLogDir, '.processed')
      let existing = []
      try {
        const content = await fs.readFile(processedFile, 'utf-8')
        existing = content.split('\n').filter(Boolean)
      } catch {
        // No file yet
      }
      const updated = [...new Set([...existing, ...sessionIds])]
      await fs.writeFile(processedFile, updated.join('\n'), 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('[Voice] Error marking processed:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save learnings
  ipcMain.handle('voice:saveLearnings', async (event, content) => {
    try {
      await fs.mkdir(learningsDir, { recursive: true })
      const filePath = path.join(learningsDir, 'voice-learnings.md')
      await fs.writeFile(filePath, content, 'utf-8')
      console.log('[Voice] Saved learnings:', filePath)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[Voice] Error saving learnings:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Read learnings
  ipcMain.handle('voice:readLearnings', async () => {
    try {
      const filePath = path.join(learningsDir, 'voice-learnings.md')
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: '' }
      }
      console.error('[Voice] Error reading learnings:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get log directory path
  ipcMain.handle('voice:getLogPath', async () => {
    return { success: true, data: voiceLogDir }
  })

  // Get learnings directory path
  ipcMain.handle('voice:getLearningsPath', async () => {
    return { success: true, data: learningsDir }
  })

  // ============================================
  // Tab Data Persistence Handlers
  // ============================================
  console.log('[TabData] Registering tab data handlers...')

  const globalDataDir = path.join(os.homedir(), '.cluso', 'data')
  console.log('[TabData] Global data dir:', globalDataDir)

  // Get the data directory for a project (or global if no project)
  function getDataDir(projectPath) {
    if (projectPath) {
      return path.join(projectPath, '.cluso')
    }
    return globalDataDir
  }

  // Ensure tab data directory exists
  ipcMain.handle('tabdata:ensureDir', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      console.log('[TabData] Directory ensured:', dataDir)
      return { success: true, path: dataDir }
    } catch (error) {
      console.error('[TabData] Error creating directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save kanban data - each board gets its own file based on boardId
  ipcMain.handle('tabdata:saveKanban', async (event, projectPath, data) => {
    console.log('[TabData] saveKanban called with projectPath:', projectPath, 'boardId:', data?.boardId)
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(path.join(dataDir, 'kanban'), { recursive: true })

      // Use boardId for unique filename, fallback to 'default'
      const boardId = data?.boardId || 'default'
      const filePath = path.join(dataDir, 'kanban', `${boardId}.json`)

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Kanban saved to:', filePath)
      return { success: true, path: filePath, boardId }
    } catch (error) {
      console.error('[TabData] Error saving kanban:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load all kanban boards from directory
  ipcMain.handle('tabdata:loadKanban', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const kanbanDir = path.join(dataDir, 'kanban')

      // Check if kanban directory exists
      try {
        await fs.access(kanbanDir)
      } catch {
        // No kanban directory yet
        return { success: true, data: [] }
      }

      // Read all kanban files
      const files = await fs.readdir(kanbanDir)
      const boards = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(kanbanDir, file)
            const content = await fs.readFile(filePath, 'utf-8')
            const board = JSON.parse(content)
            boards.push(board)
            console.log('[TabData] Loaded kanban board:', board.boardId, board.boardTitle)
          } catch (e) {
            console.error('[TabData] Error loading kanban file:', file, e.message)
          }
        }
      }

      console.log('[TabData] Loaded', boards.length, 'kanban boards')
      return { success: true, data: boards }
    } catch (error) {
      console.error('[TabData] Error loading kanban:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save todos data
  ipcMain.handle('tabdata:saveTodos', async (event, projectPath, data) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      const filePath = path.join(dataDir, 'todos.json')
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Todos saved to:', filePath)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[TabData] Error saving todos:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load todos data
  ipcMain.handle('tabdata:loadTodos', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const filePath = path.join(dataDir, 'todos.json')
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      console.log('[TabData] Todos loaded from:', filePath)
      return { success: true, data }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: null }
      }
      console.error('[TabData] Error loading todos:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save notes data
  ipcMain.handle('tabdata:saveNotes', async (event, projectPath, data) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      const filePath = path.join(dataDir, 'notes.json')
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Notes saved to:', filePath)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[TabData] Error saving notes:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load notes data
  ipcMain.handle('tabdata:loadNotes', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const filePath = path.join(dataDir, 'notes.json')
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      console.log('[TabData] Notes loaded from:', filePath)
      return { success: true, data }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: null }
      }
      console.error('[TabData] Error loading notes:', error.message)
      return { success: false, error: error.message }
    }
  })

  // List all tab data files in a project
  ipcMain.handle('tabdata:list', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const files = await fs.readdir(dataDir).catch(() => [])
      const tabFiles = files.filter(f => ['kanban.json', 'todos.json', 'notes.json'].includes(f))
      return { success: true, data: tabFiles, path: dataDir }
    } catch (error) {
      console.error('[TabData] Error listing files:', error.message)
      return { success: false, error: error.message }
    }
  })
}

// Register Claude Code session handlers
function registerClaudeCodeHandlers() {
  // Start a Claude Code session
  ipcMain.handle('claude-code:start-session', async (_event, { prompt, model, cwd }) => {
    try {
      // Check if OAuth is authenticated
      const tokens = oauth.getOAuthTokens()
      if (!tokens) {
        return {
          success: false,
          error: 'Claude Code requires OAuth authentication. Please login in Settings.'
        }
      }

      // Start the session - responses will be streamed via events
      claudeSession.startStreamingSession({
        prompt,
        model: model || 'smart',
        cwd: cwd || process.cwd(),
        onTextChunk: (text) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude-code:text-chunk', text)
          }
        },
        onToolUse: (toolUse) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude-code:tool-use', toolUse)
          }
        },
        onToolResult: (toolResult) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude-code:tool-result', toolResult)
          }
        },
        onComplete: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude-code:complete')
          }
        },
        onError: (error) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude-code:error', error)
          }
        },
      })

      return { success: true }
    } catch (error) {
      console.error('Error starting Claude Code session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Send a message to active session
  ipcMain.handle('claude-code:send-message', async (_event, text) => {
    try {
      await claudeSession.sendMessage(text)
      return { success: true }
    } catch (error) {
      console.error('Error sending message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Check if session is active
  ipcMain.handle('claude-code:is-active', () => {
    return { active: claudeSession.isSessionActive() }
  })

  // Stop current response
  ipcMain.handle('claude-code:stop', async () => {
    try {
      const stopped = await claudeSession.interruptCurrentResponse()
      return { success: stopped }
    } catch (error) {
      console.error('Error stopping response:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Reset session
  ipcMain.handle('claude-code:reset', async () => {
    try {
      await claudeSession.resetSession()
      return { success: true }
    } catch (error) {
      console.error('Error resetting session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}

// Register MCP IPC handlers
function registerMCPHandlers() {
  // Connect to an MCP server
  ipcMain.handle('mcp:connect', async (_event, config) => {
    try {
      console.log('[MCP] Connecting to server:', config.id, config.name)
      const result = await mcp.connect(config)
      return result
    } catch (error) {
      console.error('[MCP] Connection error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Disconnect from an MCP server
  ipcMain.handle('mcp:disconnect', async (_event, serverId) => {
    try {
      console.log('[MCP] Disconnecting from server:', serverId)
      return await mcp.disconnect(serverId)
    } catch (error) {
      console.error('[MCP] Disconnect error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Disconnect failed' }
    }
  })

  // List tools from a connected server
  ipcMain.handle('mcp:list-tools', async (_event, serverId) => {
    try {
      const result = await mcp.listTools(serverId)
      return { success: true, tools: result.tools || [] }
    } catch (error) {
      console.error('[MCP] List tools error:', error)
      return { success: false, tools: [], error: error instanceof Error ? error.message : 'Failed to list tools' }
    }
  })

  // List resources from a connected server
  ipcMain.handle('mcp:list-resources', async (_event, serverId) => {
    try {
      const result = await mcp.listResources(serverId)
      return { success: true, resources: result.resources || [] }
    } catch (error) {
      console.error('[MCP] List resources error:', error)
      return { success: false, resources: [], error: error instanceof Error ? error.message : 'Failed to list resources' }
    }
  })

  // List prompts from a connected server
  ipcMain.handle('mcp:list-prompts', async (_event, serverId) => {
    try {
      const result = await mcp.listPrompts(serverId)
      return { success: true, prompts: result.prompts || [] }
    } catch (error) {
      console.error('[MCP] List prompts error:', error)
      return { success: false, prompts: [], error: error instanceof Error ? error.message : 'Failed to list prompts' }
    }
  })

  // Call a tool on a connected server
  ipcMain.handle('mcp:call-tool', async (_event, { serverId, toolName, arguments: args }) => {
    try {
      console.log('[MCP] Calling tool:', toolName, 'on server:', serverId)
      const result = await mcp.callTool({ serverId, toolName, arguments: args })
      return { success: true, ...result }
    } catch (error) {
      console.error('[MCP] Call tool error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Tool call failed' }
    }
  })

  // Read a resource from a connected server
  ipcMain.handle('mcp:read-resource', async (_event, { serverId, uri }) => {
    try {
      const result = await mcp.readResource(serverId, uri)
      return { success: true, ...result }
    } catch (error) {
      console.error('[MCP] Read resource error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read resource' }
    }
  })

  // Get a prompt from a connected server
  ipcMain.handle('mcp:get-prompt', async (_event, { serverId, name, arguments: args }) => {
    try {
      const result = await mcp.getPrompt(serverId, name, args)
      return { success: true, ...result }
    } catch (error) {
      console.error('[MCP] Get prompt error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get prompt' }
    }
  })

  // Get status of all connections
  ipcMain.handle('mcp:get-status', async () => {
    try {
      const status = mcp.getStatus()
      return { success: true, status }
    } catch (error) {
      console.error('[MCP] Get status error:', error)
      return { success: false, status: {}, error: error instanceof Error ? error.message : 'Failed to get status' }
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset', // Hide title bar but keep traffic lights
    trafficLightPosition: { x: 12, y: 12 }, // Position traffic lights
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  // Configure webview security for preload script
  // Note: Preload scripts always have Node access regardless of nodeIntegration setting
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    console.log('will-attach-webview called')
    console.log('params.preload:', params.preload)

    // Prevent guest page from accessing Node APIs directly
    webPreferences.nodeIntegration = false
    // contextIsolation: false allows preload to manipulate page DOM for inspector
    // TODO: Migrate to contextBridge for full isolation (requires preload rewrite)
    webPreferences.contextIsolation = false
    webPreferences.sandbox = false

    // Ensure preload script path is valid
    if (params.preload) {
      const preloadPath = params.preload.replace('file://', '')
      console.log('Setting preload path:', preloadPath)
      webPreferences.preload = preloadPath
    }

    console.log('webPreferences:', JSON.stringify(webPreferences, null, 2))
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  registerHandlers()
  registerGitHandlers()
  registerOAuthHandlers()
  registerCodexHandlers()
  registerClaudeCodeHandlers()
  registerMCPHandlers()

  // Register AI SDK handlers and initialize
  aiSdkWrapper.registerHandlers()
  try {
    await aiSdkWrapper.initialize()
    console.log('[Main] AI SDK wrapper initialized')
  } catch (e) {
    console.warn('[Main] AI SDK wrapper initialization deferred:', e.message)
  }

  createWindow()

  // Set main window reference for MCP events and AI SDK events
  mcp.setMainWindow(mainWindow)
  aiSdkWrapper.setMainWindow(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
