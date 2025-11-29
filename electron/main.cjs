const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { execSync, exec } = require('child_process')
const fs = require('fs').promises
const oauth = require('./oauth.cjs')
const claudeSession = require('./claude-session.cjs')

const isDev = process.env.NODE_ENV === 'development'

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
      // Generate PKCE challenge
      const pkce = oauth.generatePKCEChallenge()
      oauth.setPKCEVerifier(pkce.verifier)

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

        // Automatically exchange code for tokens
        const verifier = oauth.getPKCEVerifier()
        const tokens = await oauth.exchangeCodeForTokens(code, verifier, state, true)

        if (!tokens) {
          oauth.clearPKCEVerifier()
          return {
            success: false,
            error: 'Failed to exchange authorization code for tokens'
          }
        }

        // Clear the temporary verifier
        oauth.clearPKCEVerifier()

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
        model: 'claude-sonnet-4-20250514',
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
        return {
          success: true,
          response: JSON.parse(responseText)
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

    return gitExec(`commit -m "${message.replace(/"/g, '\\"')}"`)
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
    return gitExec(`stash push -m "${message.replace(/"/g, '\\"')}"`)
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

  // Allow webview to use node integration for preload script
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    console.log('will-attach-webview called')
    console.log('params.preload:', params.preload)

    // Enable node integration in webview preload
    webPreferences.nodeIntegration = true
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

app.whenReady().then(() => {
  registerHandlers()
  registerGitHandlers()
  registerOAuthHandlers()
  registerClaudeCodeHandlers()
  createWindow()

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
