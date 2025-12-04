/**
 * LSP Manager
 *
 * Orchestrates LSP servers for a project:
 * - Automatically spawns servers based on file extensions
 * - Deduplicates spawn requests
 * - Manages client lifecycle
 * - Aggregates diagnostics across all servers
 */

const path = require('path')
const { EventEmitter } = require('events')
const { LSPClient } = require('./client.cjs')
const { SERVERS, findProjectRoot, getServersForExtension, getAllServers, which } = require('./server.cjs')
const { getLanguageId } = require('./language.cjs')

// Reference to main window for IPC
let mainWindow = null

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
 * LSP Manager class - manages all LSP servers for a project
 */
class LSPManager extends EventEmitter {
  constructor() {
    super()
    this.clients = new Map() // key: `${serverID}:${root}` -> LSPClient
    this.spawning = new Map() // key: `${serverID}:${root}` -> Promise<LSPClient>
    this.broken = new Set() // Servers that failed to spawn
    this.projectPath = null
    this.enabled = new Set() // Enabled server IDs (all enabled by default)
    this.disabled = new Set() // Explicitly disabled server IDs

    // Enable all servers by default
    for (const id of Object.keys(SERVERS)) {
      this.enabled.add(id)
    }
  }

  /**
   * Set the current project path
   */
  setProjectPath(projectPath) {
    this.projectPath = projectPath
    console.log(`[LSP] Project path set to: ${projectPath}`)
  }

  /**
   * Enable or disable a server
   */
  setServerEnabled(serverId, enabled) {
    if (enabled) {
      this.disabled.delete(serverId)
      this.enabled.add(serverId)
    } else {
      this.enabled.delete(serverId)
      this.disabled.add(serverId)
      // Shutdown any running clients for this server
      this._shutdownServer(serverId)
    }
    sendEvent('server-status-changed', { serverId, enabled })
  }

  /**
   * Check if a server is enabled
   */
  isServerEnabled(serverId) {
    return this.enabled.has(serverId) && !this.disabled.has(serverId)
  }

  /**
   * Shutdown all clients for a specific server
   */
  async _shutdownServer(serverId) {
    const toRemove = []
    for (const [key, client] of this.clients) {
      if (client.serverID === serverId) {
        toRemove.push(key)
        await client.shutdown()
      }
    }
    for (const key of toRemove) {
      this.clients.delete(key)
    }
  }

  /**
   * Get or spawn clients for a file
   */
  async getClientsForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const servers = getServersForExtension(ext)
    const clients = []

    for (const server of servers) {
      // Skip disabled servers
      if (!this.isServerEnabled(server.id)) continue

      // Find project root for this server
      const root = await findProjectRoot(
        filePath,
        server.rootPatterns,
        server.excludePatterns
      )

      if (!root) continue

      const key = `${server.id}:${root}`

      // Skip broken servers
      if (this.broken.has(key)) continue

      // Return existing client
      if (this.clients.has(key)) {
        clients.push(this.clients.get(key))
        continue
      }

      // Wait for in-flight spawn
      if (this.spawning.has(key)) {
        try {
          const client = await this.spawning.get(key)
          if (client) clients.push(client)
        } catch {
          // Spawn failed
        }
        continue
      }

      // Spawn new client
      const spawnPromise = this._spawnClient(server, root, key)
      this.spawning.set(key, spawnPromise)

      try {
        const client = await spawnPromise
        if (client) {
          clients.push(client)
        }
      } catch (err) {
        console.error(`[LSP] Failed to spawn ${server.id}:`, err)
        this.broken.add(key)
      } finally {
        this.spawning.delete(key)
      }
    }

