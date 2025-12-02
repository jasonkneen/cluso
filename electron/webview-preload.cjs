console.log('=== WEBVIEW PRELOAD LOADED ===')

// Import bippy for source location tracking
// Note: We need to access it from the page context, not the isolated preload context
let bippyApi = null

// Wait for page to load, then access bippy from page context
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload] DOM loaded, checking for source location API...')

  // Try to access the page's window object via executeJavaScript
  setTimeout(() => {
    try {
      // Check if source location API is available in page context
      const script = document.createElement('script')
      script.textContent = `
        (function() {
          if (window.__SOURCE_LOCATION__) {
            console.log('[Page] Source location API found!');
            window.__PRELOAD_SOURCE_READY__ = true;
          } else {
            console.warn('[Page] Source location API not found');
          }
        })();
      `
      document.documentElement.appendChild(script)
      script.remove()
    } catch (e) {
      console.error('[Preload] Failed to check source API:', e)
    }
  }, 500)
})

const { ipcRenderer } = require('electron')

console.log('ipcRenderer available:', !!ipcRenderer)

// Inspector state
let currentSelected = null
let isInspectorActive = false
let isScreenshotActive = false
let isMoveActive = false
let multipleMatches = [] // Store multiple AI-selected elements
let numberBadges = [] // Store number badge elements

// Move mode state - support multiple overlays
let moveOverlays = [] // Array of { overlay, element, originalRect, elementData, positionLabel }
let activeMoveOverlay = null // Currently being dragged/resized
let isMoveDragging = false
let isResizing = false
let resizeHandle = null
let moveStartX = 0
let moveStartY = 0

// CSS injection for hover/selection effects
// Inject CSS when DOM is ready
function injectStyles() {
  const style = document.createElement('style')
  style.id = 'inspector-styles'
  style.textContent = `
    .inspector-hover-target {
      outline: 2px dashed #3b82f6 !important;
      outline-offset: -2px !important;
      cursor: crosshair !important;
      position: relative;
      z-index: 10000;
    }
    .inspector-selected-target {
      position: relative !important;
      z-index: 9999 !important;
    }
    .inspector-selected-target::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px dashed rgba(59, 130, 246, 0.8);
      pointer-events: none;
      z-index: -1;
      border-radius: 4px;
    }
    .screenshot-hover-target {
      outline: 2px dashed #9333ea !important;
      outline-offset: -2px !important;
      cursor: crosshair !important;
      background-color: rgba(147, 51, 234, 0.1) !important;
      position: relative;
      z-index: 10000;
    }
    .element-number-badge {
      position: absolute;
      bottom: -10px;
      right: -10px;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      background: rgba(59, 130, 246, 0.85) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      color: white !important;
      border-radius: 14px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.3) inset !important;
      z-index: 10001 !important;
      pointer-events: none !important;
    }
    .element-number-badge::before {
      content: '';
    }

    /* Drag-drop glow effect for selected elements */
    .inspector-drag-over {
      outline: 3px solid #22c55e !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.5), 0 0 40px 10px rgba(34, 197, 94, 0.3) !important;
      transition: all 0.15s ease-out !important;
    }

    .drop-zone-label {
      position: fixed !important;
      padding: 8px 16px !important;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
      color: white !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
      z-index: 100000 !important;
      pointer-events: none !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      animation: dropLabelPulse 1s ease-in-out infinite !important;
    }

    @keyframes dropLabelPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.02); opacity: 0.95; }
    }

    .drop-zone-label-icon {
      width: 16px !important;
      height: 16px !important;
      stroke: white !important;
      stroke-width: 2 !important;
      fill: none !important;
    }

    /* Inline editing styles */
    .inspector-inline-editing {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px !important;
      min-height: 1em !important;
    }

    .inspector-edit-toolbar {
      position: fixed !important;
      display: flex !important;
      gap: 4px !important;
      z-index: 100001 !important;
      background: rgba(255, 255, 255, 0.95) !important;
      padding: 4px !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      backdrop-filter: blur(8px) !important;
    }

    .inspector-edit-btn {
      width: 28px !important;
      height: 28px !important;
      border: none !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.15s ease !important;
    }

    .inspector-edit-btn.accept {
      background: #22c55e !important;
      color: white !important;
    }

    .inspector-edit-btn.accept:hover {
      background: #16a34a !important;
    }

    .inspector-edit-btn.reject {
      background: #ef4444 !important;
      color: white !important;
    }

    .inspector-edit-btn.reject:hover {
      background: #dc2626 !important;
    }

    /* Move mode styles */
    .move-hover-target {
      outline: 2px dashed #f97316 !important;
      outline-offset: -2px !important;
      cursor: move !important;
      background-color: rgba(249, 115, 22, 0.1) !important;
      position: relative;
      z-index: 10000;
    }

    .move-original-hidden {
      visibility: hidden !important;
    }

    .move-floating-overlay {
      position: fixed !important;
      border: none !important;
      outline: 2px solid #f97316 !important;
      outline-offset: 2px !important;
      background: transparent !important;
      box-shadow: none !important;
      cursor: move !important;
      z-index: 100000 !important;
      overflow: visible !important;
    }

    .move-resize-handle {
      position: absolute !important;
      width: 12px !important;
      height: 12px !important;
      background: #f97316 !important;
      border: 2px solid white !important;
      border-radius: 50% !important;
      z-index: 100001 !important;
    }

    .move-resize-handle.tl { top: -10px; left: -10px; cursor: nw-resize !important; }
    .move-resize-handle.tr { top: -10px; right: -10px; cursor: ne-resize !important; }
    .move-resize-handle.bl { bottom: -10px; left: -10px; cursor: sw-resize !important; }
    .move-resize-handle.br { bottom: -10px; right: -10px; cursor: se-resize !important; }

    .move-position-label {
      position: fixed !important;
      padding: 6px 12px !important;
      background: rgba(249, 115, 22, 0.95) !important;
      color: white !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      z-index: 100002 !important;
      pointer-events: none !important;
      white-space: nowrap !important;
    }
  `

  // Append to head if available, otherwise body, otherwise documentElement
  const target = document.head || document.body || document.documentElement
  if (target) {
    target.appendChild(style)
    console.log('Inspector styles injected into', target.tagName)
  } else {
    console.error('No DOM target for styles!')
  }
}

