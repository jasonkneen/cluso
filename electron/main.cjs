const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { execSync, exec } = require('child_process')
const fs = require('fs').promises
const oauth = require('./oauth.cjs')

const isDev = process.env.NODE_ENV === 'development'

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
  // Start OAuth login flow
  ipcMain.handle('oauth:start-login', async (_event, mode) => {
    try {
      // Generate PKCE challenge
      const pkce = oauth.generatePKCEChallenge()
      oauth.setPKCEVerifier(pkce.verifier)

      // Get authorization URL
      const authUrl = oauth.getAuthorizationUrl(mode, pkce)

      // Open the authorization URL in the default browser
      await shell.openExternal(authUrl)

      return {
        success: true,
        authUrl
      }
    } catch (error) {
      console.error('Error starting OAuth login:', error)
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

      // If creating an API key instead of using OAuth directly
      if (createKey) {
        const apiKey = await oauth.createApiKey(tokens.access)
        if (!apiKey) {
          return {
            success: false,
            error: 'Failed to create API key'
          }
        }

        // Clear the temporary verifier
        oauth.clearPKCEVerifier()

        return {
          success: true,
          apiKey,
          mode: 'api-key'
        }
      }

      // Save OAuth tokens for Claude Code usage
      oauth.saveOAuthTokens(tokens)

      // Clear the temporary verifier
      oauth.clearPKCEVerifier()

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

function createWindow() {
  const mainWindow = new BrowserWindow({
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
