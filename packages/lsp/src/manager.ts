/**
 * LSP Manager
 *
 * Orchestrates LSP servers for a project:
 * - Automatically spawns servers based on file extensions
 * - Deduplicates spawn requests
 * - Manages client lifecycle
 * - Aggregates diagnostics across all servers
 */

import path from 'path'
import { EventEmitter } from 'events'
import { LSPClient } from './client'
import { SERVERS, findProjectRoot, getServersForExtension, getAllServers } from './servers'
import type {
  Diagnostic,
  DiagnosticsEvent,
  ServerStatus,
  LSPManagerOptions,
  LSPManagerEvents,
  Hover,
  CompletionItem,
  Location,
} from './types'
import { initInstaller } from './installer'

export interface LSPManagerEventEmitter {
  on<K extends keyof LSPManagerEvents>(event: K, listener: (data: LSPManagerEvents[K]) => void): this
  off<K extends keyof LSPManagerEvents>(event: K, listener: (data: LSPManagerEvents[K]) => void): this
  emit<K extends keyof LSPManagerEvents>(event: K, data: LSPManagerEvents[K]): boolean
}

/**
 * LSP Manager class - manages all LSP servers for a project
 */
export class LSPManager extends EventEmitter implements LSPManagerEventEmitter {
  private clients = new Map<string, LSPClient>()
  private spawning = new Map<string, Promise<LSPClient | null>>()
  private broken = new Set<string>()
  private projectPath: string | null = null
  private enabled = new Set<string>()
  private disabled = new Set<string>()

  constructor(options: LSPManagerOptions = {}) {
    super()

    // Initialize the installer with options
    initInstaller({
      appName: options.appName,
      cacheDir: options.cacheDir,
      bunPath: options.bunPath,
    })

    // Enable all servers by default
    for (const id of Object.keys(SERVERS)) {
      this.enabled.add(id)
    }
  }

  /**
   * Set the current project path
   */
  setProjectPath(projectPath: string): void {
    this.projectPath = projectPath
    console.log(`[LSP] Project path set to: ${projectPath}`)
  }

  /**
   * Enable or disable a server
   */
  setServerEnabled(serverId: string, enabled: boolean): void {
    if (enabled) {
      this.disabled.delete(serverId)
      this.enabled.add(serverId)
    } else {
      this.enabled.delete(serverId)
      this.disabled.add(serverId)
      // Shutdown any running clients for this server
      this._shutdownServer(serverId)
    }
    this.emit('server-status-changed', { serverId, enabled })
  }

  /**
   * Check if a server is enabled
   */
  isServerEnabled(serverId: string): boolean {
    return this.enabled.has(serverId) && !this.disabled.has(serverId)
  }

