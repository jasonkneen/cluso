/**
 * RSC (React Server Components) Extraction Script
 * Extracts RSC payload data from Next.js applications
 */
(function() {
  'use strict';

  /**
   * Find RSC payload in the page
   */
  function findRSCPayload() {
    // Look for Next.js RSC scripts
    const scripts = document.querySelectorAll('script[type="application/json"]');
    const payloads = [];

    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data && (data.props || data.tree || data.payload)) {
          payloads.push(data);
        }
      } catch {
        // Not valid JSON
      }
    });

    // Also check for __NEXT_DATA__
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript.textContent || '');
        payloads.push({ type: 'next-data', data: nextData });
      } catch {
        // Not valid JSON
      }
    }

    return payloads;
  }

  /**
   * Extract RSC context
   */
  window.extractRSCContext = function() {
    return {
      payloads: findRSCPayload(),
      hasRSC: findRSCPayload().length > 0,
    };
  };

  console.log('[Cluso] RSC extraction ready');
})();
