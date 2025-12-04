/**
 * LSP Bridge
 *
 * Thin Electron wrapper around the portable @anthropic/lsp-client package.
 * Forwards LSP events to the renderer via IPC.
 */

const { createLSPManager, getServer, getAllServers, clearCache, getCacheInfo, formatDiagnostic } = require('@anthropic/lsp-client')

// Reference to main window for IPC
let mainWindow = null

// Singleton manager instance
let manager = null

/**
 * Set the main window reference for IPC
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * Send event to renderer
 */
function sendEvent(type, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('lsp:event', { type, ...data })
}

/**
 * Get the LSP manager instance
 */
function getManager() {
  if (!manager) {
    manager = createLSPManager({
      appName: 'cluso',
    })

    // Forward events to renderer
    manager.on('diagnostics', (event) => {
      sendEvent('diagnostics', event)
    })

    manager.on('server-started', (data) => {
      sendEvent('server-started', data)
    })

    manager.on('server-closed', (data) => {
      sendEvent('server-closed', data)
    })

    manager.on('server-status-changed', (data) => {
      sendEvent('server-status-changed', data)
    })
  }
  return manager
}

/**
 * Initialize the LSP system
 */
async function init(projectPath) {
  const mgr = getManager()
  mgr.setProjectPath(projectPath)
  return mgr
}

/**
 * Shutdown the LSP system
 */
async function shutdown() {
  if (manager) {
    await manager.shutdown()
    manager = null
  }
}

module.exports = {
  setMainWindow,
  getManager,
  init,
  shutdown,
  formatDiagnostic,
  // Re-export for convenience
  getAllServers,
  getServer,
  clearCache,
  getCacheInfo,
}
