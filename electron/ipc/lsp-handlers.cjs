const { ipcMain } = require('electron')
const lsp = require('../lsp-bridge.cjs')

function registerLspHandlers() {
  // LSP handlers
  ipcMain.handle('lsp:init', async (event, projectPath) => {
    return lsp.init(projectPath)
  })

  ipcMain.handle('lsp:shutdown', async () => {
    return lsp.shutdown()
  })

  ipcMain.handle('lsp:status', async () => {
    const manager = lsp.getManager()
    return manager?.getStatus?.() ?? { servers: [], ready: false }
  })

  ipcMain.handle('lsp:touch-file', async (event, filePath, waitForDiagnostics = false) => {
    const manager = lsp.getManager()
    return manager?.touchFile?.(filePath, waitForDiagnostics)
  })

  ipcMain.handle('lsp:file-changed', async (event, filePath, content) => {
    const manager = lsp.getManager()
    return manager?.onFileChanged?.(filePath, content)
  })

  ipcMain.handle('lsp:file-saved', async (event, filePath) => {
    const manager = lsp.getManager()
    return manager?.onFileSaved?.(filePath)
  })

  ipcMain.handle('lsp:diagnostics', async () => {
    const manager = lsp.getManager()
    return manager?.getAllDiagnostics?.() ?? []
  })

  ipcMain.handle('lsp:diagnostics-for-file', async (event, filePath) => {
    const manager = lsp.getManager()
    return manager?.getDiagnosticsForFile?.(filePath) ?? []
  })

  ipcMain.handle('lsp:diagnostics-for-files', async (event, filePaths) => {
    const manager = lsp.getManager()
    return manager?.getDiagnosticsForFiles?.(filePaths) ?? []
  })

  ipcMain.handle('lsp:hover', async (event, filePath, line, character) => {
    const manager = lsp.getManager()
    return manager?.getHover?.(filePath, line, character)
  })

  ipcMain.handle('lsp:completion', async (event, filePath, line, character) => {
    const manager = lsp.getManager()
    return manager?.getCompletion?.(filePath, line, character)
  })

  ipcMain.handle('lsp:definition', async (event, filePath, line, character) => {
    const manager = lsp.getManager()
    return manager?.getDefinition?.(filePath, line, character)
  })

  ipcMain.handle('lsp:references', async (event, filePath, line, character) => {
    const manager = lsp.getManager()
    return manager?.getReferences?.(filePath, line, character)
  })

  ipcMain.handle('lsp:set-server-enabled', async (event, serverId, enabled) => {
    const manager = lsp.getManager()
    return manager?.setServerEnabled?.(serverId, enabled)
  })

  ipcMain.handle('lsp:install-server', async (event, serverId) => {
    const manager = lsp.getManager()
    return manager?.installServer?.(serverId)
  })

  // LSP Cache Management
  ipcMain.handle('lsp:get-cache-info', async () => {
    try {
      const info = lsp.getCacheInfo()
      return { success: true, stats: info }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('lsp:clear-cache', async () => {
    try {
      lsp.clearCache()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

module.exports = registerLspHandlers
