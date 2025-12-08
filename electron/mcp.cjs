/**
 * MCP (Model Context Protocol) Module for Electron
 *
 * Handles MCP server connections via stdio and SSE transports
 */

const { spawn } = require('child_process')

// Track active MCP server connections
const activeConnections = new Map()

// Event listeners for forwarding to renderer
let mainWindow = null

// Tool usage analytics - Map of `${serverId}:${toolName}` -> { usageCount, lastUsed, executionTimes, successCount }
const toolUsageAnalytics = new Map()

// Persistence file for usage analytics (in user's home directory)
const path = require('path')
const fs = require('fs')
const os = require('os')
const ANALYTICS_PATH = path.join(os.homedir(), '.cache', 'ai-cluso', 'tool-analytics.json')

/**
 * Load analytics from disk
 */
function loadAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      return
    }

    if (fs.existsSync(ANALYTICS_PATH)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf-8'))
      for (const [key, stats] of Object.entries(data)) {
        toolUsageAnalytics.set(key, stats)
      }
      console.log(`[MCP] Loaded analytics for ${data.length} tools`)
    }
  } catch (err) {
    console.error('[MCP] Failed to load analytics:', err.message)
  }
}

/**
 * Save analytics to disk (debounced)
 */
let analyticsSaveTimeout = null
function saveAnalyticsDebounced() {
  clearTimeout(analyticsSaveTimeout)
  analyticsSaveTimeout = setTimeout(() => {
    try {
      const dir = path.dirname(ANALYTICS_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const data = Object.fromEntries(toolUsageAnalytics)
      fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('[MCP] Failed to save analytics:', err.message)
    }
  }, 5000)
}

// Load analytics on module init
loadAnalytics()

/**
 * Set the main window reference for sending events
 */
function setMainWindow(window) {
  mainWindow = window
}

/**
 * Send an MCP event to the renderer process
 */
function sendEvent(event) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mcp:event', event)
  }
}

/**
 * Generate a unique message ID
 */
let messageIdCounter = 0
function generateMessageId() {
  return `msg_${Date.now()}_${++messageIdCounter}`
}

/**
 * Create an MCP JSON-RPC request
 */
function createRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: generateMessageId(),
    method,
    params,
  }
}

/**
 * StdioConnection - manages an MCP server via stdin/stdout
 */
class StdioConnection {
  constructor(config) {
    this.config = config
    this.process = null
    this.buffer = ''
    this.pendingRequests = new Map()
    this.capabilities = null
    this.onClose = null
    this.onError = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const { command, args = [], env = {}, cwd } = this.config.transport

      // Spawn the MCP server process
      this.process = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Handle stdout data (JSON-RPC responses)
      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString()
        this.processBuffer()
      })

      // Handle stderr (for logging)
      this.process.stderr.on('data', (data) => {
        console.log(`[MCP ${this.config.id}] stderr:`, data.toString())
      })

      // Handle process exit
      this.process.on('close', (code) => {
        console.log(`[MCP ${this.config.id}] Process exited with code ${code}`)
        this.onClose?.(code)
        sendEvent({
          type: 'disconnected',
          serverId: this.config.id,
          timestamp: Date.now(),
          data: { exitCode: code },
        })
      })

      this.process.on('error', (err) => {
        console.error(`[MCP ${this.config.id}] Process error:`, err)
        this.onError?.(err)
        reject(err)
      })

      // Initialize the connection
      this.initialize()
        .then((result) => {
          this.capabilities = result.capabilities
          resolve({ success: true, capabilities: result.capabilities })
        })
        .catch((err) => {
          this.disconnect()
          reject(err)
        })
    })
  }

  processBuffer() {
    // MCP uses JSON-RPC with newline-delimited JSON
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line)
        this.handleMessage(message)
      } catch (err) {
        console.error(`[MCP ${this.config.id}] Failed to parse message:`, err)
      }
    }
  }

  handleMessage(message) {
    // Handle responses to our requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)
      this.pendingRequests.delete(message.id)

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'))
      } else {
        resolve(message.result)
      }
      return
    }

    // Handle notifications from the server
    if (message.method) {
      this.handleNotification(message)
    }
  }

  handleNotification(message) {
    switch (message.method) {
      case 'notifications/tools/list_changed':
        sendEvent({
          type: 'tools-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
      case 'notifications/resources/list_changed':
        sendEvent({
          type: 'resources-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
      case 'notifications/prompts/list_changed':
        sendEvent({
          type: 'prompts-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
      case 'notifications/message':
        sendEvent({
          type: 'log',
          serverId: this.config.id,
          timestamp: Date.now(),
          data: message.params,
        })
        break
    }
  }

  send(request) {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        reject(new Error('Connection not active'))
        return
      }

      const timeout = this.config.timeout || 30000
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error('Request timeout'))
      }, timeout)

      this.pendingRequests.set(request.id, {
        resolve: (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
      })

      const message = JSON.stringify(request) + '\n'
      this.process.stdin.write(message)
    })
  }

  async initialize() {
    const request = createRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: 'ai-cluso',
        version: '1.0.0',
      },
    })

    const result = await this.send(request)

    // Send initialized notification
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }
    this.process.stdin.write(JSON.stringify(notification) + '\n')

    return result
  }

  async listTools() {
    const request = createRequest('tools/list')
    const result = await this.send(request)
    return result.tools || []
  }

  async listResources() {
    const request = createRequest('resources/list')
    const result = await this.send(request)
    return result.resources || []
  }

  async listPrompts() {
    const request = createRequest('prompts/list')
    const result = await this.send(request)
    return result.prompts || []
  }

  async callTool(name, args) {
    const request = createRequest('tools/call', {
      name,
      arguments: args,
    })
    return await this.send(request)
  }

  async readResource(uri) {
    const request = createRequest('resources/read', { uri })
    return await this.send(request)
  }

  async getPrompt(name, args) {
    const request = createRequest('prompts/get', {
      name,
      arguments: args,
    })
    return await this.send(request)
  }

  disconnect() {
    if (this.process && !this.process.killed) {
      this.process.kill()
    }
    this.pendingRequests.clear()
  }
}