    return clients
  }

  /**
   * Spawn a new LSP client
   */
  async _spawnClient(server, root, key) {
    console.log(`[LSP] Spawning ${server.id} for ${root}`)

    const process = await server.spawn(root)
    if (!process) {
      console.log(`[LSP] ${server.id} not available (binary not found)`)
      return null
    }

    const client = new LSPClient({
      serverID: server.id,
      root,
      process,
      initialization: server.initialization,
    })

    // Forward diagnostics events
    client.on('diagnostics', (event) => {
      this.emit('diagnostics', event)
      sendEvent('diagnostics', event)
    })

    client.on('close', () => {
      console.log(`[LSP] ${server.id} closed for ${root}`)
      this.clients.delete(key)
      sendEvent('server-closed', { serverId: server.id, root })
    })

    client.on('error', (err) => {
      console.error(`[LSP] ${server.id} error:`, err)
      this.broken.add(key)
    })

    try {
      await client.initialize()
      this.clients.set(key, client)
      sendEvent('server-started', { serverId: server.id, root })
      return client
    } catch (err) {
      console.error(`[LSP] ${server.id} initialization failed:`, err)
      this.broken.add(key)
      await client.shutdown()
      return null
    }
  }

  /**
   * Notify LSP servers that a file was opened/touched
   */
  async touchFile(filePath, waitForDiagnostics = false) {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      await client.openDocument(filePath)
    }

    if (waitForDiagnostics && clients.length > 0) {
      // Wait for diagnostics from all clients
      await Promise.all(
        clients.map(client => client.waitForDiagnostics(filePath, 3000))
      )
    }

    return clients.length
  }

  /**
   * Notify LSP servers that a file changed
   */
  async fileChanged(filePath, content) {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      if (content) {
        await client.changeDocument(filePath, content)
      } else {
        // Re-read the file if no content provided
        await client.openDocument(filePath)
      }
    }
  }

  /**
   * Notify LSP servers that a file was saved
   */
  async fileSaved(filePath) {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      await client.saveDocument(filePath)
    }
  }

  /**
   * Get all diagnostics across all servers
   */
  getAllDiagnostics() {
    const result = {}

    for (const client of this.clients.values()) {
      const diags = client.getDiagnostics()
      for (const [filePath, diagnostics] of Object.entries(diags)) {
        if (!result[filePath]) {
          result[filePath] = []
        }
        // Tag diagnostics with server ID
        result[filePath].push(
          ...diagnostics.map(d => ({ ...d, source: d.source || client.serverID }))
        )
      }
    }

    return result
  }

  /**
   * Get diagnostics for a specific file
   */
  getDiagnosticsForFile(filePath) {
    const result = []

    for (const client of this.clients.values()) {
      const diags = client.getDiagnostics()
      if (diags[filePath]) {
        result.push(
          ...diags[filePath].map(d => ({ ...d, source: d.source || client.serverID }))
        )
      }
    }

    return result
  }

  /**
   * Get hover info at a position
   */
  async hover(filePath, line, character) {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      try {
        const result = await client.hover(filePath, line, character)
        if (result) return result
      } catch {
        // Try next client
      }
    }

    return null
  }

  /**
   * Get completions at a position
   */
  async completion(filePath, line, character) {
    const clients = await this.getClientsForFile(filePath)
    const results = []

    for (const client of clients) {
      try {
        const result = await client.completion(filePath, line, character)
        if (result) {
          const items = result.items || result
          results.push(...items)
        }
      } catch {
        // Continue with other clients
      }
    }

    return results
  }

  /**
   * Get definition at a position
   */
  async definition(filePath, line, character) {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      try {
        const result = await client.definition(filePath, line, character)
        if (result) return result
      } catch {
        // Try next client
      }
    }

    return null
  }

  /**
   * Get references at a position
   */
  async references(filePath, line, character) {
    const clients = await this.getClientsForFile(filePath)
    const results = []

    for (const client of clients) {
      try {
        const result = await client.references(filePath, line, character)
        if (result) {
          results.push(...result)
        }
      } catch {
        // Continue with other clients
      }
    }

    return results
  }

  /**
   * Get status of all servers (for Settings UI)
   */
  async getStatus() {
    const servers = getAllServers()
    const status = []

    for (const [id, server] of Object.entries(servers)) {
      const installed = await server.checkInstalled()
      const running = Array.from(this.clients.values())
        .filter(c => c.serverID === id)
        .map(c => ({
          root: c.root,
          openDocuments: c.openDocuments.size,
          diagnosticCount: Array.from(c.diagnostics.values()).reduce((sum, d) => sum + d.length, 0),
        }))

      status.push({
        id,
        name: server.name,
        extensions: server.extensions,
        enabled: this.isServerEnabled(id),
        installed,
        installable: server.installable,
        running: running.length > 0,
        instances: running,
      })
    }

    return status
  }

  /**
   * Shutdown all LSP servers
   */
  async shutdown() {
    console.log('[LSP] Shutting down all servers...')
    const promises = []
    for (const client of this.clients.values()) {
      promises.push(client.shutdown())
    }
    await Promise.all(promises)
    this.clients.clear()
    this.broken.clear()
    console.log('[LSP] All servers shut down')
  }
}

// Singleton instance
let manager = null

/**
 * Get the LSP manager instance
 */
function getManager() {
  if (!manager) {
    manager = new LSPManager()
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

/**
 * Format a diagnostic for display
 */
function formatDiagnostic(diagnostic) {
  const severity = ['', 'Error', 'Warning', 'Info', 'Hint'][diagnostic.severity] || 'Unknown'
  const range = diagnostic.range
  const location = `${range.start.line + 1}:${range.start.character + 1}`
  const source = diagnostic.source || 'unknown'
  return `[${severity}] ${location} (${source}): ${diagnostic.message}`
}

module.exports = {
  setMainWindow,
  getManager,
  init,
  shutdown,
  formatDiagnostic,
  // Re-export for convenience
  getAllServers,
  getServersForExtension,
  getLanguageId,
}
