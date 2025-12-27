// Suppress Electron security warnings in dev mode (they don't appear in production)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

console.log('=== WEBVIEW PRELOAD LOADED ===')

// React Fiber Extraction Script (based on bippy patterns)
// This is injected into the page context for rich component extraction
const REACT_FIBER_EXTRACTION_SCRIPT = `
// React Fiber Extraction - based on bippy patterns
// Wrapped in try-catch to ensure errors don't break the host page
(function() {
  try {
    // Skip if already initialized
    if (window.__reactFiberExtraction) return;
    window.__reactFiberExtraction = true;

  // React work tags for component identification
  const FunctionComponentTag = 0;
  const ClassComponentTag = 1;
  const HostComponentTag = 5;
  const ForwardRefTag = 11;
  const MemoComponentTag = 14;
  const SimpleMemoComponentTag = 15;

  // Internal Next.js component names to skip
  const INTERNAL_COMPONENT_NAMES = new Set([
    'InnerLayoutRouter', 'RedirectErrorBoundary', 'RedirectBoundary',
    'HTTPAccessFallbackErrorBoundary', 'HTTPAccessFallbackBoundary',
    'LoadingBoundary', 'ErrorBoundary', 'InnerScrollAndFocusHandler',
    'ScrollAndFocusHandler', 'RenderFromTemplateContext', 'OuterLayoutRouter',
    'body', 'html', 'DevRootHTTPAccessFallbackBoundary',
    'AppDevOverlayErrorBoundary', 'AppDevOverlay', 'HotReload', 'Router',
    'ErrorBoundaryHandler', 'AppRouter', 'ServerRoot', 'SegmentStateProvider',
    'RootErrorBoundary', 'LoadableComponent', 'MotionDOMComponent'
  ]);

  /**
   * Get React fiber from a DOM element (or its ancestors)
   */
  function getFiberFromElement(element, walkUp = true) {
    if (!element || typeof element !== 'object') return null;

    // Try to find fiber on this element first
    const fiber = getFiberDirect(element);
    if (fiber) return fiber;

    // If not found and walkUp is true, try parent elements
    if (walkUp && element.parentElement) {
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 10) {
        const parentFiber = getFiberDirect(parent);
        if (parentFiber) {
          console.log('[Fiber] Found fiber on ancestor at depth:', depth + 1);
          return parentFiber;
        }
        parent = parent.parentElement;
        depth++;
      }
    }

    // Log what keys the element actually has for debugging
    const keys = Object.getOwnPropertyNames(element);
    const reactKeys = keys.filter(k => k.includes('react') || k.includes('React') || k.startsWith('__'));
    if (reactKeys.length > 0) {
      console.log('[Fiber] Element has special keys but no fiber:', reactKeys);
    } else {
      // Log ALL keys that start with __ to help debug
      const specialKeys = keys.filter(k => k.startsWith('__'));
      if (specialKeys.length > 0) {
        console.log('[Fiber] Element __ keys:', specialKeys);
      } else {
        console.log('[Fiber] No React keys found on element or ancestors');
        // Also log if devtools hook has renderers
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          console.log('[Fiber] DevTools hook exists, renderers:', hook.renderers?.size || 0);
          if (hook.renderers && hook.renderers.size > 0) {
            for (const [id, renderer] of hook.renderers) {
              console.log('[Fiber] Renderer', id, ':', Object.keys(renderer).join(', '));
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get React fiber directly from a single element (no walking)
   */
  function getFiberDirect(element) {
    if (!element || typeof element !== 'object') return null;

    // Get all own property keys including non-enumerable
    const keys = Object.getOwnPropertyNames(element);

    // Check for React 16+ fiber keys
    for (const key of keys) {
      if (key.startsWith('__reactFiber$') ||
          key.startsWith('__reactInternalInstance$') ||
          key.startsWith('__reactContainer$')) {
        const fiber = element[key];
        if (fiber) {
          console.log('[Fiber] Found fiber via key:', key);
          return fiber;
        }
      }
    }

    // Also check enumerable properties (some React versions)
    for (const key in element) {
      if (Object.prototype.hasOwnProperty.call(element, key)) {
        if (key.startsWith('__reactFiber') ||
            key.startsWith('__reactInternalInstance') ||
            key.startsWith('__reactContainer') ||
            key.startsWith('__reactProps')) {
          const fiber = element[key];
          if (fiber && typeof fiber === 'object') {
            console.log('[Fiber] Found fiber via enumerable key:', key);
            return fiber;
          }
        }
      }
    }

    // Check for _reactRootContainer (React 16/17)
    if ('_reactRootContainer' in element) {
      const fiber = element._reactRootContainer?._internalRoot?.current?.child;
      if (fiber) {
        console.log('[Fiber] Found fiber via _reactRootContainer');
        return fiber;
      }
    }

    // Try React DevTools hook as last resort
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook.renderers && hook.renderers.size > 0) {
        for (const [id, renderer] of hook.renderers) {
          if (renderer.findFiberByHostInstance) {
            const fiber = renderer.findFiberByHostInstance(element);
            if (fiber) {
              console.log('[Fiber] Found fiber via DevTools hook, renderer:', id);
              return fiber;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get display name from a React component type
   */
  function getDisplayName(type) {
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') {
      return type.displayName || type.name || null;
    }
    if (typeof type === 'object') {
      // Handle memo/forwardRef wrapped components
      if (type.displayName) return type.displayName;
      if (type.type) return getDisplayName(type.type);
      if (type.render) return getDisplayName(type.render);
    }
    return null;
  }

  /**
   * Check if this is a user-defined component (not internal/framework)
   */
  function isUserComponent(name) {
    if (!name) return false;
    if (name.startsWith('_')) return false;
    if (INTERNAL_COMPONENT_NAMES.has(name)) return false;
    if (!name[0] || name[0] !== name[0].toUpperCase()) return false;
    if (name.startsWith('Primitive.')) return false;
    if (name.includes('Provider') && name.includes('Context')) return false;
    return true;
  }

  /**
   * Check if a fiber is a composite (user) component
   */
  function isCompositeFiber(fiber) {
    const tag = fiber.tag;
    return tag === FunctionComponentTag ||
           tag === ClassComponentTag ||
           tag === ForwardRefTag ||
           tag === MemoComponentTag ||
           tag === SimpleMemoComponentTag;
  }

  /**
   * Normalize file path - strip webpack/vite prefixes
   */
  function normalizeFileName(fileName) {
    if (!fileName) return '';

    let normalized = fileName;

    // Strip common prefixes
    const prefixes = [
      'webpack-internal:///',
      'webpack://',
      'file:///',
      'http://localhost:3000/',
      'http://localhost:3001/',
      'http://localhost:3002/',
      'http://localhost:4000/',
      'http://localhost:5173/',
      'rsc://React/Server/',
      '/_next/static/',
    ];

    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length);
      }
    }

    // Remove query parameters
    const queryIndex = normalized.indexOf('?');
    if (queryIndex !== -1) {
      normalized = normalized.slice(0, queryIndex);
    }

    // Clean up leading slashes
    normalized = normalized.replace(/^\\/+/, '/');

    return normalized;
  }

  /**
   * Check if this is a source file (not node_modules, not bundled)
   */
  function isSourceFile(fileName) {
    if (!fileName) return false;
    const normalized = normalizeFileName(fileName);
    if (!normalized) return false;

    // Skip node_modules
    if (normalized.includes('node_modules')) return false;

    // Skip webpack/vite internals
    if (normalized.includes('webpack/') || normalized.includes('.vite/')) return false;

    // Must have a source extension
    if (!/\\.(jsx?|tsx?|vue|svelte)$/i.test(normalized)) return false;

    return true;
  }

  /**
   * Extract source info from fiber's _debugSource (React 17-18)
   */
  function getDebugSource(fiber) {
    const debugSource = fiber._debugSource;
    if (!debugSource) return null;
    if (typeof debugSource !== 'object') return null;

    return {
      fileName: debugSource.fileName || null,
      lineNumber: debugSource.lineNumber || null,
      columnNumber: debugSource.columnNumber || null
    };
  }

  /**
   * Parse stack trace from React 19's _debugStack
   */
  function parseDebugStack(stack) {
    if (!stack || typeof stack !== 'string') return [];

    const frames = [];
    const lines = stack.split('\\n');

    for (const line of lines) {
      // Match patterns like: "at ComponentName (file:line:col)"
      const match = line.match(/at\\s+([\\w$<>]+)?\\s*\\(?([^)]+):(\\d+):(\\d+)\\)?/);
      if (match) {
        frames.push({
          functionName: match[1] || null,
          fileName: match[2],
          lineNumber: parseInt(match[3], 10),
          columnNumber: parseInt(match[4], 10)
        });
      }
    }

    return frames;
  }

  /**
   * Get component stack by traversing fiber tree upward
   */
  function getComponentStack(fiber, maxDepth = 10) {
    const stack = [];
    let current = fiber;
    let depth = 0;

    while (current && depth < maxDepth) {
      if (isCompositeFiber(current)) {
        const name = getDisplayName(current.type);

        if (name && isUserComponent(name)) {
          const info = {
            componentName: name,
            fileName: null,
            lineNumber: null,
            columnNumber: null
          };

          // Try _debugSource first (React 17-18)
          const debugSource = getDebugSource(current);
          if (debugSource && isSourceFile(debugSource.fileName)) {
            info.fileName = normalizeFileName(debugSource.fileName);
            info.lineNumber = debugSource.lineNumber;
            info.columnNumber = debugSource.columnNumber;
          }

          // Try _debugStack (React 19)
          if (!info.fileName && current._debugStack) {
            const stackError = current._debugStack;
            if (stackError instanceof Error && stackError.stack) {
              const frames = parseDebugStack(stackError.stack);
              for (const frame of frames) {
                if (isSourceFile(frame.fileName)) {
                  info.fileName = normalizeFileName(frame.fileName);
                  info.lineNumber = frame.lineNumber;
                  info.columnNumber = frame.columnNumber;
                  break;
                }
              }
            }
          }

          // Try owner stack (React 19+)
          if (!info.fileName && current._debugOwner) {
            const ownerSource = getDebugSource(current._debugOwner);
            if (ownerSource && isSourceFile(ownerSource.fileName)) {
              info.fileName = normalizeFileName(ownerSource.fileName);
              info.lineNumber = ownerSource.lineNumber;
              info.columnNumber = ownerSource.columnNumber;
            }
          }

          stack.push(info);
        }
      }

      current = current.return;
      depth++;
    }

    return stack;
  }

  /**
   * Main extraction function - gets full context for an element
   */
  window.extractReactContext = function(element) {
    const fiber = getFiberFromElement(element);
    const componentStack = fiber ? getComponentStack(fiber) : [];

    return {
      componentStack: componentStack,
      hasFiber: !!fiber
    };
  };

  /**
   * Get nearest React component name for an element
   */
  window.getNearestComponentName = function(element) {
    const fiber = getFiberFromElement(element);
    if (!fiber) return null;

    let current = fiber;
    while (current) {
      if (isCompositeFiber(current)) {
        const name = getDisplayName(current.type);
        if (name && isUserComponent(name)) {
          return name;
        }
      }
      current = current.return;
    }
    return null;
  };

  console.log('[ReactFiberExtraction] Initialized in page context');
  } catch (e) {
    console.warn('[ReactFiberExtraction] Failed to initialize (this is safe to ignore):', e.message);
  }
})();
`;

