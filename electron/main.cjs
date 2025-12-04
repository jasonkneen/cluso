const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { execSync, exec, spawnSync } = require('child_process')
const fs = require('fs').promises
const oauth = require('./oauth.cjs')
const codex = require('./codex-oauth.cjs')
const claudeSession = require('./claude-session.cjs')
const mcp = require('./mcp.cjs')
const selectorAgent = require('./selector-agent.cjs')
const aiSdkWrapper = require('./ai-sdk-wrapper.cjs')
const agentSdkWrapper = require('./agent-sdk-wrapper.cjs')
const fileWatcher = require('./file-watcher.cjs')
const backgroundValidator = require('./background-validator.cjs')
const agentTodos = require('./agent-todos.cjs')
const lsp = require('./lsp/index.cjs')

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

// DEPRECATED: Use gitExecSafe() instead to prevent command injection
// This function is kept for reference but should not be used
function gitExec_UNSAFE_DO_NOT_USE(command) {
  console.warn('[SECURITY] gitExec_UNSAFE called - this function is deprecated')
  throw new Error('gitExec is deprecated due to command injection risk. Use gitExecSafe() instead.')
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
const fsSync = require('fs')

function validatePath(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid path' }
  }

  // Resolve the path (handles .., ., etc)
  let resolved = path.resolve(filePath)

  // Resolve symlinks to prevent symlink-based bypasses
  try {
    if (fsSync.existsSync(resolved)) {
      resolved = fsSync.realpathSync(resolved)
    }
  } catch (e) {
    // If we can't resolve, use the original resolved path
  }

  const projectRoot = path.resolve(process.cwd())

  // By default, only allow project root
  // Use allowHomeDir: true only for specific trusted operations
  if (resolved.startsWith(projectRoot + path.sep) || resolved === projectRoot) {
    return { valid: true, path: resolved }
  }

  // Allow home directory only if explicitly requested (for user config files, etc)
  if (options.allowHomeDir) {
    const homeDir = os.homedir()
    // Still block sensitive directories even in home
    const blockedDirs = ['.ssh', '.aws', '.gnupg', '.kube', '.config/gcloud']
    const relativePath = path.relative(homeDir, resolved)
    const isBlocked = blockedDirs.some(dir =>
      relativePath.startsWith(dir + path.sep) || relativePath === dir
    )
    if (!isBlocked && (resolved.startsWith(homeDir + path.sep) || resolved === homeDir)) {
      return { valid: true, path: resolved }
    }
  }

  return { valid: false, error: 'Path outside allowed directories' }
}

