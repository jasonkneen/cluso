
export const INJECTION_SCRIPT = `
<style>
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
    outline: 2px dashed #9333ea !important; /* Purple dashed */
    outline-offset: -2px !important;
    cursor: camera !important;
    background-color: rgba(147, 51, 234, 0.1) !important;
    position: relative;
    z-index: 10000;
  }

  .selection-box {
    position: fixed;
    border: 2px dashed #9333ea;
    background-color: rgba(147, 51, 234, 0.1);
    z-index: 10001;
    pointer-events: none;
    display: none;
  }

  .multi-selected {
    outline: 2px dashed #9333ea !important;
    outline-offset: -2px !important;
    background-color: rgba(147, 51, 234, 0.05) !important;
  }
</style>
<script>
  (function() {
    let currentSelected = null;
    let isInspectorActive = false;
    let isScreenshotActive = false;

    // Drag Selection State
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    document.body.appendChild(selectionBox);

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

    function getElementSummary(el) {
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        text: el.innerText ? el.innerText.substring(0, 100) : '',
      };
    }

    // Helper to check intersection
    function isIntersecting(r1, r2) {
      return !(r2.left > r1.right || 
               r2.right < r1.left || 
               r2.top > r1.bottom || 
               r2.bottom < r1.top);
    }

    document.addEventListener('mouseover', function(e) {
      if (!isInspectorActive && !isScreenshotActive) return;
      if (isDragging) return; // Don't hover highlight while dragging
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

    document.addEventListener('mousedown', function(e) {
        if (!isScreenshotActive) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
        
        // Prevent text selection
        e.preventDefault();
    }, true);

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(currentX, startX);
        const top = Math.min(currentY, startY);
        
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';

        // Highlight intersecting elements
        // Debounce or limit this in production, but okay for prototype
        const dragRect = selectionBox.getBoundingClientRect();
        const allElements = document.body.getElementsByTagName('*');
        
        for (let el of allElements) {
            if (el === selectionBox) continue;
            if (el.classList.contains('inspector-hover-target')) continue; 
            
            const elRect = el.getBoundingClientRect();
            // Basic optimization: only check visible elements
            if (elRect.width === 0 || elRect.height === 0) continue;

            if (isIntersecting(dragRect, elRect)) {
                el.classList.add('multi-selected');
            } else {
                el.classList.remove('multi-selected');
            }
        }

    }, true);

    document.addEventListener('mouseup', function(e) {
        if (isDragging) {
            isDragging = false;
            selectionBox.style.display = 'none';
            
            // Gather selected elements
            const selectedEls = document.querySelectorAll('.multi-selected');
            const summaryList = [];
            
            // Calculate total bounding box of selection
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            selectedEls.forEach(el => {
                el.classList.remove('multi-selected');
                summaryList.push(getElementSummary(el));
                const r = el.getBoundingClientRect();
                minX = Math.min(minX, r.left);
                minY = Math.min(minY, r.top);
                maxX = Math.max(maxX, r.right);
                maxY = Math.max(maxY, r.bottom);
            });

            // If we dragged but didn't catch anything, check the simple click target
            if (summaryList.length === 0 && Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                 // It was a click
                 return; // Let the click handler take over
            }

            if (summaryList.length > 0 || Math.abs(e.clientX - startX) > 10) {
                 window.parent.postMessage({ 
                    type: 'MULTI_SELECT', 
                    elements: summaryList,
                    rect: {
                        top: minY === Infinity ? startY : minY,
                        left: minX === Infinity ? startX : minX,
                        width: maxX === -Infinity ? Math.abs(e.clientX - startX) : maxX - minX,
                        height: maxY === -Infinity ? Math.abs(e.clientY - startY) : maxY - minY
                    }
                }, '*');
                e.stopPropagation(); // Stop click handler from firing
            }
        }
    }, true);

    document.addEventListener('click', function(e) {
      if (!isInspectorActive && !isScreenshotActive) return;
      if (isDragging) return; // handled by mouseup

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
        }
    });

  })();
</script>
`;