// Track if we've already injected
let fiberExtractionInjected = false

// Inject React fiber extraction script into page context
function injectReactFiberExtraction() {
  if (fiberExtractionInjected) return
  fiberExtractionInjected = true

  try {
    const script = document.createElement('script')
    script.textContent = REACT_FIBER_EXTRACTION_SCRIPT
    document.documentElement.appendChild(script)
    script.remove()
    console.log('[Preload] React fiber extraction script injected')
  } catch (e) {
    console.error('[Preload] Failed to inject fiber extraction:', e)
  }
}

// Wait for page to load, then inject
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload] DOM loaded, injecting React fiber extraction...')
  injectReactFiberExtraction()
})

const { ipcRenderer } = require('electron')

console.log('ipcRenderer available:', !!ipcRenderer)

// Inspector state
let currentSelected = null
let selectedElements = [] // Store multiple selected elements for multi-select
let isInspectorActive = false
let isScreenshotActive = false
let isMoveActive = false
let multipleMatches = [] // Store multiple AI-selected elements
let numberBadges = [] // Store number badge elements
let selectionTrackRaf = null // requestAnimationFrame id for selection tracking

// Move mode state - support multiple overlays
let moveOverlays = [] // Array of { overlay, element, originalRect, elementData, positionLabel, initialScrollX, initialScrollY }
let activeMoveOverlay = null // Currently being dragged/resized
let isMoveDragging = false
let isResizing = false
let resizeHandle = null
let moveStartX = 0
let moveStartY = 0
let moveScrollHandler = null // Scroll event handler for move mode

// Rectangle selection state
let isRectSelecting = false
let rectStartX = 0
let rectStartY = 0
let currentHovered = null

// --- Animated Overlay Helper Functions ---
function markClusoUi(el) {
  try {
    if (!el || !el.setAttribute) return
    el.setAttribute('data-cluso-ui', '1')
  } catch (e) {}
}

function ensureOverlays() {
  if (!document.getElementById('cluso-hover-overlay')) {
    const hover = document.createElement('div')
    hover.id = 'cluso-hover-overlay'
    markClusoUi(hover)
    document.body.appendChild(hover)
  }
  if (!document.getElementById('cluso-rect-selection')) {
    const rect = document.createElement('div')
    rect.id = 'cluso-rect-selection'
    markClusoUi(rect)
    document.body.appendChild(rect)
  }
}

function positionOverlay(overlay, rect) {
  overlay.style.left = rect.left + 'px'
  overlay.style.top = rect.top + 'px'
  overlay.style.width = rect.width + 'px'
  overlay.style.height = rect.height + 'px'
}

function updateHoverOverlay(element) {
  ensureOverlays()
  const overlay = document.getElementById('cluso-hover-overlay')
  if (!element) {
    overlay.classList.remove('visible')
    overlay.classList.remove('selected')
    return
  }
  const rect = element.getBoundingClientRect()
  positionOverlay(overlay, rect)
  overlay.classList.remove('screenshot-mode', 'move-mode')
  if (isScreenshotActive) overlay.classList.add('screenshot-mode')
  if (isMoveActive) overlay.classList.add('move-mode')
  overlay.classList.add('visible')
}

function updateSelectionOverlay(element) {
  // Intentionally disabled: we use the single dotted overlay (#cluso-hover-overlay)
  // for selection so we don't mutate target elements or show a "double selector".
}

function renderInspectorOverlay() {
  ensureOverlays()
  const overlay = document.getElementById('cluso-hover-overlay')
  if (!overlay) return

  const target = currentHovered || currentSelected
  if (!target) {
    overlay.classList.remove('visible')
    overlay.classList.remove('selected')
    return
  }

  try {
    const rect = target.getBoundingClientRect()
    positionOverlay(overlay, rect)
  } catch (e) {
    // ignore
  }

  overlay.classList.remove('screenshot-mode', 'move-mode')
  if (isScreenshotActive) overlay.classList.add('screenshot-mode')
  if (isMoveActive) overlay.classList.add('move-mode')

  // "Selected" styling only when we're showing the selected element (not a different hover target).
  const showSelected = !!(isInspectorActive && currentSelected && (!currentHovered || currentHovered === currentSelected))
  overlay.classList.toggle('selected', showSelected)
  overlay.classList.add('visible')
}

function startSelectionTracking() {
  if (selectionTrackRaf != null) return
  const tick = () => {
    // Stop if inspector is off, or nothing to track
    if (!isInspectorActive || (!currentSelected && !currentHovered)) {
      stopSelectionTracking()
      return
    }
    try {
      const target = currentHovered || currentSelected
      if (target && document.contains(target)) {
        renderInspectorOverlay()
      } else {
        if (target === currentHovered) currentHovered = null
        if (target === currentSelected) currentSelected = null
        if (!currentSelected && !currentHovered) stopSelectionTracking()
      }
    } catch (e) {}
    selectionTrackRaf = requestAnimationFrame(tick)
  }
  selectionTrackRaf = requestAnimationFrame(tick)
}

