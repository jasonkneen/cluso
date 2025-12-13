/**
 * PTY WebSocket Server for Terminal Integration
 *
 * Provides a WebSocket endpoint for connecting terminals to PTY sessions.
 * Uses Unix socket for reliable local IPC in packaged apps.
 */

const { WebSocketServer } = require('ws')
const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')
const net = require('net')

// PTY support - try node-pty first, fall back to lydell/node-pty
let pty
try {
  pty = require('node-pty')
} catch (e) {
  try {
    pty = require('@lydell/node-pty')
  } catch (e2) {
    console.error('[PTY Server] No PTY module available:', e.message)
    pty = null
  }
}

// Store active PTY sessions
const ptySessions = new Map()

let server = null
let wss = null
let activePort = null
let socketPath = null

/**
 * Get the socket path for Unix socket mode
 */
function getSocketPath() {
  const tmpDir = os.tmpdir()
  return path.join(tmpDir, `cluso-pty-${process.pid}.sock`)
}

/**
 * Clean up socket file if it exists
 */
function cleanupSocket(sockPath) {
  try {
    if (fs.existsSync(sockPath)) {
      fs.unlinkSync(sockPath)
    }
  } catch (e) {
    console.warn('[PTY Server] Failed to cleanup socket:', e.message)
  }
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const testServer = net.createServer()
    testServer.listen(startPort, () => {
      const port = testServer.address().port
      testServer.close(() => resolve(port))
    })
    testServer.on('error', () => {
      resolve(findAvailablePort(startPort + 1))
    })
  })
}

/**
 * Create the WebSocket connection handler
 */
function createConnectionHandler() {
  return (ws, req) => {
    // Parse query parameters for initial terminal size
    const url = new URL(req.url, 'http://localhost')
    const cols = parseInt(url.searchParams.get('cols') || '80', 10)
    const rows = parseInt(url.searchParams.get('rows') || '24', 10)
    const cwd = url.searchParams.get('cwd') || os.homedir()

    console.log(`[PTY Server] New connection: ${cols}x${rows}, cwd: ${cwd}`)

    // Determine shell based on platform
    const isWindows = process.platform === 'win32'
    const shell = isWindows
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/zsh'

    // Build proper PATH based on platform
    const pathSeparator = isWindows ? ';' : ':'
    const defaultPaths = isWindows
      ? [
          // Windows common paths
          path.join(os.homedir(), 'AppData', 'Roaming', 'npm'),
          path.join(os.homedir(), 'AppData', 'Local', 'pnpm'),
          path.join(os.homedir(), '.cargo', 'bin'),
          'C:\\Program Files\\nodejs',
          'C:\\Program Files\\Git\\bin',
          'C:\\Program Files\\Git\\cmd',
        ]
      : [
          // macOS/Linux paths
          '/opt/homebrew/bin',
          '/opt/homebrew/sbin',
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
          `${os.homedir()}/.nvm/versions/node/v22.14.0/bin`,
          `${os.homedir()}/.cargo/bin`,
          `${os.homedir()}/.local/bin`,
        ]
    const currentPath = process.env.PATH || ''
    const enhancedPath = [...new Set([...defaultPaths, ...currentPath.split(pathSeparator)])].join(pathSeparator)

    // Build platform-specific environment
    const ptyEnv = {
      ...process.env,
      PATH: enhancedPath,
    }

    if (isWindows) {
      // Windows-specific env vars
      ptyEnv.USERPROFILE = process.env.USERPROFILE || os.homedir()
      ptyEnv.TERM = 'xterm-256color' // PowerShell handles this fine
    } else {
      // Unix-specific env vars
      ptyEnv.TERM = 'xterm-256color'
      ptyEnv.COLORTERM = 'truecolor'
      ptyEnv.LANG = process.env.LANG || 'en_US.UTF-8'
      ptyEnv.LC_ALL = process.env.LC_ALL || 'en_US.UTF-8'
      ptyEnv.HOME = process.env.HOME || os.homedir()
    }

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: ptyEnv,
    })

    const sessionId = ptyProcess.pid
    ptySessions.set(sessionId, { ptyProcess, ws })

    console.log(`[PTY Server] Spawned PTY process ${sessionId}`)

    // Send PTY output to WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data)
      }
    })

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY Server] PTY ${sessionId} exited (code: ${exitCode}, signal: ${signal})`)
      ptySessions.delete(sessionId)
      if (ws.readyState === ws.OPEN) {
        ws.close()
      }
    })

    // Handle incoming WebSocket messages
    ws.on('message', (message) => {
      try {
        const str = message.toString()
        if (str.startsWith('{')) {
          const parsed = JSON.parse(str)
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            ptyProcess.resize(parsed.cols, parsed.rows)
            console.log(`[PTY Server] Resized PTY ${sessionId} to ${parsed.cols}x${parsed.rows}`)
            return
          }
        }
        ptyProcess.write(str)
      } catch (e) {
        ptyProcess.write(message.toString())
      }
    })

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`[PTY Server] WebSocket closed for PTY ${sessionId}`)
      if (ptySessions.has(sessionId)) {
        ptyProcess.kill()
        ptySessions.delete(sessionId)
      }
    })

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`[PTY Server] WebSocket error for PTY ${sessionId}:`, error.message)
    })
  }
}

/**
 * Start the PTY WebSocket server
 * @param {number} preferredPort - Preferred port to listen on (default: 3001)
 * @returns {Promise<number>} The actual port the server is listening on
 */
async function start(preferredPort = 3001) {
  if (server) {
    console.log('[PTY Server] Already running on port', activePort)
    return activePort
  }

  if (!pty) {
    console.error('[PTY Server] Cannot start - no PTY module available')
    return null
  }

  // Find an available port
  activePort = await findAvailablePort(preferredPort)

  // Create HTTP server
  server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', port: activePort, sessions: ptySessions.size }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('PTY WebSocket Server')
  })

  // Create WebSocket server
  wss = new WebSocketServer({ server })
  wss.on('connection', createConnectionHandler())

  wss.on('error', (error) => {
    console.error('[PTY Server] WebSocket server error:', error.message)
  })

  return new Promise((resolve, reject) => {
    server.listen(activePort, '127.0.0.1', () => {
      console.log(`[PTY Server] Running on ws://127.0.0.1:${activePort}`)
      resolve(activePort)
    })

    server.on('error', (error) => {
      console.error('[PTY Server] Server error:', error.message)
      reject(error)
    })
  })
}

/**
 * Get the current port the server is running on
 */
function getPort() {
  return activePort
}

/**
 * Stop the PTY server
 */
function stop() {
  // Kill all active PTY sessions
  for (const [sessionId, { ptyProcess }] of ptySessions) {
    try {
      ptyProcess.kill()
    } catch (e) {
      console.warn(`[PTY Server] Failed to kill PTY ${sessionId}:`, e.message)
    }
  }
  ptySessions.clear()

  if (wss) {
    wss.close()
    wss = null
  }

  if (server) {
    server.close()
    server = null
  }

  // Clean up socket file if using Unix socket
  if (socketPath) {
    cleanupSocket(socketPath)
    socketPath = null
  }

  activePort = null
  console.log('[PTY Server] Stopped')
}

module.exports = {
  start,
  stop,
  getPort,
}
