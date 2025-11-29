const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { execSync, exec } = require('child_process')
const fs = require('fs').promises

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
