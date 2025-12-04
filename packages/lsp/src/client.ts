/**
 * LSP Client
 *
 * Handles JSON-RPC 2.0 communication with LSP servers over stdio.
 * Manages the lifecycle of a single LSP server connection.
 */

import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import fs from 'fs/promises'
import { getLanguageId } from './language'
import type {
  LSPClientOptions,
  Diagnostic,
  Hover,
  CompletionItem,
  Location,
  DiagnosticsEvent,
} from './types'

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout?: NodeJS.Timeout
}

interface ParsedMessage {
  headers: Record<string, string>
  body: string
  consumed: number
}

/**
 * JSON-RPC message parsing
 */
function parseHeaders(data: Buffer): ParsedMessage | null {
  const headerEnd = data.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const headerStr = data.subarray(0, headerEnd).toString('utf-8')
  const headers: Record<string, string> = {}

  for (const line of headerStr.split('\r\n')) {
    const colonIndex = line.indexOf(': ')
    if (colonIndex !== -1) {
      const key = line.substring(0, colonIndex)
      const value = line.substring(colonIndex + 2)
      headers[key.toLowerCase()] = value
    }
  }

  const contentLength = parseInt(headers['content-length'], 10)
  if (isNaN(contentLength)) return null

  const bodyStart = headerEnd + 4
  const bodyEnd = bodyStart + contentLength

  if (data.length < bodyEnd) return null

  const body = data.subarray(bodyStart, bodyEnd).toString('utf-8')

  return {
    headers,
    body,
    consumed: bodyEnd,
  }
}

export interface LSPClientEvents {
  diagnostics: (event: DiagnosticsEvent) => void
  close: (code: number | null) => void
  error: (error: Error) => void
}

/**
 * Create an LSP client for a server process
 */
export class LSPClient extends EventEmitter {
  readonly serverID: string
  readonly root: string
  private process: ChildProcess
  private initialization: Record<string, unknown>

  private requestId = 0
  private pendingRequests = new Map<number, PendingRequest>()
  private _diagnostics = new Map<string, Diagnostic[]>()
  private _openDocuments = new Set<string>()
  private documentVersions = new Map<string, number>()
  private buffer = Buffer.alloc(0)
  private initialized = false
  private capabilities: unknown = null

  constructor(options: LSPClientOptions) {
    super()
    this.serverID = options.serverID
    this.root = options.root
    this.process = options.process
    this.initialization = options.initialization || {}

    this._setupProcessHandlers()
  }

  get diagnostics(): Map<string, Diagnostic[]> {
    return this._diagnostics
  }

  get openDocuments(): Set<string> {
    return this._openDocuments
  }