// Try to inject immediately, or wait for DOMContentLoaded
if (document.head || document.body) {
  injectStyles()
} else {
  document.addEventListener('DOMContentLoaded', injectStyles, { once: true })
}

// Console interception
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

function sendLog(level, args) {
  try {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg) } catch(e) { return String(arg) }
      }
      return String(arg)
    }).join(' ')

    ipcRenderer.sendToHost('console-log', { level, message, timestamp: Date.now() })
  } catch (e) {
    // ignore
  }
}

console.log = function(...args) {
  originalLog.apply(console, args)
  sendLog('log', args)
}
console.warn = function(...args) {
  originalWarn.apply(console, args)
  sendLog('warn', args)
}
console.error = function(...args) {
  originalError.apply(console, args)
  sendLog('error', args)
}

// Element summary helper - enhanced with more context
function getElementSummary(el) {
  // Get computed styles for visibility info
  const computedStyle = window.getComputedStyle(el)

  // Get outer HTML (truncated for large elements)
  let outerHTML = ''
  try {
    outerHTML = el.outerHTML
    if (outerHTML.length > 2000) {
      // For large elements, just get the opening tag
      const match = outerHTML.match(/^<[^>]+>/)
      outerHTML = match ? match[0] + '...(truncated)' : outerHTML.substring(0, 500)
    }
  } catch (e) {
    outerHTML = `<${el.tagName.toLowerCase()}>`
  }

  // Get attributes
  const attributes = {}
  for (const attr of el.attributes || []) {
    attributes[attr.name] = attr.value
  }

  // Source location will be added asynchronously by getSourceLocation function

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className : '',
    text: el.innerText ? el.innerText.substring(0, 200) : '',
    outerHTML: outerHTML,
    attributes: attributes,
    computedStyle: {
      display: computedStyle.display,
      position: computedStyle.position,
      visibility: computedStyle.visibility,
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      fontSize: computedStyle.fontSize,
    }
    // Note: sourceLocation is added asynchronously by the caller via getSourceLocation()
  }
}

// Get XPath of element
function getXPath(el) {
  if (!el) return ''
  if (el.id) return `//*[@id="${el.id}"]`

  const parts = []
  while (el && el.nodeType === 1) {
    let idx = 1
    for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
      if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++
    }
    parts.unshift(`${el.tagName.toLowerCase()}[${idx}]`)
    el = el.parentNode
  }
  return '/' + parts.join('/')
}

// Helper to check if element is part of any move overlay
function isPartOfMoveOverlay(element) {
  return moveOverlays.some(m => m.overlay === element || m.overlay.contains(element) || m.positionLabel === element)
}

// Mouse events for inspector
document.addEventListener('mouseover', function(e) {
  if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return
  if (isEditing) return // Don't highlight while inline editing
  if (isPartOfMoveOverlay(e.target)) return // Don't highlight move overlays
  e.stopPropagation()

  if (isInspectorActive) {
    e.target.classList.add('inspector-hover-target')
  } else if (isScreenshotActive) {
    e.target.classList.add('screenshot-hover-target')
  } else if (isMoveActive) {
    e.target.classList.add('move-hover-target')
  }

  // Send hover info to host for element label display
  const summary = getElementSummary(e.target)
  const rect = e.target.getBoundingClientRect()
  ipcRenderer.sendToHost('inspector-hover', {
    element: summary,
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }
  })
}, true)

