/**
 * Floating Toolbar - Injected into web pages
 *
 * Creates a floating toolbar at the bottom of the viewport
 * with the same controls as the main Cluso app.
 */

import { INSPECTOR_OVERLAY_STYLES } from '@ai-cluso/shared-inspector'

let toolbarContainer: HTMLDivElement | null = null
let currentMode: 'none' | 'screen' | 'select' | 'move' = 'none'
let isMicActive = false
let isToolbarVisible = false
let isChatOpen = false
let isSending = false
let selectedElements: Array<{ id: string; tagName: string; label: string; fullInfo?: Record<string, unknown> }> = []

const TOOLBAR_STYLES = `
${INSPECTOR_OVERLAY_STYLES}

#cluso-toolbar-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  pointer-events: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#cluso-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

#cluso-toolbar .toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

#cluso-toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
}

#cluso-toolbar button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

#cluso-toolbar button.active {
  color: white;
}

#cluso-toolbar button.active.mode-screen {
  background: rgba(147, 51, 234, 0.8);
  box-shadow: 0 0 12px rgba(147, 51, 234, 0.4);
}

#cluso-toolbar button.active.mode-select {
  background: rgba(59, 130, 246, 0.8);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}

#cluso-toolbar button.active.mode-move {
  background: rgba(245, 158, 11, 0.8);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
}

#cluso-toolbar button svg {
  width: 20px;
  height: 20px;
}

#cluso-toolbar .separator {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 6px;
}

#cluso-toolbar .mic-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

#cluso-toolbar .mic-button:hover {
  background: rgba(59, 130, 246, 0.3);
}

#cluso-toolbar .mic-button.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

#cluso-toolbar .cluso-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #9333ea);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  font-weight: bold;
  font-size: 14px;
  color: white;
}

/* Connection indicator */
#cluso-toolbar .connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
}

#cluso-toolbar .connection-dot.connected {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
}

#cluso-toolbar .connection-dot.disconnected {
  background: #f59e0b;
}

/* Chat Panel */
#cluso-chat-panel {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  width: 380px;
  max-height: 0;
  overflow: hidden;
  background: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  margin-bottom: 8px;
  opacity: 0;
  transition: max-height 0.3s ease, opacity 0.2s ease, transform 0.3s ease;
}

#cluso-chat-panel.open {
  max-height: 400px;
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

#cluso-chat-panel .chat-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px 4px;
}

#cluso-chat-panel .chat-header button {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#cluso-chat-panel .chat-header button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

#cluso-chat-panel .chat-header button svg {
  width: 14px;
  height: 14px;
}

#cluso-chat-panel .chips-container {
  padding: 4px 12px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}

#cluso-chat-panel .chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  font-size: 11px;
  color: #60a5fa;
}

#cluso-chat-panel .chip .chip-tag {
  font-weight: 600;
  text-transform: lowercase;
}

#cluso-chat-panel .chip .chip-label {
  color: rgba(255, 255, 255, 0.7);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#cluso-chat-panel .chip .chip-remove {
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  margin-left: 2px;
}

#cluso-chat-panel .chip .chip-remove svg {
  width: 10px;
  height: 10px;
}

#cluso-chat-panel .chip .chip-remove:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

#cluso-chat-panel .empty-state {
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
}

#cluso-chat-panel .chat-input-container {
  padding: 8px 12px 12px;
  display: flex;
  gap: 8px;
}

#cluso-chat-panel .chat-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: white;
  font-size: 13px;
  outline: none;
}

#cluso-chat-panel .chat-input:focus {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

#cluso-chat-panel .chat-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

#cluso-chat-panel .send-button {
  width: 38px;
  height: 38px;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

#cluso-chat-panel .send-button:hover {
  background: #2563eb;
}

#cluso-chat-panel .send-button:disabled {
  background: rgba(59, 130, 246, 0.3);
  cursor: not-allowed;
}

/* Messages container */
#cluso-chat-panel .messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
}

#cluso-chat-panel .message {
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.4;
  max-width: 85%;
  word-wrap: break-word;
}

#cluso-chat-panel .message.user {
  background: #3b82f6;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

#cluso-chat-panel .message.assistant {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

#cluso-chat-panel .message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

/* Chat toggle button in toolbar */
#cluso-toolbar .chat-toggle {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  position: relative;
}

#cluso-toolbar .chat-toggle .badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

#cluso-toolbar .chat-toggle.has-items {
  color: #3b82f6;
}
`

