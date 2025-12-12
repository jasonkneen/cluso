const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const { autoUpdater } = require('electron-updater')
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
const lsp = require('./lsp-bridge.cjs')
const mgrep = require('./mgrep.cjs')
const backupManager = require('./backup-manager.cjs')
const morph = require('./shared/morph.cjs')
const registerGitHandlers = require('./ipc/git-handlers.cjs')
const registerFileHandlers = require('./ipc/file-handlers.cjs')
const registerLspHandlers = require('./ipc/lsp-handlers.cjs')
const registerVoiceHandlers = require('./ipc/voice-handlers.cjs')
const registerAgentHandlers = require('./ipc/agent-handlers.cjs')
const registerTabDataHandlers = require('./ipc/tab-data-handlers.cjs')

const isDev = process.env.NODE_ENV === 'development'

// Suppress Electron security warnings in dev mode
// These warnings are expected when using dynamic script injection for React fiber extraction
// The warnings don't appear in production builds
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// ==========================================
// Multi-Window Support with Project Locking
// ==========================================
// Each window is locked to a single project once set.
// Opening a different project opens a new window.
// Windows track: id, project path, BrowserWindow instance

// Window registry: Map<windowId, { window: BrowserWindow, projectPath: string | null }>
const windowRegistry = new Map()
let nextWindowId = 1

// Track the main window for sending events (for backwards compatibility)
let mainWindow = null

// Helper: Get window by project path
function getWindowByProject(projectPath) {
  for (const [id, entry] of windowRegistry) {
    if (entry.projectPath === projectPath) {
      return { id, ...entry }
    }
  }
  return null
}

// Helper: Get all windows with projects
function getAllProjectWindows() {
  const result = []
  for (const [id, entry] of windowRegistry) {
    result.push({
      id,
      projectPath: entry.projectPath,
      projectName: entry.projectName || null,
      isFocused: entry.window.isFocused()
    })
  }
  return result
}

// Helper: Send to specific window
function sendToWindow(windowId, channel, data) {
  const entry = windowRegistry.get(windowId)
  if (entry && entry.window && !entry.window.isDestroyed()) {
    entry.window.webContents.send(channel, data)
  }
}

// Helper: Send to all windows
function sendToAllWindows(channel, data) {
  for (const [, entry] of windowRegistry) {
    if (entry.window && !entry.window.isDestroyed()) {
      entry.window.webContents.send(channel, data)
    }
  }
}

