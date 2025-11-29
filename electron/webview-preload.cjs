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
let multipleMatches = [] // Store multiple AI-selected elements
let numberBadges = [] // Store number badge elements

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

// Mouse events for inspector
document.addEventListener('mouseover', function(e) {
  if (!isInspectorActive && !isScreenshotActive) return
  e.stopPropagation()

  if (isInspectorActive) {
    e.target.classList.add('inspector-hover-target')
  } else if (isScreenshotActive) {
    e.target.classList.add('screenshot-hover-target')
  }
}, true)

document.addEventListener('mouseout', function(e) {
  if (!isInspectorActive && !isScreenshotActive) return
  e.stopPropagation()
  e.target.classList.remove('inspector-hover-target')
  e.target.classList.remove('screenshot-hover-target')
}, true)

document.addEventListener('click', async function(e) {
  console.log('[Inspector] Click detected, inspectorActive:', isInspectorActive, 'screenshotActive:', isScreenshotActive)

  if (!isInspectorActive && !isScreenshotActive) return

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
  }
}, true)

// Listen for mode changes from host
ipcRenderer.on('set-inspector-mode', (event, active) => {
  console.log('[Inspector] set-inspector-mode received:', active)
  isInspectorActive = active
  if (active) isScreenshotActive = false

  if (!active && currentSelected) {
    currentSelected.classList.remove('inspector-selected-target')
    currentSelected = null
  }
})

ipcRenderer.on('set-screenshot-mode', (event, active) => {
  console.log('[Inspector] set-screenshot-mode received:', active)
  isScreenshotActive = active
  if (active) {
    isInspectorActive = false
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
      currentSelected = null
    }
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

          // Approach 2: React DevTools hook (works for most React apps in dev)
          if (!sourceInfo && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            try {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              // Find fiber from element
              for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                  let fiber = el[key];
                  // Walk up to find component with _debugSource
                  while (fiber) {
                    if (fiber._debugSource) {
                      const src = fiber._debugSource;
                      sourceInfo = {
                        sources: [{
                          name: fiber.type?.name || fiber.type?.displayName || 'Component',
                          file: src.fileName || src.filename || '',
                          line: src.lineNumber || src.line || 0,
                          column: src.columnNumber || src.column || 0
                        }],
                        summary: (src.fileName || src.filename || 'unknown') + ':' + (src.lineNumber || src.line || 0)
                      };
                      console.log('[Page] Source from _debugSource:', sourceInfo.summary);
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

          // Approach 3: Direct fiber key access (fallback)
          if (!sourceInfo) {
            try {
              for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber$')) {
                  let fiber = el[key];
                  while (fiber) {
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