// Validate git branch/ref names to prevent injection
function validateGitRef(ref) {
  if (!ref || typeof ref !== 'string') {
    return { valid: false, error: 'Invalid ref name' }
  }
  // Git ref names can't contain: space, ~, ^, :, ?, *, [, \, ..
  // Also block shell metacharacters
  const invalidChars = /[\s~^:?*\[\]\\;&|`$()'"<>]/
  if (invalidChars.test(ref) || ref.includes('..')) {
    return { valid: false, error: 'Invalid characters in ref name' }
  }
  if (ref.startsWith('-')) {
    return { valid: false, error: 'Ref name cannot start with dash' }
  }
  return { valid: true, ref: ref.trim() }
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
    return gitExecSafe(['rev-parse', '--abbrev-ref', 'HEAD'])
  })

  ipcMain.handle('git:getBranches', async () => {
    const result = gitExecSafe(['branch', '-a'])
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
    // Validate branch name to prevent injection
    const validation = validateGitRef(branch)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    return gitExecSafe(['checkout', validation.ref])
  })

  ipcMain.handle('git:checkoutFile', async (event, filePath) => {
    // Restore a specific file to its last committed state
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Invalid file path' }
    }
    // Validate path - must be within project folder
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectFolder, filePath)
    if (!absolutePath.startsWith(projectFolder)) {
      return { success: false, error: 'File path outside project folder' }
    }
    // Use -- to separate path from command to prevent path injection
    return gitExecSafe(['checkout', 'HEAD', '--', absolutePath])
  })

  ipcMain.handle('git:createBranch', async (event, name) => {
    // Validate branch name to prevent injection
    const validation = validateGitRef(name)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    return gitExecSafe(['checkout', '-b', validation.ref])
  })

  ipcMain.handle('git:getStatus', async () => {
    const result = gitExecSafe(['status', '--porcelain'])
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
    const addResult = gitExecSafe(['add', '-A'])
    if (!addResult.success) return addResult

    // Message is passed as array element, safe from injection
    return gitExecSafe(['commit', '-m', message])
  })

  ipcMain.handle('git:push', async () => {
    return gitExecSafe(['push'])
  })

  ipcMain.handle('git:pull', async () => {
    return gitExecSafe(['pull'])
  })

  ipcMain.handle('git:stash', async () => {
    return gitExecSafe(['stash'])
  })

  ipcMain.handle('git:stashWithMessage', async (event, message) => {
    return gitExecSafe(['stash', 'push', '-m', message])
  })

  ipcMain.handle('git:stashPop', async () => {
    return gitExecSafe(['stash', 'pop'])
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
    console.log('[Files] writeFile called with path:', filePath)
    console.log('[Files] Content length:', content?.length || 0)

    // Allow writing anywhere in home directory (users need to save to their projects)
    // Sensitive directories (.ssh, .aws, etc) are still blocked
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      console.log('[Files] ❌ Path validation failed:', validation.error)
      return { success: false, error: validation.error }
    }

    console.log('[Files] ✓ Path validated, writing to:', validation.path)

    try {
      await fs.writeFile(validation.path, content, 'utf-8')
      console.log('[Files] ✅ Successfully wrote file:', validation.path)

      // Verify by reading back
      const readBack = await fs.readFile(validation.path, 'utf-8')
      console.log('[Files] Verification read-back length:', readBack.length)
      console.log('[Files] Write verified:', readBack.length === content.length ? '✅ OK' : '❌ MISMATCH')

      return { success: true }
    } catch (error) {
      console.error('[Files] ❌ Error writing file:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Create file (fails if exists)
  ipcMain.handle('files:createFile', async (event, filePath, content = '') => {
    const validation = validatePath(filePath, { allowHomeDir: true })
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
    const validation = validatePath(filePath, { allowHomeDir: true })
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
    const oldValidation = validatePath(oldPath, { allowHomeDir: true })
    const newValidation = validatePath(newPath, { allowHomeDir: true })
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
    const validation = validatePath(dirPath, { allowHomeDir: true })
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
    const validation = validatePath(dirPath, { allowHomeDir: true })
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

  // File watcher handlers
  ipcMain.handle('file-watcher:start', async (event, projectPath) => {
    return fileWatcher.startWatching(projectPath)
  })

  ipcMain.handle('file-watcher:stop', async (event, projectPath) => {
    return fileWatcher.stopWatching(projectPath)
  })

  ipcMain.handle('file-watcher:get-watched', async () => {
    return fileWatcher.getWatchedPaths()
  })

  // Background validator handlers
  ipcMain.handle('validator:trigger', async (event, projectPath) => {
    return backgroundValidator.triggerValidation(projectPath)
  })

  ipcMain.handle('validator:get-state', async (event, projectPath) => {
    return backgroundValidator.getValidationState(projectPath)
  })

  ipcMain.handle('validator:clear', async (event, projectPath) => {
    backgroundValidator.clearValidation(projectPath)
    return { success: true }
  })

  // Agent todos handlers - aggregate todos from various AI coding agents
  ipcMain.handle('agent-todos:scan', async (event, projectPath) => {
    return agentTodos.scanAllAgents(projectPath)
  })

  ipcMain.handle('agent-todos:agents', async () => {
    return agentTodos.getAllAgents()
  })

  ipcMain.handle('agent-todos:agent-info', async (event, agentId) => {
    return agentTodos.getAgentInfo(agentId)
  })

  // LSP handlers - Language Server Protocol integration
  ipcMain.handle('lsp:init', async (event, projectPath) => {
    try {
      await lsp.init(projectPath)
      return { success: true }
    } catch (error) {
      console.error('[LSP] Init failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:shutdown', async () => {
    try {
      await lsp.shutdown()
      return { success: true }
    } catch (error) {
      console.error('[LSP] Shutdown failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:status', async () => {
    try {
      const manager = lsp.getManager()
      return { success: true, data: await manager.getStatus() }
    } catch (error) {
      console.error('[LSP] Status failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:touch-file', async (event, filePath, waitForDiagnostics = false) => {
    try {
      const manager = lsp.getManager()
      const count = await manager.touchFile(filePath, waitForDiagnostics)
      return { success: true, clientCount: count }
    } catch (error) {
      console.error('[LSP] Touch file failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:file-changed', async (event, filePath, content) => {
    try {
      const manager = lsp.getManager()
      await manager.fileChanged(filePath, content)
      return { success: true }
    } catch (error) {
      console.error('[LSP] File changed failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:file-saved', async (event, filePath) => {
    try {
      const manager = lsp.getManager()
      await manager.fileSaved(filePath)
      return { success: true }
    } catch (error) {
      console.error('[LSP] File saved failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:diagnostics', async () => {
    try {
      const manager = lsp.getManager()
      return { success: true, data: manager.getAllDiagnostics() }
    } catch (error) {
      console.error('[LSP] Get diagnostics failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:diagnostics-for-file', async (event, filePath) => {
    try {
      const manager = lsp.getManager()
      return { success: true, data: manager.getDiagnosticsForFile(filePath) }
    } catch (error) {
      console.error('[LSP] Get diagnostics for file failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:hover', async (event, filePath, line, character) => {
    try {
      const manager = lsp.getManager()
      const result = await manager.hover(filePath, line, character)
      return { success: true, data: result }
    } catch (error) {
      console.error('[LSP] Hover failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:completion', async (event, filePath, line, character) => {
    try {
      const manager = lsp.getManager()
      const result = await manager.completion(filePath, line, character)
      return { success: true, data: result }
    } catch (error) {
      console.error('[LSP] Completion failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:definition', async (event, filePath, line, character) => {
    try {
      const manager = lsp.getManager()
      const result = await manager.definition(filePath, line, character)
      return { success: true, data: result }
    } catch (error) {
      console.error('[LSP] Definition failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:references', async (event, filePath, line, character) => {
    try {
      const manager = lsp.getManager()
      const result = await manager.references(filePath, line, character)
      return { success: true, data: result }
    } catch (error) {
      console.error('[LSP] References failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('lsp:set-server-enabled', async (event, serverId, enabled) => {
    try {
      const manager = lsp.getManager()
      manager.setServerEnabled(serverId, enabled)
      return { success: true }
    } catch (error) {
      console.error('[LSP] Set server enabled failed:', error)
      return { success: false, error: error.message }
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

  // Save base64 image to file (for image uploads to project public folder)
  ipcMain.handle('files:saveImage', async (event, base64DataUrl, destPath) => {
    console.log('[Files] saveImage called with destPath:', destPath)

    const validation = validatePath(destPath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      // Parse the base64 data URL: "data:image/png;base64,iVBORw0..."
      const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/)
      if (!matches) {
        return { success: false, error: 'Invalid base64 data URL format' }
      }

      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      // Ensure directory exists
      const dir = path.dirname(validation.path)
      await fs.mkdir(dir, { recursive: true })

      // Write the file
      await fs.writeFile(validation.path, buffer)
      console.log('[Files] Image saved successfully:', validation.path, 'size:', buffer.length)

      return {
        success: true,
        data: {
          path: validation.path,
          size: buffer.length,
          mimeType
        }
      }
    } catch (error) {
      console.error('[Files] saveImage error:', error)
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

// Register Selector Agent IPC handlers
function registerSelectorAgentHandlers() {
  // Initialize selector agent session
  ipcMain.handle('selector-agent:init', async (_event, options = {}) => {
    try {
      // Check if OAuth is authenticated
      const tokens = oauth.getOAuthTokens()
      if (!tokens) {
        return {
          success: false,
          error: 'Selector agent requires OAuth authentication. Please login in Settings.'
        }
      }

      // Check if already active to prevent double-init
      if (selectorAgent.isSessionActive()) {
        console.log('[SelectorAgent] Session already active, skipping init')
        return { success: true }
      }

      // Start the session - responses will be streamed via events
      // Use a Promise wrapper to catch async errors from the SDK
      const initPromise = selectorAgent.initializeSession({
        cwd: options.cwd || process.cwd(),
        onTextChunk: (text) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('selector-agent:text-chunk', text)
          }
        },
        onSelectionResult: (result) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('selector-agent:selection-result', result)
          }
        },
        onError: (error) => {
          console.error('[SelectorAgent] Session error:', error)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('selector-agent:error', error)
          }
        },
        onReady: () => {
          console.log('[SelectorAgent] Session ready')
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('selector-agent:ready')
          }
        },
      })

      // Catch async errors from the SDK (e.g., "process exited with code 1")
      initPromise.catch((error) => {
        console.error('[SelectorAgent] Init failed:', error)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('selector-agent:error',
            error instanceof Error ? error.message : 'Session initialization failed')
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Error initializing selector agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Prime context with page elements
  ipcMain.handle('selector-agent:prime', async (_event, context) => {
    try {
      await selectorAgent.primeContext(context)
      return { success: true }
    } catch (error) {
      console.error('Error priming selector context:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Request element selection
  ipcMain.handle('selector-agent:select', async (_event, { description, options }) => {
    try {
      await selectorAgent.selectElement(description, options)
      return { success: true }
    } catch (error) {
      console.error('Error requesting selection:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Send message to session
  ipcMain.handle('selector-agent:send', async (_event, text) => {
    try {
      await selectorAgent.sendMessage(text)
      return { success: true }
    } catch (error) {
      console.error('Error sending selector message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Check if session is active
  ipcMain.handle('selector-agent:is-active', () => {
    return { active: selectorAgent.isSessionActive() }
  })

  // Get context state
  ipcMain.handle('selector-agent:context-state', () => {
    return selectorAgent.getContextState()
  })

  // Reset session
  ipcMain.handle('selector-agent:reset', async () => {
    try {
      await selectorAgent.resetSession()
      return { success: true }
    } catch (error) {
      console.error('Error resetting selector session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Interrupt current response
  ipcMain.handle('selector-agent:interrupt', async () => {
    try {
      const interrupted = await selectorAgent.interruptResponse()
      return { success: interrupted }
    } catch (error) {
      console.error('Error interrupting selector response:', error)
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

  // Discover MCP servers from Claude Desktop, project, etc.
  ipcMain.handle('mcp:discover', async (_event, projectPath) => {
    try {
      const discovered = await mcp.discoverMcpServers(projectPath)
      return { success: true, discovered }
    } catch (error) {
      console.error('[MCP] Discovery error:', error)
      return { success: false, discovered: {}, error: error instanceof Error ? error.message : 'Failed to discover servers' }
    }
  })

  // Probe a discovered server to get its tools
  ipcMain.handle('mcp:probe', async (_event, serverConfig) => {
    try {
      const result = await mcp.probeServer(serverConfig)
      return { success: true, ...result }
    } catch (error) {
      console.error('[MCP] Probe error:', error)
      return { success: false, tools: null, error: error instanceof Error ? error.message : 'Failed to probe server' }
    }
  })
}

// ============================================
// Fast Apply (Local LLM) IPC Handlers
// ============================================
let fastApplyInstance = null
let fastApplyAvailable = null // null = not checked, true/false = check result

// Mock model data for when the package isn't available yet
const FAST_APPLY_MODELS = [
  {
    variant: 'Q4_K_M',
    file: 'FastApply-1.5B-v1.0-Q4_K_M.gguf',
    size: 986,
    quality: 'Good',
    memory: 1500,
    description: 'Smallest & fastest. Good quality for most use cases.',
    downloaded: false,
  },
  {
    variant: 'Q5_K_M',
    file: 'FastApply-1.5B-v1.0-Q5_K_M.gguf',
    size: 1130,
    quality: 'Better',
    memory: 1700,
    description: 'Slightly better quality, minimal speed impact.',
    downloaded: false,
  },
  {
    variant: 'Q8_0',
    file: 'FastApply-1.5B-v1.0-Q8_0.gguf',
    size: 1650,
    quality: 'High',
    memory: 2200,
    description: 'High quality. Recommended if you have 4GB+ RAM.',
    downloaded: false,
  },
  {
    variant: 'F16',
    file: 'FastApply-1.5B-v1.0-F16.gguf',
    size: 3090,
    quality: 'Maximum',
    memory: 4000,
    description: 'Maximum quality. Requires 6GB+ RAM.',
    downloaded: false,
  },
]

function getFastApply() {
  if (!fastApplyInstance) {
    try {
      const { FastApply } = require('@ai-cluso/fast-apply')
      fastApplyInstance = new FastApply({
        storageDir: path.join(app.getPath('userData'), 'models', 'fast-apply'),
        autoDownload: false,
      })

      // Forward events to renderer
      fastApplyInstance.on('download:progress', (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fast-apply:progress', progress)
        }
      })

      fastApplyInstance.on('download:complete', (modelPath) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fast-apply:complete', modelPath)
        }
      })

      fastApplyInstance.on('download:error', (error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fast-apply:error', error.message)
        }
      })

      fastApplyInstance.on('model:loaded', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fast-apply:model-loaded')
        }
      })

      fastApplyInstance.on('model:unloaded', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fast-apply:model-unloaded')
        }
      })

      fastApplyAvailable = true
      console.log('[FastApply] Initialized')
    } catch (error) {
      fastApplyAvailable = false
      console.error('[FastApply] Failed to initialize:', error.message)
      console.log('[FastApply] Package not installed - UI will show models but downloads disabled')
      return null
    }
  }
  return fastApplyInstance
}

function registerFastApplyHandlers() {
  // Get status
  ipcMain.handle('fast-apply:status', async () => {
    try {
      const fa = getFastApply()
      if (!fa) {
        // Return mock status when package not installed
        return {
          ready: false,
          activeModel: null,
          modelLoaded: false,
          downloadedModels: [],
          storageDir: path.join(app.getPath('userData'), 'models', 'fast-apply'),
        }
      }
      const status = await fa.getStatus()
      return status
    } catch (error) {
      return {
        ready: false,
        activeModel: null,
        modelLoaded: false,
        downloadedModels: [],
        storageDir: path.join(app.getPath('userData'), 'models', 'fast-apply'),
        error: error.message,
      }
    }
  })

  // List all available models
  ipcMain.handle('fast-apply:list-models', async () => {
    try {
      const fa = getFastApply()
      if (!fa) {
        // Return mock models when package not installed (UI will show them as not downloaded)
        return { success: true, models: FAST_APPLY_MODELS }
      }
      const models = await fa.listModels()
      return { success: true, models }
    } catch (error) {
      // Fallback to mock models on error
      return { success: true, models: FAST_APPLY_MODELS, error: error.message }
    }
  })

  // Download a model variant
  ipcMain.handle('fast-apply:download', async (_event, variant) => {
    console.log('[FastApply IPC] Download requested for variant:', variant)
    try {
      const fa = getFastApply()
      if (!fa) {
        console.log('[FastApply IPC] FastApply instance not available')
        return { success: false, error: 'Fast Apply package not installed. Please run: npm install in packages/fast-apply' }
      }
      console.log('[FastApply IPC] Starting download...')
      const modelPath = await fa.download(variant)
      console.log('[FastApply IPC] Download complete:', modelPath)
      return { success: true, path: modelPath }
    } catch (error) {
      console.error('[FastApply IPC] Download error:', error)
      return { success: false, error: error.message }
    }
  })

  // Set active model
  ipcMain.handle('fast-apply:set-model', async (_event, variant) => {
    try {
      const fa = getFastApply()
      if (!fa) {
        return { success: false, error: 'Fast Apply not available' }
      }
      await fa.setActiveModel(variant)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Apply code changes
  ipcMain.handle('fast-apply:apply', async (_event, { code, update }) => {
    try {
      const fa = getFastApply()
      if (!fa) {
        return { success: false, error: 'Fast Apply not available' }
      }
      const result = await fa.apply(code, update)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Cancel download
  ipcMain.handle('fast-apply:cancel', async () => {
    try {
      const fa = getFastApply()
      if (fa) {
        fa.cancelDownload()
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Delete a model
  ipcMain.handle('fast-apply:delete', async (_event, variant) => {
    try {
      const fa = getFastApply()
      if (!fa) {
        return { success: false, error: 'Fast Apply not available' }
      }
      await fa.deleteModel(variant)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Load model into memory
  ipcMain.handle('fast-apply:load', async () => {
    try {
      const fa = getFastApply()
      if (!fa) {
        return { success: false, error: 'Fast Apply not available' }
      }
      console.log('[FastApply IPC] Loading model into memory...')
      await fa.load()
      console.log('[FastApply IPC] Model loaded successfully')
      return { success: true }
    } catch (error) {
      console.error('[FastApply IPC] Load error:', error)
      return { success: false, error: error.message }
    }
  })

  // Unload model to free memory
  ipcMain.handle('fast-apply:unload', async () => {
    try {
      const fa = getFastApply()
      if (fa) {
        await fa.unload()
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  console.log('[FastApply] IPC handlers registered')
}

// ============================================================================
// Agent SDK Handlers (Claude 4.5+ models with full streaming)
// ============================================================================

function registerAgentSdkHandlers() {
  // Stream chat with Agent SDK
  ipcMain.handle('agent-sdk:stream', async (_event, options) => {
    const requestId = options.requestId || require('crypto').randomUUID()
    options.requestId = requestId

    // Start streaming in background
    agentSdkWrapper.streamChat(options).catch(error => {
      console.error('[Agent-SDK] Stream handler error:', error)
      mainWindow.webContents.send('agent-sdk:error', { requestId, error: error.message })
    })

    return { success: true, requestId }
  })

  // Send follow-up message
  ipcMain.handle('agent-sdk:send-message', async (_event, text) => {
    try {
      await agentSdkWrapper.sendMessage(text)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Stop current response
  ipcMain.handle('agent-sdk:stop', async () => {
    try {
      const interrupted = await agentSdkWrapper.interruptCurrentResponse()
      return { success: true, interrupted }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Reset session
  ipcMain.handle('agent-sdk:reset', async () => {
    try {
      await agentSdkWrapper.resetSession()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Check if session is active
  ipcMain.handle('agent-sdk:is-active', () => {
    return { active: agentSdkWrapper.isSessionActive() }
  })

  // Check if model supports Agent SDK
  ipcMain.handle('agent-sdk:supports-model', (_event, modelId) => {
    return { supported: agentSdkWrapper.supportsAgentSDK(modelId) }
  })

  console.log('[Agent-SDK] IPC handlers registered')
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
  // SECURITY NOTE: contextIsolation is disabled for the webview because the inspector
  // functionality requires DOM manipulation and React fiber access in the page context.
  // This is a known tradeoff - mitigations are applied below.
  // Future improvement: Migrate to contextBridge with webContents.executeJavaScript for source location.
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    console.log('will-attach-webview called')
    console.log('params.preload:', params.preload)

    // Prevent guest page from accessing Node APIs directly
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = false

    // Disable remote module (deprecated but explicit is safer)
    webPreferences.enableRemoteModule = false

    // contextIsolation: false allows preload to manipulate page DOM for inspector
    // This is required for: hover highlighting, element selection, React source location detection
    webPreferences.contextIsolation = false
    webPreferences.sandbox = false

    // Disable potentially dangerous features
    webPreferences.allowRunningInsecureContent = false
    webPreferences.experimentalFeatures = false
    webPreferences.webSecurity = true

    // Ensure preload script path is valid
    if (params.preload) {
      const preloadPath = params.preload.replace('file://', '')
      console.log('Setting preload path:', preloadPath)
      webPreferences.preload = preloadPath
    }

    console.log('webPreferences:', JSON.stringify(webPreferences, null, 2))
  })

  // Block dangerous permission requests from webviews
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['clipboard-read', 'clipboard-write']
    const isAllowed = allowedPermissions.includes(permission)
    console.log(`Permission request: ${permission} -> ${isAllowed ? 'allowed' : 'denied'}`)
    callback(isAllowed)
  })

  // Helper to check if URL is local (localhost, file://, etc.)
  const isLocalUrl = (url) => {
    try {
      const parsed = new URL(url)
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']
      return (
        parsed.protocol === 'file:' ||
        localHosts.includes(parsed.hostname) ||
        parsed.hostname.endsWith('.local') ||
        parsed.hostname.endsWith('.localhost')
      )
    } catch {
      // If URL parsing fails, treat as local (relative paths, etc.)
      return true
    }
  }

  // Block dangerous navigation in main window (file://, javascript:, data: URIs)
  // AND prevent navigating away from local URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url)
      const blockedProtocols = ['javascript:', 'data:', 'vbscript:']
      if (blockedProtocols.includes(parsed.protocol)) {
        console.warn(`Blocked navigation to dangerous URL: ${url}`)
        event.preventDefault()
        return
      }
    } catch {
      // URL parsing failed, allow it
    }
  })

  // Handle webview navigation - open external URLs in system browser
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    // Block external URL navigation in webviews - open in system browser instead
    webContents.on('will-navigate', (navEvent, url) => {
      if (!isLocalUrl(url)) {
        console.log(`[Webview] External URL detected, opening in system browser: ${url}`)
        navEvent.preventDefault()
        shell.openExternal(url).catch((err) => {
          console.error('Failed to open external URL:', err)
        })
      }
    })

    // Handle new window requests (target="_blank", window.open, etc.) in webviews
    webContents.setWindowOpenHandler(({ url }) => {
      if (!isLocalUrl(url)) {
        console.log(`[Webview] New window request for external URL, opening in system browser: ${url}`)
        shell.openExternal(url).catch((err) => {
          console.error('Failed to open external URL:', err)
        })
      }
      // Always deny new windows - external links open in system browser
      return { action: 'deny' }
    })
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
  registerSelectorAgentHandlers()
  registerFastApplyHandlers()
  registerAgentSdkHandlers()

  // Register AI SDK handlers and initialize
  aiSdkWrapper.registerHandlers()
  try {
    await aiSdkWrapper.initialize()
    console.log('[Main] AI SDK wrapper initialized')
  } catch (e) {
    console.warn('[Main] AI SDK wrapper initialization deferred:', e.message)
  }

  createWindow()

  // Set main window reference for MCP events, AI SDK events, Agent SDK events, and file watcher
  mcp.setMainWindow(mainWindow)
  aiSdkWrapper.setMainWindow(mainWindow)
  agentSdkWrapper.setMainWindow(mainWindow)
  fileWatcher.setMainWindow(mainWindow)
  lsp.setMainWindow(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Stop all file watchers before quitting
  fileWatcher.stopAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