// Build application menu with Window submenu for project switching
function buildApplicationMenu() {
  const projectWindows = getAllProjectWindows().filter(w => w.projectPath)

  const windowSubmenu = [
    {
      label: 'New Window',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => {
        createWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    { type: 'separator' },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ]

  // Add project windows if any exist
  if (projectWindows.length > 0) {
    windowSubmenu.push({ type: 'separator' })
    windowSubmenu.push({
      label: 'Project Windows',
      enabled: false
    })

    for (const pw of projectWindows) {
      const displayName = pw.projectName || path.basename(pw.projectPath || 'Unknown')
      windowSubmenu.push({
        label: `  ${displayName}`,
        type: 'checkbox',
        checked: pw.isFocused,
        click: () => {
          const entry = windowRegistry.get(pw.id)
          if (entry && entry.window && !entry.window.isDestroyed()) {
            entry.window.focus()
          }
        }
      })
    }
  }

  const template = [
    // App menu (macOS)
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            createWindow()
          }
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: windowSubmenu
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Update menu when windows change (to reflect current project windows)
function updateApplicationMenu() {
  buildApplicationMenu()
}





// Register all IPC handlers
function registerHandlers() {
  // Webview preload path
  ipcMain.handle('get-webview-preload-path', () => {
    return path.join(__dirname, 'webview-preload.cjs')
  })
}

// Register Window Management IPC handlers
function registerWindowHandlers() {
  // Get current window info (called from renderer to get its identity)
  ipcMain.handle('window:get-info', (event) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    if (!win) return { windowId: null, projectPath: null, projectName: null }

    const windowId = win.windowId
    const entry = windowRegistry.get(windowId)
    return {
      windowId,
      projectPath: entry?.projectPath || null,
      projectName: entry?.projectName || null
    }
  })

  // Lock this window to a project (one-time operation)
  ipcMain.handle('window:lock-project', (event, projectPath, projectName) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    if (!win) return { success: false, error: 'Window not found' }

    const windowId = win.windowId
    const entry = windowRegistry.get(windowId)
    if (!entry) return { success: false, error: 'Window not in registry' }

    // Check if this window already has a project
    if (entry.projectPath) {
      if (entry.projectPath === projectPath) {
        return { success: true, message: 'Already locked to this project' }
      }
      return {
        success: false,
        error: 'Window already locked to a different project',
        currentProject: entry.projectPath
      }
    }

    // Check if project is already open in another window
    const existingWindow = getWindowByProject(projectPath)
    if (existingWindow && existingWindow.id !== windowId) {
      return {
        success: false,
        error: 'Project already open in another window',
        existingWindowId: existingWindow.id
      }
    }

    // Lock this window to the project
    entry.projectPath = projectPath
    entry.projectName = projectName
    windowRegistry.set(windowId, entry)
    console.log(`[Window] Window ${windowId} locked to project: ${projectPath}`)

    // Update window title
    win.setTitle(projectName || path.basename(projectPath))

    // Notify all windows about registry change
    sendToAllWindows('window:registry-changed', getAllProjectWindows())

    // Update application menu to show new project window
    updateApplicationMenu()

    return { success: true, windowId, projectPath, projectName }
  })

  // Open a project - either in existing window (if available) or new window
  ipcMain.handle('window:open-project', async (_event, projectPath, projectName) => {
    // Check if project already has a window
    const existingWindow = getWindowByProject(projectPath)
    if (existingWindow) {
      existingWindow.window.focus()
      return {
        success: true,
        action: 'focused',
        windowId: existingWindow.id,
        alreadyOpen: true
      }
    }

    // Create new window for this project
    const result = createWindow({ projectPath, projectName })
    return {
      success: true,
      action: result.alreadyOpen ? 'focused' : 'created',
      windowId: result.windowId,
      alreadyOpen: result.alreadyOpen
    }
  })

  // Open a new empty window (no project locked yet)
  ipcMain.handle('window:new', async () => {
    const result = createWindow()
    return {
      success: true,
      windowId: result.windowId
    }
  })

  // Check if a project is already open in any window
  ipcMain.handle('window:is-project-open', (_event, projectPath) => {
    const existingWindow = getWindowByProject(projectPath)
    return {
      isOpen: !!existingWindow,
      windowId: existingWindow?.id || null
    }
  })

  // Get all open project windows
  ipcMain.handle('window:get-all', () => {
    return getAllProjectWindows()
  })

  // Focus a specific window
  ipcMain.handle('window:focus', (_event, windowId) => {
    const entry = windowRegistry.get(windowId)
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.focus()
      return { success: true }
    }
    return { success: false, error: 'Window not found' }
  })

  // Close a specific window
  ipcMain.handle('window:close', (_event, windowId) => {
    const entry = windowRegistry.get(windowId)
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.close()
      return { success: true }
    }
    return { success: false, error: 'Window not found' }
  })

  // Set window appearance options (opacity/transparency/blur)
  // NOTE: `transparent` can’t be toggled after window creation in Electron.
  // We create the window with transparency enabled and emulate “off” by setting
  // an opaque background + disabling vibrancy.
  ipcMain.handle('window:set-appearance', (event, appearance = {}) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    if (!win) return { success: false, error: 'Window not found' }

    const transparencyEnabled = !!appearance.transparencyEnabled
    const opacityRaw = typeof appearance.opacity === 'number' ? appearance.opacity : 1
    const blurRaw = typeof appearance.blur === 'number' ? appearance.blur : 0

    const opacity = Math.min(1, Math.max(0.2, opacityRaw))
    const blur = Math.min(30, Math.max(0, blurRaw))

    try {
      // Background: transparent when enabled, solid otherwise
      win.setBackgroundColor(transparencyEnabled ? '#00000000' : '#1a1a1a')

      // Opacity
      win.setOpacity(transparencyEnabled ? opacity : 1)

      // Blur (platform-specific)
      if (typeof win.setVibrancy === 'function') {
        // macOS
        win.setVibrancy(transparencyEnabled && blur > 0 ? 'sidebar' : null)
      }
      if (typeof win.setBackgroundMaterial === 'function') {
        // Windows 11+ (best-effort)
        win.setBackgroundMaterial(transparencyEnabled && blur > 0 ? 'mica' : 'none')
      }

      return { success: true, applied: { transparencyEnabled, opacity, blur } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set appearance' }
    }
  })

  console.log('[Window] IPC handlers registered')
}