document.addEventListener('mouseout', function(e) {
  if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return
  if (isEditing) return // Don't process while inline editing
  if (isPartOfMoveOverlay(e.target)) return // Don't process move overlays
  e.stopPropagation()
  e.target.classList.remove('inspector-hover-target')
  e.target.classList.remove('screenshot-hover-target')
  e.target.classList.remove('move-hover-target')

  // Clear hover info
  ipcRenderer.sendToHost('inspector-hover-end')
}, true)

document.addEventListener('click', async function(e) {
  console.log('[Inspector] Click detected, inspectorActive:', isInspectorActive, 'screenshotActive:', isScreenshotActive, 'moveActive:', isMoveActive)

  if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return
  if (isEditing) return // Don't select new elements while inline editing

  e.preventDefault()
  e.stopPropagation()

  const summary = getElementSummary(e.target)
  const rect = e.target.getBoundingClientRect()
  const xpath = getXPath(e.target)

  // Get source location asynchronously
  const sourceLocation = await getSourceLocation(e.target)

  console.log('[Inspector] Element selected:', summary.tagName, summary.id || summary.className, 'source:', sourceLocation?.summary || 'none')

  if (isInspectorActive) {
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
    }
    e.target.classList.add('inspector-selected-target')
    e.target.classList.remove('inspector-hover-target')
    currentSelected = e.target

    const payload = {
      element: { ...summary, xpath, sourceLocation },
      x: e.clientX,
      y: e.clientY,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    }
    console.log('[Inspector] Sending inspector-select:', payload.element.tagName, 'source:', payload.element.sourceLocation?.summary || 'none')
    ipcRenderer.sendToHost('inspector-select', payload)
  } else if (isScreenshotActive) {
    e.target.classList.remove('screenshot-hover-target')

    const payload = {
      element: { ...summary, xpath, sourceLocation },
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    }
    console.log('[Inspector] Sending screenshot-select:', payload.element.tagName)
    ipcRenderer.sendToHost('screenshot-select', payload)
  } else if (isMoveActive) {
    // Move mode - create floating replica for multiple elements
    // Ignore clicks on existing overlays (handled by overlay's own mousedown)
    if (isPartOfMoveOverlay(e.target)) {
      console.log('[Move] Ignoring click on existing overlay')
      return
    }
    // Check if this element already has an overlay
    const existingOverlay = moveOverlays.find(m => m.element === e.target)
    if (existingOverlay) {
      console.log('[Move] Element already has overlay')
      return
    }
    e.target.classList.remove('move-hover-target')
    createMoveOverlay(e.target, summary, xpath, sourceLocation)
  }
}, true)

// Listen for mode changes from host
ipcRenderer.on('set-inspector-mode', (event, active) => {
  console.log('[Inspector] set-inspector-mode received:', active)
  isInspectorActive = active
  if (active) isScreenshotActive = false

  if (!active) {
    // Clean up all inspector UI when turning off
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
      currentSelected.classList.remove('inspector-drag-over')
      currentSelected = null
    }
    hideDropLabel()
  }
})

ipcRenderer.on('set-screenshot-mode', (event, active) => {
  console.log('[Inspector] set-screenshot-mode received:', active)
  isScreenshotActive = active
  if (active) {
    isInspectorActive = false
    // DON'T disable move mode or cleanup overlays - allow screenshot with moved elements
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
      currentSelected = null
    }
  }
})

ipcRenderer.on('set-move-mode', (event, active) => {
  console.log('[Inspector] set-move-mode received:', active)
  isMoveActive = active
  if (active) {
    isInspectorActive = false
    // DON'T disable screenshot mode - allow both to work together
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
      currentSelected = null
    }
  } else {
    cleanupAllMoveOverlays()
  }
})

// Clear selection on request
ipcRenderer.on('clear-selection', () => {
  clearNumberBadges()
  if (currentSelected) {
    currentSelected.classList.remove('inspector-selected-target')
    currentSelected = null
  }
})

// Clear number badges helper
function clearNumberBadges() {
  numberBadges.forEach(badge => badge.remove())
  numberBadges = []
  multipleMatches.forEach(el => el.classList.remove('inspector-selected-target'))
  multipleMatches = []
}

// Create number badge for element
function createNumberBadge(number) {
  const badge = document.createElement('div')
  badge.className = 'element-number-badge'
  badge.textContent = number
  return badge
}

