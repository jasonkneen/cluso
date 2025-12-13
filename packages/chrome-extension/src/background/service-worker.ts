/**
 * Background Service Worker
 *
 * Handles:
 * - Communication between content scripts and popup
 * - WebSocket connection to Cluso desktop app
 * - MCP server for external clients (Claude Code)
 */

import type { SelectedElement } from '@ai-cluso/shared-types'

// State
let selectedElement: SelectedElement | null = null
let clusoConnection: WebSocket | null = null
let isConnectedToCluso = false

/**
 * Cluso WebSocket Client
 * Connects to the Cluso desktop app when available
 */
class ClusoClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pendingRequests = new Map<string, { resolve: (value: { reply?: string; error?: string }) => void; timeout: ReturnType<typeof setTimeout> }>()

  async connect(): Promise<boolean> {
    try {
      // Try to connect to Cluso desktop app (port 3002, 3001 is used by PTY)
      this.ws = new WebSocket('ws://localhost:3002/extension-bridge')

      return new Promise((resolve) => {
        if (!this.ws) {
          resolve(false)
          return
        }

        this.ws.onopen = () => {
          console.log('[Cluso] Connected to desktop app')
          isConnectedToCluso = true
          this.reconnectAttempts = 0
          resolve(true)
        }

        this.ws.onclose = () => {
          console.log('[Cluso] Disconnected from desktop app')
          isConnectedToCluso = false
          this.scheduleReconnect()
        }

        this.ws.onerror = () => {
          console.log('[Cluso] Connection error - running standalone')
          isConnectedToCluso = false
          resolve(false)
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string)
            this.handleMessage(message)
          } catch (err) {
            console.error('[Cluso] Failed to parse message:', err)
          }
        }
      })
    } catch {
      console.log('[Cluso] Desktop app not available - running standalone')
      return false
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'activate-inspector':
        // Forward to active tab
        activateInspectorOnActiveTab()
        break

      case 'deactivate-inspector':
        deactivateInspectorOnActiveTab()
        break

      case 'request-elements':
        // Request elements from active tab
        getPageElementsFromActiveTab().then((elements) => {
          this.send({
            type: 'page-elements',
            elements,
          })
        })
        break

      case 'chat-response': {
        // Handle chat response from Cluso
        const requestId = message.requestId as string
        const pending = this.pendingRequests.get(requestId)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(requestId)
          pending.resolve({
            reply: message.reply as string | undefined,
            error: message.error as string | undefined,
          })
        }
        break
      }

      default:
        console.log('[Cluso] Unknown message type:', message.type)
    }
  }

  /**
   * Send a chat request and wait for response
   */
  async sendChatRequest(request: {
    message: string
    elements: Array<{ id: string; tagName: string; label: string; fullInfo?: Record<string, unknown> }>
    pageUrl: string
    pageTitle: string
  }): Promise<{ reply?: string; error?: string }> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        resolve({ error: 'Request timed out' })
      }, 30000)

      // Track pending request
      this.pendingRequests.set(requestId, { resolve, timeout })

      // Send request
      this.send({
        type: 'chat-request',
        requestId,
        message: request.message,
        elements: request.elements,
        pageUrl: request.pageUrl,
        pageTitle: request.pageTitle,
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Cluso] Max reconnect attempts reached')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      console.log(`[Cluso] Reconnect attempt ${this.reconnectAttempts}`)
      this.connect()
    }, delay)
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.ws?.close()
    this.ws = null
  }
}

const clusoClient = new ClusoClient()

/**
 * Send message to content script on active tab
 */
async function sendToActiveTab(message: Record<string, unknown>): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    return chrome.tabs.sendMessage(tab.id, message)
  }
  throw new Error('No active tab found')
}

/**
 * Activate inspector on active tab
 */
async function activateInspectorOnActiveTab(): Promise<void> {
  try {
    await sendToActiveTab({ type: 'activate-inspector' })
  } catch (err) {
    console.error('[Cluso] Failed to activate inspector:', err)
  }
}

/**
 * Deactivate inspector on active tab
 */
async function deactivateInspectorOnActiveTab(): Promise<void> {
  try {
    await sendToActiveTab({ type: 'deactivate-inspector' })
  } catch (err) {
    console.error('[Cluso] Failed to deactivate inspector:', err)
  }
}