const ICONS = {
  screen: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
  select: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>`,
  move: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>`,
  mic: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>`,
  chat: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
  close: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
  send: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"/></svg>`,
}

/**
 * Create the chat panel HTML
 */
function createChatPanelHTML(): string {
  const chipsHTML = selectedElements.length > 0
    ? selectedElements.map(el => `
        <div class="chip" data-id="${el.id}">
          <span class="chip-tag">&lt;${el.tagName}&gt;</span>
          <span class="chip-label">${el.label}</span>
          <button class="chip-remove" data-id="${el.id}" title="Remove">
            ${ICONS.close}
          </button>
        </div>
      `).join('')
    : '<div class="empty-state">Select elements to add them here</div>'

  return `
    <div id="cluso-chat-panel" data-cluso-ui="1">
      <div class="chat-header">
        <button id="cluso-chat-close" title="Close">
          ${ICONS.close}
        </button>
      </div>
      <div class="chips-container" id="cluso-chips">
        ${chipsHTML}
      </div>
      <div class="messages-container" id="cluso-messages"></div>
      <div class="chat-input-container">
        <input type="text" class="chat-input" id="cluso-chat-input" placeholder="Ask about these elements..." />
        <button class="send-button" id="cluso-chat-send" title="Send">
          ${ICONS.send}
        </button>
      </div>
    </div>
  `
}

/**
 * Create the toolbar HTML
 */
function createToolbarHTML(isConnected: boolean): string {
  const badgeHTML = selectedElements.length > 0
    ? `<span class="badge">${selectedElements.length}</span>`
    : ''
  const hasItemsClass = selectedElements.length > 0 ? 'has-items' : ''

  return `
    ${createChatPanelHTML()}
    <div id="cluso-toolbar" data-cluso-ui="1">
      <div class="cluso-logo">C</div>
      <div class="toolbar-group">
        <button id="cluso-btn-screen" title="Screenshot mode" data-mode="screen">
          ${ICONS.screen}
        </button>
        <button id="cluso-btn-select" title="Select element" data-mode="select">
          ${ICONS.select}
        </button>
        <button id="cluso-btn-move" title="Move element" data-mode="move">
          ${ICONS.move}
        </button>
      </div>
      <div class="separator"></div>
      <button id="cluso-btn-chat" class="chat-toggle ${hasItemsClass}" title="View selected elements">
        ${ICONS.chat}
        ${badgeHTML}
      </button>
      <button id="cluso-btn-mic" class="mic-button" title="Voice input">
        ${ICONS.mic}
      </button>
      <div class="connection-dot ${isConnected ? 'connected' : 'disconnected'}" title="${isConnected ? 'Connected to Cluso' : 'Standalone mode'}"></div>
    </div>
  `
}

/**
 * Inject the toolbar into the page
 */
export function showToolbar(): void {
  if (toolbarContainer) {
    toolbarContainer.style.display = 'block'
    isToolbarVisible = true
    return
  }

  // Inject styles
  const style = document.createElement('style')
  style.id = 'cluso-toolbar-styles'
  style.textContent = TOOLBAR_STYLES
  document.head.appendChild(style)

  // Create container
  toolbarContainer = document.createElement('div')
  toolbarContainer.id = 'cluso-toolbar-container'
  toolbarContainer.setAttribute('data-cluso-ui', '1')

  // Check connection status
  chrome.runtime.sendMessage({ type: 'get-connection-status' }, (response) => {
    const isConnected = response?.connected ?? false
    if (toolbarContainer) {
      toolbarContainer.innerHTML = createToolbarHTML(isConnected)
      document.body.appendChild(toolbarContainer)
      attachEventListeners()
    }
  })

  isToolbarVisible = true
}

/**
 * Hide the toolbar
 */
export function hideToolbar(): void {
  if (toolbarContainer) {
    toolbarContainer.style.display = 'none'
  }
  isToolbarVisible = false
  setMode('none')
}

/**
 * Toggle toolbar visibility
 */
export function toggleToolbar(): boolean {
  if (isToolbarVisible) {
    hideToolbar()
  } else {
    showToolbar()
  }
  return isToolbarVisible
}

/**
 * Toggle chat panel visibility
 */
function toggleChat(): void {
  const panel = document.getElementById('cluso-chat-panel')
  if (!panel) return

  isChatOpen = !isChatOpen
  panel.classList.toggle('open', isChatOpen)

  if (isChatOpen) {
    // Focus the input when opening
    setTimeout(() => {
      const input = document.getElementById('cluso-chat-input') as HTMLInputElement
      input?.focus()
    }, 100)
  }
}

