/**
 * LSP Client
 *
 * Handles JSON-RPC 2.0 communication with LSP servers over stdio.
 * Manages the lifecycle of a single LSP server connection.
 */

const { EventEmitter } = require('events')
const { getLanguageId } = require('./language.cjs')
const path = require('path')
const fs = require('fs').promises

/**
 * JSON-RPC message parsing
 */
function parseHeaders(data) {
  const headerEnd = data.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const headerStr = data.slice(0, headerEnd).toString('utf-8')
  const headers = {}

  for (const line of headerStr.split('\r\n')) {
    const [key, value] = line.split(': ')
    if (key && value) {
      headers[key.toLowerCase()] = value
    }
  }

  const contentLength = parseInt(headers['content-length'], 10)
  if (isNaN(contentLength)) return null

  const bodyStart = headerEnd + 4
  const bodyEnd = bodyStart + contentLength

  if (data.length < bodyEnd) return null

  const body = data.slice(bodyStart, bodyEnd).toString('utf-8')

  return {
    headers,
    body,
    consumed: bodyEnd,
  }
}

/**
 * Create an LSP client for a server process
 */
class LSPClient extends EventEmitter {
  constructor(options) {
    super()
    this.serverID = options.serverID
    this.root = options.root
    this.process = options.process
    this.initialization = options.initialization || {}

    this.requestId = 0
    this.pendingRequests = new Map()
    this.diagnostics = new Map() // path -> Diagnostic[]
    this.openDocuments = new Set()
    this.documentVersions = new Map()
    this.buffer = Buffer.alloc(0)
    this.initialized = false
    this.capabilities = null

    this._setupProcessHandlers()
  }

  _setupProcessHandlers() {
    this.process.stdout.on('data', (data) => {
      this.buffer = Buffer.concat([this.buffer, data])
      this._processBuffer()
    })

    this.process.stderr.on('data', (data) => {
      console.log(`[LSP:${this.serverID}] stderr:`, data.toString())
    })

    this.process.on('close', (code) => {
      console.log(`[LSP:${this.serverID}] Process exited with code ${code}`)
      this.emit('close', code)
    })

    this.process.on('error', (err) => {
      console.error(`[LSP:${this.serverID}] Process error:`, err)
      this.emit('error', err)
    })
  }

  _processBuffer() {
    while (true) {
      const parsed = parseHeaders(this.buffer)
      if (!parsed) break

      this.buffer = this.buffer.slice(parsed.consumed)

      try {
        const message = JSON.parse(parsed.body)
        this._handleMessage(message)
      } catch (err) {
        console.error(`[LSP:${this.serverID}] Failed to parse message:`, err)
      }
    }
  }