// Get source location from page context (async)
// This tries multiple approaches:
// 1. Custom __SOURCE_LOCATION__ API (if app has bippy installed)
// 2. React's internal _debugSource (works in dev mode for any React app)
// 3. React DevTools hook fiber data
function getSourceLocation(el) {
  return new Promise((resolve) => {
    try {
      const uniqueId = `source-${Date.now()}-${Math.random().toString(36).substring(7)}`
      el.setAttribute('data-source-id', uniqueId)

      // Inject script into page context
      const script = document.createElement('script')
      script.textContent = `
        (async function() {
          const el = document.querySelector('[data-source-id="${uniqueId}"]');
          if (!el) return;

          let sourceInfo = null;

          // Approach 1: Custom SOURCE_LOCATION API (bippy-based)
          if (window.__SOURCE_LOCATION__ && !sourceInfo) {
            try {
              sourceInfo = await window.__SOURCE_LOCATION__.getElementSourceLocation(el);
              if (sourceInfo) {
                console.log('[Page] Source from bippy API:', sourceInfo.summary);
              }
            } catch (e) {
              console.log('[Page] bippy API error:', e.message);
            }
          }

          // Approach 2: React 19 _debugStack (stack trace based)
          // React 19 removed _debugSource and uses stack traces instead
          if (!sourceInfo) {
            try {
              for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                  let fiber = el[key];
                  console.log('[Page] Found fiber:', key);

                  // Walk up to find component with stack info
                  let depth = 0;
                  while (fiber && depth < 20 && !sourceInfo) {
                    depth++;

                    // React 19: check _debugStack (Error object with stack trace)
                    if (fiber._debugStack) {
                      const stack = fiber._debugStack.stack || String(fiber._debugStack);
                      console.log('[Page] Found _debugStack at depth', depth);

                      // Parse stack trace to extract source location
                      // Format: "    at ComponentName (http://localhost:4000/src/File.tsx:123:45)"
                      // Or: "    at http://localhost:4000/src/File.tsx:123:45"
                      const lines = stack.split('\\n');
                      for (const line of lines) {
                        // Match: ComponentName (url:line:col) or just (url:line:col)
                        const match = line.match(/at\\s+(?:([\\w$]+)\\s+)?\\(?(?:https?:\\/\\/[^/]+)?(\\/[^:]+):([0-9]+):([0-9]+)\\)?/);
                        if (match) {
                          const [, name, file, lineNum, col] = match;
                          // Skip node_modules
                          if (file && !file.includes('node_modules')) {
                            console.log('[Page] Parsed stack:', { name, file, lineNum, col });
                            sourceInfo = {
                              sources: [{
                                name: name || fiber.type?.name || 'Component',
                                file: file,
                                line: parseInt(lineNum, 10),
                                column: parseInt(col, 10)
                              }],
                              summary: file + ':' + lineNum
                            };
                            break;
                          }
                        }
                      }
                      if (sourceInfo) break;
                    }

                    // React 18 style: _debugSource
                    if (fiber._debugSource) {
                      const src = fiber._debugSource;
                      console.log('[Page] Found _debugSource at depth', depth, ':', src);
                      sourceInfo = {
                        sources: [{
                          name: fiber.type?.name || fiber.type?.displayName || 'Component',
                          file: src.fileName || src.filename || '',
                          line: src.lineNumber || src.line || 0,
                          column: src.columnNumber || src.column || 0
                        }],
                        summary: (src.fileName || src.filename || 'unknown') + ':' + (src.lineNumber || src.line || 0)
                      };
                      break;
                    }

                    fiber = fiber.return;
                  }
                  if (sourceInfo) break;
                }
              }
            } catch (e) {
              console.log('[Page] React fiber approach error:', e.message);
            }
          }

          // Approach 3: Inspect ALL fiber properties for source info
          if (!sourceInfo) {
            try {
              for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber$')) {
                  let fiber = el[key];
                  let depth = 0;
                  while (fiber && depth < 15) {
                    depth++;
                    // Log ALL keys on fiber that might have source info
                    const allKeys = Object.keys(fiber);
                    const interestingKeys = allKeys.filter(k =>
                      k.toLowerCase().includes('debug') ||
                      k.toLowerCase().includes('source') ||
                      k.toLowerCase().includes('stack') ||
                      k.toLowerCase().includes('file') ||
                      k.toLowerCase().includes('owner')
                    );
                    if (interestingKeys.length > 0) {
                      console.log('[Page] Fiber depth', depth, 'interesting keys:', interestingKeys);
                      // Log the values
                      for (const ik of interestingKeys) {
                        const val = fiber[ik];
                        if (val && typeof val === 'object') {
                          console.log('[Page]  -', ik, ':', JSON.stringify(val).substring(0, 200));
                        } else if (val) {
                          console.log('[Page]  -', ik, ':', String(val).substring(0, 200));
                        }
                      }
                    }

                    // Check for _debugOwner which might have source
                    if (fiber._debugOwner && fiber._debugOwner._debugSource) {
                      const src = fiber._debugOwner._debugSource;
                      sourceInfo = {
                        sources: [{
                          name: fiber._debugOwner.type?.name || 'Component',
                          file: src.fileName || '',
                          line: src.lineNumber || 0,
                          column: src.columnNumber || 0
                        }],
                        summary: (src.fileName || 'unknown') + ':' + (src.lineNumber || 0)
                      };
                      console.log('[Page] Source from _debugOwner:', sourceInfo.summary);
                      break;
                    }
                    fiber = fiber.return;
                  }
                  if (sourceInfo) break;
                }
              }
            } catch (e) {
              console.log('[Page] Fallback fiber error:', e.message);
            }
          }

          // Approach 4: Get component name even without source (production React builds)
          if (!sourceInfo) {
            try {
              const componentNames = [];
              for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                  let fiber = el[key];
                  // Walk up the tree to find named components
                  while (fiber && componentNames.length < 5) {
                    const type = fiber.type;
                    if (type) {
                      const name = type.displayName || type.name || (typeof type === 'string' ? type : null);
                      if (name && name !== 'Fragment' && !name.startsWith('_') && !componentNames.includes(name)) {
                        componentNames.push(name);
                      }
                    }
                    fiber = fiber.return;
                  }
                  break;
                }
              }
              if (componentNames.length > 0) {
                sourceInfo = {
                  sources: componentNames.map(name => ({
                    name: name,
                    file: '',
                    line: 0,
                    column: 0
                  })),
                  summary: componentNames.join(' > ')
                };
                console.log('[Page] Component hierarchy (no source):', sourceInfo.summary);
              }
            } catch (e) {
              console.log('[Page] Component name fallback error:', e.message);
            }
          }

          if (sourceInfo) {
            el.setAttribute('data-source-info', JSON.stringify(sourceInfo));
          } else {
            console.log('[Page] No source location found for element');
          }
        })();
      `
      document.documentElement.appendChild(script)
      script.remove()

      // Wait for async operations
      setTimeout(() => {
        const sourceInfoAttr = el.getAttribute('data-source-info')
        el.removeAttribute('data-source-id')
        if (sourceInfoAttr) {
          const sourceLocation = JSON.parse(sourceInfoAttr)
          el.removeAttribute('data-source-info')
          console.log('[Preload] Retrieved source location:', sourceLocation.summary)
          resolve(sourceLocation)
        } else {
          resolve(null)
        }
      }, 500)
    } catch (err) {
      console.error('[Preload] Failed to get source location:', err)
      resolve(null)
    }
  })
}