/**
 * Get page elements from active tab
 */
async function getPageElementsFromActiveTab(): Promise<unknown[]> {
  try {
    const response = (await sendToActiveTab({ type: 'get-page-elements' })) as {
      elements?: unknown[]
    }
    return response?.elements || []
  } catch (err) {
    console.error('[Cluso] Failed to get page elements:', err)
    return []
  }
}

/**
 * Handle chat message - proxy via Cluso socket or direct API
 */
async function handleChatMessage(message: {
  message: string
  elements: Array<{ id: string; tagName: string; label: string; fullInfo?: Record<string, unknown> }>
  pageUrl: string
  pageTitle: string
}): Promise<{ reply?: string; error?: string }> {
  // If connected to Cluso, proxy through it
  if (isConnectedToCluso) {
    console.log('[Cluso] Sending chat request to desktop app')
    return clusoClient.sendChatRequest(message)
  }

  // Standalone mode - direct API call
  // For now, return a placeholder response
  // TODO: Implement direct Gemini API call when not connected to Cluso
  console.log('[Cluso] Chat message (standalone):', message)
  return {
    reply: `Standalone mode: "${message.message}" with ${message.elements.length} element(s) on ${message.pageTitle}`,
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'element-selected':
      // Store selected element
      selectedElement = message.element as SelectedElement

      // Forward to Cluso if connected
      if (isConnectedToCluso) {
        clusoClient.send({
          type: 'selection',
          element: selectedElement,
        })
      }

      // Notify popup
      chrome.runtime
        .sendMessage({
          type: 'selection-updated',
          element: selectedElement,
        })
        .catch(() => {
          // Popup may not be open
        })

      sendResponse({ success: true })
      break

    case 'get-selected-element':
      sendResponse({ element: selectedElement })
      break

    case 'get-connection-status':
      sendResponse({ connected: isConnectedToCluso })
      break

    case 'activate-inspector':
      activateInspectorOnActiveTab().then(() => {
        sendResponse({ success: true })
      })
      return true // Keep channel open

    case 'deactivate-inspector':
      deactivateInspectorOnActiveTab().then(() => {
        sendResponse({ success: true })
      })
      return true

    case 'get-page-elements':
      getPageElementsFromActiveTab().then((elements) => {
        sendResponse({ elements })
      })
      return true

    case 'clear-selection':
      selectedElement = null
      sendToActiveTab({ type: 'clear-selection' }).then(() => {
        sendResponse({ success: true })
      })
      return true

    case 'show-toolbar':
      sendToActiveTab({ type: 'show-toolbar' }).then((response) => {
        sendResponse(response)
      }).catch((err) => {
        sendResponse({ success: false, error: err.message })
      })
      return true

    case 'hide-toolbar':
      sendToActiveTab({ type: 'hide-toolbar' }).then((response) => {
        sendResponse(response)
      }).catch((err) => {
        sendResponse({ success: false, error: err.message })
      })
      return true

    case 'toggle-toolbar':
      sendToActiveTab({ type: 'toggle-toolbar' }).then((response) => {
        sendResponse(response)
      }).catch((err) => {
        sendResponse({ success: false, error: err.message })
      })
      return true

    case 'chat-message':
      handleChatMessage(message).then((response) => {
        sendResponse(response)
      }).catch((err) => {
        sendResponse({ error: err.message })
      })
      return true

    case 'start-sharing':
      if (isConnectedToCluso) {
        clusoClient.send({ type: 'start-sharing' })
      }
      sendResponse({ success: true })
      break

    case 'stop-sharing':
      if (isConnectedToCluso) {
        clusoClient.send({ type: 'stop-sharing' })
      }
      sendResponse({ success: true })
      break

    case 'cursor-move':
      if (isConnectedToCluso) {
        clusoClient.send({
          type: 'cursor-move',
          // Element-relative positioning (most accurate)
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
      sendResponse({ success: true })
      break

    default:
      sendResponse({ error: `Unknown message type: ${message.type}` })
  }

  return true
})

// Initialize
console.log('[Cluso] Service worker starting...')
clusoClient.connect().then((connected) => {
  if (connected) {
    console.log('[Cluso] Running in connected mode')
  } else {
    console.log('[Cluso] Running in standalone mode')
  }
})

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Cluso] Extension installed/updated')
})
