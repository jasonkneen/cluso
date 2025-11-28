
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
</style>
<script>
  (function() {
    let currentSelected = null;
    let isInspectorActive = false;
    let isScreenshotActive = false;

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
        }
    });

  })();
</script>
`;