/**
 * Update the chips display
 */
function updateChipsDisplay(): void {
  const chipsContainer = document.getElementById('cluso-chips')
  const chatToggle = document.getElementById('cluso-btn-chat')

  if (chipsContainer) {
    if (selectedElements.length > 0) {
      chipsContainer.innerHTML = selectedElements.map(el => `
        <div class="chip" data-id="${el.id}">
          <span class="chip-tag">&lt;${el.tagName}&gt;</span>
          <span class="chip-label">${el.label}</span>
          <button class="chip-remove" data-id="${el.id}" title="Remove">
            ${ICONS.close}
          </button>
        </div>
      `).join('')

      // Re-attach remove listeners
      chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const id = (btn as HTMLElement).dataset.id
          if (id) removeSelectedElement(id)
        })
      })
    } else {
      chipsContainer.innerHTML = '<div class="empty-state">Select elements to add them here</div>'
    }
  }

  // Update badge
  if (chatToggle) {
    const existingBadge = chatToggle.querySelector('.badge')
    if (selectedElements.length > 0) {
      chatToggle.classList.add('has-items')
      if (existingBadge) {
        existingBadge.textContent = String(selectedElements.length)
      } else {
        const badge = document.createElement('span')
        badge.className = 'badge'
        badge.textContent = String(selectedElements.length)
        chatToggle.appendChild(badge)
      }
    } else {
      chatToggle.classList.remove('has-items')
      existingBadge?.remove()
    }
  }
}

/**
 * Remove a selected element by ID
 */
function removeSelectedElement(id: string): void {
  selectedElements = selectedElements.filter(el => el.id !== id)
  updateChipsDisplay()
}

/**
 * Attach event listeners to toolbar buttons
 */
function attachEventListeners(): void {
  const btnScreen = document.getElementById('cluso-btn-screen')
  const btnSelect = document.getElementById('cluso-btn-select')
  const btnMove = document.getElementById('cluso-btn-move')
  const btnMic = document.getElementById('cluso-btn-mic')
  const btnChat = document.getElementById('cluso-btn-chat')
  const btnChatClose = document.getElementById('cluso-chat-close')
  const btnChatSend = document.getElementById('cluso-chat-send')
  const chatInput = document.getElementById('cluso-chat-input') as HTMLInputElement

  btnScreen?.addEventListener('click', () => toggleMode('screen'))
  btnSelect?.addEventListener('click', () => toggleMode('select'))
  btnMove?.addEventListener('click', () => toggleMode('move'))
  btnMic?.addEventListener('click', toggleMic)
  btnChat?.addEventListener('click', toggleChat)
  btnChatClose?.addEventListener('click', toggleChat)

  // Chat input handling
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  })
  btnChatSend?.addEventListener('click', handleChatSend)

  // Chip remove buttons
  document.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id
      if (id) removeSelectedElement(id)
    })
  })

  // ESC key to cancel mode or close chat
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isChatOpen) {
        toggleChat()
      } else if (currentMode !== 'none') {
        setMode('none')
      }
    }
  })
}

/**
 * Add a message to the chat UI
 */
function addMessage(text: string, type: 'user' | 'assistant' | 'error'): void {
  const container = document.getElementById('cluso-messages')
  if (!container) return

  const msg = document.createElement('div')
  msg.className = `message ${type}`
  msg.textContent = text
  container.appendChild(msg)

  // Scroll to bottom
  container.scrollTop = container.scrollHeight
}

/**
 * Handle sending a chat message
 */
function handleChatSend(): void {
  const input = document.getElementById('cluso-chat-input') as HTMLInputElement
  const sendBtn = document.getElementById('cluso-chat-send') as HTMLButtonElement
  if (!input?.value.trim() || isSending) return

  const message = input.value.trim()
  input.value = ''

  // Add user message to UI
  addMessage(message, 'user')

  // Show loading state
  isSending = true
  if (sendBtn) {
    sendBtn.disabled = true
    sendBtn.innerHTML = '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/></svg>'
  }

  // Send to background for processing (will proxy via Cluso socket or direct API)
  chrome.runtime.sendMessage({
    type: 'chat-message',
    message,
    elements: selectedElements.map(el => ({
      ...el,
      fullInfo: el.fullInfo,
    })),
    pageUrl: window.location.href,
    pageTitle: document.title,
  }, (response) => {
    // Reset loading state
    isSending = false
    if (sendBtn) {
      sendBtn.disabled = false
      sendBtn.innerHTML = ICONS.send
    }

    if (response?.error) {
      console.error('[Cluso] Chat error:', response.error)
      addMessage(response.error, 'error')
    } else if (response?.reply) {
      console.log('[Cluso] Chat response:', response.reply)
      addMessage(response.reply, 'assistant')
    }
  })
}