/**
 * SSEConnection - manages an MCP server via Server-Sent Events
 * Uses Node.js http/https modules since EventSource isn't available in Node
 */
class SSEConnection {
  constructor(config) {
    this.config = config
    this.httpRequest = null
    this.sessionUrl = null
    this.capabilities = null
    this.onClose = null
    this.onError = null
    this.pendingRequests = new Map()
    this.connected = false
    this.buffer = ''
  }

  async connect() {
    const { url, headers = {} } = this.config.transport

    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 30000
      let timeoutId = null
      let resolved = false

      // Parse URL to determine http or https
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'
      const http = isHttps ? require('https') : require('http')

      // Build SSE URL - append /sse if not already present
      const sseUrl = url.endsWith('/sse') ? url : `${url.replace(/\/$/, '')}/sse`
      const sseUrlParsed = new URL(sseUrl)

      console.log(`[MCP ${this.config.id}] Connecting to SSE: ${sseUrl}`)

      const options = {
        hostname: sseUrlParsed.hostname,
        port: sseUrlParsed.port || (isHttps ? 443 : 80),
        path: sseUrlParsed.pathname + sseUrlParsed.search,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers,
        },
      }

      this.httpRequest = http.request(options, (res) => {
        console.log(`[MCP ${this.config.id}] SSE response status: ${res.statusCode}`)

        if (res.statusCode !== 200) {
          resolved = true
          clearTimeout(timeoutId)
          reject(new Error(`SSE connection failed with status ${res.statusCode}`))
          return
        }

        res.setEncoding('utf8')

        res.on('data', (chunk) => {
          this.buffer += chunk
          this.processSSEBuffer(resolve, reject, () => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeoutId)
            }
          })
        })

        res.on('end', () => {
          console.log(`[MCP ${this.config.id}] SSE connection ended`)
          this.connected = false
          this.onClose?.()
        })

        res.on('error', (err) => {
          console.error(`[MCP ${this.config.id}] SSE response error:`, err)
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            reject(err)
          }
        })
      })

      this.httpRequest.on('error', (err) => {
        console.error(`[MCP ${this.config.id}] SSE request error:`, err)
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          reject(new Error(`SSE connection error: ${err.message}`))
        }
      })

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          this.disconnect()
          reject(new Error('SSE connection timeout'))
        }
      }, timeout)

      this.httpRequest.end()
    })
  }

  processSSEBuffer(resolve, reject, onResolved) {
    // SSE format: event: <type>\ndata: <data>\n\n
    const lines = this.buffer.split('\n')
    let currentEvent = null
    let currentData = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        currentData.push(line.slice(5).trim())
      } else if (line === '' && (currentEvent || currentData.length > 0)) {
        // End of event
        const data = currentData.join('\n')

        if (currentEvent === 'endpoint') {
          // Got the session URL
          this.sessionUrl = data
          console.log(`[MCP ${this.config.id}] Got session URL: ${this.sessionUrl}`)

          // Initialize the connection
          this.initialize()
            .then((result) => {
              this.capabilities = result.capabilities
              this.connected = true
              onResolved()
              resolve({ success: true, capabilities: result.capabilities })
            })
            .catch((err) => {
              this.disconnect()
              reject(err)
            })
        } else if (currentEvent === 'message' || !currentEvent) {
          // JSON-RPC message
          try {
            const message = JSON.parse(data)
            this.handleMessage(message)
          } catch (err) {
            console.error(`[MCP ${this.config.id}] Failed to parse SSE message:`, err, data)
          }
        }

        currentEvent = null
        currentData = []

        // Remove processed lines from buffer
        this.buffer = lines.slice(i + 1).join('\n')
        i = 0
        continue
      }

      i++
    }
  }

  handleMessage(message) {
    // Handle responses to our requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)
      this.pendingRequests.delete(message.id)

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'))
      } else {
        resolve(message.result)
      }
      return
    }

    // Handle notifications
    if (message.method) {
      this.handleNotification(message)
    }
  }

  handleNotification(message) {
    switch (message.method) {
      case 'notifications/tools/list_changed':
        sendEvent({
          type: 'tools-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
      case 'notifications/resources/list_changed':
        sendEvent({
          type: 'resources-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
      case 'notifications/prompts/list_changed':
        sendEvent({
          type: 'prompts-changed',
          serverId: this.config.id,
          timestamp: Date.now(),
        })
        break
    }
  }

  async send(request) {
    if (!this.sessionUrl) {
      throw new Error('No session URL available')
    }

    const { headers = {} } = this.config.transport

    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 30000
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error('Request timeout'))
      }, timeout)

      this.pendingRequests.set(request.id, {
        resolve: (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
      })

      // Send the request via POST to the session URL
      fetch(this.sessionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(request),
      }).catch((err) => {
        this.pendingRequests.delete(request.id)
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  async initialize() {
    const request = createRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: 'ai-cluso',
        version: '1.0.0',
      },
    })

    const result = await this.send(request)

    // Send initialized notification
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }
    await fetch(this.sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.transport.headers || {}),
      },
      body: JSON.stringify(notification),
    })

    return result
  }

  async listTools() {
    const request = createRequest('tools/list')
    const result = await this.send(request)
    return result.tools || []
  }

  async listResources() {
    const request = createRequest('resources/list')
    const result = await this.send(request)
    return result.resources || []
  }

  async listPrompts() {
    const request = createRequest('prompts/list')
    const result = await this.send(request)
    return result.prompts || []
  }

  async callTool(name, args) {
    const request = createRequest('tools/call', {
      name,
      arguments: args,
    })
    return await this.send(request)
  }

  async readResource(uri) {
    const request = createRequest('resources/read', { uri })
    return await this.send(request)
  }

  async getPrompt(name, args) {
    const request = createRequest('prompts/get', {
      name,
      arguments: args,
    })
    return await this.send(request)
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.sessionUrl = null
    this.pendingRequests.clear()
  }
}