// Auto-update handlers (electron-updater)
function registerUpdateHandlers() {
  ipcMain.handle('updates:get-version', async () => ({ success: true, version: app.getVersion() }))

  if (isDev) {
    console.log('[Updates] Skipping autoUpdater in development mode')
    ipcMain.handle('updates:check', async () => ({ success: false, error: 'Updates are disabled in development mode' }))
    ipcMain.handle('updates:download', async () => ({ success: false, error: 'Updates are disabled in development mode' }))
    ipcMain.handle('updates:install', async () => ({ success: false, error: 'Updates are disabled in development mode' }))
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const feedUrl = process.env.AICLUSO_UPDATE_FEED
  if (feedUrl) {
    try {
      autoUpdater.setFeedURL({ url: feedUrl })
      console.log('[Updates] Feed URL set from AICLUSO_UPDATE_FEED')
    } catch (err) {
      console.warn('[Updates] Failed to set feed URL:', err.message)
    }
  }

  const sendUpdateEvent = (payload) => {
    sendToAllWindows('updates:event', payload)
  }

  autoUpdater.on('checking-for-update', () => sendUpdateEvent({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => sendUpdateEvent({ type: 'available', info }))
  autoUpdater.on('update-not-available', () => sendUpdateEvent({ type: 'none' }))
  autoUpdater.on('download-progress', (progress) => sendUpdateEvent({ type: 'progress', progress }))
  autoUpdater.on('update-downloaded', (info) => sendUpdateEvent({ type: 'ready', info }))
  autoUpdater.on('error', (error) => sendUpdateEvent({ type: 'error', message: error?.message || 'Update error' }))

  ipcMain.handle('updates:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, info: result?.updateInfo || null }
    } catch (error) {
      sendUpdateEvent({ type: 'error', message: error?.message || 'Failed to check for updates' })
      return { success: false, error: error?.message || 'Failed to check for updates' }
    }
  })

  ipcMain.handle('updates:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      sendUpdateEvent({ type: 'error', message: error?.message || 'Failed to download update' })
      return { success: false, error: error?.message || 'Failed to download update' }
    }
  })

  ipcMain.handle('updates:install', async () => {
    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to install update' }
    }
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
          model: 'gpt-5.1-codex',
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


// ==========================================
// Backup/Recovery IPC Handlers
// ==========================================
function registerBackupHandlers() {
  ipcMain.handle('backup:create', async (_event, filePath, description) => {
    try {
      const result = await backupManager.createBackup(filePath, description)
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] Create backup error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create backup' }
    }
  })

  ipcMain.handle('backup:restore', async (_event, filePath, backupId) => {
    try {
      const result = await backupManager.restoreBackup(filePath, backupId)
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] Restore backup error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to restore backup' }
    }
  })

  ipcMain.handle('backup:list', async (_event, filePath) => {
    try {
      const result = await backupManager.listBackups(filePath)
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] List backups error:', error)
      return { success: false, backups: [], error: error instanceof Error ? error.message : 'Failed to list backups' }
    }
  })

  ipcMain.handle('backup:get-content', async (_event, filePath, backupId) => {
    try {
      const result = await backupManager.getBackupContent(filePath, backupId)
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] Get backup content error:', error)
      return { success: false, content: '', error: error instanceof Error ? error.message : 'Failed to get backup content' }
    }
  })

  ipcMain.handle('backup:delete', async (_event, filePath, backupId) => {
    try {
      const result = await backupManager.deleteBackup(filePath, backupId)
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] Delete backup error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete backup' }
    }
  })

  ipcMain.handle('backup:cleanup', async () => {
    try {
      const result = await backupManager.cleanupAllBackups()
      return { success: true, ...result }
    } catch (error) {
      console.error('[Backup] Cleanup error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to cleanup backups' }
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
      // Note: primeContext now returns early if no session, so this shouldn't trigger
      console.warn('[SelectorAgent] Prime context issue (non-critical):', error instanceof Error ? error.message : error)
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
          enabled: false,
          storageDir: path.join(app.getPath('userData'), 'models', 'fast-apply'),
        }
      }
      const status = await fa.getStatus()
      // Add enabled flag from config
      return {
        ...status,
        enabled: fa.isEnabled(),
      }
    } catch (error) {
      return {
        ready: false,
        activeModel: null,
        modelLoaded: false,
        downloadedModels: [],
        enabled: false,
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

  // Load model into memory (also sets enabled=true for persistence)
  ipcMain.handle('fast-apply:load', async () => {
    try {
      const fa = getFastApply()
      if (!fa) {
        return { success: false, error: 'Fast Apply not available' }
      }
      console.log('[FastApply IPC] Loading model into memory...')
      await fa.load()
      fa.setEnabled(true)  // Persist enabled state so it auto-loads on restart
      console.log('[FastApply IPC] Model loaded successfully, enabled state persisted')
      return { success: true }
    } catch (error) {
      console.error('[FastApply IPC] Load error:', error)
      return { success: false, error: error.message }
    }
  })

  // Unload model to free memory (also sets enabled=false)
  ipcMain.handle('fast-apply:unload', async () => {
    try {
      const fa = getFastApply()
      if (fa) {
        await fa.unload()
        fa.setEnabled(false)  // Persist disabled state
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

// Create a new window, optionally locked to a project
// Returns { windowId, window } or focuses existing window if project already open
function createWindow(options = {}) {
  const { projectPath = null, projectName = null } = options

  // If projectPath specified, check if already open in another window
  if (projectPath) {
    const existingWindow = getWindowByProject(projectPath)
    if (existingWindow) {
      // Focus the existing window instead of creating a new one
      console.log(`[Window] Project already open in window ${existingWindow.id}, focusing`)
      existingWindow.window.focus()
      return { windowId: existingWindow.id, window: existingWindow.window, alreadyOpen: true }
    }
  }

  const windowId = nextWindowId++
  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // Create transparent-capable window; renderer can emulate opaque mode.
    transparent: true,
    backgroundColor: '#00000000',
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

  // Register window in registry
  windowRegistry.set(windowId, {
    window: newWindow,
    projectPath,
    projectName
  })

  // Track window close to clean up registry
  newWindow.on('closed', () => {
    console.log(`[Window] Window ${windowId} closed, removing from registry`)
    windowRegistry.delete(windowId)
    // If this was mainWindow, clear it
    if (mainWindow === newWindow) {
      mainWindow = null
    }
    // Notify other windows about the change
    sendToAllWindows('window:registry-changed', getAllProjectWindows())
    // Update application menu to reflect closed window
    updateApplicationMenu()
  })

  // Update menu when window gains focus to show correct checkmarks
  newWindow.on('focus', () => {
    updateApplicationMenu()
  })

  // Set as mainWindow for backwards compatibility (first window or newest)
  mainWindow = newWindow

  // Store windowId on the BrowserWindow for IPC handlers to identify
  newWindow.windowId = windowId

  // Configure webview security for preload script
  // SECURITY NOTE: contextIsolation is disabled for the webview because the inspector
  // functionality requires DOM manipulation and React fiber access in the page context.
  // This is a known tradeoff - mitigations are applied below.
  // Future improvement: Migrate to contextBridge with webContents.executeJavaScript for source location.
  newWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
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
  newWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['clipboard-read', 'clipboard-write', 'media']
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
  newWindow.webContents.on('will-navigate', (event, url) => {
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
  newWindow.webContents.on('did-attach-webview', (event, webContents) => {
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

  newWindow.once('ready-to-show', () => {
    newWindow.show()
    // Send window info to renderer once ready
    newWindow.webContents.send('window:info', {
      windowId,
      projectPath,
      projectName
    })
  })

  if (isDev) {
    // Pass windowId and project info via URL params so renderer knows its identity
    const urlParams = new URLSearchParams()
    urlParams.set('windowId', String(windowId))
    if (projectPath) urlParams.set('projectPath', projectPath)
    if (projectName) urlParams.set('projectName', projectName)
    newWindow.loadURL(`http://localhost:3000?${urlParams.toString()}`)
    newWindow.webContents.openDevTools()
  } else {
    // For production, pass via hash (index.html can't take query params directly)
    const urlParams = new URLSearchParams()
    urlParams.set('windowId', String(windowId))
    if (projectPath) urlParams.set('projectPath', projectPath)
    if (projectName) urlParams.set('projectName', projectName)
    newWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: urlParams.toString()
    })
  }

  console.log(`[Window] Created window ${windowId}${projectPath ? ` for project: ${projectPath}` : ' (no project)'}`)

  return { windowId, window: newWindow, alreadyOpen: false }
}

app.whenReady().then(async () => {
  registerHandlers()
  registerWindowHandlers()  // Multi-window support
  registerGitHandlers()
  registerBackupHandlers()  // Backup/recovery system
  registerFileHandlers()  // File operations
  registerLspHandlers()
  registerVoiceHandlers()
  registerAgentHandlers()
  registerTabDataHandlers()
  registerOAuthHandlers()
  registerCodexHandlers()
  registerClaudeCodeHandlers()
  registerMCPHandlers()
  registerSelectorAgentHandlers()
  registerFastApplyHandlers()
  registerAgentSdkHandlers()
  registerUpdateHandlers()

  // Register AI SDK handlers and initialize
  aiSdkWrapper.registerHandlers()

  // Register Morph IPC handlers (cloud apply/router) in main to avoid renderer CORS
  morph.registerMorphHandlers()

  try {
    await aiSdkWrapper.initialize()
    console.log('[Main] AI SDK wrapper initialized')
  } catch (e) {
    console.warn('[Main] AI SDK wrapper initialization deferred:', e.message)
  }

  createWindow()

  // Build application menu with Window submenu
  buildApplicationMenu()

  // Set main window reference for MCP events, AI SDK events, Agent SDK events, and file watcher
  mcp.setMainWindow(mainWindow)
  aiSdkWrapper.setMainWindow(mainWindow)
  agentSdkWrapper.setMainWindow(mainWindow)
  fileWatcher.setMainWindow(mainWindow)
  lsp.setMainWindow(mainWindow)
  mgrep.setMainWindow(mainWindow)

  // Auto-load Fast Apply if it was enabled in previous session
  try {
    const fa = getFastApply()
    if (fa && fa.isEnabled() && fa.getActiveModel()) {
      console.log('[FastApply] Auto-loading model (was enabled in previous session)...')
      fa.load().then(() => {
        console.log('[FastApply] Model auto-loaded successfully')
      }).catch((err) => {
        console.warn('[FastApply] Auto-load failed:', err.message)
        // Clear enabled state if auto-load fails
        fa.setEnabled(false)
      })
    }
  } catch (err) {
    console.warn('[FastApply] Auto-load check failed:', err.message)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Stop all file watchers before quitting
  fileWatcher.stopAll()
  mgrep.shutdown()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