function stopSelectionTracking() {
  if (selectionTrackRaf == null) return
  try {
    cancelAnimationFrame(selectionTrackRaf)
  } catch (e) {}
  selectionTrackRaf = null
}

// --- Selection Overlay with Toolbar ---
let selectionOverlays = [] // Array of { element, overlay, toolbar, trackingRaf, summary, xpath, sourceLocation }

function createSelectionOverlay(element, summary, xpath, sourceLocation, rect) {
  // Check if already has overlay
  if (selectionOverlays.some(s => s.element === element)) return

  // Create overlay div
  const overlay = document.createElement('div')
  overlay.className = 'cluso-selection-overlay'
  overlay.style.cssText = `
    position: fixed;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    z-index: 2147483646;
    transition: all 0.1s ease;
  `
  markClusoUi(overlay)

  // Create toolbar
  const toolbar = document.createElement('div')
  toolbar.className = 'cluso-selection-toolbar'
  toolbar.style.cssText = `
    position: fixed;
    background: #3b82f6;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    pointer-events: auto;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `
  markClusoUi(toolbar)

  // Add element info label
  const infoLabel = document.createElement('div')
  infoLabel.style.cssText = `
    color: white;
    font-size: 11px;
    font-family: -apple-system, system-ui, sans-serif;
    padding: 2px 4px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `

  // Build label text: tagName + file location if available
  let labelText = summary.tagName.toLowerCase()
  if (summary.id) labelText += `#${summary.id}`
  else if (summary.className) {
    const firstClass = summary.className.split(' ')[0]
    if (firstClass) labelText += `.${firstClass}`
  }

  // Add file location if available
  if (sourceLocation && sourceLocation.sources && sourceLocation.sources.length > 0) {
    const src = sourceLocation.sources[0]
    const fileName = src.file ? src.file.split('/').pop().split('?')[0] : null
    if (fileName) {
      labelText += ` · ${fileName}`
      if (src.line) labelText += `:${src.line}`
    }
  }

  infoLabel.textContent = labelText
  infoLabel.title = labelText
  toolbar.appendChild(infoLabel)

  // Drag handle button
  const dragHandle = document.createElement('button')
  dragHandle.innerHTML = '⠿'
  dragHandle.title = 'Drag to move'
  dragHandle.style.cssText = `
    background: transparent;
    border: none;
    color: white;
    cursor: move;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 2px;
  `
  dragHandle.addEventListener('mouseenter', () => {
    dragHandle.style.background = 'rgba(255,255,255,0.2)'
  })
  dragHandle.addEventListener('mouseleave', () => {
    dragHandle.style.background = 'transparent'
  })
  dragHandle.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[Selection] Drag handle clicked - creating move overlay')

    // Find the selection overlay data for this element
    const selectionData = selectionOverlays.find(s => s.element === element)
    if (!selectionData) {
      console.warn('[Selection] No selection data found for element')
      return
    }

    // Remove the selection overlay since we're entering move mode
    removeSelectionOverlay(element)

    // Create move overlay using the same function as the dedicated move button
    createMoveOverlay(element, selectionData.summary, selectionData.xpath, selectionData.sourceLocation)
  })

  // Close button
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '×'
  closeBtn.title = 'Remove selection'
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
    padding: 0 6px;
    border-radius: 2px;
    line-height: 1;
  `
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.2)'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent'
  })
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    removeSelectionOverlay(element)
  })

  toolbar.appendChild(dragHandle)
  toolbar.appendChild(closeBtn)

  // Position overlay and toolbar
  updateSelectionPosition(overlay, toolbar, element)

  document.body.appendChild(overlay)
  document.body.appendChild(toolbar)

  // Start tracking to follow scroll/resize
  const trackingRaf = requestAnimationFrame(function tick() {
    if (document.contains(element)) {
      updateSelectionPosition(overlay, toolbar, element)
      const sel = selectionOverlays.find(s => s.element === element)
      if (sel) sel.trackingRaf = requestAnimationFrame(tick)
    } else {
      removeSelectionOverlay(element)
    }
  })

  selectionOverlays.push({ element, overlay, toolbar, trackingRaf, summary, xpath, sourceLocation })
}

function updateSelectionPosition(overlay, toolbar, element) {
  try {
    const rect = element.getBoundingClientRect()
    overlay.style.left = rect.left + 'px'
    overlay.style.top = rect.top + 'px'
    overlay.style.width = rect.width + 'px'
    overlay.style.height = rect.height + 'px'

    // Position toolbar above element, or below if not enough space
    const toolbarHeight = 32
    const spaceAbove = rect.top
    const placeAbove = spaceAbove >= toolbarHeight + 8

    toolbar.style.left = rect.left + 'px'
    if (placeAbove) {
      toolbar.style.top = (rect.top - toolbarHeight - 4) + 'px'
    } else {
      toolbar.style.top = (rect.bottom + 4) + 'px'
    }
  } catch (e) {
    console.warn('[Selection] Failed to update position:', e)
  }
}

function removeSelectionOverlay(element) {
  const index = selectionOverlays.findIndex(s => s.element === element)
  if (index === -1) return

  const sel = selectionOverlays[index]
  if (sel.trackingRaf) cancelAnimationFrame(sel.trackingRaf)
  if (sel.overlay && sel.overlay.parentNode) sel.overlay.parentNode.removeChild(sel.overlay)
  if (sel.toolbar && sel.toolbar.parentNode) sel.toolbar.parentNode.removeChild(sel.toolbar)

  selectionOverlays.splice(index, 1)
  selectedElements = selectedElements.filter(el => el !== element)

  if (currentSelected === element) {
    currentSelected = selectedElements[0] || null
  }
}

function clearAllSelectionOverlays() {
  selectionOverlays.forEach(sel => {
    if (sel.trackingRaf) cancelAnimationFrame(sel.trackingRaf)
    if (sel.overlay && sel.overlay.parentNode) sel.overlay.parentNode.removeChild(sel.overlay)
    if (sel.toolbar && sel.toolbar.parentNode) sel.toolbar.parentNode.removeChild(sel.toolbar)
  })
  selectionOverlays = []
  selectedElements = []
  currentSelected = null
}

function hideAllOverlays() {
  const hover = document.getElementById('cluso-hover-overlay')
  const sel = document.getElementById('cluso-selection-overlay')
  const rect = document.getElementById('cluso-rect-selection')
  if (hover) hover.classList.remove('visible')
  if (sel) sel.classList.remove('visible')
  if (rect) rect.style.display = 'none'
}

// Get all elements intersecting with a rectangle
function getElementsInRect(x1, y1, x2, y2) {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const right = Math.max(x1, x2)
  const bottom = Math.max(y1, y2)

  const selector = 'button, a, input, textarea, select, img, video, h1, h2, h3, h4, h5, h6, p, span, div, section, article, nav, header, footer, form, label, li'
  const allElements = document.querySelectorAll(selector)
  const intersecting = []

  allElements.forEach(el => {
    const rect = el.getBoundingClientRect()
    // Check if element intersects with selection rectangle
    if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
      // Skip if it's a parent of already-selected elements (prefer more specific)
      const dominated = intersecting.some(other => el.contains(other.element))
      if (!dominated && rect.width > 5 && rect.height > 5) {
        intersecting.push({ element: el, rect })
      }
    }
  })

  return intersecting
}

// CSS injection for hover/selection effects
// Inject CSS when DOM is ready
function injectStyles() {
  const style = document.createElement('style')
  style.id = 'inspector-styles'
  markClusoUi(style)
  style.textContent = `
    /* Animated overlay for inspector/screenshot/move hover */
    #cluso-hover-overlay {
      position: fixed;
      pointer-events: none;
      border: 2px dashed #3b82f6;
      border-radius: 8px;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
      z-index: 999998;
      opacity: 0;
      transition: opacity 120ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1), border-color 120ms cubic-bezier(0.4, 0, 0.2, 1), border-width 120ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    #cluso-hover-overlay.visible {
      opacity: 1;
    }
    #cluso-hover-overlay.selected {
      opacity: 1;
      border-width: 3px;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18), 0 4px 12px rgba(59, 130, 246, 0.22);
    }
    #cluso-hover-overlay.screenshot-mode {
      border-color: #9333ea;
      box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.15);
      background-color: rgba(147, 51, 234, 0.05);
    }
    #cluso-hover-overlay.move-mode {
      border-color: #f59e0b;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
    }

    /* Animated overlay for selection */
    #cluso-selection-overlay {
      position: fixed;
      pointer-events: none;
      border: 3px solid #3b82f6;
      border-radius: 8px;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(59, 130, 246, 0.3);
      z-index: 999999;
      opacity: 0;
      transition: opacity 120ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1), border-color 120ms cubic-bezier(0.4, 0, 0.2, 1), border-width 120ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    #cluso-selection-overlay.visible {
      opacity: 1;
    }

    /* Rectangle drag selection */
    #cluso-rect-selection {
      position: fixed;
      pointer-events: none;
      border: 2px dashed #3b82f6;
      border-radius: 4px;
      background-color: rgba(59, 130, 246, 0.1);
      z-index: 999997;
      display: none;
    }
    #cluso-rect-selection.screenshot-mode {
      border-color: #9333ea;
      background-color: rgba(147, 51, 234, 0.1);
    }

    /* Selection is indicated by the overlay (not by mutating target elements). */
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

    .move-floating-overlay.screenshot-mode {
      outline: none !important;
      outline-offset: 0 !important;
      box-shadow: none !important;
    }

    .move-resize-handle.screenshot-mode {
      display: none !important;
    }

    .move-position-label.screenshot-mode {
      display: none !important;
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
  if (isRectSelecting) return // Don't hover while rect selecting
  if (isPartOfMoveOverlay(e.target)) return // Don't highlight move overlays

  // For inspector mode:
  // - If NO elements selected yet: always show hover (first selection)
  // - If elements ARE selected: only show hover when Shift is pressed (multi-select)
  // For screenshot/move modes: always show hover
  if (isInspectorActive && selectedElements.length > 0 && !e.shiftKey) {
    // Clear hover if Shift is not pressed and we have selections
    if (currentHovered) {
      currentHovered = null
      renderInspectorOverlay()
      ipcRenderer.sendToHost('inspector-hover-end')
    }
    return
  }

  e.stopPropagation()

  // Update animated hover overlay
  currentHovered = e.target
  renderInspectorOverlay()
  if (isInspectorActive) startSelectionTracking()

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

  // Only hide hover overlay if we're leaving the hovered element
  if (e.target === currentHovered) {
    currentHovered = null
    if (isInspectorActive && currentSelected) {
      renderInspectorOverlay()
    } else {
      updateHoverOverlay(null)
    }
  }

  // Clear hover info
  ipcRenderer.sendToHost('inspector-hover-end')
}, true)