/**
 * Connect to an MCP server
 */
async function connect(config) {
  // Check if already connected
  if (activeConnections.has(config.id)) {
    const existing = activeConnections.get(config.id)
    return { success: true, capabilities: existing.capabilities }
  }

  sendEvent({
    type: 'connecting',
    serverId: config.id,
    timestamp: Date.now(),
  })

  try {
    let connection
    if (config.transport.type === 'stdio') {
      connection = new StdioConnection(config)
    } else if (config.transport.type === 'sse') {
      connection = new SSEConnection(config)
    } else {
      throw new Error(`Unknown transport type: ${config.transport.type}`)
    }

    // Set up disconnect handler
    connection.onClose = () => {
      activeConnections.delete(config.id)
    }

    connection.onError = (err) => {
      sendEvent({
        type: 'error',
        serverId: config.id,
        timestamp: Date.now(),
        data: err.message,
      })
    }

    const result = await connection.connect()
    activeConnections.set(config.id, connection)

    sendEvent({
      type: 'connected',
      serverId: config.id,
      timestamp: Date.now(),
      data: result.capabilities,
    })

    return result
  } catch (err) {
    sendEvent({
      type: 'error',
      serverId: config.id,
      timestamp: Date.now(),
      data: err.message,
    })
    return { success: false, error: err.message }
  }
}