/**
 * Toggle cursor sharing on/off
 */
function toggleSharing(): void {
  isSharingEnabled = !isSharingEnabled

  const btn = document.getElementById('cluso-btn-share')
  if (btn) {
    btn.classList.toggle('active', isSharingEnabled)
    btn.classList.toggle('mode-share', isSharingEnabled)
  }

  if (isSharingEnabled) {
    startCursorTracking()
    chrome.runtime.sendMessage({ type: 'start-sharing' })
    console.log('[Cluso] Cursor sharing enabled')
  } else {
    stopCursorTracking()
    chrome.runtime.sendMessage({ type: 'stop-sharing' })
    removeAllRemoteCursors()
    console.log('[Cluso] Cursor sharing disabled')
  }
}

/**
 * Start tracking and broadcasting cursor position
 */
function startCursorTracking(): void {
  if (cursorTrackingInterval) return

  // Track mouse movement
  document.addEventListener('mousemove', handleMouseMove)

  // Listen for remote cursor updates
  chrome.runtime.onMessage.addListener(handleRemoteCursor)
}

/**
 * Stop cursor tracking
 */
function stopCursorTracking(): void {
  document.removeEventListener('mousemove', handleMouseMove)
  if (cursorTrackingInterval) {
    clearInterval(cursorTrackingInterval)
    cursorTrackingInterval = null
  }
}

let lastCursorUpdate = 0
let cursorMoveCount = 0

/**
 * Generate a unique selector for an element
 */
function getElementSelector(el: Element): string {
  // Try ID first
  if (el.id) return `#${el.id}`

  // Try unique class combination
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('hover') && !c.startsWith('active'))
    if (classes.length > 0) {
      const selector = `${el.tagName.toLowerCase()}.${classes.join('.')}`
      if (document.querySelectorAll(selector).length === 1) return selector
    }
  }

  // Try data attributes
  const dataAttrs = Array.from(el.attributes).filter(a => a.name.startsWith('data-'))
  for (const attr of dataAttrs) {
    const selector = `${el.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`
    if (document.querySelectorAll(selector).length === 1) return selector
  }

  // Generate path-based selector
  const path: string[] = []
  let current: Element | null = el
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      path.unshift(`#${current.id}`)
      break
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }
    path.unshift(selector)
    current = parent
  }
  return path.join(' > ')
}

/**
 * Find the most specific interactive/content element at position
 */
function findAnchorElement(x: number, y: number): Element | null {
  const elements = document.elementsFromPoint(x, y)

  // Skip our UI elements
  for (const el of elements) {
    if (el.closest('[data-cluso-ui]') || el.closest('#cluso-toolbar-container')) continue

    // Prefer interactive/content elements
    const tag = el.tagName.toLowerCase()
    const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tag)
    const isContent = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'td', 'th', 'img', 'video'].includes(tag)
    const hasId = !!el.id
    const hasClasses = el.className && typeof el.className === 'string' && el.className.trim().length > 0

    if (isInteractive || isContent || hasId || hasClasses) {
      return el
    }
  }

  // Fall back to first non-UI element
  for (const el of elements) {
    if (!el.closest('[data-cluso-ui]') && !el.closest('#cluso-toolbar-container')) {
      return el
    }
  }

  return null
}

