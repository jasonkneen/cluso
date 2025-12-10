const { ipcMain } = require('electron')
const path = require('path')
const { gitExecSafe, validateGitRef } = require('../shared/git-utils.cjs')

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
    const projectFolder = process.cwd()
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
}

module.exports = registerGitHandlers