/**
 * Disconnect from an MCP server
 */
async function disconnect(serverId) {
  const connection = activeConnections.get(serverId)
  if (connection) {
    connection.disconnect()
    activeConnections.delete(serverId)
  }
  return { success: true }
}

/**
 * List tools from a connected server
 */
async function listTools(serverId) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { tools: [], error: 'Server not connected' }
  }

  try {
    const tools = await connection.listTools()
    return { tools }
  } catch (err) {
    return { tools: [], error: err.message }
  }
}

/**
 * List resources from a connected server
 */
async function listResources(serverId) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { resources: [], error: 'Server not connected' }
  }

  try {
    const resources = await connection.listResources()
    return { resources }
  } catch (err) {
    return { resources: [], error: err.message }
  }
}

/**
 * List prompts from a connected server
 */
async function listPrompts(serverId) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { prompts: [], error: 'Server not connected' }
  }

  try {
    const prompts = await connection.listPrompts()
    return { prompts }
  } catch (err) {
    return { prompts: [], error: err.message }
  }
}

/**
 * Call a tool on a connected server
 */
async function callTool({ serverId, toolName, arguments: args }) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { success: false, error: 'Server not connected' }
  }

  try {
    const result = await connection.callTool(toolName, args)
    return {
      success: true,
      content: result.content || [],
      isError: result.isError || false,
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Read a resource from a connected server
 */
async function readResource(serverId, uri) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { error: 'Server not connected' }
  }

  try {
    const result = await connection.readResource(uri)
    return { content: result.contents }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Get a prompt from a connected server
 */
async function getPrompt(serverId, name, args) {
  const connection = activeConnections.get(serverId)
  if (!connection) {
    return { error: 'Server not connected' }
  }

  try {
    const result = await connection.getPrompt(name, args)
    return { messages: result.messages }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Get status of all connections
 */
function getStatus() {
  const status = {}
  for (const [serverId, connection] of activeConnections) {
    status[serverId] = {
      config: connection.config,
      status: 'connected',
      capabilities: connection.capabilities,
      tools: [],
      resources: [],
      prompts: [],
    }
  }
  return status
}

/**
 * Discover MCP servers from various sources:
 * 1. Claude Desktop config (global)
 * 2. Project .mcp.json
 * 3. App configured servers
 */
async function discoverMcpServers(projectPath) {
  const fs = require('fs')
  const path = require('path')
  const os = require('os')

  const discovered = {}

  // Helper to safely parse JSON
  const safeJsonParse = (content, source) => {
    try {
      return JSON.parse(content)
    } catch (err) {
      console.error(`Failed to parse ${source}:`, err.message)
      return null
    }
  }

  // Helper to process servers from a config
  const processServers = (servers, source) => {
    if (!servers || typeof servers !== 'object') return

    for (const [name, config] of Object.entries(servers)) {
      if (!config) continue

      // Determine transport type
      const type = config.type || 'stdio'
      let transport

      if (type === 'stdio') {
        if (!config.command) {
          console.warn(`Skipping ${name} from ${source}: missing command`)
          continue
        }
        transport = {
          type: 'stdio',
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          cwd: config.cwd,
        }
      } else if (type === 'sse' || type === 'http') {
        if (!config.url) {
          console.warn(`Skipping ${name} from ${source}: missing url`)
          continue
        }
        transport = {
          type: config.type,
          url: config.url,
          headers: config.headers || {},
        }
      } else {
        console.warn(`Skipping ${name} from ${source}: unknown type ${type}`)
        continue
      }

      // Create unique key with source suffix for display
      const key = `${name} (${source})`
      discovered[key] = {
        name,
        source,
        config: {
          ...config,
          type,
        },
        transport,
        tools: null, // Will be populated when connected
        error: null,
      }
    }
  }

  // 1. Claude Desktop config (macOS)
  try {
    const claudeDesktopPath = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json'
    )
    if (fs.existsSync(claudeDesktopPath)) {
      const content = fs.readFileSync(claudeDesktopPath, 'utf-8')
      const parsed = safeJsonParse(content, 'Claude Desktop config')
      if (parsed?.mcpServers) {
        processServers(parsed.mcpServers, 'Claude Desktop')
        console.log(`Discovered ${Object.keys(parsed.mcpServers).length} servers from Claude Desktop`)
      }
    }
  } catch (err) {
    console.error('Error reading Claude Desktop config:', err.message)
  }

  // 2. Project .mcp.json
  if (projectPath) {
    try {
      const projectMcpPath = path.join(projectPath, '.mcp.json')
      if (fs.existsSync(projectMcpPath)) {
        const content = fs.readFileSync(projectMcpPath, 'utf-8')
        const parsed = safeJsonParse(content, 'Project .mcp.json')
        if (parsed?.mcpServers) {
          processServers(parsed.mcpServers, 'Project')
          console.log(`Discovered ${Object.keys(parsed.mcpServers).length} servers from project`)
        }
      }
    } catch (err) {
      console.error('Error reading project .mcp.json:', err.message)
    }
  }

  console.log(`Total discovered MCP servers: ${Object.keys(discovered).length}`)
  return discovered
}

/**
 * Score tool relevance based on context
 * Considers file type, recent usage, user intent, and error context
 */
function scoreToolRelevance(tools, context = {}) {
  const {
    currentFileType = '',
    recentTools = [],
    userIntent = '',
    errorContext = '',
    projectType = 'generic',
  } = context

  return tools.map(tool => {
    let score = 0.5 // Base score
    let reasons = []

    // Score based on tool name and description matching file type
    const fileTypeScore = calculateFileTypeRelevance(
      tool.name,
      tool.description || '',
      currentFileType,
      projectType
    )
    score += fileTypeScore * 0.25
    if (fileTypeScore > 0.5) {
      reasons.push(`Matches file type: ${currentFileType}`)
    }

    // Score based on recent usage (recency bonus)
    if (recentTools.includes(tool.name)) {
      score += 0.15
      reasons.push('Recently used')
    }

    // Score based on user intent matching
    const intentScore = calculateIntentRelevance(tool.name, tool.description || '', userIntent)
    score += intentScore * 0.30
    if (intentScore > 0.5) {
      reasons.push(`Matches intent: ${userIntent}`)
    }

    // Score based on error context
    if (errorContext) {
      const errorScore = calculateErrorRelevance(tool.name, tool.description || '', errorContext)
      score += errorScore * 0.20
      if (errorScore > 0.5) {
        reasons.push(`Relevant to error: ${errorContext}`)
      }
    }

    // Get usage stats
    const statsKey = `unknown:${tool.name}`
    const usageStats = toolUsageAnalytics.get(statsKey)
    if (usageStats && usageStats.usageCount > 0) {
      // Tools used more frequently get a small boost
      const usageBoost = Math.min(0.1, usageStats.usageCount * 0.01)
      score += usageBoost
      reasons.push(`Used ${usageStats.usageCount} times (${(usageStats.successRate * 100).toFixed(0)}% success)`)
    }

    // Clamp score to 0-1
    score = Math.max(0, Math.min(1, score))

    return {
      ...tool,
      relevanceScore: score,
      scoreReason: reasons.length > 0 ? reasons.join(', ') : 'Generic tool',
      usageStats,
    }
  })
}

/**
 * Calculate relevance of tool to file type
 */
function calculateFileTypeRelevance(toolName, description, fileType, projectType) {
  const text = `${toolName} ${description}`.toLowerCase()
  const fileTypeLower = fileType.toLowerCase()

  // Language-specific matches
  const fileTypeKeywords = {
    typescript: ['typescript', 'ts', 'node', 'react', 'jest'],
    javascript: ['javascript', 'js', 'node', 'react', 'jest'],
    python: ['python', 'py', 'django', 'flask', 'pytest'],
    rust: ['rust', 'rs', 'cargo', 'clippy'],
    go: ['go', 'golang', 'goland'],
    java: ['java', 'maven', 'gradle', 'spring'],
    markdown: ['markdown', 'md', 'docs', 'documentation'],
  }

  let score = 0
  const keywords = fileTypeKeywords[fileTypeLower] || []
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 0.25
    }
  }

  return Math.min(1, score)
}

/**
 * Calculate relevance of tool to user intent
 */
function calculateIntentRelevance(toolName, description, intent) {
  if (!intent) return 0

  const text = `${toolName} ${description}`.toLowerCase()
  const intentLower = intent.toLowerCase()

  // Split intent into keywords and match
  const keywords = intentLower.split(/\s+/).filter(w => w.length > 2)
  let matches = 0

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      matches++
    }
  }

  return Math.min(1, matches / Math.max(1, keywords.length))
}

