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
`

const ICONS = {
  screen: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
  select: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>`,
  move: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>`,
  mic: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>`,
}

/**
 * Create the toolbar HTML
 */
function createToolbarHTML(isConnected: boolean): string {
  return `
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
 * Attach event listeners to toolbar buttons
 */
function attachEventListeners(): void {
  const btnScreen = document.getElementById('cluso-btn-screen')
  const btnSelect = document.getElementById('cluso-btn-select')
  const btnMove = document.getElementById('cluso-btn-move')
  const btnMic = document.getElementById('cluso-btn-mic')

  btnScreen?.addEventListener('click', () => toggleMode('screen'))
  btnSelect?.addEventListener('click', () => toggleMode('select'))
  btnMove?.addEventListener('click', () => toggleMode('move'))
  btnMic?.addEventListener('click', toggleMic)

  // ESC key to cancel mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentMode !== 'none') {
      setMode('none')
    }
  })
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

  // Send message to content script handler
  if (mode === 'select') {
    chrome.runtime.sendMessage({ type: 'activate-inspector' })
  } else {
    chrome.runtime.sendMessage({ type: 'deactivate-inspector' })
  }

  // Update cursor
  if (mode === 'select') {
    document.body.style.cursor = 'crosshair'
  } else if (mode === 'screen') {
    document.body.style.cursor = 'cell'
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