function handleMouseMove(e: MouseEvent): void {
  // Throttle to 30fps
  const now = Date.now()
  if (now - lastCursorUpdate < 33) return
  lastCursorUpdate = now

  cursorMoveCount++

  // Find anchor element under cursor
  const anchorElement = findAnchorElement(e.clientX, e.clientY)

  let elementAnchor: {
    selector: string
    relativeX: number
    relativeY: number
    elementText?: string
  } | null = null

  if (anchorElement) {
    const rect = anchorElement.getBoundingClientRect()
    // Calculate relative position within element (0-1)
    const relativeX = (e.clientX - rect.left) / rect.width
    const relativeY = (e.clientY - rect.top) / rect.height

    // Only anchor if cursor is actually inside element bounds
    if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
      elementAnchor = {
        selector: getElementSelector(anchorElement),
        relativeX,
        relativeY,
        // Include text snippet for verification
        elementText: anchorElement.textContent?.slice(0, 50)?.trim() || undefined,
      }
    }
  }

  // Send cursor data with element anchoring
  chrome.runtime.sendMessage({
    type: 'cursor-move',
    // Element-relative positioning (primary - most accurate)
    elementAnchor,
    // Document-relative position (fallback)
    pageX: e.pageX,
    pageY: e.pageY,
    // Viewport-relative position (fallback)
    clientX: e.clientX,
    clientY: e.clientY,
    // Viewport percentage (breakpoint-aware fallback)
    viewportPercentX: e.clientX / window.innerWidth,
    viewportPercentY: e.clientY / window.innerHeight,
    // Scroll position
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    // Viewport dimensions
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    // Document dimensions
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    // Page URL for matching
    pageUrl: window.location.href,
    // Timestamp for interpolation
    timestamp: now,
  })
}

/**
 * Handle incoming remote cursor positions
 */
interface RemoteCursorMessage {
  type: string
  userId?: string
  userName?: string
  color?: string
  // Element-relative positioning (most accurate)
  elementAnchor?: {
    selector: string
    relativeX: number
    relativeY: number
    elementText?: string
  }
  // Viewport percentage (breakpoint-aware fallback)
  viewportPercentX?: number
  viewportPercentY?: number
  // Full positioning data
  pageX?: number
  pageY?: number
  clientX?: number
  clientY?: number
  scrollX?: number
  scrollY?: number
  viewportWidth?: number
  viewportHeight?: number
  timestamp?: number
  // Legacy format
  x?: number
  y?: number
}

// Store last keyframes for interpolation
const cursorKeyframes = new Map<string, { x: number; y: number; timestamp: number }[]>()

function handleRemoteCursor(message: RemoteCursorMessage): void {
  if (message.type !== 'remote-cursor' || !isSharingEnabled) return

  const { userId, userName, color, elementAnchor } = message

  if (!userId) return

  let targetX: number
  let targetY: number
  let anchoredToElement = false

  // Priority 1: Element-relative positioning (most accurate across breakpoints)
  if (elementAnchor) {
    try {
      const element = document.querySelector(elementAnchor.selector)
      if (element) {
        const rect = element.getBoundingClientRect()
        targetX = rect.left + (rect.width * elementAnchor.relativeX)
        targetY = rect.top + (rect.height * elementAnchor.relativeY)
        anchoredToElement = true
      }
    } catch {
      // Invalid selector, fall through to other methods
    }
  }

  // Priority 2: Viewport percentage (works across different screen sizes)
  if (!anchoredToElement && message.viewportPercentX !== undefined && message.viewportPercentY !== undefined) {
    targetX = message.viewportPercentX * window.innerWidth
    targetY = message.viewportPercentY * window.innerHeight
  }

  // Priority 3: Direct viewport coordinates (fallback)
  if (targetX === undefined || targetY === undefined) {
    targetX = message.clientX ?? message.x ?? 0
    targetY = message.clientY ?? message.y ?? 0
  }

  // Store keyframe for interpolation
  const keyframes = cursorKeyframes.get(userId) || []
  keyframes.push({ x: targetX, y: targetY, timestamp: message.timestamp || Date.now() })
  // Keep only last 5 keyframes
  if (keyframes.length > 5) keyframes.shift()
  cursorKeyframes.set(userId, keyframes)

  let cursor = remoteCursors.get(userId)

  if (!cursor) {
    // Create new cursor element
    cursor = document.createElement('div')
    cursor.className = 'cluso-remote-cursor'
    cursor.setAttribute('data-cluso-ui', '1')
    cursor.style.setProperty('--cursor-color', color || '#8b5cf6') // Purple for Cluso
    cursor.innerHTML = `
      <div class="cursor-pointer"></div>
      <div class="cursor-label">${userName || 'Cluso'}</div>
    `
    document.body.appendChild(cursor)
    remoteCursors.set(userId, cursor)
  }

  // Position cursor
  cursor.style.transform = `translate(${targetX}px, ${targetY}px)`

  // Update label
  const labelEl = cursor.querySelector('.cursor-label')
  if (labelEl) {
    let label = userName || 'Cluso'
    // Show anchor indicator when element-anchored
    if (anchoredToElement) {
      label += ' 📍'
    }
    // Show scroll diff if not anchored
    else if (message.scrollY !== undefined) {
      const myScrollY = window.scrollY
      const scrollDiff = Math.abs(message.scrollY - myScrollY)
      if (scrollDiff > 50) {
        const direction = message.scrollY > myScrollY ? '↓' : '↑'
        label += ` ${direction}${Math.round(scrollDiff)}px`
      }
    }
    labelEl.textContent = label
  }
}