/**
 * Calculate relevance of tool to error context
 */
function calculateErrorRelevance(toolName, description, errorContext) {
  if (!errorContext) return 0

  const text = `${toolName} ${description}`.toLowerCase()
  const errorLower = errorContext.toLowerCase()

  // Common error patterns and related tools
  const errorPatterns = {
    'type': ['type', 'typescript', 'schema', 'validation'],
    'import': ['import', 'module', 'resolve', 'path'],
    'syntax': ['syntax', 'parse', 'lint', 'format'],
    'test': ['test', 'unit', 'integration', 'coverage'],
    'performance': ['performance', 'profile', 'optimize', 'benchmark'],
    'security': ['security', 'audit', 'vulnerability', 'scan'],
  }

  let score = 0
  for (const [pattern, keywords] of Object.entries(errorPatterns)) {
    if (errorLower.includes(pattern)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 0.2
        }
      }
    }
  }

  return Math.min(1, score)
}

/**
 * Filter tools by context and return top N relevant tools
 */
function filterToolsByContext(tools, context, limit = 10) {
  const scored = scoreToolRelevance(tools, context)
  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

/**
 * Track tool usage for analytics
 */
function trackToolUsage(serverId, toolName, executionTime, success) {
  const key = `${serverId}:${toolName}`
  const current = toolUsageAnalytics.get(key) || {
    usageCount: 0,
    executionTimes: [],
    successCount: 0,
  }

  current.usageCount++
  current.lastUsed = Date.now()
  current.executionTimes.push(executionTime)
  if (success) {
    current.successCount++
  }

  // Keep only last 100 execution times to avoid unbounded growth
  if (current.executionTimes.length > 100) {
    current.executionTimes = current.executionTimes.slice(-100)
  }

  // Calculate derived stats
  current.avgExecutionTime = current.executionTimes.reduce((a, b) => a + b, 0) / current.executionTimes.length
  current.successRate = current.successCount / current.usageCount

  toolUsageAnalytics.set(key, current)
  saveAnalyticsDebounced()
}

/**
 * Get tool usage statistics
 */
function getToolUsageStats(serverId, toolName) {
  const key = `${serverId}:${toolName}`
  const stats = toolUsageAnalytics.get(key)
  if (!stats) return null

  return {
    usageCount: stats.usageCount,
    lastUsed: stats.lastUsed,
    avgExecutionTime: stats.avgExecutionTime,
    successRate: stats.successRate,
  }
}

/**
 * Try to connect to a discovered server and get its tools
 */
async function probeServer(serverConfig) {
  const tempId = `probe_${Date.now()}`
  try {
    // Create a temporary connection to probe the server
    const config = {
      id: tempId,
      name: serverConfig.name,
      transport: serverConfig.transport,
      timeout: 10000, // 10 second timeout for probing
    }

    // Connect
    const result = await connect(config)
    if (!result.success) {
      return { tools: null, error: result.error }
    }

    // Get tools
    const toolsResult = await listTools(tempId)
    const tools = toolsResult.tools || []

    // Disconnect
    await disconnect(tempId)

    return {
      tools: tools.map(t => ({
        name: t.name,
        displayName: t.name,
        description: t.description,
      })),
      error: null,
    }
  } catch (err) {
    // Make sure to disconnect on error
    try {
      await disconnect(tempId)
    } catch {}
    return { tools: null, error: err.message }
  }
}

module.exports = {
  setMainWindow,
  connect,
  disconnect,
  listTools,
  listResources,
  listPrompts,
  callTool,
  readResource,
  getPrompt,
  getStatus,
  discoverMcpServers,
  probeServer,
  // Smart MCP functions
  scoreToolRelevance,
  filterToolsByContext,
  trackToolUsage,
  getToolUsageStats,
}