// Handle Shift key for dynamic hover highlighting
let lastMouseElement = null
document.addEventListener('mousemove', function(e) {
  if (!isInspectorActive) return
  if (isEditing || isRectSelecting) return
  lastMouseElement = e.target
}, true)

document.addEventListener('keydown', function(e) {
  if (!isInspectorActive) return
  if (e.key !== 'Shift') return
  // Only trigger on Shift if we have selections (otherwise hover is automatic)
  if (selectedElements.length === 0) return

  // When Shift is pressed, trigger hover on current mouse position
  if (lastMouseElement && !currentHovered) {
    currentHovered = lastMouseElement
    renderInspectorOverlay()
    startSelectionTracking()

    const summary = getElementSummary(lastMouseElement)
    const rect = lastMouseElement.getBoundingClientRect()
    ipcRenderer.sendToHost('inspector-hover', {
      element: summary,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    })
  }
}, true)

document.addEventListener('keyup', function(e) {
  if (!isInspectorActive) return
  if (e.key !== 'Shift') return
  // Only clear on Shift release if we have selections
  if (selectedElements.length === 0) return

  // When Shift is released, clear hover
  if (currentHovered) {
    currentHovered = null
    renderInspectorOverlay()
    ipcRenderer.sendToHost('inspector-hover-end')
  }
}, true)