// Handle AI-driven element selection
ipcRenderer.on('select-element-by-selector', async (event, selector) => {
  console.log('[AI] Selecting element with selector:', selector)
  try {
    // Clear previous selections
    clearNumberBadges()
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
      currentSelected = null
    }

    // Find ALL matching elements
    const elements = document.querySelectorAll(selector)

    if (elements.length === 0) {
      ipcRenderer.sendToHost('ai-selection-failed', {
        selector: selector,
        error: 'No elements found'
      })
      return
    }

    // Store all matches
    multipleMatches = Array.from(elements)

    // Highlight all elements and add number badges
    const elementsData = []
    for (let index = 0; index < multipleMatches.length; index++) {
      const element = multipleMatches[index]
      element.classList.add('inspector-selected-target')

      // Create and position number badge
      const badge = createNumberBadge(index + 1)
      element.style.position = element.style.position || 'relative'
      element.appendChild(badge)
      numberBadges.push(badge)

      // Collect element data (including source location)
      const summary = getElementSummary(element)
      const rect = element.getBoundingClientRect()
      const xpath = getXPath(element)
      const sourceLocation = await getSourceLocation(element)

      elementsData.push({
        element: { ...summary, xpath, sourceLocation },
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      })
    }

    // Scroll first element into view
    multipleMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Send back all matched elements
    ipcRenderer.sendToHost('ai-selection-confirmed', {
      selector: selector,
      count: multipleMatches.length,
      elements: elementsData
    })

  } catch (error) {
    ipcRenderer.sendToHost('ai-selection-failed', {
      selector: selector,
      error: error.message
    })
  }
})

// --- Drag-Drop on Selected Elements ---
let dropLabel = null
let originalTextContent = null
let isEditing = false
let editToolbar = null

function getDropAction(element, dataTransfer) {
  const hasFiles = dataTransfer.types.includes('Files')
  const hasUrl = dataTransfer.types.includes('text/uri-list') || dataTransfer.types.includes('text/plain')
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'img' && hasFiles) return 'Replace Image'
  if (tagName === 'img' && hasUrl) return 'Set Image URL'
  if ((tagName === 'a' || tagName === 'button') && hasUrl) return 'Set Link'
  if (hasFiles) return 'Insert Image'
  if (hasUrl) return 'Insert Link'
  return 'Drop Here'
}

function showDropLabel(element, action) {
  if (!dropLabel) {
    dropLabel = document.createElement('div')
    dropLabel.className = 'drop-zone-label'
    document.body.appendChild(dropLabel)
  }

  // Lucide download icon as SVG
  const downloadIcon = '<svg class="drop-zone-label-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'

  const rect = element.getBoundingClientRect()
  dropLabel.innerHTML = downloadIcon + '<span>' + action + '</span>'
  dropLabel.style.left = (rect.left + rect.width / 2 - 60) + 'px'
  dropLabel.style.top = (rect.top - 40) + 'px'
  dropLabel.style.display = 'flex'
}

function hideDropLabel() {
  if (dropLabel) {
    dropLabel.style.display = 'none'
  }
}

