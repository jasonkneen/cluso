
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
</style>
<script>
  (function() {
    let currentSelected = null;
    let isInspectorActive = false;
    let isScreenshotActive = false;
    let multipleMatches = [];
    let numberBadges = [];

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

        window.parent.postMessage({
            type: 'CONSOLE_LOG',
            level: level,
            message: message,
            timestamp: Date.now()
        }, '*');
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

    function getElementSummary(el) {
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        text: el.innerText ? el.innerText.substring(0, 100) : '',
      };
    }

    document.addEventListener('mouseover', function(e) {
      if (!isInspectorActive && !isScreenshotActive) return;
      e.stopPropagation();
      
      if (isInspectorActive) {
          e.target.classList.add('inspector-hover-target');
      } else if (isScreenshotActive) {
          e.target.classList.add('screenshot-hover-target');
      }
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (!isInspectorActive && !isScreenshotActive) return;
      e.stopPropagation();
      e.target.classList.remove('inspector-hover-target');
      e.target.classList.remove('screenshot-hover-target');
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
          
          window.parent.postMessage({ 
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
          }, '*');
      } 
      else if (isScreenshotActive) {
           // For screenshot, we just notify selection and clear highlight
           e.target.classList.remove('screenshot-hover-target');
           
           window.parent.postMessage({ 
            type: 'SCREENSHOT_SELECT', 
            element: summary,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            }
          }, '*');
      }
    }, true);

    // Listen for messages from parent to toggle modes
    window.addEventListener('message', function(event) {
        if (event.data) {
            if (event.data.type === 'TOGGLE_INSPECTOR') {
                isInspectorActive = event.data.active;
                // clear previous screenshot mode if swapping
                if(isInspectorActive) isScreenshotActive = false;

                if (!isInspectorActive && currentSelected) {
                    currentSelected.classList.remove('inspector-selected-target');
                    currentSelected = null;
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
                        window.parent.postMessage({
                            type: 'AI_SELECTION_FAILED',
                            selector: selector,
                            error: 'No elements found'
                        }, '*');
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
        }
    });

  })();
</script>
`;
