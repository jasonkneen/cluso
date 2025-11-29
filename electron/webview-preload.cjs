console.log('=== WEBVIEW PRELOAD LOADED ===')

const { ipcRenderer } = require('electron')

console.log('ipcRenderer available:', !!ipcRenderer)

// Inspector state
let currentSelected = null
let isInspectorActive = false
let isScreenshotActive = false

// CSS injection for hover/selection effects
// Inject CSS when DOM is ready
function injectStyles() {
  const style = document.createElement('style')
  style.id = 'inspector-styles'
  style.textContent = `
    .inspector-hover-target {
      outline: 2px solid #3b82f6 !important;
      outline-offset: -2px !important;
      cursor: crosshair !important;
      position: relative;
      z-index: 10000;
    }
    .inspector-selected-target {
      outline: 2px solid #ef4444 !important;
      outline-offset: -2px !important;
    }
    .screenshot-hover-target {
      outline: 2px dashed #9333ea !important;
      outline-offset: -2px !important;
      cursor: crosshair !important;
      background-color: rgba(147, 51, 234, 0.1) !important;
      position: relative;
      z-index: 10000;
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

document.addEventListener('click', function(e) {
  console.log('[Inspector] Click detected, inspectorActive:', isInspectorActive, 'screenshotActive:', isScreenshotActive)

  if (!isInspectorActive && !isScreenshotActive) return

  e.preventDefault()
  e.stopPropagation()

  const summary = getElementSummary(e.target)
  const rect = e.target.getBoundingClientRect()
  const xpath = getXPath(e.target)

  console.log('[Inspector] Element selected:', summary.tagName, summary.id || summary.className)

  if (isInspectorActive) {
    if (currentSelected) {
      currentSelected.classList.remove('inspector-selected-target')
    }
    e.target.classList.add('inspector-selected-target')
    e.target.classList.remove('inspector-hover-target')
    currentSelected = e.target

    const payload = {
      element: { ...summary, xpath },
      x: e.clientX,
      y: e.clientY,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    }
    console.log('[Inspector] Sending inspector-select:', payload.element.tagName)
    ipcRenderer.sendToHost('inspector-select', payload)
  } else if (isScreenshotActive) {
    e.target.classList.remove('screenshot-hover-target')

    const payload = {
      element: { ...summary, xpath },
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
  if (currentSelected) {
    currentSelected.classList.remove('inspector-selected-target')
    currentSelected = null
  }
})