document.addEventListener('click', async function(e) {
  // Early return FIRST - don't intercept clicks when no mode is active
  if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return
  if (isEditing) return // Don't select new elements while inline editing
  if (isRectSelecting) return // Don't click while rect selecting

  // Only log and intercept if a mode is active
  console.log('[Inspector] Click intercepted, mode:', isInspectorActive ? 'inspector' : isScreenshotActive ? 'screenshot' : 'move')

  e.preventDefault()
  e.stopPropagation()

  const summary = getElementSummary(e.target)
  const rect = e.target.getBoundingClientRect()
  const xpath = getXPath(e.target)

  // Get source location asynchronously
  const sourceLocation = await getSourceLocation(e.target)

  console.log('[Inspector] Element selected:', summary.tagName, summary.id || summary.className, 'source:', sourceLocation?.summary || 'none')

  if (isInspectorActive) {
    // Multi-select: Shift+click adds to selection, regular click replaces
    if (e.shiftKey) {
      // Add to selection if not already selected
      if (!selectedElements.includes(e.target)) {
        selectedElements.push(e.target)
        createSelectionOverlay(e.target, summary, xpath, sourceLocation, rect)
      }
    } else {
      // Clear previous selections and select only this element
      clearAllSelectionOverlays()
      selectedElements = [e.target]
      currentSelected = e.target
      createSelectionOverlay(e.target, summary, xpath, sourceLocation, rect)
    }

    currentHovered = null

    const payload = {
      element: { ...summary, xpath, sourceLocation },
      x: e.clientX,
      y: e.clientY,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      isMultiSelect: e.shiftKey,
      selectedCount: selectedElements.length
    }
    console.log('[Inspector] Sending inspector-select:', payload.element.tagName, 'multi-select:', payload.isMultiSelect, 'count:', payload.selectedCount)
    ipcRenderer.sendToHost('inspector-select', payload)
  } else if (isScreenshotActive) {
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

// Rectangle drag selection - mousedown to start
// Hold Shift to start rectangle selection from anywhere
document.addEventListener('mousedown', function(e) {
  if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return
  if (e.button !== 0) return // Only left click
  if (!e.shiftKey) return // Require Shift key for rect selection

  e.preventDefault()
  e.stopPropagation()

  // Clear any text selection
  window.getSelection()?.removeAllRanges()

  // Disable text selection on body while dragging
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'

  isRectSelecting = true
  rectStartX = e.clientX
  rectStartY = e.clientY

  ensureOverlays()
  const rectEl = document.getElementById('cluso-rect-selection')
  rectEl.style.left = rectStartX + 'px'
  rectEl.style.top = rectStartY + 'px'
  rectEl.style.width = '0px'
  rectEl.style.height = '0px'
  rectEl.style.display = 'block'
  if (isScreenshotActive) {
    rectEl.classList.add('screenshot-mode')
  } else {
    rectEl.classList.remove('screenshot-mode')
  }

  updateHoverOverlay(null) // Hide hover overlay while dragging
}, true)

// Rectangle drag selection - mousemove to resize
document.addEventListener('mousemove', function(e) {
  if (!isRectSelecting) return

  e.preventDefault() // Prevent text selection while dragging

  const rectEl = document.getElementById('cluso-rect-selection')
  const left = Math.min(e.clientX, rectStartX)
  const top = Math.min(e.clientY, rectStartY)
  const width = Math.abs(e.clientX - rectStartX)
  const height = Math.abs(e.clientY - rectStartY)

  rectEl.style.left = left + 'px'
  rectEl.style.top = top + 'px'
  rectEl.style.width = width + 'px'
  rectEl.style.height = height + 'px'
}, true)

// Rectangle drag selection - mouseup to finish
document.addEventListener('mouseup', function(e) {
  if (!isRectSelecting) return

  isRectSelecting = false

  // Re-enable text selection
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''

  const rectEl = document.getElementById('cluso-rect-selection')
  rectEl.style.display = 'none'

  const width = Math.abs(e.clientX - rectStartX)
  const height = Math.abs(e.clientY - rectStartY)

  // Only process if dragged a meaningful distance
  if (width > 20 && height > 20) {
    const elements = getElementsInRect(rectStartX, rectStartY, e.clientX, e.clientY)

    if (elements.length > 0) {
      // Collect all element data
      const elementsData = elements.map(({ element, rect }) => ({
        element: getElementSummary(element),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      }))

      // Send rectangle selection to host
      const messageType = isScreenshotActive ? 'screenshot-rect-select' : 'inspector-rect-select'
      ipcRenderer.sendToHost(messageType, {
        elements: elementsData,
        selectionRect: {
          left: Math.min(rectStartX, e.clientX),
          top: Math.min(rectStartY, e.clientY),
          width: width,
          height: height
        }
      })
    }
  }
}, true)

// Listen for mode changes from host
ipcRenderer.on('set-inspector-mode', (event, active) => {
  console.log('[Inspector] set-inspector-mode received:', active)
  isInspectorActive = active
  if (active) isScreenshotActive = false
  // Ensure no legacy solid selection overlay remains visible/attached
  try {
    const sel = document.getElementById('cluso-selection-overlay')
    if (sel) sel.remove()
  } catch (e) {}
  // Ensure we never leave marker classes on the page DOM
  try {
    document.querySelectorAll('.inspector-hover-target,.inspector-selected-target,.screenshot-hover-target,.move-hover-target')
      .forEach(el => {
        el.classList.remove('inspector-hover-target', 'inspector-selected-target', 'screenshot-hover-target', 'move-hover-target')
      })
  } catch (e) {}

  // Set a global cursor for modes without mutating individual page nodes
  try {
    if (active) document.documentElement.style.cursor = 'crosshair'
    else if (!isScreenshotActive && !isMoveActive) document.documentElement.style.cursor = ''
  } catch (e) {}

  if (!active) {
    // Clean up all inspector UI when turning off
    if (currentSelected) {
      currentSelected.classList.remove('inspector-drag-over')
      currentSelected = null
    }
    currentHovered = null
    stopSelectionTracking()
    clearAllSelectionOverlays()
    try {
      const hover = document.getElementById('cluso-hover-overlay')
      if (hover) hover.classList.remove('selected')
    } catch (e) {}
    hideAllOverlays()
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
      currentSelected = null
    }
    updateSelectionOverlay(null)
  }
  try {
    if (active) document.documentElement.style.cursor = 'crosshair'
    else if (!isInspectorActive && !isMoveActive) document.documentElement.style.cursor = ''
  } catch (e) {}
  if (!active) {
    hideAllOverlays()
  }
})

ipcRenderer.on('set-move-mode', (event, active) => {
  console.log('[Inspector] set-move-mode received:', active)
  isMoveActive = active
  if (active) {
    isInspectorActive = false
    // DON'T disable screenshot mode - allow both to work together
    if (currentSelected) {
      currentSelected = null
    }
  } else {
    currentHovered = null
    hideAllOverlays()
    cleanupAllMoveOverlays()
  }
  try {
    if (active) document.documentElement.style.cursor = 'move'
    else if (!isInspectorActive && !isScreenshotActive) document.documentElement.style.cursor = ''
  } catch (e) {}
})

// Clear selection on request
ipcRenderer.on('clear-selection', () => {
  clearNumberBadges()
  if (currentSelected) {
    currentSelected = null
  }
  currentHovered = null
  stopSelectionTracking()
  clearAllSelectionOverlays()
  try {
    const hover = document.getElementById('cluso-hover-overlay')
    if (hover) hover.classList.remove('selected')
  } catch (e) {}
  hideAllOverlays()
})

// Select a layer element by elementNumber (from Layers panel) and mirror as an inspector selection
ipcRenderer.on('select-layer-element-by-number', async (_event, elementNumber) => {
  try {
    const map = window.__layersElements
    if (!map || !(map instanceof Map)) return
    const el = map.get(elementNumber)
    if (!el) return

    currentSelected = el
    ensureOverlays()
    try {
      const overlay = document.getElementById('cluso-hover-overlay')
      if (overlay) overlay.classList.add('selected')
    } catch (e) {}
    updateHoverOverlay(el)
    startSelectionTracking()
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (e) {}

    // Send back a standard inspector-select payload so the host stays in sync
    const summary = getElementSummary(el)
    const rect = el.getBoundingClientRect()
    const xpath = getXPath(el)
    const sourceLocation = await getSourceLocation(el)
    ipcRenderer.sendToHost('inspector-select', {
      element: { ...summary, xpath, sourceLocation },
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      source: 'layers',
    })
  } catch (e) {
    console.warn('[Inspector] select-layer-element-by-number failed:', e?.message || e)
  }
})

// Highlight element by number - for voice control
ipcRenderer.on('highlight-element-by-number', (event, elementNumber) => {
  console.log('[AI] Highlighting element by number:', elementNumber)

  // If we have multiple matches from a previous selector, use those
  if (multipleMatches.length > 0) {
    const index = elementNumber - 1 // Convert to 0-indexed
    if (index >= 0 && index < multipleMatches.length) {
      const element = multipleMatches[index]

      currentSelected = element
      ensureOverlays()
      try {
        const overlay = document.getElementById('cluso-hover-overlay')
        if (overlay) overlay.classList.add('selected')
      } catch (e) {}
      updateHoverOverlay(element)
      startSelectionTracking()
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const summary = getElementSummary(element)
      const rect = element.getBoundingClientRect()

      ipcRenderer.sendToHost('HIGHLIGHT_BY_NUMBER_SUCCESS', {
        elementNumber: elementNumber,
        element: summary,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      })
    } else {
      ipcRenderer.sendToHost('HIGHLIGHT_BY_NUMBER_FAILED', {
        elementNumber: elementNumber,
        error: `Element number ${elementNumber} not found. Valid range: 1-${multipleMatches.length}`
      })
    }
  } else {
    // No previous selector - try to find all interactive elements and number them
    const interactiveSelector = 'button, a, input, [role="button"], [onclick], img, video, h1, h2, h3, p, span, div[class*="card"], div[class*="item"]'
    const elements = document.querySelectorAll(interactiveSelector)

    if (elements.length === 0) {
      ipcRenderer.sendToHost('HIGHLIGHT_BY_NUMBER_FAILED', {
        elementNumber: elementNumber,
        error: 'No elements found on page to highlight'
      })
      return
    }

    // Store and number all elements
    clearNumberBadges()
    multipleMatches = Array.from(elements)

    multipleMatches.forEach((element, index) => {
      const badge = createNumberBadge(index + 1)
      element.style.position = element.style.position || 'relative'
      element.appendChild(badge)
      numberBadges.push(badge)
    })

    // Now highlight the requested number
    const index = elementNumber - 1
    if (index >= 0 && index < multipleMatches.length) {
      const element = multipleMatches[index]
      currentSelected = element
      ensureOverlays()
      try {
        const overlay = document.getElementById('cluso-hover-overlay')
        if (overlay) overlay.classList.add('selected')
      } catch (e) {}
      updateHoverOverlay(element)
      startSelectionTracking()
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const summary = getElementSummary(element)
      const rect = element.getBoundingClientRect()

      ipcRenderer.sendToHost('HIGHLIGHT_BY_NUMBER_SUCCESS', {
        elementNumber: elementNumber,
        element: summary,
        totalElements: multipleMatches.length,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      })
    } else {
      ipcRenderer.sendToHost('HIGHLIGHT_BY_NUMBER_FAILED', {
        elementNumber: elementNumber,
        error: `Element number ${elementNumber} not found. Valid range: 1-${multipleMatches.length}`
      })
    }
  }
})

// Clear number badges helper
function clearNumberBadges() {
  numberBadges.forEach(badge => badge.remove())
  numberBadges = []
  multipleMatches = []
}

// Create number badge for element
function createNumberBadge(number) {
  const badge = document.createElement('div')
  badge.className = 'element-number-badge'
  badge.textContent = number
  markClusoUi(badge)
  return badge
}

// Get source location from page context (async)
// Uses bippy's __SOURCE_LOCATION__ API if available (from the target app),
// otherwise falls back to our injected extractReactContext
function getSourceLocation(el) {
  return new Promise((resolve) => {
    try {
      const uniqueId = `source-${Date.now()}-${Math.random().toString(36).substring(7)}`
      el.setAttribute('data-source-id', uniqueId)

      // Inject script into page context - handles async APIs properly
      const script = document.createElement('script')
      script.textContent = `
        (async function() {
          const el = document.querySelector('[data-source-id="${uniqueId}"]');
          if (!el) return;

          let sourceInfo = null;

          // Debug: Log what APIs are available
          const reactRootDiv = document.getElementById('__next') || document.getElementById('root') || document.getElementById('app');
          const rootKeys = reactRootDiv ? Object.getOwnPropertyNames(reactRootDiv).filter(k => k.startsWith('__')) : [];

          console.log('[Page] Available APIs:', {
            hasSourceLocation: !!window.__SOURCE_LOCATION__,
            sourceLocationMethods: window.__SOURCE_LOCATION__ ? Object.keys(window.__SOURCE_LOCATION__) : [],
            hasExtractReactContext: !!window.extractReactContext,
            hasDevToolsHook: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            hasNearestComponentName: !!window.getNearestComponentName,
            rootElement: reactRootDiv ? reactRootDiv.id : 'none',
            rootSpecialKeys: rootKeys
          });

          // Debug: Check if React root has fiber
          if (reactRootDiv) {
            const keys = Object.getOwnPropertyNames(reactRootDiv);
            console.log('[Page] React root element total keys:', keys.length);
            const specialKeys = keys.filter(k => k.includes('react') || k.includes('React') || k.startsWith('__'));
            console.log('[Page] React root special keys:', specialKeys);
          }

          // Check for React DevTools hook state
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            console.log('[Page] DevTools hook found:', {
              hasRenderers: !!hook.renderers,
              renderersSize: hook.renderers?.size || 0,
              hookKeys: Object.keys(hook)
            });
          } else {
            console.log('[Page] No __REACT_DEVTOOLS_GLOBAL_HOOK__ found');
          }

          // PRIMARY: Use ReactGrab if available (loaded via CDN script tag)
          // ReactGrab handles React 19 source maps correctly
          if (typeof ReactGrab !== 'undefined' && ReactGrab.getStack) {
            try {
              console.log('[Page] Trying ReactGrab.getStack...');
              const stackFrames = await ReactGrab.getStack(el);
              console.log('[Page] ReactGrab result:', stackFrames);
              
              if (stackFrames && stackFrames.length > 0) {
                const sources = stackFrames
                  .filter(f => f.fileName && !f.fileName.includes('node_modules'))
                  .map((f, i) => ({
                    name: f.functionName || el.tagName.toLowerCase(),
                    file: f.fileName,
                    line: f.lineNumber || 0,
                    column: f.columnNumber || 0,
                    isJSXLocation: i === 0
                  }));
                
                if (sources.length > 0) {
                  sourceInfo = {
                    sources: sources,
                    summary: sources[0].file + ':' + sources[0].line
                  };
                  console.log('[Page] Source from ReactGrab:', sourceInfo.summary);
                }
              }
            } catch (e) {
              console.log('[Page] ReactGrab error:', e.message);
            }
          } else {
            console.log('[Page] ReactGrab not available');
          }

          // FALLBACK 1: Use app's built-in __SOURCE_LOCATION__ API (bippy-based)
          if (!sourceInfo && window.__SOURCE_LOCATION__ && window.__SOURCE_LOCATION__.getElementSourceLocation) {
            try {
              console.log('[Page] Trying __SOURCE_LOCATION__ API...');
              const result = await window.__SOURCE_LOCATION__.getElementSourceLocation(el);
              console.log('[Page] __SOURCE_LOCATION__ raw result:', result);
              if (result && result.sources && result.sources.length > 0) {
                sourceInfo = result;
                console.log('[Page] Source from __SOURCE_LOCATION__:', sourceInfo.summary);
              }
            } catch (e) {
              console.log('[Page] __SOURCE_LOCATION__ error:', e.message);
            }
          }

          // FALLBACK 2: Use our injected extractReactContext
          if (!sourceInfo && window.extractReactContext) {
            try {
              const context = window.extractReactContext(el);
              console.log('[Page] extractReactContext result:', JSON.stringify(context, null, 2));

              if (context && context.componentStack && context.componentStack.length > 0) {
                const stack = context.componentStack;

                // Log all components with their source info for debugging
                console.log('[Page] Component stack (nearest to root):');
                stack.forEach((c, i) => {
                  console.log('  [' + i + '] ' + c.componentName + ' -> ' + (c.fileName || 'NO SOURCE'));
                });

                // IMPORTANT: React's _debugSource points to where component is USED, not DEFINED
                // So if we see <Notebook /> in App.tsx, debugSource = App.tsx:line
                // But Notebook is actually defined in Notebook.tsx
                // We need to use component name as hint for the actual file

                const genericFiles = ['app.tsx', 'app.jsx', 'index.tsx', 'index.jsx', 'main.tsx', 'main.jsx', 'App.tsx', 'App.jsx'];

                // Get the nearest/first component
                const nearestComponent = stack[0];

                // Check if the fileName matches the component name (meaning we found the definition site)
                // e.g., componentName="Notebook" and fileName contains "notebook" or "Notebook"
                let bestMatch = stack.find(c => {
                  if (!c.fileName || !c.componentName) return false;
                  const fileNameLower = c.fileName.toLowerCase();
                  const compNameLower = c.componentName.toLowerCase();
                  return fileNameLower.includes(compNameLower);
                });

                // If no definition-site match, prefer non-generic files
                if (!bestMatch) {
                  bestMatch = stack.find(c => {
                    if (!c.fileName) return false;
                    const baseName = c.fileName.split('/').pop();
                    return !genericFiles.includes(baseName);
                  });
                }

                // Fallback: first with any filename
                if (!bestMatch) {
                  bestMatch = stack.find(c => c.fileName);
                }

                // If bestMatch file doesn't contain component name, show component name as hint
                const showComponentHint = bestMatch && nearestComponent &&
                  !bestMatch.fileName.toLowerCase().includes(nearestComponent.componentName.toLowerCase());

                if (bestMatch) {
                  // If the file is generic and doesn't match component name, show: "ComponentName (in App.tsx:9)"
                  let summary;
                  let sources;

                  if (showComponentHint) {
                    // The file path is the USAGE site, not the DEFINITION site
                    // Set the first source to use component name as the file (for editing)
                    const likelyFile = nearestComponent.componentName + '.tsx';
                    summary = nearestComponent.componentName + ' (used in ' + bestMatch.fileName + ':' + (bestMatch.lineNumber || 0) + ')';

                    // First source should point to the likely definition file
                    sources = [{
                      name: nearestComponent.componentName,
                      file: likelyFile,  // This is what editing logic should use
                      line: 0,  // We don't know the exact line
                      column: 0,
                      isLikelyDefinition: true,
                      usageSite: bestMatch.fileName + ':' + (bestMatch.lineNumber || 0)
                    }];

                    // Add the rest of the stack as additional sources
                    stack.forEach(c => {
                      sources.push({
                        name: c.componentName || 'Component',
                        file: c.fileName || '',
                        line: c.lineNumber || 0,
                        column: c.columnNumber || 0,
                        isUsageSite: true
                      });
                    });

                    console.log('[Page] Detected usage site - likely definition file:', likelyFile);
                  } else {
                    summary = bestMatch.fileName + ':' + (bestMatch.lineNumber || 0);
                    sources = stack.map(c => ({
                      name: c.componentName || 'Component',
                      file: c.fileName || '',
                      line: c.lineNumber || 0,
                      column: c.columnNumber || 0
                    }));
                  }

                  sourceInfo = {
                    sources: sources,
                    summary: summary,
                    componentStack: stack,
                    likelyDefinitionFile: nearestComponent ? nearestComponent.componentName + '.tsx' : null
                  };
                  console.log('[Page] Source from extractReactContext:', sourceInfo.summary);
                } else {
                  // Have component names but no file paths (production build)
                  sourceInfo = {
                    sources: stack.map(c => ({
                      name: c.componentName || 'Component',
                      file: '',
                      line: 0,
                      column: 0
                    })),
                    summary: stack.map(c => c.componentName).join(' > '),
                    componentStack: stack
                  };
                  console.log('[Page] Component hierarchy (no source):', sourceInfo.summary);
                }
              }
            } catch (e) {
              console.log('[Page] extractReactContext error:', e.message);
            }
          }

          // FALLBACK 2: Try bippy's direct functions if available
          if (!sourceInfo && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            try {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              if (hook.renderers && hook.renderers.size > 0) {
                for (const [id, renderer] of hook.renderers) {
                  if (renderer.findFiberByHostInstance) {
                    const fiber = renderer.findFiberByHostInstance(el);
                    if (fiber) {
                      console.log('[Page] Found fiber via DevTools hook');
                      // Walk up to find component with debug source
                      let current = fiber;
                      let depth = 0;
                      while (current && depth < 20) {
                        if (current._debugSource) {
                          const src = current._debugSource;
                          const name = current.type?.displayName || current.type?.name || 'Component';
                          sourceInfo = {
                            sources: [{
                              name: name,
                              file: src.fileName || '',
                              line: src.lineNumber || 0,
                              column: src.columnNumber || 0
                            }],
                            summary: (src.fileName || name) + ':' + (src.lineNumber || 0)
                          };
                          console.log('[Page] Source from DevTools fiber:', sourceInfo.summary);
                          break;
                        }
                        current = current.return;
                        depth++;
                      }
                      if (sourceInfo) break;
                    }
                  }
                }
              }
            } catch (e) {
              console.log('[Page] DevTools hook error:', e.message);
            }
          }

          // FALLBACK 3: Get component name from fiber even without full extraction
          if (!sourceInfo) {
            try {
              const name = window.getNearestComponentName ? window.getNearestComponentName(el) : null;
              if (name) {
                sourceInfo = {
                  sources: [{ name: name, file: '', line: 0, column: 0 }],
                  summary: name
                };
                console.log('[Page] Component name only:', name);
              }
            } catch (e) {
              console.log('[Page] getNearestComponentName error:', e.message);
            }
          }

          // FALLBACK 4: For Next.js Server Components, try to find source info from RSC payload
          // RSC payloads contain component mappings in script tags like:
          // self.__next_f.push([1,"13:[[\"RootLayout\",\"webpack-internal:///(rsc)/./app/layout.tsx\",27,87,26,1,false]]"])
          if (!sourceInfo) {
            try {
              console.log('[RSC] Attempting RSC payload extraction...');

              // Parse RSC payloads from __next_f
              const rscComponents = [];

              if (window.__next_f && Array.isArray(window.__next_f)) {
                console.log('[RSC] Found __next_f with', window.__next_f.length, 'entries');

                for (const entry of window.__next_f) {
                  if (!Array.isArray(entry) || entry.length < 2) continue;

                  const payload = entry[1];
                  if (typeof payload !== 'string') continue;

                  // Parse component array patterns: [[\"Name\",\"file\",line,col,...]]
                  // The format is: id:[["ComponentName","webpack-internal:///(rsc)/./path.tsx",line,col,endLine,endCol,isClient]]
                  const componentRegex = /\\[\\[?\\"([A-Z][a-zA-Z0-9_]*)\\",\\"([^"]+)\\",(\\d+),(\\d+)/g;
                  let match;

                  while ((match = componentRegex.exec(payload)) !== null) {
                    const [, componentName, filePath, line, col] = match;

                    // Skip internal Next.js components
                    if (componentName.startsWith('_') ||
                        componentName === 'html' ||
                        componentName === 'body' ||
                        filePath.includes('node_modules')) {
                      continue;
                    }

                    // Normalize the file path
                    let normalizedPath = filePath;
                    const prefixes = [
                      'webpack-internal:///(rsc)/',
                      'webpack-internal:///(ssr)/',
                      'webpack-internal:///(app-pages-browser)/',
                      'webpack://',
                      'rsc://React/Server/',
                    ];
                    for (const prefix of prefixes) {
                      if (normalizedPath.startsWith(prefix)) {
                        normalizedPath = normalizedPath.slice(prefix.length);
                      }
                    }

                    // Remove query params
                    const queryIndex = normalizedPath.indexOf('?');
                    if (queryIndex !== -1) {
                      normalizedPath = normalizedPath.slice(0, queryIndex);
                    }

                    rscComponents.push({
                      name: componentName,
                      file: normalizedPath,
                      line: parseInt(line, 10),
                      column: parseInt(col, 10)
                    });
                  }
                }
              }

              // Also try parsing script tags with RSC payloads
              if (rscComponents.length === 0) {
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                  const text = script.textContent || '';

                  // Look for self.__next_f.push patterns
                  if (text.includes('__next_f.push')) {
                    const componentRegex = /\\[\\[?\\"([A-Z][a-zA-Z0-9_]*)\\",\\"([^"]+)\\",(\\d+),(\\d+)/g;
                    let match;

                    while ((match = componentRegex.exec(text)) !== null) {
                      const [, componentName, filePath, line, col] = match;

                      if (componentName.startsWith('_') ||
                          componentName === 'html' ||
                          componentName === 'body' ||
                          filePath.includes('node_modules')) {
                        continue;
                      }

                      let normalizedPath = filePath;
                      const prefixes = [
                        'webpack-internal:///(rsc)/',
                        'webpack-internal:///(ssr)/',
                        'webpack-internal:///(app-pages-browser)/',
                        'webpack://',
                        'rsc://React/Server/',
                      ];
                      for (const prefix of prefixes) {
                        if (normalizedPath.startsWith(prefix)) {
                          normalizedPath = normalizedPath.slice(prefix.length);
                        }
                      }

                      const queryIndex = normalizedPath.indexOf('?');
                      if (queryIndex !== -1) {
                        normalizedPath = normalizedPath.slice(0, queryIndex);
                      }

                      rscComponents.push({
                        name: componentName,
                        file: normalizedPath,
                        line: parseInt(line, 10),
                        column: parseInt(col, 10)
                      });
                    }
                  }
                }
              }

              console.log('[RSC] Found', rscComponents.length, 'component mappings');

              if (rscComponents.length > 0) {
                // Try to match element to a component based on:
                // 1. Element's data attributes
                // 2. Element's class names that might match component names
                // 3. Element's tag/role structure

                // Get element context for matching
                const tagName = el.tagName.toLowerCase();
                const className = el.className || '';
                const classNames = typeof className === 'string' ? className.split(/\\s+/) : [];

                // Check for data attributes
                let matchedComponent = null;
                let current = el;
                let depth = 0;

                while (current && depth < 10 && !matchedComponent) {
                  const attrs = Array.from(current.attributes || []);

                  for (const attr of attrs) {
                    // Check for common React/Next.js patterns in data attributes
                    if (attr.name.startsWith('data-') && attr.value) {
                      const attrValue = attr.value.toLowerCase();

                      // Try to find a component whose name matches the data attribute
                      for (const comp of rscComponents) {
                        const compNameLower = comp.name.toLowerCase();
                        if (attrValue.includes(compNameLower) ||
                            attr.name.toLowerCase().includes(compNameLower)) {
                          matchedComponent = comp;
                          console.log('[RSC] Matched via data attr:', attr.name, '->', comp.name);
                          break;
                        }
                      }
                      if (matchedComponent) break;
                    }
                  }

                  // Try matching by class name
                  if (!matchedComponent) {
                    const currentClassNames = typeof current.className === 'string'
                      ? current.className.split(/\\s+/)
                      : [];

                    for (const cls of currentClassNames) {
                      // Convert class name to potential component name (kebab-case to PascalCase)
                      const potentialName = cls
                        .split('-')
                        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                        .join('');

                      for (const comp of rscComponents) {
                        if (comp.name === potentialName ||
                            comp.name.toLowerCase() === cls.toLowerCase()) {
                          matchedComponent = comp;
                          console.log('[RSC] Matched via class:', cls, '->', comp.name);
                          break;
                        }
                      }
                      if (matchedComponent) break;
                    }
                  }

                  current = current.parentElement;
                  depth++;
                }

                // If no direct match, provide the component hierarchy from RSC
                if (!matchedComponent && rscComponents.length > 0) {
                  // Return the component stack - most specific components first
                  // Filter to only user-defined components
                  const userComponents = rscComponents.filter(c =>
                    !c.name.startsWith('_') &&
                    c.file &&
                    c.file.includes('/') &&
                    !c.file.includes('node_modules')
                  );

                  if (userComponents.length > 0) {
                    // Get unique components by name (first occurrence = most specific)
                    const seen = new Set();
                    const uniqueComponents = [];
                    for (const comp of userComponents) {
                      if (!seen.has(comp.name)) {
                        seen.add(comp.name);
                        uniqueComponents.push(comp);
                      }
                    }

                    sourceInfo = {
                      sources: uniqueComponents.slice(0, 5).map(c => ({
                        name: c.name,
                        file: c.file,
                        line: c.line,
                        column: c.column
                      })),
                      summary: uniqueComponents[0].file + ':' + uniqueComponents[0].line,
                      componentStack: uniqueComponents.slice(0, 5),
                      isRSC: true
                    };
                    console.log('[RSC] Source from RSC payload (hierarchy):', sourceInfo.summary);
                  }
                }

                if (matchedComponent) {
                  sourceInfo = {
                    sources: [{
                      name: matchedComponent.name,
                      file: matchedComponent.file,
                      line: matchedComponent.line,
                      column: matchedComponent.column
                    }],
                    summary: matchedComponent.file + ':' + matchedComponent.line,
                    componentStack: [matchedComponent],
                    isRSC: true
                  };
                  console.log('[RSC] Source from RSC payload (matched):', sourceInfo.summary);
                }
              } else {
                console.log('[RSC] No RSC payload found - this may be a non-Next.js app or production build');
              }
            } catch (e) {
              console.log('[RSC] RSC fallback error:', e.message);
            }
          }

          if (sourceInfo) {
            el.setAttribute('data-source-info', JSON.stringify(sourceInfo));
            console.log('[Page] Final source info:', sourceInfo.summary);
          } else {
            console.log('[Page] No source location found');
          }
        })();
      `
      document.documentElement.appendChild(script)
      script.remove()

      // Wait for the async script to execute
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
      }, 300) // Increased timeout for async operations
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
      currentSelected = null
    }
    stopSelectionTracking()
    try {
      const hover = document.getElementById('cluso-hover-overlay')
      if (hover) hover.classList.remove('selected')
    } catch (e) {}

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
let originalTextContent = null
let isEditing = false
let editToolbar = null
let editingSourceLocation = null // Store source location when editing starts

function createEditToolbar(element) {
  if (editToolbar) editToolbar.remove()

  editToolbar = document.createElement('div')
  editToolbar.className = 'inspector-edit-toolbar'
  markClusoUi(editToolbar)

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
    const xpath = getXPath(element)
    // Include source location captured when editing started
    ipcRenderer.sendToHost('inline-edit-accept', {
      oldText: originalTextContent,
      newText: newText,
      element: { ...getElementSummary(element), xpath, sourceLocation: editingSourceLocation }
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

async function startEditing(element) {
  if (isEditing) return

  // Only allow editing for text-like elements
  const tagName = element.tagName.toLowerCase()
  if (['img', 'video', 'audio', 'iframe', 'canvas', 'svg'].includes(tagName)) return
  if (element.children.length > 0 && element.textContent.trim().length > 200) return // Skip complex elements

  isEditing = true
  originalTextContent = element.textContent

  // Get source location now so we have it when accepting the edit
  editingSourceLocation = await getSourceLocation(element)
  console.log('[Inline Edit] Started editing, source location:', editingSourceLocation?.summary || 'none')

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
  editingSourceLocation = null // Clear stored source location

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
  markClusoUi(overlay)
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
    markClusoUi(handle)
    overlay.appendChild(handle)
  })

  document.body.appendChild(overlay)

  // Create position label
  const positionLabel = document.createElement('div')
  positionLabel.className = 'move-position-label'
  markClusoUi(positionLabel)
  document.body.appendChild(positionLabel)

  // Store overlay data with initial scroll position
  const overlayData = {
    overlay,
    element,
    originalRect,
    elementData: { summary, xpath, sourceLocation },
    positionLabel,
    initialScrollX: window.scrollX,
    initialScrollY: window.scrollY,
    currentOffsetX: 0, // Track user drag offset separately from scroll
    currentOffsetY: 0
  }
  moveOverlays.push(overlayData)

  // Set up scroll handler on first overlay creation
  if (moveOverlays.length === 1 && !moveScrollHandler) {
    moveScrollHandler = handleMoveScroll
    window.addEventListener('scroll', moveScrollHandler, { passive: true })
    console.log('[Move] Scroll handler attached')
  }

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
    // Update the user offset (separate from scroll position)
    activeMoveOverlay.currentOffsetX += deltaX
    activeMoveOverlay.currentOffsetY += deltaY

    // Calculate new position based on original + scroll delta + user offset
    const scrollDeltaX = window.scrollX - activeMoveOverlay.initialScrollX
    const scrollDeltaY = window.scrollY - activeMoveOverlay.initialScrollY
    const newLeft = activeMoveOverlay.originalRect.left - scrollDeltaX + activeMoveOverlay.currentOffsetX
    const newTop = activeMoveOverlay.originalRect.top - scrollDeltaY + activeMoveOverlay.currentOffsetY

    overlay.style.left = newLeft + 'px'
    overlay.style.top = newTop + 'px'
  } else if (isResizing) {
    const currentWidth = parseFloat(overlay.style.width) || 100
    const currentHeight = parseFloat(overlay.style.height) || 100

    let offsetDeltaX = 0
    let offsetDeltaY = 0
    let newWidth = currentWidth
    let newHeight = currentHeight

    if (resizeHandle.includes('l')) {
      offsetDeltaX = deltaX
      newWidth = currentWidth - deltaX
    }
    if (resizeHandle.includes('r')) {
      newWidth = currentWidth + deltaX
    }
    if (resizeHandle.includes('t')) {
      offsetDeltaY = deltaY
      newHeight = currentHeight - deltaY
    }
    if (resizeHandle.includes('b')) {
      newHeight = currentHeight + deltaY
    }

    if (newWidth >= 20 && newHeight >= 20) {
      // Update offsets for left/top handle resizing
      activeMoveOverlay.currentOffsetX += offsetDeltaX
      activeMoveOverlay.currentOffsetY += offsetDeltaY

      // Calculate new position
      const scrollDeltaX = window.scrollX - activeMoveOverlay.initialScrollX
      const scrollDeltaY = window.scrollY - activeMoveOverlay.initialScrollY
      const newLeft = activeMoveOverlay.originalRect.left - scrollDeltaX + activeMoveOverlay.currentOffsetX
      const newTop = activeMoveOverlay.originalRect.top - scrollDeltaY + activeMoveOverlay.currentOffsetY

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

// Handle scroll events to move overlays with page content
function handleMoveScroll() {
  if (moveOverlays.length === 0) return

  moveOverlays.forEach(overlayData => {
    // Calculate scroll delta from when overlay was created
    const scrollDeltaX = window.scrollX - overlayData.initialScrollX
    const scrollDeltaY = window.scrollY - overlayData.initialScrollY

    // New position = original position - scroll delta + any user drag offset
    const newLeft = overlayData.originalRect.left - scrollDeltaX + overlayData.currentOffsetX
    const newTop = overlayData.originalRect.top - scrollDeltaY + overlayData.currentOffsetY

    overlayData.overlay.style.left = newLeft + 'px'
    overlayData.overlay.style.top = newTop + 'px'

    // Update position label
    updatePositionLabelFor(overlayData)
  })
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
  // Remove scroll handler
  if (moveScrollHandler) {
    window.removeEventListener('scroll', moveScrollHandler)
    moveScrollHandler = null
    console.log('[Move] Scroll handler removed')
  }

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

// Hide move handles for screenshot (keeps element visible, hides all chrome)
ipcRenderer.on('hide-move-handles', () => {
  moveOverlays.forEach(overlayData => {
    // Add screenshot-mode class to hide all chrome
    overlayData.overlay.classList.add('screenshot-mode')
    // Hide handles
    const handles = overlayData.overlay.querySelectorAll('.move-resize-handle')
    handles.forEach(handle => {
      handle.classList.add('screenshot-mode')
    })
    // Hide position label
    if (overlayData.positionLabel) {
      overlayData.positionLabel.classList.add('screenshot-mode')
    }
  })
  console.log('[Move] Handles hidden for screenshot')
})

// Show move handles after screenshot
ipcRenderer.on('show-move-handles', () => {
  moveOverlays.forEach(overlayData => {
    // Remove screenshot-mode class to restore all chrome
    overlayData.overlay.classList.remove('screenshot-mode')
    // Show handles
    const handles = overlayData.overlay.querySelectorAll('.move-resize-handle')
    handles.forEach(handle => {
      handle.classList.remove('screenshot-mode')
    })
    // Show position label
    if (overlayData.positionLabel) {
      overlayData.positionLabel.classList.remove('screenshot-mode')
    }
  })
  console.log('[Move] Handles restored after screenshot')
})
