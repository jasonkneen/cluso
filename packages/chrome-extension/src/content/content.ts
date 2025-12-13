/**
 * Content Script
 *
 * Injected into web pages to enable element inspection.
 * Communicates with the background service worker via chrome.runtime.
 */

import {
  REACT_FIBER_EXTRACTION_SCRIPT,
  RSC_EXTRACTION_SCRIPT,
  INSPECTOR_OVERLAY_STYLES,
} from '@ai-cluso/shared-inspector'

import {
  showToolbar,
  hideToolbar,
  toggleToolbar,
  updateConnectionStatus,
  isVisible as isToolbarVisible,
  addSelectedElement,
  clearSelectedElements,
} from './toolbar'

// Track inspector state
let inspectorActive = false
let hoverOverlay: HTMLDivElement | null = null
let selectionOverlay: HTMLDivElement | null = null
let currentHoveredElement: Element | null = null

/**
 * Inject the React fiber extraction scripts into the page
 */
function injectExtractionScripts(): void {
  // Inject React fiber extraction
  const fiberScript = document.createElement('script')
  fiberScript.textContent = REACT_FIBER_EXTRACTION_SCRIPT
  document.documentElement.appendChild(fiberScript)
  fiberScript.remove()

  // Inject RSC extraction
  const rscScript = document.createElement('script')
  rscScript.textContent = RSC_EXTRACTION_SCRIPT
  document.documentElement.appendChild(rscScript)
  rscScript.remove()

  console.log('[Cluso] Extraction scripts injected')
}

/**
 * Inject inspector styles into the page
 */
function injectStyles(): void {
  const style = document.createElement('style')
  style.id = 'cluso-inspector-styles'
  style.textContent = INSPECTOR_OVERLAY_STYLES
  document.head.appendChild(style)
}

/**
 * Create overlay elements for hover and selection
 */
function createOverlays(): void {
  // Hover overlay
  hoverOverlay = document.createElement('div')
  hoverOverlay.id = 'cluso-hover-overlay'
  hoverOverlay.setAttribute('data-cluso-ui', '1')
  document.body.appendChild(hoverOverlay)

  // Selection overlay
  selectionOverlay = document.createElement('div')
  selectionOverlay.id = 'cluso-selection-overlay'
  selectionOverlay.setAttribute('data-cluso-ui', '1')
  document.body.appendChild(selectionOverlay)
}

/**
 * Position overlay over an element
 */
