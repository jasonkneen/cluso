/**
 * PTY WebSocket Server for Terminal Integration
 *
 * Provides a WebSocket endpoint for connecting terminals to PTY sessions.
 * Each WebSocket connection spawns a new PTY shell process.
 */

const { WebSocketServer } = require('ws')
const http = require('http')
const os = require('os')
const path = require('path')

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

/**
 * Start the PTY WebSocket server
 * @param {number} port - Port to listen on (default: 3001)
 */
function start(port = 3001) {
  if (server) {
    console.log('[PTY Server] Already running')
    return
  }

  if (!pty) {
    console.error('[PTY Server] Cannot start - no PTY module available')
    return
  }

  // Create HTTP server
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('PTY WebSocket Server')
  })

  // Create WebSocket server
  wss = new WebSocketServer({ server })

  wss.on('connection', (ws, req) => {
    // Parse query parameters for initial terminal size
    const url = new URL(req.url, `http://localhost:${port}`)
    const cols = parseInt(url.searchParams.get('cols') || '80', 10)
    const rows = parseInt(url.searchParams.get('rows') || '24', 10)
    const cwd = url.searchParams.get('cwd') || os.homedir()

    console.log(`[PTY Server] New connection: ${cols}x${rows}, cwd: ${cwd}`)

    // Determine shell
    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/zsh'

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Ensure proper locale for unicode support
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      },
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
        // Check if it's a JSON control message
        const str = message.toString()
        if (str.startsWith('{')) {
          const parsed = JSON.parse(str)
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            ptyProcess.resize(parsed.cols, parsed.rows)
            console.log(`[PTY Server] Resized PTY ${sessionId} to ${parsed.cols}x${parsed.rows}`)
            return
          }
        }
        // Otherwise treat as terminal input
        ptyProcess.write(str)
      } catch (e) {
        // Not JSON, treat as raw input
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
  })

  wss.on('error', (error) => {
    console.error('[PTY Server] WebSocket server error:', error.message)
  })

  server.listen(port, () => {
    console.log(`[PTY Server] Running on ws://localhost:${port}/pty`)
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`[PTY Server] Port ${port} in use, trying ${port + 1}`)
      server = null
      start(port + 1)
    } else {
      console.error('[PTY Server] Server error:', error.message)
    }
  })
}

/**
 * Stop the PTY WebSocket server
 */
function stop() {
  // Kill all PTY sessions
  for (const [sessionId, { ptyProcess, ws }] of ptySessions) {
    console.log(`[PTY Server] Killing PTY ${sessionId}`)
    try {
      ptyProcess.kill()
    } catch (e) {
      // Ignore
    }
    try {
      ws.close()
    } catch (e) {
      // Ignore
    }
  }
  ptySessions.clear()

  // Close WebSocket server
  if (wss) {
    wss.close()
    wss = null
  }

  // Close HTTP server
  if (server) {
    server.close()
    server = null
  }

  console.log('[PTY Server] Stopped')
}

/**
 * Get active session count
 */
function getSessionCount() {
  return ptySessions.size
}

module.exports = {
  start,
  stop,
  getSessionCount,
}