  private _setupProcessHandlers(): void {
    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data])
      this._processBuffer()
    })

    this.process.stderr?.on('data', (data: Buffer) => {
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

  private _processBuffer(): void {
    while (true) {
      const parsed = parseHeaders(this.buffer)
      if (!parsed) break

      this.buffer = this.buffer.subarray(parsed.consumed)

      try {
        const message = JSON.parse(parsed.body)
        this._handleMessage(message)
      } catch (err) {
        console.error(`[LSP:${this.serverID}] Failed to parse message:`, err)
      }
    }
  }

  private _handleMessage(message: {
    id?: number
    result?: unknown
    error?: { message?: string }
    method?: string
    params?: unknown
  }): void {
    // Response to a request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        this.pendingRequests.delete(message.id)
        if (pending.timeout) clearTimeout(pending.timeout)
        if (message.error) {
          pending.reject(new Error(message.error.message || 'LSP error'))
        } else {
          pending.resolve(message.result)
        }
      }
      return
    }

    // Server notification or request
    if (message.method) {
      this._handleNotification(message.method, message.params)

      // If it's a request (has id), we need to respond
      if (message.id !== undefined) {
        this._handleRequest(message.id, message.method, message.params)
      }
    }
  }

  private _handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'textDocument/publishDiagnostics':
        this._handleDiagnostics(params as { uri: string; diagnostics?: Diagnostic[] })
        break
      case 'window/logMessage':
        console.log(`[LSP:${this.serverID}] ${(params as { message?: string }).message}`)
        break
      case 'window/showMessage':
        console.log(
          `[LSP:${this.serverID}] [${(params as { type?: number }).type}] ${(params as { message?: string }).message}`
        )
        break
      default:
        // Ignore other notifications
        break
    }
  }

  private _handleRequest(id: number, method: string, _params: unknown): void {
    let result: unknown = null

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

  private _handleDiagnostics(params: { uri: string; diagnostics?: Diagnostic[] }): void {
    const uri = params.uri
    const filePath = uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri

    this._diagnostics.set(filePath, params.diagnostics || [])
    this.emit('diagnostics', { path: filePath, diagnostics: params.diagnostics || [] })
  }

  private _sendMessage(message: unknown): void {
    const content = JSON.stringify(message)
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`
    this.process.stdin?.write(header + content)
  }

  private _sendRequest<T = unknown>(method: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`LSP request timeout: ${method}`))
        }
      }, 10000)

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      })

      this._sendMessage({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })
    })
  }

  private _sendNotification(method: string, params: unknown): void {
    this._sendMessage({
      jsonrpc: '2.0',
      method,
      params,
    })
  }

  /**
   * Initialize the LSP connection
   */
  async initialize(): Promise<unknown> {
    if (this.initialized) return this.capabilities

    const result = await this._sendRequest<{ capabilities: unknown }>('initialize', {
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
  async openDocument(filePath: string): Promise<void> {
    if (this._openDocuments.has(filePath)) return

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const languageId = getLanguageId(filePath)
      const version = 1

      this.documentVersions.set(filePath, version)
      this._openDocuments.add(filePath)

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
  async changeDocument(filePath: string, content: string): Promise<void> {
    if (!this._openDocuments.has(filePath)) {
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
  async saveDocument(filePath: string): Promise<void> {
    if (!this._openDocuments.has(filePath)) return

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
  closeDocument(filePath: string): void {
    if (!this._openDocuments.has(filePath)) return

    this._openDocuments.delete(filePath)
    this.documentVersions.delete(filePath)
    this._diagnostics.delete(filePath)

    this._sendNotification('textDocument/didClose', {
      textDocument: { uri: `file://${filePath}` },
    })
  }

  /**
   * Get hover information at a position
   */
  async hover(filePath: string, line: number, character: number): Promise<Hover | null> {
    if (!this._openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return this._sendRequest<Hover | null>('textDocument/hover', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    })
  }

  /**
   * Get completions at a position
   */
  async completion(
    filePath: string,
    line: number,
    character: number
  ): Promise<CompletionItem[] | { items: CompletionItem[] } | null> {
    if (!this._openDocuments.has(filePath)) {
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
  async definition(filePath: string, line: number, character: number): Promise<Location | Location[] | null> {
    if (!this._openDocuments.has(filePath)) {
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
  async references(filePath: string, line: number, character: number): Promise<Location[]> {
    if (!this._openDocuments.has(filePath)) {
      await this.openDocument(filePath)
    }

    return (
      (await this._sendRequest<Location[] | null>('textDocument/references', {
        textDocument: { uri: `file://${filePath}` },
        position: { line, character },
        context: { includeDeclaration: true },
      })) || []
    )
  }

  /**
   * Get all diagnostics
   */
  getDiagnostics(): Record<string, Diagnostic[]> {
    const result: Record<string, Diagnostic[]> = {}
    for (const [filePath, diags] of this._diagnostics) {
      result[filePath] = diags
    }
    return result
  }

  /**
   * Wait for diagnostics for a specific file
   */
  waitForDiagnostics(filePath: string, timeout = 3000): Promise<Diagnostic[]> {
    return new Promise((resolve) => {
      // If we already have diagnostics, return immediately
      if (this._diagnostics.has(filePath)) {
        resolve(this._diagnostics.get(filePath)!)
        return
      }

      const timer = setTimeout(() => {
        this.off('diagnostics', handler)
        resolve([])
      }, timeout)

      const handler = (event: DiagnosticsEvent) => {
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
  async shutdown(): Promise<void> {
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
  getInfo(): {
    serverID: string
    root: string
    initialized: boolean
    openDocuments: string[]
    diagnosticCount: number
  } {
    return {
      serverID: this.serverID,
      root: this.root,
      initialized: this.initialized,
      openDocuments: Array.from(this._openDocuments),
      diagnosticCount: Array.from(this._diagnostics.values()).reduce((sum, d) => sum + d.length, 0),
    }
  }
}