function positionOverlay(overlay: HTMLDivElement, element: Element): void {
  const rect = element.getBoundingClientRect()
  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

/**
 * Handle mouse movement during inspection
 */
function handleMouseMove(event: MouseEvent): void {
  if (!inspectorActive || !hoverOverlay) return

  // Ignore our own UI elements
  const target = event.target as Element
  if (target.closest('[data-cluso-ui]')) return

  currentHoveredElement = target
  positionOverlay(hoverOverlay, target)
  hoverOverlay.classList.add('visible')
}

/**
 * Handle click during inspection
 */
function handleClick(event: MouseEvent): void {
  if (!inspectorActive) return

  // Ignore our own UI elements
  const target = event.target as Element
  if (target.closest('[data-cluso-ui]')) return

  event.preventDefault()
  event.stopPropagation()

  // Extract element info and send to background
  const elementInfo = extractElementInfo(target)
  chrome.runtime.sendMessage({
    type: 'element-selected',
    element: elementInfo,
  })

  // Add to floating toolbar's chat panel
  const htmlEl = target as HTMLElement
  addSelectedElement({
    tagName: target.tagName,
    id: target.id || undefined,
    className: target.className || undefined,
    text: htmlEl.innerText?.substring(0, 50) || undefined,
  })

  // Show selection overlay
  if (selectionOverlay) {
    positionOverlay(selectionOverlay, target)
    selectionOverlay.classList.add('visible')
  }

  // Hide hover overlay
  if (hoverOverlay) {
    hoverOverlay.classList.remove('visible')
  }
}

/**
 * Extract information about an element
 */
function extractElementInfo(element: Element): Record<string, unknown> {
  const htmlEl = element as HTMLElement
  const rect = element.getBoundingClientRect()

  // Get attributes
  const attributes: Record<string, string> = {}
  Array.from(element.attributes).forEach((attr) => {
    attributes[attr.name] = attr.value
  })

  // Basic info
  const info: Record<string, unknown> = {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className || undefined,
    text: htmlEl.innerText?.substring(0, 100) || undefined,
    xpath: generateXPath(element),
    attributes,
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    computedStyle: {
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      color: getComputedStyle(element).color,
      backgroundColor: getComputedStyle(element).backgroundColor,
      fontSize: getComputedStyle(element).fontSize,
    },
  }

  // Try to get React context via injected functions
  try {
    const win = window as Window & {
      extractReactContext?: (el: Element) => unknown
    }
    if (win.extractReactContext) {
      const reactContext = win.extractReactContext(element) as Record<string, unknown>
      if (reactContext?.hasFiber) {
        info.componentStack = reactContext.componentStack
        info.hasFiber = true
      }
    }
  } catch (err) {
    console.warn('[Cluso] Failed to extract React context:', err)
  }

  return info
}

/**
 * Generate XPath for an element
 */
function generateXPath(el: Element | null): string {
  if (!el) return ''
  if (el.id) return `//*[@id="${el.id}"]`

  const parts: string[] = []
  let current: Element | null = el

  while (current && current.nodeType === 1) {
    let idx = 1
    let sib = current.previousSibling

    while (sib) {
      if (sib.nodeType === 1 && (sib as Element).tagName === current.tagName) {
        idx++
      }
      sib = sib.previousSibling
    }

    parts.unshift(`${current.tagName.toLowerCase()}[${idx}]`)
    current = current.parentElement
  }

  return '/' + parts.join('/')
}

/**
 * Activate the inspector
 */
function activateInspector(): void {
  if (inspectorActive) return

  inspectorActive = true
  document.addEventListener('mousemove', handleMouseMove, true)
  document.addEventListener('click', handleClick, true)
  document.body.style.cursor = 'crosshair'

  console.log('[Cluso] Inspector activated')
}

/**
 * Deactivate the inspector
 */
function deactivateInspector(): void {
  if (!inspectorActive) return

  inspectorActive = false
  document.removeEventListener('mousemove', handleMouseMove, true)
  document.removeEventListener('click', handleClick, true)
  document.body.style.cursor = ''

  if (hoverOverlay) {
    hoverOverlay.classList.remove('visible')
  }

  console.log('[Cluso] Inspector deactivated')
}

/**
 * Clear selection
 */
function clearSelection(): void {
  if (selectionOverlay) {
    selectionOverlay.classList.remove('visible')
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'activate-inspector':
      activateInspector()
      sendResponse({ success: true })
      break

    case 'deactivate-inspector':
      deactivateInspector()
      sendResponse({ success: true })
      break

    case 'clear-selection':
      clearSelection()
      clearSelectedElements()
      sendResponse({ success: true })
      break

    case 'get-page-elements':
      // Get all interactive elements on the page
      const selector =
        'button, a, input, textarea, select, img, video, h1, h2, h3, h4, h5, h6, p, span, div, section, article, nav, header, footer, form, label, li'
      const elements = document.querySelectorAll(selector)
      const elementList: Array<Record<string, unknown>> = []

      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          elementList.push({
            index,
            ...extractElementInfo(el),
          })
        }
      })

      sendResponse({ elements: elementList })
      break

    case 'show-toolbar':
      showToolbar()
      sendResponse({ success: true, visible: true })
      break

    case 'hide-toolbar':
      hideToolbar()
      sendResponse({ success: true, visible: false })
      break

    case 'toggle-toolbar':
      const visible = toggleToolbar()
      sendResponse({ success: true, visible })
      break

    case 'update-connection-status':
      updateConnectionStatus(message.connected ?? false)
      sendResponse({ success: true })
      break

    default:
      sendResponse({ error: `Unknown message type: ${message.type}` })
  }

  return true // Keep channel open for async response
})

// Initialize on load
function initialize(): void {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectExtractionScripts()
      injectStyles()
      createOverlays()
    })
  } else {
    injectExtractionScripts()
    injectStyles()
    createOverlays()
  }
}

initialize()
console.log('[Cluso] Content script loaded')
