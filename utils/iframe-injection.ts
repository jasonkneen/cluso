import { REACT_FIBER_EXTRACTION_SCRIPT, RSC_EXTRACTION_SCRIPT } from './react-fiber-extraction'

// The parent origin is set dynamically when the inspector is activated
// This prevents broadcasting messages to arbitrary windows
export const INJECTION_SCRIPT = `
<style>
  /* Animated overlay for inspector/screenshot hover and selection */
  #cluso-hover-overlay {
    position: fixed;
    pointer-events: none;
    border: 2px dashed #3b82f6;
    border-radius: 8px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
    z-index: 999998;
    opacity: 0;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  #cluso-hover-overlay.visible {
    opacity: 1;
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

  #cluso-selection-overlay {
    position: fixed;
    pointer-events: none;
    border: 3px solid #3b82f6;
    border-radius: 8px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(59, 130, 246, 0.3);
    z-index: 999999;
    opacity: 0;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
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

  /* Legacy class support */
  .inspector-selected-target {
    position: relative !important;
    z-index: 9999 !important;
  }

  .screenshot-hover-target {
    cursor: camera !important;
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

  .drop-zone-label::before {
    content: '📥' !important;
    font-size: 16px !important;
  }
</style>
<script>
  // --- React Fiber Extraction (based on bippy patterns) ---
  ${REACT_FIBER_EXTRACTION_SCRIPT}

  // --- RSC (React Server Components) Extraction ---
  ${RSC_EXTRACTION_SCRIPT}

  (function() {
    let currentSelected = null;
    let currentHovered = null;
    let isInspectorActive = false;
    let isScreenshotActive = false;
    let isMoveActive = false;
    let multipleMatches = [];
    let numberBadges = [];
    // Store the parent's origin for secure postMessage calls
    // This is set when the inspector is first activated
    let trustedOrigin = null;

    // Rectangle selection state
    let isRectSelecting = false;
    let rectStartX = 0;
    let rectStartY = 0;

    // Create overlay elements
    function ensureOverlays() {
      if (!document.getElementById('cluso-hover-overlay')) {
        const hover = document.createElement('div');
        hover.id = 'cluso-hover-overlay';
        document.body.appendChild(hover);
      }
      if (!document.getElementById('cluso-selection-overlay')) {
        const sel = document.createElement('div');
        sel.id = 'cluso-selection-overlay';
        document.body.appendChild(sel);
      }
      if (!document.getElementById('cluso-rect-selection')) {
        const rect = document.createElement('div');
        rect.id = 'cluso-rect-selection';
        document.body.appendChild(rect);
      }
    }

    // Position overlay to match element
    function positionOverlay(overlay, rect) {
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
    }

    function updateHoverOverlay(element) {
      ensureOverlays();
      const overlay = document.getElementById('cluso-hover-overlay');
      if (!element) {
        overlay.classList.remove('visible');
        return;
      }
      const rect = element.getBoundingClientRect();
      positionOverlay(overlay, rect);
      overlay.classList.remove('screenshot-mode', 'move-mode');
      if (isScreenshotActive) overlay.classList.add('screenshot-mode');
      if (isMoveActive) overlay.classList.add('move-mode');
      overlay.classList.add('visible');
    }

    function updateSelectionOverlay(element) {
      ensureOverlays();
      const overlay = document.getElementById('cluso-selection-overlay');
      if (!element) {
        overlay.classList.remove('visible');
        return;
      }
      const rect = element.getBoundingClientRect();
      positionOverlay(overlay, rect);
      overlay.classList.add('visible');
    }

    function hideAllOverlays() {
      const hover = document.getElementById('cluso-hover-overlay');
      const sel = document.getElementById('cluso-selection-overlay');
      const rect = document.getElementById('cluso-rect-selection');
      if (hover) hover.classList.remove('visible');
      if (sel) sel.classList.remove('visible');
      if (rect) rect.style.display = 'none';
    }

    // Get all elements intersecting with a rectangle
    function getElementsInRect(x1, y1, x2, y2) {
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const right = Math.max(x1, x2);
      const bottom = Math.max(y1, y2);

      const selector = 'button, a, input, textarea, select, img, video, h1, h2, h3, h4, h5, h6, p, span, div, section, article, nav, header, footer, form, label, li';
      const allElements = document.querySelectorAll(selector);
      const intersecting = [];

      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Check if element intersects with selection rectangle
        if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
          // Skip if it's a parent of already-selected elements (prefer more specific)
          const dominated = intersecting.some(other => el.contains(other.element));
          if (!dominated && rect.width > 5 && rect.height > 5) {
            intersecting.push({ element: el, rect });
          }
        }
      });

      return intersecting;
    }

    // --- Secure postMessage Helper ---
    // Only send messages to the trusted parent origin
    function securePostMessage(data) {
      if (!trustedOrigin) {
        // If origin not yet set, queue the message for when it's established
        // In practice, the parent always sends TOGGLE_INSPECTOR first which sets the origin
        console.warn('[Inspector] Cannot send message - trusted origin not set');
        return;
      }
      try {
        window.parent.postMessage(data, trustedOrigin);
      } catch (e) {
        // Fallback for cases where origin validation fails (e.g., file:// protocols)
        // In Electron, the parent is always trusted
        if (window.parent === window.top) {
          window.parent.postMessage(data, '*');
        }
      }
    }

    // --- Console Interception ---
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    function sendLog(level, args) {
      try {
        // Simple serialization of args
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
        }).join(' ');

        securePostMessage({
            type: 'CONSOLE_LOG',
            level: level,
            message: message,
            timestamp: Date.now()
        });
      } catch (e) {
        // ignore errors in logging to prevent infinite loops
      }
    }

    console.log = function(...args) {
        originalLog.apply(console, args);
        sendLog('log', args);
    };
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        sendLog('warn', args);
    };
    console.error = function(...args) {
        originalError.apply(console, args);
        sendLog('error', args);
    };

    // --- Inspector Logic ---

    function clearNumberBadges() {
      numberBadges.forEach(badge => badge.remove());
      numberBadges = [];
      multipleMatches.forEach(el => el.classList.remove('inspector-selected-target'));
      multipleMatches = [];
    }

    function createNumberBadge(number) {
      const badge = document.createElement('div');
      badge.className = 'element-number-badge';
      badge.setAttribute('data-cluso-ui', '1');
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = number;
      return badge;
    }

    // Enhanced element summary with React component info
    function getElementSummary(el) {
      const basicInfo = {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        text: el.innerText ? el.innerText.substring(0, 100) : '',
      };

      // Try to get React fiber info if available
      if (window.extractReactContext) {
        try {
          const reactContext = window.extractReactContext(el);

          // If we got a fiber with component info, use it
          if (reactContext.hasFiber && reactContext.componentStack?.length > 0) {
            return {
              ...basicInfo,
              // React component info
              componentStack: reactContext.componentStack || [],
              componentName: reactContext.componentStack?.[0]?.componentName || null,
              fileName: reactContext.componentStack?.[0]?.fileName || null,
              lineNumber: reactContext.componentStack?.[0]?.lineNumber || null,
              columnNumber: reactContext.componentStack?.[0]?.columnNumber || null,
              // Full context string (like react-grab format)
              fullContext: window.formatElementContext ? window.formatElementContext(el) : null,
              xpath: reactContext.xpath,
              attributes: reactContext.attributes,
              hasFiber: true,
              isRSC: false
            };
          }
        } catch (e) {
          console.warn('[Inspector] Failed to extract React context:', e);
        }
      }

      // Fallback: Try RSC extraction for Server Components (Next.js App Router)
      if (window.getRSCSourceForElement) {
        try {
          const rscSource = window.getRSCSourceForElement(el);
          if (rscSource && rscSource.sources?.length > 0) {
            return {
              ...basicInfo,
              componentStack: rscSource.componentStack || [],
              componentName: rscSource.sources[0]?.name || null,
              fileName: rscSource.sources[0]?.file || null,
              lineNumber: rscSource.sources[0]?.line || null,
              columnNumber: rscSource.sources[0]?.column || null,
              fullContext: rscSource.summary || null,
              xpath: window.getXPath ? window.getXPath(el) : null,
              attributes: Array.from(el.attributes || []).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {}),
              hasFiber: false,
              isRSC: true,
              rscMatched: rscSource.matched || false
            };
          }
        } catch (e) {
          console.warn('[Inspector] Failed to extract RSC source:', e);
        }
      }

      return basicInfo;
    }

    // Get XPath of element
    function getXPath(el) {
      if (!el) return '';
      if (el.id) return '//*[@id="' + el.id + '"]';

      const parts = [];
      while (el && el.nodeType === 1) {
        let idx = 1;
        for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
          if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++;
        }
        parts.unshift(el.tagName.toLowerCase() + '[' + idx + ']');
        el = el.parentNode;
      }
      return '/' + parts.join('/');
    }

    document.addEventListener('mouseover', function(e) {
      if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return;
      if (isRectSelecting) return; // Don't hover while rect selecting
      e.stopPropagation();

      currentHovered = e.target;
      updateHoverOverlay(e.target);

      // Send hover info to parent for display
      const summary = getElementSummary(e.target);
      const rect = e.target.getBoundingClientRect();
      securePostMessage({
        type: 'INSPECTOR_HOVER',
        element: summary,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      });
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return;
      e.stopPropagation();

      // Only hide hover if we're leaving the hovered element
      if (e.target === currentHovered) {
        currentHovered = null;
        updateHoverOverlay(null);
      }

      // Clear hover info
      securePostMessage({
        type: 'INSPECTOR_HOVER_END'
      });
    }, true);

    document.addEventListener('click', function(e) {
      if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return;
      if (isRectSelecting) return; // Don't click while rect selecting

      e.preventDefault();
      e.stopPropagation();

      const summary = getElementSummary(e.target);
      const rect = e.target.getBoundingClientRect();

      if (isInspectorActive || isMoveActive) {
          currentSelected = e.target;
          updateSelectionOverlay(e.target);

          securePostMessage({
            type: 'INSPECTOR_SELECT',
            element: summary,
            x: e.clientX,
            y: e.clientY,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            }
          });
      }
      else if (isScreenshotActive) {
           securePostMessage({
            type: 'SCREENSHOT_SELECT',
            element: summary,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            }
          });
      }
    }, true);

    // Rectangle drag selection - mousedown to start
    // Hold Shift to start rectangle selection from anywhere
    document.addEventListener('mousedown', function(e) {
      if (!isInspectorActive && !isScreenshotActive && !isMoveActive) return;
      if (e.button !== 0) return; // Only left click
      if (!e.shiftKey) return; // Require Shift key for rect selection

      e.preventDefault();
      e.stopPropagation();

      // Clear any text selection
      window.getSelection()?.removeAllRanges();

      // Disable text selection on body while dragging
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';

      isRectSelecting = true;
      rectStartX = e.clientX;
      rectStartY = e.clientY;

      ensureOverlays();
      const rectEl = document.getElementById('cluso-rect-selection');
      rectEl.style.left = rectStartX + 'px';
      rectEl.style.top = rectStartY + 'px';
      rectEl.style.width = '0px';
      rectEl.style.height = '0px';
      rectEl.style.display = 'block';
      rectEl.classList.toggle('screenshot-mode', isScreenshotActive);

      updateHoverOverlay(null); // Hide hover overlay
    }, true);

    // Rectangle drag selection - mousemove to resize
    document.addEventListener('mousemove', function(e) {
      if (!isRectSelecting) return;

      e.preventDefault(); // Prevent text selection while dragging

      const rectEl = document.getElementById('cluso-rect-selection');
      const left = Math.min(e.clientX, rectStartX);
      const top = Math.min(e.clientY, rectStartY);
      const width = Math.abs(e.clientX - rectStartX);
      const height = Math.abs(e.clientY - rectStartY);

      rectEl.style.left = left + 'px';
      rectEl.style.top = top + 'px';
      rectEl.style.width = width + 'px';
      rectEl.style.height = height + 'px';
    }, true);

    // Rectangle drag selection - mouseup to finish
    document.addEventListener('mouseup', function(e) {
      if (!isRectSelecting) return;

      isRectSelecting = false;

      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      const rectEl = document.getElementById('cluso-rect-selection');
      rectEl.style.display = 'none';

      const width = Math.abs(e.clientX - rectStartX);
      const height = Math.abs(e.clientY - rectStartY);

      // Only process if dragged a meaningful distance
      if (width > 20 && height > 20) {
        const elements = getElementsInRect(rectStartX, rectStartY, e.clientX, e.clientY);

        if (elements.length > 0) {
          // Collect all element data
          const elementsData = elements.map(({ element, rect }) => ({
            element: getElementSummary(element),
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          }));

          // Send rectangle selection to parent
          securePostMessage({
            type: isScreenshotActive ? 'SCREENSHOT_RECT_SELECT' : 'INSPECTOR_RECT_SELECT',
            elements: elementsData,
            selectionRect: {
              left: Math.min(rectStartX, e.clientX),
              top: Math.min(rectStartY, e.clientY),
              width: width,
              height: height
            }
          });
        }
      }
    }, true);

    // Listen for messages from parent to toggle modes
    window.addEventListener('message', function(event) {
        // Only accept messages from our parent window
        if (event.source !== window.parent) return;

        // Capture the trusted origin on first valid message from parent
        // This establishes a secure communication channel
        if (!trustedOrigin && event.origin) {
            trustedOrigin = event.origin;
        }

        if (event.data) {
            if (event.data.type === 'TOGGLE_INSPECTOR') {
                isInspectorActive = event.data.active;
                // clear other modes if swapping
                if(isInspectorActive) {
                    isScreenshotActive = false;
                    isMoveActive = false;
                }

                if (!isInspectorActive) {
                    // Clean up all inspector UI when mode is off
                    currentSelected = null;
                    currentHovered = null;
                    hideAllOverlays();
                    hideDropLabel();
                }
            }
            else if (event.data.type === 'TOGGLE_SCREENSHOT') {
                isScreenshotActive = event.data.active;
                // clear other modes if swapping
                if(isScreenshotActive) {
                     isInspectorActive = false;
                     isMoveActive = false;
                     currentSelected = null;
                     updateSelectionOverlay(null);
                }
                if (!isScreenshotActive) {
                    hideAllOverlays();
                }
            }
            else if (event.data.type === 'TOGGLE_MOVE') {
                isMoveActive = event.data.active;
                // clear other modes if swapping
                if(isMoveActive) {
                     isInspectorActive = false;
                     isScreenshotActive = false;
                }
                if (!isMoveActive) {
                    currentSelected = null;
                    currentHovered = null;
                    hideAllOverlays();
                }
            }
            else if (event.data.type === 'SELECT_ELEMENT_BY_SELECTOR') {
                // AI-driven element selection with multi-element support
                const selector = event.data.selector;
                try {
                    // Clear previous selections
                    clearNumberBadges();
                    if (currentSelected) {
                        currentSelected.classList.remove('inspector-selected-target');
                        currentSelected = null;
                    }

                    // Find ALL matching elements
                    const elements = document.querySelectorAll(selector);

                    if (elements.length === 0) {
                        securePostMessage({
                            type: 'AI_SELECTION_FAILED',
                            selector: selector,
                            error: 'No elements found'
                        });
                        return;
                    }

                    // Store all matches
                    multipleMatches = Array.from(elements);

                    // Highlight all elements and add number badges
                    const elementsData = [];
                    multipleMatches.forEach((element, index) => {
                        element.classList.add('inspector-selected-target');

                        // Create and position number badge
                        const badge = createNumberBadge(index + 1);
                        element.style.position = element.style.position || 'relative';
                        element.appendChild(badge);
                        numberBadges.push(badge);

                        // Collect element data
                        const summary = getElementSummary(element);
                        const rect = element.getBoundingClientRect();

                        elementsData.push({
                            element: summary,
                            rect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height
                            }
                        });
                    });

                    // Scroll first element into view
                    multipleMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Send back all matched elements
                    window.parent.postMessage({
                        type: 'AI_SELECTION_CONFIRMED',
                        selector: selector,
                        count: multipleMatches.length,
                        elements: elementsData
                    }, '*');

                } catch (error) {
                    window.parent.postMessage({
                        type: 'AI_SELECTION_FAILED',
                        selector: selector,
                        error: error.message
                    }, '*');
                }
            }

            // Handle HIGHLIGHT_BY_NUMBER - highlight a specific numbered element
            if (data.type === 'HIGHLIGHT_BY_NUMBER') {
                const elementNumber = data.elementNumber;

                // If we have multiple matches from a previous selector, use those
                if (multipleMatches.length > 0) {
                    const index = elementNumber - 1; // Convert to 0-indexed
                    if (index >= 0 && index < multipleMatches.length) {
                        const element = multipleMatches[index];

                        // Clear previous selection highlight (keep numbers visible)
                        if (currentSelected && currentSelected !== element) {
                            currentSelected.classList.remove('inspector-selected-target');
                        }

                        // Highlight the selected element
                        element.classList.add('inspector-selected-target');
                        currentSelected = element;
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        const summary = getElementSummary(element);
                        const rect = element.getBoundingClientRect();

                        window.parent.postMessage({
                            type: 'HIGHLIGHT_BY_NUMBER_SUCCESS',
                            elementNumber: elementNumber,
                            element: summary,
                            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                        }, '*');
                    } else {
                        window.parent.postMessage({
                            type: 'HIGHLIGHT_BY_NUMBER_FAILED',
                            elementNumber: elementNumber,
                            error: 'Element number ' + elementNumber + ' not found. Valid range: 1-' + multipleMatches.length
                        }, '*');
                    }
                } else {
                    // No previous selector - try to find all interactive elements and number them
                    const interactiveSelector = 'button, a, input, [role="button"], [onclick], img, video, h1, h2, h3, p, span, div[class*="card"], div[class*="item"]';
                    const elements = document.querySelectorAll(interactiveSelector);

                    if (elements.length === 0) {
                        window.parent.postMessage({
                            type: 'HIGHLIGHT_BY_NUMBER_FAILED',
                            elementNumber: elementNumber,
                            error: 'No elements found on page to highlight'
                        }, '*');
                        return;
                    }

                    // Store and number all elements
                    clearNumberBadges();
                    multipleMatches = Array.from(elements);

                    multipleMatches.forEach((element, index) => {
                        const badge = createNumberBadge(index + 1);
                        element.style.position = element.style.position || 'relative';
                        element.appendChild(badge);
                        numberBadges.push(badge);
                    });

                    // Now highlight the requested number
                    const index = elementNumber - 1;
                    if (index >= 0 && index < multipleMatches.length) {
                        const element = multipleMatches[index];
                        element.classList.add('inspector-selected-target');
                        currentSelected = element;
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        const summary = getElementSummary(element);
                        const rect = element.getBoundingClientRect();

                        window.parent.postMessage({
                            type: 'HIGHLIGHT_BY_NUMBER_SUCCESS',
                            elementNumber: elementNumber,
                            element: summary,
                            totalElements: multipleMatches.length,
                            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                        }, '*');
                    } else {
                        window.parent.postMessage({
                            type: 'HIGHLIGHT_BY_NUMBER_FAILED',
                            elementNumber: elementNumber,
                            error: 'Element number ' + elementNumber + ' not found. Valid range: 1-' + multipleMatches.length
                        }, '*');
                    }
                }
            }
        }
    });

    // --- Drag-Drop on Selected Elements ---
    let dropLabel = null;
    let originalTextContent = null;
    let isEditing = false;
    let editToolbar = null;

    function getDropAction(element, dataTransfer) {
      const hasFiles = dataTransfer.types.includes('Files');
      const hasUrl = dataTransfer.types.includes('text/uri-list') || dataTransfer.types.includes('text/plain');
      const tagName = element.tagName.toLowerCase();

      if (tagName === 'img' && hasFiles) return 'Replace Image';
      if (tagName === 'img' && hasUrl) return 'Set Image URL';
      if ((tagName === 'a' || tagName === 'button') && hasUrl) return 'Set Link';
      if (hasFiles) return 'Insert Image';
      if (hasUrl) return 'Insert Link';
      return 'Drop Here';
    }

    function showDropLabel(element, action) {
      if (!dropLabel) {
        dropLabel = document.createElement('div');
        dropLabel.className = 'drop-zone-label';
        dropLabel.setAttribute('data-cluso-ui', '1');
        dropLabel.setAttribute('aria-hidden', 'true');
        document.body.appendChild(dropLabel);
      }

      const rect = element.getBoundingClientRect();
      dropLabel.textContent = action;
      dropLabel.style.left = (rect.left + rect.width / 2 - 60) + 'px';
      dropLabel.style.top = (rect.top - 40) + 'px';
      dropLabel.style.display = 'flex';
    }

    function hideDropLabel() {
      if (dropLabel) {
        dropLabel.style.display = 'none';
      }
    }

    function createEditToolbar(element) {
      if (editToolbar) editToolbar.remove();

      editToolbar = document.createElement('div');
      editToolbar.className = 'inspector-edit-toolbar';
      editToolbar.setAttribute('data-cluso-ui', '1');
      editToolbar.setAttribute('aria-hidden', 'true');
      editToolbar.innerHTML = \`
        <button class="edit-btn edit-accept" title="Accept">✓</button>
        <button class="edit-btn edit-reject" title="Reject">✗</button>
      \`;

      const rect = element.getBoundingClientRect();
      editToolbar.style.cssText = \`
        position: fixed !important;
        left: \${rect.right + 8}px !important;
        top: \${rect.top}px !important;
        display: flex !important;
        gap: 4px !important;
        z-index: 100001 !important;
        background: rgba(255, 255, 255, 0.95) !important;
        padding: 4px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        backdrop-filter: blur(8px) !important;
      \`;

      document.body.appendChild(editToolbar);

      // Style buttons
      const buttons = editToolbar.querySelectorAll('.edit-btn');
      buttons.forEach(btn => {
        btn.style.cssText = \`
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
        \`;
      });

      editToolbar.querySelector('.edit-accept').style.background = '#22c55e';
      editToolbar.querySelector('.edit-accept').style.color = 'white';
      editToolbar.querySelector('.edit-reject').style.background = '#ef4444';
      editToolbar.querySelector('.edit-reject').style.color = 'white';

      // Accept button handler
      editToolbar.querySelector('.edit-accept').addEventListener('click', function(e) {
        e.stopPropagation();
        const newText = element.textContent;
        window.parent.postMessage({
          type: 'INLINE_EDIT_ACCEPT',
          oldText: originalTextContent,
          newText: newText,
          element: getElementSummary(element)
        }, '*');
        finishEditing(element);
      });

      // Reject button handler
      editToolbar.querySelector('.edit-reject').addEventListener('click', function(e) {
        e.stopPropagation();
        element.textContent = originalTextContent;
        finishEditing(element);
      });

      return editToolbar;
    }

    function startEditing(element) {
      if (isEditing) return;

      // Only allow editing for text-like elements
      const tagName = element.tagName.toLowerCase();
      if (['img', 'video', 'audio', 'iframe', 'canvas', 'svg'].includes(tagName)) return;
      if (element.children.length > 0 && element.textContent.trim().length > 200) return; // Skip complex elements

      isEditing = true;
      originalTextContent = element.textContent;

      element.contentEditable = 'true';
      element.style.outline = '2px solid #3b82f6';
      element.style.outlineOffset = '2px';
      element.style.minHeight = '1em';
      element.focus();

      createEditToolbar(element);

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(element);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function finishEditing(element) {
      isEditing = false;
      element.contentEditable = 'false';
      element.style.outline = '';
      element.style.outlineOffset = '';
      originalTextContent = null;

      if (editToolbar) {
        editToolbar.remove();
        editToolbar = null;
      }
    }

    // Global drag event handlers
    document.addEventListener('dragover', function(e) {
      if (!currentSelected || !isInspectorActive) return;

      const rect = currentSelected.getBoundingClientRect();
      const isOverSelected = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );

      if (isOverSelected) {
        e.preventDefault();
        e.stopPropagation();
        currentSelected.classList.add('inspector-drag-over');
        const action = getDropAction(currentSelected, e.dataTransfer);
        showDropLabel(currentSelected, action);
      } else {
        currentSelected.classList.remove('inspector-drag-over');
        hideDropLabel();
      }
    }, true);

    document.addEventListener('dragleave', function(e) {
      if (!currentSelected || !isInspectorActive) return;

      // Only hide if truly leaving the element
      const rect = currentSelected.getBoundingClientRect();
      const isStillOver = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );

      if (!isStillOver) {
        currentSelected.classList.remove('inspector-drag-over');
        hideDropLabel();
      }
    }, true);

    document.addEventListener('drop', function(e) {
      if (!currentSelected || !isInspectorActive) return;

      const rect = currentSelected.getBoundingClientRect();
      const isOverSelected = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );

      if (!isOverSelected) return;

      e.preventDefault();
      e.stopPropagation();

      currentSelected.classList.remove('inspector-drag-over');
      hideDropLabel();

      const files = e.dataTransfer.files;
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      const summary = getElementSummary(currentSelected);
      const xpath = getXPath(currentSelected);

      if (files.length > 0 && files[0].type.startsWith('image/')) {
        // Read the file and send to parent
        const reader = new FileReader();
        reader.onload = function(ev) {
          window.parent.postMessage({
            type: 'DROP_IMAGE_ON_ELEMENT',
            imageData: ev.target.result,
            element: { ...summary, xpath },
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          }, '*');
        };
        reader.readAsDataURL(files[0]);
      } else if (url && url.startsWith('http')) {
        window.parent.postMessage({
          type: 'DROP_URL_ON_ELEMENT',
          url: url,
          element: { ...summary, xpath },
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          }
        }, '*');
      }
    }, true);

    // Double-click to start inline editing
    document.addEventListener('dblclick', function(e) {
      if (!currentSelected || !isInspectorActive) return;
      if (e.target !== currentSelected && !currentSelected.contains(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      startEditing(currentSelected);
    }, true);

    // Escape to cancel editing
    document.addEventListener('keydown', function(e) {
      if (!isEditing) return;
      if (e.key === 'Escape') {
        if (currentSelected) {
          currentSelected.textContent = originalTextContent;
          finishEditing(currentSelected);
        }
      }
    }, true);

  })();
</script>
`;