  /**
   * Shutdown all clients for a specific server
   */
  private async _shutdownServer(serverId: string): Promise<void> {
    const toRemove: string[] = []
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
  async getClientsForFile(filePath: string): Promise<LSPClient[]> {
    const ext = path.extname(filePath).toLowerCase()
    const servers = getServersForExtension(ext)
    const clients: LSPClient[] = []

    for (const server of servers) {
      // Skip disabled servers
      if (!this.isServerEnabled(server.id)) continue

      // Find project root for this server
      const root = await findProjectRoot(filePath, server.rootPatterns, server.excludePatterns)

      if (!root) continue

      const key = `${server.id}:${root}`

      // Skip broken servers
      if (this.broken.has(key)) continue

      // Return existing client
      if (this.clients.has(key)) {
        clients.push(this.clients.get(key)!)
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
  private async _spawnClient(
    server: (typeof SERVERS)[string],
    root: string,
    key: string
  ): Promise<LSPClient | null> {
    console.log(`[LSP] Spawning ${server.id} for ${root}`)

    const childProcess = await server.spawn(root)
    if (!childProcess) {
      console.log(`[LSP] ${server.id} not available (binary not found)`)
      return null
    }

    const client = new LSPClient({
      serverID: server.id,
      root,
      process: childProcess,
      initialization: server.initialization as Record<string, unknown>,
    })

    // Forward diagnostics events
    client.on('diagnostics', (event: DiagnosticsEvent) => {
      this.emit('diagnostics', event)
    })

    client.on('close', () => {
      console.log(`[LSP] ${server.id} closed for ${root}`)
      this.clients.delete(key)
      this.emit('server-closed', { serverId: server.id, root })
    })

    client.on('error', () => {
      this.broken.add(key)
    })

    try {
      await client.initialize()
      this.clients.set(key, client)
      this.emit('server-started', { serverId: server.id, root })
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
  async touchFile(filePath: string, waitForDiagnostics = false): Promise<number> {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      await client.openDocument(filePath)
    }

    if (waitForDiagnostics && clients.length > 0) {
      // Wait for diagnostics from all clients
      await Promise.all(clients.map((client) => client.waitForDiagnostics(filePath, 3000)))
    }

    return clients.length
  }

  /**
   * Notify LSP servers that a file changed
   */
  async fileChanged(filePath: string, content?: string): Promise<void> {
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
  async fileSaved(filePath: string): Promise<void> {
    const clients = await this.getClientsForFile(filePath)

    for (const client of clients) {
      await client.saveDocument(filePath)
    }
  }

  /**
   * Get all diagnostics across all servers
   */
  getAllDiagnostics(): Record<string, Diagnostic[]> {
    const result: Record<string, Diagnostic[]> = {}

    for (const client of this.clients.values()) {
      const diags = client.getDiagnostics()
      for (const [filePath, diagnostics] of Object.entries(diags)) {
        if (!result[filePath]) {
          result[filePath] = []
        }
        // Tag diagnostics with server ID
        result[filePath].push(
          ...diagnostics.map((d) => ({ ...d, source: d.source || client.serverID }))
        )
      }
    }

    return result
  }

  /**
   * Get diagnostics for a specific file
   */
  getDiagnosticsForFile(filePath: string): Diagnostic[] {
    const result: Diagnostic[] = []

    for (const client of this.clients.values()) {
      const diags = client.getDiagnostics()
      if (diags[filePath]) {
        result.push(...diags[filePath].map((d) => ({ ...d, source: d.source || client.serverID })))
      }
    }

    return result
  }

  /**
   * Get hover info at a position
   */
  async hover(filePath: string, line: number, character: number): Promise<Hover | null> {
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
  async completion(filePath: string, line: number, character: number): Promise<CompletionItem[]> {
    const clients = await this.getClientsForFile(filePath)
    const results: CompletionItem[] = []

    for (const client of clients) {
      try {
        const result = await client.completion(filePath, line, character)
        if (result) {
          const items = Array.isArray(result) ? result : result.items || []
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
  async definition(filePath: string, line: number, character: number): Promise<Location | Location[] | null> {
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
  async references(filePath: string, line: number, character: number): Promise<Location[]> {
    const clients = await this.getClientsForFile(filePath)
    const results: Location[] = []

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
  async getStatus(): Promise<ServerStatus[]> {
    const servers = getAllServers()
    const status: ServerStatus[] = []

    for (const [id, server] of Object.entries(servers)) {
      const installed = await server.checkInstalled()
      const running = Array.from(this.clients.values())
        .filter((c) => c.serverID === id)
        .map((c) => ({
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
  async shutdown(): Promise<void> {
    console.log('[LSP] Shutting down all servers...')
    const promises: Promise<void>[] = []
    for (const client of this.clients.values()) {
      promises.push(client.shutdown())
    }
    await Promise.all(promises)
    this.clients.clear()
    this.broken.clear()
    console.log('[LSP] All servers shut down')
  }
}

/**
 * Format a diagnostic for display
 */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const severityNames = ['', 'Error', 'Warning', 'Info', 'Hint']
  const severity = severityNames[diagnostic.severity || 0] || 'Unknown'
  const range = diagnostic.range
  const location = `${range.start.line + 1}:${range.start.character + 1}`
  const source = diagnostic.source || 'unknown'
  return `[${severity}] ${location} (${source}): ${diagnostic.message}`
}
