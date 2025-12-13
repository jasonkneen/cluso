/**
 * Extension Bridge
 *
 * WebSocket server that connects Chrome extension to the Cluso desktop app.
 * Allows the extension to share element selections and receive commands.
 */

const { WebSocketServer } = require('ws')

let wss = null
let extensionSocket = null
let mainWindow = null

/**
 * Initialize the WebSocket server
 * @param {BrowserWindow} window - Main Electron window to forward events to
 */
function initialize(window) {
  mainWindow = window

  // Skip if already initialized
  if (wss) {
    console.log('[ExtensionBridge] Already initialized')
    return
  }

  // Create WebSocket server on port 3002 (3001 is used by PTY server)
  try {
    wss = new WebSocketServer({ port: 3002, path: '/extension-bridge' })

    wss.on('connection', (ws) => {
      console.log('[ExtensionBridge] Extension connected')
      extensionSocket = ws

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          handleMessage(message)
        } catch (err) {
          console.error('[ExtensionBridge] Failed to parse message:', err)
        }
      })

      ws.on('close', () => {
        console.log('[ExtensionBridge] Extension disconnected')
        if (extensionSocket === ws) {
          extensionSocket = null
        }
      })

      ws.on('error', (err) => {
        console.error('[ExtensionBridge] WebSocket error:', err)
      })
    })

    wss.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('[ExtensionBridge] Port 3002 in use, retrying on 3003...')
        wss = new WebSocketServer({ port: 3003, path: '/extension-bridge' })
      } else {
        console.error('[ExtensionBridge] Server error:', err)
      }
    })

    console.log('[ExtensionBridge] Server started on port 3002')
  } catch (err) {
    console.error('[ExtensionBridge] Failed to start server:', err)
  }
}

// Pending chat requests waiting for response
const pendingChatRequests = new Map()

/**
 * Handle incoming messages from the extension
 */
function handleMessage(message) {
  console.log('[ExtensionBridge] Received:', message.type)

  switch (message.type) {
    case 'selection':
      // Forward element selection to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension:selection', message.element)
      }
      break

    case 'page-elements':
      // Forward page elements to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension:page-elements', message.elements)
      }
      break

    case 'chat-request':
      // Forward chat request to renderer and track for response
      if (mainWindow && !mainWindow.isDestroyed()) {
        const requestId = message.requestId || Date.now().toString()
        pendingChatRequests.set(requestId, true)
        mainWindow.webContents.send('extension:chat-request', {
          requestId,
          message: message.message,
          elements: message.elements,
          pageUrl: message.pageUrl,
          pageTitle: message.pageTitle,
        })
      } else {
        console.log('[ExtensionBridge] Cannot forward - no mainWindow')
      }
      break

    case 'start-sharing':
      console.log('[ExtensionBridge] Extension started sharing')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension:sharing-started')
      }
      break

    case 'stop-sharing':
      console.log('[ExtensionBridge] Extension stopped sharing')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension:sharing-stopped')
      }
      break

    case 'cursor-move':
      // Forward cursor position to renderer with all positioning data
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension:cursor-move', {
          // Element-relative anchoring (most accurate across breakpoints)
          elementAnchor: message.elementAnchor,
          // Viewport percentage (breakpoint-aware)
          viewportPercentX: message.viewportPercentX,
          viewportPercentY: message.viewportPercentY,
          // Document-relative position
          pageX: message.pageX,
          pageY: message.pageY,
          // Viewport-relative position
          clientX: message.clientX,
          clientY: message.clientY,
          // Scroll position
          scrollX: message.scrollX,
          scrollY: message.scrollY,
          // Viewport dimensions
          viewportWidth: message.viewportWidth,
          viewportHeight: message.viewportHeight,
          // Document dimensions
          documentWidth: message.documentWidth,
          documentHeight: message.documentHeight,
          // Page URL
          pageUrl: message.pageUrl,
          // Timestamp for interpolation
          timestamp: message.timestamp,
        })
      }
      break

    default:
      console.log('[ExtensionBridge] Unknown message type:', message.type)
  }
}

/**
 * Send chat response back to extension
 */
function sendChatResponse(requestId, reply, error) {
  if (pendingChatRequests.has(requestId)) {
    pendingChatRequests.delete(requestId)
    sendToExtension({
      type: 'chat-response',
      requestId,
      reply,
      error,
    })
  }
}

/**
 * Send a message to the connected extension
 * @param {object} message - Message to send
 */
function sendToExtension(message) {
  if (extensionSocket && extensionSocket.readyState === 1) {
    extensionSocket.send(JSON.stringify(message))
    return true
  }
  return false
}

/**
 * Check if extension is connected
 */
function isConnected() {
  return extensionSocket !== null && extensionSocket.readyState === 1
}

/**
 * Activate inspector on extension
 */
function activateInspector() {
  return sendToExtension({ type: 'activate-inspector' })
}

/**
 * Deactivate inspector on extension
 */
function deactivateInspector() {
  return sendToExtension({ type: 'deactivate-inspector' })
}

/**
 * Request page elements from extension
 */
function requestPageElements() {
  return sendToExtension({ type: 'request-elements' })
}

/**
 * Clean up the WebSocket server
 */
function cleanup() {
  if (extensionSocket) {
    extensionSocket.close()
    extensionSocket = null
  }

  if (wss) {
    wss.close()
    wss = null
  }

  console.log('[ExtensionBridge] Cleaned up')
}

/**
 * Register IPC handlers for extension bridge
 * @param {typeof import('electron').ipcMain} ipcMain
 */
function registerHandlers(ipcMain) {
  ipcMain.handle('extension-bridge:status', async () => {
    return {
      connected: isConnected(),
      port: wss?.options?.port || 3002,
    }
  })

  ipcMain.handle('extension-bridge:activate-inspector', async () => {
    return { success: activateInspector() }
  })

  ipcMain.handle('extension-bridge:deactivate-inspector', async () => {
    return { success: deactivateInspector() }
  })

  ipcMain.handle('extension-bridge:request-elements', async () => {
    return { success: requestPageElements() }
  })

  ipcMain.handle('extension-bridge:chat-response', async (_event, requestId, reply, error) => {
    sendChatResponse(requestId, reply, error)
    return { success: true }
  })
}

module.exports = {
  initialize,
  sendToExtension,
  sendChatResponse,
  isConnected,
  activateInspector,
  deactivateInspector,
  requestPageElements,
  cleanup,
  registerHandlers,
}