/**
 * Remove all remote cursors
 */
function removeAllRemoteCursors(): void {
  remoteCursors.forEach((cursor) => cursor.remove())
  remoteCursors.clear()
}

/**
 * Toggle a mode on/off
 */
function toggleMode(mode: 'screen' | 'select' | 'move'): void {
  if (currentMode === mode) {
    setMode('none')
  } else {
    setMode(mode)
  }
}

/**
 * Set the current mode
 */
function setMode(mode: 'none' | 'screen' | 'select' | 'move'): void {
  const previousMode = currentMode
  currentMode = mode

  // Update button states
  const buttons = ['screen', 'select', 'move']
  buttons.forEach((btn) => {
    const el = document.getElementById(`cluso-btn-${btn}`)
    if (el) {
      el.classList.remove('active', 'mode-screen', 'mode-select', 'mode-move')
      if (mode === btn) {
        el.classList.add('active', `mode-${btn}`)
      }
    }
  })

  // Deactivate previous mode
  if (previousMode === 'select') {
    chrome.runtime.sendMessage({ type: 'deactivate-inspector' })
  } else if (previousMode === 'move') {
    chrome.runtime.sendMessage({ type: 'deactivate-move' })
  }

  // Activate new mode
  if (mode === 'select') {
    chrome.runtime.sendMessage({ type: 'activate-inspector' })
  } else if (mode === 'move') {
    chrome.runtime.sendMessage({ type: 'activate-move' })
  }

  // Update cursor
  if (mode === 'select') {
    document.body.style.cursor = 'crosshair'
  } else if (mode === 'screen') {
    document.body.style.cursor = 'cell'
  } else if (mode === 'move') {
    document.body.style.cursor = 'move'
  } else {
    document.body.style.cursor = ''
  }
}

/**
 * Toggle microphone
 */
function toggleMic(): void {
  isMicActive = !isMicActive
  const btn = document.getElementById('cluso-btn-mic')
  if (btn) {
    btn.classList.toggle('active', isMicActive)
  }

  // TODO: Implement voice capture
  chrome.runtime.sendMessage({
    type: isMicActive ? 'start-voice' : 'stop-voice',
  })
}

/**
 * Update connection status indicator
 */
export function updateConnectionStatus(connected: boolean): void {
  const dot = toolbarContainer?.querySelector('.connection-dot')
  if (dot) {
    dot.classList.toggle('connected', connected)
    dot.classList.toggle('disconnected', !connected)
    dot.setAttribute('title', connected ? 'Connected to Cluso' : 'Standalone mode')
  }
}

/**
 * Check if toolbar is visible
 */
export function isVisible(): boolean {
  return isToolbarVisible
}

/**
 * Get current mode
 */
export function getMode(): string {
  return currentMode
}

/**
 * Add a selected element to the chat panel
 */
export function addSelectedElement(element: {
  tagName: string
  id?: string
  className?: string
  text?: string
  xpath?: string
  rect?: { top: number; left: number; width: number; height: number }
  computedStyle?: Record<string, string>
}): void {
  // Generate a unique ID for this selection
  const uniqueId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Create a label from the element info
  let label = ''
  if (element.id) {
    label = `#${element.id}`
  } else if (element.className) {
    const firstClass = element.className.split(' ')[0]
    label = `.${firstClass}`
  } else if (element.text) {
    label = element.text.substring(0, 20) + (element.text.length > 20 ? '...' : '')
  } else {
    label = element.tagName.toLowerCase()
  }

  selectedElements.push({
    id: uniqueId,
    tagName: element.tagName.toLowerCase(),
    label,
    fullInfo: element as Record<string, unknown>,
  })

  updateChipsDisplay()

  // Auto-open chat panel when first element is added
  if (selectedElements.length === 1 && !isChatOpen) {
    toggleChat()
  }
}

/**
 * Clear all selected elements
 */
export function clearSelectedElements(): void {
  selectedElements = []
  updateChipsDisplay()
}

/**
 * Get selected elements count
 */
export function getSelectedElementsCount(): number {
  return selectedElements.length
}
