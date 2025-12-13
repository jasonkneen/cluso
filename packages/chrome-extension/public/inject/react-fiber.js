/**
 * React Fiber Extraction Script
 * Injected into the page context to access React internals
 */
(function() {
  'use strict';

  /**
   * Get React Fiber from a DOM element
   */
  function getReactFiber(element) {
    if (!element) return null;

    // React 16+ fiber keys
    const fiberKeys = Object.keys(element).filter(key =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
    );

    if (fiberKeys.length > 0) {
      return element[fiberKeys[0]];
    }

    return null;
  }

  /**
   * Get component name from fiber
   */
  function getComponentName(fiber) {
    if (!fiber) return null;

    const type = fiber.type;
    if (!type) return null;

    if (typeof type === 'string') {
      return type; // HTML element
    }

    if (typeof type === 'function') {
      return type.displayName || type.name || 'Unknown';
    }

    if (type.$$typeof) {
      // React special types (memo, forwardRef, etc.)
      if (type.displayName) return type.displayName;
      if (type.render?.displayName) return type.render.displayName;
      if (type.render?.name) return type.render.name;
    }

    return 'Unknown';
  }

  /**
   * Get component stack from element
   */
  function getComponentStack(element) {
    const fiber = getReactFiber(element);
    if (!fiber) return [];

    const stack = [];
    let current = fiber;

    while (current) {
      const name = getComponentName(current);
      if (name && typeof current.type !== 'string') {
        // Get source location if available
        const source = current._debugSource || current.type?._source;
        stack.push({
          name,
          fileName: source?.fileName || null,
          lineNumber: source?.lineNumber || null,
          columnNumber: source?.columnNumber || null,
        });
      }
      current = current.return;
    }

    return stack;
  }

  /**
   * Extract React context from element
   */
  window.extractReactContext = function(element) {
    const fiber = getReactFiber(element);

    if (!fiber) {
      return { hasFiber: false };
    }

    return {
      hasFiber: true,
      componentStack: getComponentStack(element),
    };
  };

  console.log('[Cluso] React fiber extraction ready');
})();
