import { REACT_FIBER_EXTRACTION_SCRIPT } from './react-fiber-extraction'

// The parent origin is set dynamically when the inspector is activated
// This prevents broadcasting messages to arbitrary windows
export const INJECTION_SCRIPT = `
<style>
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
    outline: 2px dashed #9333ea !important; /* Purple dashed */
    outline-offset: -2px !important;
    cursor: camera !important;
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

  .drop-zone-label::before {
    content: '📥' !important;
    font-size: 16px !important;
  }
</style>
<script>
  // --- React Fiber Extraction (based on bippy patterns) ---
  ${REACT_FIBER_EXTRACTION_SCRIPT}

  (function() {
    let currentSelected = null;
    let isInspectorActive = false;
    let isScreenshotActive = false;
    let multipleMatches = [];
    let numberBadges = [];
    // Store the parent's origin for secure postMessage calls
    // This is set when the inspector is first activated
    let trustedOrigin = null;

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
            hasFiber: reactContext.hasFiber
          };
        } catch (e) {
          console.warn('[Inspector] Failed to extract React context:', e);
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
      if (!isInspectorActive && !isScreenshotActive) return;
      e.stopPropagation();

      if (isInspectorActive) {
          e.target.classList.add('inspector-hover-target');
      } else if (isScreenshotActive) {
          e.target.classList.add('screenshot-hover-target');
      }

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
      if (!isInspectorActive && !isScreenshotActive) return;
      e.stopPropagation();
      e.target.classList.remove('inspector-hover-target');
      e.target.classList.remove('screenshot-hover-target');

      // Clear hover info
      securePostMessage({
        type: 'INSPECTOR_HOVER_END'
      });
    }, true);

    document.addEventListener('click', function(e) {
      if (!isInspectorActive && !isScreenshotActive) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const summary = getElementSummary(e.target);
      const rect = e.target.getBoundingClientRect();

      if (isInspectorActive) {
          if (currentSelected) {
            currentSelected.classList.remove('inspector-selected-target');
          }
          e.target.classList.add('inspector-selected-target');
          currentSelected = e.target;
          
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
           // For screenshot, we just notify selection and clear highlight
           e.target.classList.remove('screenshot-hover-target');

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
                // clear previous screenshot mode if swapping
                if(isInspectorActive) isScreenshotActive = false;

                if (!isInspectorActive) {
                    // Clean up all inspector UI when mode is off
                    if (currentSelected) {
                        currentSelected.classList.remove('inspector-selected-target');
                        currentSelected.classList.remove('inspector-drag-over');
                        currentSelected = null;
                    }
                    hideDropLabel();
                }
            }
            else if (event.data.type === 'TOGGLE_SCREENSHOT') {
                isScreenshotActive = event.data.active;
                // clear previous inspector mode if swapping
                if(isScreenshotActive) {
                     isInspectorActive = false;
                     if (currentSelected) {
                        currentSelected.classList.remove('inspector-selected-target');
                        currentSelected = null;
                    }
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