function createEditToolbar(element) {
  if (editToolbar) editToolbar.remove()

  editToolbar = document.createElement('div')
  editToolbar.className = 'inspector-edit-toolbar'

  const acceptBtn = document.createElement('button')
  acceptBtn.className = 'inspector-edit-btn accept'
  acceptBtn.textContent = '✓'
  acceptBtn.title = 'Accept'

  const rejectBtn = document.createElement('button')
  rejectBtn.className = 'inspector-edit-btn reject'
  rejectBtn.textContent = '✗'
  rejectBtn.title = 'Reject'

  editToolbar.appendChild(acceptBtn)
  editToolbar.appendChild(rejectBtn)

  const rect = element.getBoundingClientRect()
  editToolbar.style.left = (rect.right + 8) + 'px'
  editToolbar.style.top = rect.top + 'px'

  document.body.appendChild(editToolbar)

  // Accept button handler
  acceptBtn.addEventListener('click', function(e) {
    e.stopPropagation()
    const newText = element.textContent
    ipcRenderer.sendToHost('inline-edit-accept', {
      oldText: originalTextContent,
      newText: newText,
      element: getElementSummary(element)
    })
    finishEditing(element)
  })

  // Reject button handler
  rejectBtn.addEventListener('click', function(e) {
    e.stopPropagation()
    element.textContent = originalTextContent
    finishEditing(element)
  })

  return editToolbar
}

function startEditing(element) {
  if (isEditing) return

  // Only allow editing for text-like elements
  const tagName = element.tagName.toLowerCase()
  if (['img', 'video', 'audio', 'iframe', 'canvas', 'svg'].includes(tagName)) return
  if (element.children.length > 0 && element.textContent.trim().length > 200) return // Skip complex elements

  isEditing = true
  originalTextContent = element.textContent

  element.contentEditable = 'true'
  element.classList.add('inspector-inline-editing')
  element.focus()

  createEditToolbar(element)

  // Select all text
  const range = document.createRange()
  range.selectNodeContents(element)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

function finishEditing(element) {
  isEditing = false
  element.contentEditable = 'false'
  element.classList.remove('inspector-inline-editing')
  originalTextContent = null

  if (editToolbar) {
    editToolbar.remove()
    editToolbar = null
  }
}

// Global drag event handlers - only work when inspector is active
document.addEventListener('dragover', function(e) {
  if (!currentSelected || !isInspectorActive) return

  const rect = currentSelected.getBoundingClientRect()
  const isOverSelected = (
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom
  )

  if (isOverSelected) {
    e.preventDefault()
    e.stopPropagation()
    currentSelected.classList.add('inspector-drag-over')
    const action = getDropAction(currentSelected, e.dataTransfer)
    showDropLabel(currentSelected, action)
  } else {
    currentSelected.classList.remove('inspector-drag-over')
    hideDropLabel()
  }
}, true)

document.addEventListener('dragleave', function(e) {
  if (!currentSelected || !isInspectorActive) return

  // Only hide if truly leaving the element
  const rect = currentSelected.getBoundingClientRect()
  const isStillOver = (
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom
  )

  if (!isStillOver) {
    currentSelected.classList.remove('inspector-drag-over')
    hideDropLabel()
  }
}, true)

document.addEventListener('drop', function(e) {
  if (!currentSelected || !isInspectorActive) return

  const rect = currentSelected.getBoundingClientRect()
  const isOverSelected = (
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom
  )

  if (!isOverSelected) return

  e.preventDefault()
  e.stopPropagation()

  currentSelected.classList.remove('inspector-drag-over')
  hideDropLabel()

  const files = e.dataTransfer.files
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  const summary = getElementSummary(currentSelected)
  const xpath = getXPath(currentSelected)

  if (files.length > 0 && files[0].type.startsWith('image/')) {
    // Read the file and send to parent
    const reader = new FileReader()
    reader.onload = function(ev) {
      ipcRenderer.sendToHost('drop-image-on-element', {
        imageData: ev.target.result,
        element: { ...summary, xpath },
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      })
    }
    reader.readAsDataURL(files[0])
  } else if (url && url.startsWith('http')) {
    ipcRenderer.sendToHost('drop-url-on-element', {
      url: url,
      element: { ...summary, xpath },
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    })
  }
}, true)

// Double-click to start inline editing - only when inspector is active
document.addEventListener('dblclick', function(e) {
  if (!currentSelected || !isInspectorActive) return
  if (e.target !== currentSelected && !currentSelected.contains(e.target)) return

  e.preventDefault()
  e.stopPropagation()
  startEditing(currentSelected)
}, true)

// Escape to cancel editing or move mode
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Cancel inline editing
    if (isEditing && currentSelected) {
      currentSelected.textContent = originalTextContent
      finishEditing(currentSelected)
      return
    }
    // Cancel move mode - clear all overlays
    if (moveOverlays.length > 0) {
      cleanupAllMoveOverlays()
      ipcRenderer.sendToHost('move-cancelled')
      return
    }
  }
}, true)

// --- Move Mode Functions (Multi-overlay support) ---

