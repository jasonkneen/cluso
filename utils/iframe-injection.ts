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

  /* Drill-down selection highlight */
  .drill-highlight {
    outline: 2px solid rgba(59, 130, 246, 0.5) !important;
    outline-offset: 2px !important;
    transition: outline 0.2s ease-out !important;
  }
  
  .drill-highlight:hover {
    outline-color: rgba(59, 130, 246, 0.8) !important;
    background-color: rgba(59, 130, 246, 0.05) !important;
  }

  /* Drag-drop glow effect for selected elements */
  .inspector-drag-over {
    outline: 3px solid #22c55e !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.5), 0 0 40px 10px rgba(34, 197, 94, 0.3) !important;
    transition: all 0.15s ease-out !important;
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

    // Hierarchical drill-down selection state
    // Stack of {element, children} for back/forward navigation
    let selectionHistoryStack = [];
    let selectionHistoryIndex = -1; // Current position in stack (-1 = not in drill mode)

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

    // --- Hierarchical Drill-Down Selection Helpers ---
    
    // Get top-level semantic sections of the page
    function getTopLevelSections() {
      // Priority order: semantic elements first, then large divs
      const semanticSelectors = [
        'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
        '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="contentinfo"]',
        'form', '.hero', '.header', '.footer', '.nav', '.sidebar'
      ];
      
      let sections = [];
      
      // First, try semantic elements
      semanticSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            // Skip if already added or if it's a Cluso UI element
            if (!sections.includes(el) && !el.getAttribute('data-cluso-ui')) {
              // Only add if it's a direct child of body or has significant size
              const rect = el.getBoundingClientRect();
              if (rect.width > 100 && rect.height > 50) {
                sections.push(el);
              }
            }
          });
        } catch (e) { /* invalid selector */ }
      });
      
      // If we found fewer than 3 sections, add large direct children of body
      if (sections.length < 3) {
        const bodyChildren = Array.from(document.body.children);
        bodyChildren.forEach(el => {
          if (!sections.includes(el) && !el.getAttribute('data-cluso-ui') && 
              el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 50) {
              sections.push(el);
            }
          }
        });
      }
      
      // Sort by vertical position (top to bottom)
      sections.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectA.top - rectB.top;
      });
      
      return sections;
    }
    
    // Get meaningful children of an element (skip text nodes, scripts, etc.)
    function getMeaningfulChildren(element) {
      return Array.from(element.children).filter(child => {
        if (child.getAttribute('data-cluso-ui')) return false;
        if (['SCRIPT', 'STYLE', 'LINK', 'META', 'BR', 'HR'].includes(child.tagName)) return false;
        
        const rect = child.getBoundingClientRect();
        // Must have some visible size
        if (rect.width < 10 || rect.height < 10) return false;
        
        return true;
      });
    }
    
    // Show elements with number badges
    function showNumberedElements(elements) {
      clearNumberBadges();
      multipleMatches = elements;
      
      elements.forEach((el, index) => {
        const badge = createNumberBadge(index + 1);
        el.style.position = el.style.position || 'relative';
        el.appendChild(badge);
        numberBadges.push(badge);
        
        // Add subtle highlight
        el.classList.add('drill-highlight');
      });
    }
    
    // Clear drill highlights
    function clearDrillHighlights() {
      document.querySelectorAll('.drill-highlight').forEach(el => {
        el.classList.remove('drill-highlight');
      });
    }
    
    // Push to selection history
    function pushSelectionHistory(element, children) {
      // If we're not at the end of the stack, truncate forward history
      if (selectionHistoryIndex < selectionHistoryStack.length - 1) {
        selectionHistoryStack = selectionHistoryStack.slice(0, selectionHistoryIndex + 1);
      }
      selectionHistoryStack.push({ element, children });
      selectionHistoryIndex = selectionHistoryStack.length - 1;
    }
    
    // Get description of element for voice feedback
    function getElementDescription(el) {
      const tagName = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const className = el.className && typeof el.className === 'string' 
        ? '.' + el.className.split(' ').filter(c => c).slice(0, 2).join('.') 
        : '';
      const text = el.innerText ? el.innerText.substring(0, 30).trim() : '';
      
      // Try to give a semantic description
      if (tagName === 'header' || el.getAttribute('role') === 'banner') return 'Header' + (text ? ': ' + text : '');
      if (tagName === 'nav' || el.getAttribute('role') === 'navigation') return 'Navigation' + (text ? ': ' + text : '');
      if (tagName === 'main' || el.getAttribute('role') === 'main') return 'Main content';
      if (tagName === 'footer' || el.getAttribute('role') === 'contentinfo') return 'Footer';
      if (tagName === 'section') return 'Section' + (text ? ': ' + text : '');
      if (tagName === 'article') return 'Article' + (text ? ': ' + text : '');
      if (tagName === 'aside') return 'Sidebar';
      if (tagName === 'form') return 'Form' + (text ? ': ' + text : '');
      if (tagName === 'button') return 'Button: ' + (text || el.getAttribute('aria-label') || 'unnamed');
      if (tagName === 'a') return 'Link: ' + (text || 'unnamed');
      if (tagName === 'input') return 'Input: ' + (el.getAttribute('placeholder') || el.getAttribute('name') || 'unnamed');
      if (tagName === 'img') return 'Image: ' + (el.getAttribute('alt') || 'unnamed');
      
      return (id || className || tagName) + (text ? ': ' + text : '');
    }

    // Enhanced element summary with React component info
    function getElementSummary(el) {
      const basicInfo = {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        text: el.innerText ? el.innerText.substring(0, 100) : '',
      };

      // PRIORITY 1: Check for injected Cluso metadata (data-cluso-id)
      const clusoId = el.getAttribute('data-cluso-id');
      const clusoName = el.getAttribute('data-cluso-name');

      if (clusoId) {
        // Parse format: "src/App.tsx:45:12" -> {file, line, column}
        const parts = clusoId.split(':');
        const columnStr = parts.pop();
        const lineStr = parts.pop();
        const fileName = parts.join(':'); // Handle Windows paths with colons

        return {
          ...basicInfo,
          componentName: clusoName || null,
          fileName: fileName || null,
          lineNumber: lineStr ? parseInt(lineStr, 10) : null,
          columnNumber: columnStr ? parseInt(columnStr, 10) : null,
          xpath: window.getXPath ? window.getXPath(el) : null,
          attributes: Array.from(el.attributes || []).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          hasFiber: false,
          isRSC: false,
          hasMetadata: true, // Flag to indicate Cluso metadata was found
          fullContext: clusoName ? clusoName + ' (' + fileName + ':' + lineStr + ')' : null
        };
      }

      // PRIORITY 2: Try to get React fiber info if available
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

      // PRIORITY 3: Fallback to RSC extraction for Server Components (Next.js App Router)
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

                    // PERFORMANCE: Batch DOM operations to avoid layout thrashing
                    // Phase 1: READ all data first (causes single reflow)
                    const elementsData = multipleMatches.map((element, index) => {
                        const summary = getElementSummary(element);
                        const rect = element.getBoundingClientRect();
                        const currentPosition = element.style.position;
                        return {
                            element,
                            index,
                            summary,
                            rect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height
                            },
                            currentPosition
                        };
                    });

                    // Phase 2: WRITE all changes (no reflows during this phase)
                    elementsData.forEach(({ element, index, currentPosition }) => {
                        element.classList.add('inspector-selected-target');

                        // Create and position number badge
                        const badge = createNumberBadge(index + 1);
                        element.style.position = currentPosition || 'relative';
                        element.appendChild(badge);
                        numberBadges.push(badge);
                    });

                    // Phase 3: Format output data (no DOM access)
                    const outputData = elementsData.map(({ summary, rect }) => ({
                        element: summary,
                        rect
                    }));

                    // Scroll first element into view
                    multipleMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Send back all matched elements
                    window.parent.postMessage({
                        type: 'AI_SELECTION_CONFIRMED',
                        selector: selector,
                        count: multipleMatches.length,
                        elements: outputData
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

            // --- DOM Navigation Message Handlers ---
            // SELECT_PARENT: Navigate up the DOM tree
            if (data.type === 'SELECT_PARENT') {
                const levels = data.levels || 1;
                if (!currentSelected) {
                    securePostMessage({
                        type: 'SELECT_PARENT_RESULT',
                        success: false,
                        error: 'No element currently selected. Select an element first.'
                    });
                    return;
                }

                let parent = currentSelected;
                for (let i = 0; i < levels && parent.parentElement; i++) {
                    parent = parent.parentElement;
                    // Skip html and body
                    if (parent.tagName === 'HTML' || parent.tagName === 'BODY') break;
                }

                if (parent && parent !== currentSelected && parent.tagName !== 'HTML' && parent.tagName !== 'BODY') {
                    currentSelected = parent;
                    updateSelectionOverlay(parent);
                    parent.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    const summary = getElementSummary(parent);
                    const rect = parent.getBoundingClientRect();
                    securePostMessage({
                        type: 'SELECT_PARENT_RESULT',
                        success: true,
                        element: summary,
                        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                    });
                } else {
                    securePostMessage({
                        type: 'SELECT_PARENT_RESULT',
                        success: false,
                        error: 'No valid parent element found.'
                    });
                }
            }

            // SELECT_CHILDREN: Get all direct children of selected element
            if (data.type === 'SELECT_CHILDREN') {
                const selector = data.selector; // Optional filter
                if (!currentSelected) {
                    securePostMessage({
                        type: 'SELECT_CHILDREN_RESULT',
                        success: false,
                        error: 'No element currently selected.'
                    });
                    return;
                }

                let children = Array.from(currentSelected.children);
                
                // Filter out Cluso UI elements
                children = children.filter(el => !el.getAttribute('data-cluso-ui'));
                
                // Apply optional selector filter
                if (selector) {
                    children = children.filter(el => el.matches(selector));
                }

                if (children.length > 0) {
                    // Clear previous badges and add new ones
                    clearNumberBadges();
                    multipleMatches = children;

                    const childrenData = children.map((child, index) => {
                        const summary = getElementSummary(child);
                        const rect = child.getBoundingClientRect();
                        
                        // Add number badge
                        const badge = createNumberBadge(index + 1);
                        child.style.position = child.style.position || 'relative';
                        child.appendChild(badge);
                        numberBadges.push(badge);

                        return {
                            element: summary,
                            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                        };
                    });

                    securePostMessage({
                        type: 'SELECT_CHILDREN_RESULT',
                        success: true,
                        children: childrenData
                    });
                } else {
                    securePostMessage({
                        type: 'SELECT_CHILDREN_RESULT',
                        success: true,
                        children: []
                    });
                }
            }

            // SELECT_SIBLINGS: Navigate to siblings
            if (data.type === 'SELECT_SIBLINGS') {
                const direction = data.direction || 'all'; // 'next', 'prev', or 'all'
                if (!currentSelected) {
                    securePostMessage({
                        type: 'SELECT_SIBLINGS_RESULT',
                        success: false,
                        error: 'No element currently selected.'
                    });
                    return;
                }

                const parent = currentSelected.parentElement;
                if (!parent) {
                    securePostMessage({
                        type: 'SELECT_SIBLINGS_RESULT',
                        success: false,
                        error: 'Selected element has no parent.'
                    });
                    return;
                }

                let siblings = Array.from(parent.children).filter(el => 
                    el !== currentSelected && !el.getAttribute('data-cluso-ui')
                );

                if (direction === 'next') {
                    const currentIndex = Array.from(parent.children).indexOf(currentSelected);
                    siblings = siblings.filter((_, i) => 
                        Array.from(parent.children).indexOf(siblings[i]) > currentIndex
                    );
                    if (siblings.length > 0) {
                        // Select the next sibling
                        const nextSibling = siblings[0];
                        currentSelected = nextSibling;
                        updateSelectionOverlay(nextSibling);
                        nextSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        siblings = [nextSibling];
                    }
                } else if (direction === 'prev') {
                    const currentIndex = Array.from(parent.children).indexOf(currentSelected);
                    siblings = siblings.filter((_, i) => 
                        Array.from(parent.children).indexOf(siblings[i]) < currentIndex
                    );
                    if (siblings.length > 0) {
                        // Select the previous sibling (last one before current)
                        const prevSibling = siblings[siblings.length - 1];
                        currentSelected = prevSibling;
                        updateSelectionOverlay(prevSibling);
                        prevSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        siblings = [prevSibling];
                    }
                } else {
                    // Show all siblings with numbers
                    clearNumberBadges();
                    multipleMatches = siblings;
                    
                    siblings.forEach((sib, index) => {
                        const badge = createNumberBadge(index + 1);
                        sib.style.position = sib.style.position || 'relative';
                        sib.appendChild(badge);
                        numberBadges.push(badge);
                    });
                }

                const siblingsData = siblings.map(sib => {
                    const summary = getElementSummary(sib);
                    const rect = sib.getBoundingClientRect();
                    return {
                        element: summary,
                        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                    };
                });

                securePostMessage({
                    type: 'SELECT_SIBLINGS_RESULT',
                    success: true,
                    siblings: siblingsData
                });
            }

            // SELECT_ALL_MATCHING: Find all elements matching the current element's pattern
            if (data.type === 'SELECT_ALL_MATCHING') {
                const matchBy = data.matchBy || 'both'; // 'tag', 'class', or 'both'
                if (!currentSelected) {
                    securePostMessage({
                        type: 'SELECT_ALL_MATCHING_RESULT',
                        success: false,
                        error: 'No element currently selected.'
                    });
                    return;
                }

                const tagName = currentSelected.tagName.toLowerCase();
                const className = currentSelected.className;
                let selector = '';

                if (matchBy === 'tag') {
                    selector = tagName;
                } else if (matchBy === 'class' && className) {
                    // Use first meaningful class
                    const classes = className.split(' ').filter(c => c && !c.startsWith('inspector-'));
                    if (classes.length > 0) {
                        selector = '.' + classes[0];
                    } else {
                        selector = tagName;
                    }
                } else {
                    // Both - combine tag and first class
                    const classes = className.split(' ').filter(c => c && !c.startsWith('inspector-'));
                    selector = classes.length > 0 ? tagName + '.' + classes[0] : tagName;
                }

                try {
                    const matches = Array.from(document.querySelectorAll(selector))
                        .filter(el => !el.getAttribute('data-cluso-ui'));

                    if (matches.length > 0) {
                        clearNumberBadges();
                        multipleMatches = matches;

                        const matchesData = matches.map((match, index) => {
                            const summary = getElementSummary(match);
                            const rect = match.getBoundingClientRect();

                            // Add number badge
                            const badge = createNumberBadge(index + 1);
                            match.style.position = match.style.position || 'relative';
                            match.appendChild(badge);
                            numberBadges.push(badge);

                            return {
                                element: summary,
                                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                            };
                        });

                        securePostMessage({
                            type: 'SELECT_ALL_MATCHING_RESULT',
                            success: true,
                            selector: selector,
                            matches: matchesData
                        });
                    } else {
                        securePostMessage({
                            type: 'SELECT_ALL_MATCHING_RESULT',
                            success: true,
                            selector: selector,
                            matches: []
                        });
                    }
                } catch (err) {
                    securePostMessage({
                        type: 'SELECT_ALL_MATCHING_RESULT',
                        success: false,
                        error: 'Invalid selector: ' + selector
                    });
                }
            }

            // --- Hierarchical Drill-Down Selection Handlers ---

            // START_DRILL_SELECTION: Begin drill-down mode with top-level sections
            if (data.type === 'START_DRILL_SELECTION') {
                // Reset drill state
                selectionHistoryStack = [];
                selectionHistoryIndex = -1;
                clearDrillHighlights();
                
                const sections = getTopLevelSections();
                
                if (sections.length === 0) {
                    securePostMessage({
                        type: 'START_DRILL_SELECTION_RESULT',
                        success: false,
                        error: 'No top-level sections found on this page.'
                    });
                    return;
                }
                
                // Push root level to history (null element means root)
                pushSelectionHistory(null, sections);
                
                // Show numbered sections
                showNumberedElements(sections);
                
                const sectionsData = sections.map((section, index) => ({
                    number: index + 1,
                    description: getElementDescription(section),
                    tagName: section.tagName.toLowerCase(),
                    rect: (() => {
                        const r = section.getBoundingClientRect();
                        return { top: r.top, left: r.left, width: r.width, height: r.height };
                    })()
                }));
                
                securePostMessage({
                    type: 'START_DRILL_SELECTION_RESULT',
                    success: true,
                    level: 0,
                    sections: sectionsData,
                    canGoBack: false,
                    canGoForward: false
                });
            }
            
            // DRILL_INTO: Focus on a numbered element and show its children
            if (data.type === 'DRILL_INTO') {
                const elementNumber = data.elementNumber;
                
                if (multipleMatches.length === 0) {
                    securePostMessage({
                        type: 'DRILL_INTO_RESULT',
                        success: false,
                        error: 'No elements currently shown. Start drill selection first.'
                    });
                    return;
                }
                
                const index = elementNumber - 1;
                if (index < 0 || index >= multipleMatches.length) {
                    securePostMessage({
                        type: 'DRILL_INTO_RESULT',
                        success: false,
                        error: 'Invalid number ' + elementNumber + '. Choose between 1 and ' + multipleMatches.length + '.'
                    });
                    return;
                }
                
                const selectedElement = multipleMatches[index];
                const children = getMeaningfulChildren(selectedElement);
                
                // If no children, this is a leaf - select it as final
                if (children.length === 0) {
                    clearDrillHighlights();
                    clearNumberBadges();
                    
                    // Set as current selection
                    currentSelected = selectedElement;
                    selectedElement.classList.add('inspector-selected-target');
                    updateSelectionOverlay(selectedElement);
                    selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    const summary = getElementSummary(selectedElement);
                    const rect = selectedElement.getBoundingClientRect();
                    
                    securePostMessage({
                        type: 'DRILL_INTO_RESULT',
                        success: true,
                        isFinalSelection: true,
                        element: summary,
                        description: getElementDescription(selectedElement),
                        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                        level: selectionHistoryIndex + 1,
                        canGoBack: selectionHistoryIndex >= 0,
                        canGoForward: false
                    });
                    return;
                }
                
                // Has children - drill into it
                pushSelectionHistory(selectedElement, children);
                
                // Update current selection
                currentSelected = selectedElement;
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Show numbered children
                showNumberedElements(children);
                
                const childrenData = children.map((child, i) => ({
                    number: i + 1,
                    description: getElementDescription(child),
                    tagName: child.tagName.toLowerCase(),
                    rect: (() => {
                        const r = child.getBoundingClientRect();
                        return { top: r.top, left: r.left, width: r.width, height: r.height };
                    })()
                }));
                
                securePostMessage({
                    type: 'DRILL_INTO_RESULT',
                    success: true,
                    isFinalSelection: false,
                    parentDescription: getElementDescription(selectedElement),
                    children: childrenData,
                    level: selectionHistoryIndex,
                    canGoBack: selectionHistoryIndex > 0,
                    canGoForward: false
                });
            }
            
            // DRILL_BACK: Go back one level in selection history
            if (data.type === 'DRILL_BACK') {
                if (selectionHistoryIndex <= 0) {
                    securePostMessage({
                        type: 'DRILL_BACK_RESULT',
                        success: false,
                        error: 'Already at top level, cannot go back further.'
                    });
                    return;
                }
                
                selectionHistoryIndex--;
                const historyEntry = selectionHistoryStack[selectionHistoryIndex];
                
                // Restore the children view from history
                showNumberedElements(historyEntry.children);
                
                if (historyEntry.element) {
                    currentSelected = historyEntry.element;
                    historyEntry.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                const childrenData = historyEntry.children.map((child, i) => ({
                    number: i + 1,
                    description: getElementDescription(child),
                    tagName: child.tagName.toLowerCase(),
                    rect: (() => {
                        const r = child.getBoundingClientRect();
                        return { top: r.top, left: r.left, width: r.width, height: r.height };
                    })()
                }));
                
                securePostMessage({
                    type: 'DRILL_BACK_RESULT',
                    success: true,
                    parentDescription: historyEntry.element ? getElementDescription(historyEntry.element) : 'Page root',
                    children: childrenData,
                    level: selectionHistoryIndex,
                    canGoBack: selectionHistoryIndex > 0,
                    canGoForward: selectionHistoryIndex < selectionHistoryStack.length - 1
                });
            }
            
            // DRILL_FORWARD: Go forward in selection history (if previously went back)
            if (data.type === 'DRILL_FORWARD') {
                if (selectionHistoryIndex >= selectionHistoryStack.length - 1) {
                    securePostMessage({
                        type: 'DRILL_FORWARD_RESULT',
                        success: false,
                        error: 'No forward history available.'
                    });
                    return;
                }
                
                selectionHistoryIndex++;
                const historyEntry = selectionHistoryStack[selectionHistoryIndex];
                
                // Restore the children view from history
                showNumberedElements(historyEntry.children);
                
                if (historyEntry.element) {
                    currentSelected = historyEntry.element;
                    historyEntry.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                const childrenData = historyEntry.children.map((child, i) => ({
                    number: i + 1,
                    description: getElementDescription(child),
                    tagName: child.tagName.toLowerCase(),
                    rect: (() => {
                        const r = child.getBoundingClientRect();
                        return { top: r.top, left: r.left, width: r.width, height: r.height };
                    })()
                }));
                
                securePostMessage({
                    type: 'DRILL_FORWARD_RESULT',
                    success: true,
                    parentDescription: historyEntry.element ? getElementDescription(historyEntry.element) : 'Page root',
                    children: childrenData,
                    level: selectionHistoryIndex,
                    canGoBack: selectionHistoryIndex > 0,
                    canGoForward: selectionHistoryIndex < selectionHistoryStack.length - 1
                });
            }
            
            // EXIT_DRILL_MODE: Clear drill state and badges
            if (data.type === 'EXIT_DRILL_MODE') {
                selectionHistoryStack = [];
                selectionHistoryIndex = -1;
                clearDrillHighlights();
                clearNumberBadges();
                
                securePostMessage({
                    type: 'EXIT_DRILL_MODE_RESULT',
                    success: true
                });
            }
        }
    });

    // --- Inline Editing State ---
    let originalTextContent = null;
    let isEditing = false;
    let editToolbar = null;

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
