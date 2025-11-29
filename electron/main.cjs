const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { execSync, exec } = require('child_process')

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
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'default',
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