function createMoveOverlay(element, summary, xpath, sourceLocation) {
  const rect = element.getBoundingClientRect()
  const originalRect = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  }

  // Hide the original element (keep layout space)
  element.classList.add('move-original-hidden')

  // Create floating overlay
  const overlay = document.createElement('div')
  overlay.className = 'move-floating-overlay'
  overlay.style.left = rect.left + 'px'
  overlay.style.top = rect.top + 'px'
  overlay.style.width = rect.width + 'px'
  overlay.style.height = rect.height + 'px'

  // Clone the element content into the overlay
  const clone = element.cloneNode(true)
  clone.classList.remove('move-original-hidden')

  // Copy all computed styles from original element to clone
  const computedStyle = window.getComputedStyle(element)

  // Apply key visual styles - preserve element's original appearance exactly
  clone.style.cssText = ''
  clone.style.visibility = 'visible'
  clone.style.position = 'static'
  clone.style.margin = '0'
  clone.style.width = '100%'
  clone.style.height = '100%'
  clone.style.display = computedStyle.display
  clone.style.background = computedStyle.background
  clone.style.backgroundColor = computedStyle.backgroundColor
  clone.style.backgroundImage = computedStyle.backgroundImage
  clone.style.backgroundSize = computedStyle.backgroundSize
  clone.style.backgroundPosition = computedStyle.backgroundPosition
  clone.style.borderRadius = computedStyle.borderRadius
  clone.style.padding = computedStyle.padding
  clone.style.color = computedStyle.color
  clone.style.fontFamily = computedStyle.fontFamily
  clone.style.fontSize = computedStyle.fontSize
  clone.style.fontWeight = computedStyle.fontWeight
  clone.style.lineHeight = computedStyle.lineHeight
  clone.style.textAlign = computedStyle.textAlign
  clone.style.boxShadow = computedStyle.boxShadow
  clone.style.border = computedStyle.border
  clone.style.overflow = 'hidden'

  // Copy border-radius to overlay as well for seamless look
  overlay.style.borderRadius = computedStyle.borderRadius

  overlay.appendChild(clone)

  // Add resize handles
  const handles = ['tl', 'tr', 'bl', 'br']
  handles.forEach(pos => {
    const handle = document.createElement('div')
    handle.className = 'move-resize-handle ' + pos
    handle.dataset.handle = pos
    overlay.appendChild(handle)
  })

  document.body.appendChild(overlay)

  // Create position label
  const positionLabel = document.createElement('div')
  positionLabel.className = 'move-position-label'
  document.body.appendChild(positionLabel)

  // Store overlay data
  const overlayData = {
    overlay,
    element,
    originalRect,
    elementData: { summary, xpath, sourceLocation },
    positionLabel
  }
  moveOverlays.push(overlayData)

  // Update position label
  updatePositionLabelFor(overlayData)

  // Add event listeners for dragging and resizing
  overlay.addEventListener('mousedown', (e) => handleMoveStart(e, overlayData))

  console.log('[Move] Created overlay for element:', summary.tagName, 'Total overlays:', moveOverlays.length)

  // Send initial selection to host
  ipcRenderer.sendToHost('move-select', {
    element: { ...summary, xpath, sourceLocation },
    rect: originalRect
  })
}

function handleMoveStart(e, overlayData) {
  activeMoveOverlay = overlayData

  const handle = e.target.dataset?.handle
  if (handle) {
    isResizing = true
    resizeHandle = handle
  } else {
    isMoveDragging = true
  }

  moveStartX = e.clientX
  moveStartY = e.clientY

  e.preventDefault()
  e.stopPropagation()

  document.addEventListener('mousemove', handleMoveMove)
  document.addEventListener('mouseup', handleMoveEnd)
}

function handleMoveMove(e) {
  if (!activeMoveOverlay) return

  const overlay = activeMoveOverlay.overlay
  const deltaX = e.clientX - moveStartX
  const deltaY = e.clientY - moveStartY

  if (isMoveDragging) {
    const currentLeft = parseFloat(overlay.style.left) || 0
    const currentTop = parseFloat(overlay.style.top) || 0
    overlay.style.left = (currentLeft + deltaX) + 'px'
    overlay.style.top = (currentTop + deltaY) + 'px'
  } else if (isResizing) {
    const currentLeft = parseFloat(overlay.style.left) || 0
    const currentTop = parseFloat(overlay.style.top) || 0
    const currentWidth = parseFloat(overlay.style.width) || 100
    const currentHeight = parseFloat(overlay.style.height) || 100

    let newLeft = currentLeft
    let newTop = currentTop
    let newWidth = currentWidth
    let newHeight = currentHeight

    if (resizeHandle.includes('l')) {
      newLeft = currentLeft + deltaX
      newWidth = currentWidth - deltaX
    }
    if (resizeHandle.includes('r')) {
      newWidth = currentWidth + deltaX
    }
    if (resizeHandle.includes('t')) {
      newTop = currentTop + deltaY
      newHeight = currentHeight - deltaY
    }
    if (resizeHandle.includes('b')) {
      newHeight = currentHeight + deltaY
    }

    if (newWidth >= 20 && newHeight >= 20) {
      overlay.style.left = newLeft + 'px'
      overlay.style.top = newTop + 'px'
      overlay.style.width = newWidth + 'px'
      overlay.style.height = newHeight + 'px'
    }
  }

  moveStartX = e.clientX
  moveStartY = e.clientY

  updatePositionLabelFor(activeMoveOverlay)
}