  _handleMessage(message) {
    // Response to a request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        this.pendingRequests.delete(message.id)
        if (message.error) {
          pending.reject(new Error(message.error.message || 'LSP error'))
        } else {
          pending.resolve(message.result)
        }
      }
      return
    }

    // Server notification
    if (message.method) {
      this._handleNotification(message.method, message.params)

      // If it's a request (has id), we need to respond
      if (message.id !== undefined) {
        this._handleRequest(message.id, message.method, message.params)
      }
    }
  }

  _handleNotification(method, params) {
    switch (method) {
      case 'textDocument/publishDiagnostics':
        this._handleDiagnostics(params)
        break
      case 'window/logMessage':
        console.log(`[LSP:${this.serverID}] ${params.message}`)
        break
      case 'window/showMessage':
        console.log(`[LSP:${this.serverID}] [${params.type}] ${params.message}`)
        break
      default:
        // console.log(`[LSP:${this.serverID}] Notification: ${method}`)
    }
  }

  _handleRequest(id, method, params) {
    let result = null

    switch (method) {
      case 'workspace/workspaceFolders':
        result = [{ name: 'workspace', uri: `file://${this.root}` }]
        break
      case 'workspace/configuration':
        result = [this.initialization]
        break
      case 'client/registerCapability':
        result = null // Acknowledge registration
        break
      default:
        console.log(`[LSP:${this.serverID}] Unhandled request: ${method}`)
    }

    this._sendMessage({ jsonrpc: '2.0', id, result })
  }

  _handleDiagnostics(params) {
    const uri = params.uri
    const filePath = uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri

    this.diagnostics.set(filePath, params.diagnostics || [])
    this.emit('diagnostics', { path: filePath, diagnostics: params.diagnostics })
  }

  _sendMessage(message) {
    const content = JSON.stringify(message)
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`
    this.process.stdin.write(header + content)
  }

  _sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      this.pendingRequests.set(id, { resolve, reject })

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`LSP request timeout: ${method}`))
        }
      }, 10000)

      this.pendingRequests.get(id).timeout = timeout

      this._sendMessage({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })
    })
  }

  _sendNotification(method, params) {
    this._sendMessage({
      jsonrpc: '2.0',
      method,
      params,
    })
  }

  /**
   * Initialize the LSP connection
   */
  async initialize() {
    if (this.initialized) return this.capabilities

    const result = await this._sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.root}`,
      rootPath: this.root,
      workspaceFolders: [{ name: 'workspace', uri: `file://${this.root}` }],
      capabilities: {
        workspace: {
          workspaceFolders: true,
          configuration: true,
          didChangeConfiguration: { dynamicRegistration: true },
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          completion: {
            dynamicRegistration: true,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext'],
          },
          signatureHelp: {
            dynamicRegistration: true,
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          documentHighlight: { dynamicRegistration: true },
          documentSymbol: { dynamicRegistration: true },
          codeAction: { dynamicRegistration: true },
          codeLens: { dynamicRegistration: true },
          formatting: { dynamicRegistration: true },
          rangeFormatting: { dynamicRegistration: true },
          rename: { dynamicRegistration: true },
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: { valueSet: [1, 2] },
          },
        },
      },
      initializationOptions: this.initialization,
    })

    this.capabilities = result.capabilities
    this._sendNotification('initialized', {})
    this.initialized = true

    console.log(`[LSP:${this.serverID}] Initialized for ${this.root}`)
    return this.capabilities
  }

  /**
   * Notify server that a document was opened
   */
  async openDocument(filePath) {
    if (this.openDocuments.has(filePath)) return

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const languageId = getLanguageId(filePath)
      const version = 1

      this.documentVersions.set(filePath, version)
      this.openDocuments.add(filePath)

      this._sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: `file://${filePath}`,
          languageId,
          version,
          text: content,
        },
      })
    } catch (err) {
      console.error(`[LSP:${this.serverID}] Failed to open document:`, err)
    }
  }

  /**
   * Notify server that a document changed
   */
  async changeDocument(filePath, content) {
    if (!this.openDocuments.has(filePath)) {
      await this.openDocument(filePath)
      return
    }

    const version = (this.documentVersions.get(filePath) || 0) + 1
    this.documentVersions.set(filePath, version)

    this._sendNotification('textDocument/didChange', {
      textDocument: {
        uri: `file://${filePath}`,
        version,
      },
      contentChanges: [{ text: content }],
    })
  }

  /**
   * Notify server that a document was saved
   */
  async saveDocument(filePath) {
    if (!this.openDocuments.has(filePath)) return

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this._sendNotification('textDocument/didSave', {
        textDocument: { uri: `file://${filePath}` },
        text: content,
      })
    } catch (err) {
      console.error(`[LSP:${this.serverID}] Failed to save notification:`, err)
    }
  }

  /**
   * Notify server that a document was closed
   */
  closeDocument(filePath) {
    if (!this.openDocuments.has(filePath)) return

    this.openDocuments.delete(filePath)
    this.documentVersions.delete(filePath)
    this.diagnostics.delete(filePath)

    this._sendNotification('textDocument/didClose', {
      textDocument: { uri: `file://${filePath}` },
    })
  }

  /**
   * Get hover information at a position
   */
  async hover(filePath, line, character) {
    if (!this.openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return this._sendRequest('textDocument/hover', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    })
  }

  /**
   * Get completions at a position
   */
  async completion(filePath, line, character) {
    if (!this.openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return this._sendRequest('textDocument/completion', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    })
  }

  /**
   * Get definition at a position
   */
  async definition(filePath, line, character) {
    if (!this.openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return this._sendRequest('textDocument/definition', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    })
  }

  /**
   * Get references at a position
   */
  async references(filePath, line, character) {
    if (!this.openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return this._sendRequest('textDocument/references', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
      context: { includeDeclaration: true },
    })
  }

  /**
   * Get all diagnostics
   */
  getDiagnostics() {
    const result = {}
    for (const [filePath, diags] of this.diagnostics) {
      result[filePath] = diags
    }
    return result
  }

  /**
   * Wait for diagnostics for a specific file
   */
  waitForDiagnostics(filePath, timeout = 3000) {
    return new Promise((resolve) => {
      // If we already have diagnostics, return immediately
      if (this.diagnostics.has(filePath)) {
        resolve(this.diagnostics.get(filePath))
        return
      }

      const timer = setTimeout(() => {
        this.off('diagnostics', handler)
        resolve([])
      }, timeout)

      const handler = (event) => {
        if (event.path === filePath) {
          clearTimeout(timer)
          this.off('diagnostics', handler)
          resolve(event.diagnostics)
        }
      }

      this.on('diagnostics', handler)
    })
  }

  /**
   * Shutdown the LSP server
   */
  async shutdown() {
    try {
      await this._sendRequest('shutdown', null)
      this._sendNotification('exit', null)
    } catch {
      // Server may have already exited
    }

    if (this.process && !this.process.killed) {
      this.process.kill()
    }
  }

  /**
   * Get client info for UI display
   */
  getInfo() {
    return {
      serverID: this.serverID,
      root: this.root,
      initialized: this.initialized,
      openDocuments: Array.from(this.openDocuments),
      diagnosticCount: Array.from(this.diagnostics.values()).reduce((sum, d) => sum + d.length, 0),
    }
  }
}

module.exports = { LSPClient }