function handleMoveEnd(e) {
  if (!activeMoveOverlay) return

  const overlay = activeMoveOverlay.overlay
  const elementData = activeMoveOverlay.elementData
  const originalRect = activeMoveOverlay.originalRect

  isMoveDragging = false
  isResizing = false
  resizeHandle = null

  document.removeEventListener('mousemove', handleMoveMove)
  document.removeEventListener('mouseup', handleMoveEnd)

  // Send updated position to host
  const newRect = {
    x: parseFloat(overlay.style.left) || 0,
    y: parseFloat(overlay.style.top) || 0,
    width: parseFloat(overlay.style.width) || 100,
    height: parseFloat(overlay.style.height) || 100
  }

  ipcRenderer.sendToHost('move-update', {
    element: {
      ...elementData.summary,
      xpath: elementData.xpath,
      sourceLocation: elementData.sourceLocation
    },
    originalRect: originalRect,
    targetRect: newRect
  })

  activeMoveOverlay = null
}

function updatePositionLabelFor(overlayData) {
  if (!overlayData || !overlayData.positionLabel || !overlayData.overlay) return

  const overlay = overlayData.overlay
  const label = overlayData.positionLabel

  const x = Math.round(parseFloat(overlay.style.left) || 0)
  const y = Math.round(parseFloat(overlay.style.top) || 0)
  const w = Math.round(parseFloat(overlay.style.width) || 0)
  const h = Math.round(parseFloat(overlay.style.height) || 0)

  label.textContent = `${x}, ${y} • ${w} × ${h}`
  label.style.left = (x + w / 2 - 50) + 'px'
  label.style.top = (y - 30) + 'px'
}

function cleanupSingleMoveOverlay(overlayData) {
  if (overlayData.element) {
    overlayData.element.classList.remove('move-original-hidden')
  }
  if (overlayData.overlay) {
    overlayData.overlay.remove()
  }
  if (overlayData.positionLabel) {
    overlayData.positionLabel.remove()
  }
}

function cleanupAllMoveOverlays() {
  moveOverlays.forEach(overlayData => {
    cleanupSingleMoveOverlay(overlayData)
  })
  moveOverlays = []
  activeMoveOverlay = null
  isMoveDragging = false
  isResizing = false
  resizeHandle = null
}

// Confirm move and send final positions for all overlays
ipcRenderer.on('confirm-move', () => {
  moveOverlays.forEach(overlayData => {
    const overlay = overlayData.overlay
    const elementData = overlayData.elementData
    const originalRect = overlayData.originalRect

    const targetRect = {
      x: parseFloat(overlay.style.left) || 0,
      y: parseFloat(overlay.style.top) || 0,
      width: parseFloat(overlay.style.width) || 100,
      height: parseFloat(overlay.style.height) || 100
    }

    ipcRenderer.sendToHost('move-confirmed', {
      element: {
        ...elementData.summary,
        xpath: elementData.xpath,
        sourceLocation: elementData.sourceLocation
      },
      originalRect: originalRect,
      targetRect: targetRect
    })
  })
  cleanupAllMoveOverlays()
})

// Cancel move
ipcRenderer.on('cancel-move', () => {
  cleanupAllMoveOverlays()
})

// Hide move handles for screenshot (keeps element visible)
ipcRenderer.on('hide-move-handles', () => {
  moveOverlays.forEach(overlayData => {
    // Hide handles
    const handles = overlayData.overlay.querySelectorAll('.move-resize-handle')
    handles.forEach(handle => {
      handle.style.display = 'none'
    })
    // Hide outline
    overlayData.overlay.style.outline = 'none'
    overlayData.overlay.style.outlineOffset = '0'
    // Hide position label
    if (overlayData.positionLabel) {
      overlayData.positionLabel.style.display = 'none'
    }
  })
  console.log('[Move] Handles hidden for screenshot')
})

// Show move handles after screenshot
ipcRenderer.on('show-move-handles', () => {
  moveOverlays.forEach(overlayData => {
    // Show handles
    const handles = overlayData.overlay.querySelectorAll('.move-resize-handle')
    handles.forEach(handle => {
      handle.style.display = ''
    })
    // Restore outline
    overlayData.overlay.style.outline = '2px solid #f97316'
    overlayData.overlay.style.outlineOffset = '2px'
    // Show position label
    if (overlayData.positionLabel) {
      overlayData.positionLabel.style.display = ''
    }
  })
  console.log('[Move] Handles restored after screenshot')
})
