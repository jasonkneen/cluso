import {
  getFiberFromHostInstance,
  getLatestFiber,
  isCompositeFiber,
  traverseFiber,
  type Fiber,
} from 'bippy';

import {
  getSource,
  type FiberSource,
} from 'bippy/source';

export interface ComponentSource {
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface ElementSourceInfo {
  sources: ComponentSource[];
  summary: string; // e.g., "App.tsx (45-120)"
}

/**
 * Get source location information for a DOM element
 * Returns the component stack with file locations
 */
export function getElementSourceLocation(element: HTMLElement): ElementSourceInfo | null {
  try {
    console.log('[SourceLocation] Attempting to get source for element:', element.tagName, element.id || element.className);

    // Get the React Fiber associated with this DOM element
    const fiber = getFiberFromHostInstance(element);

    console.log('[SourceLocation] Fiber found:', !!fiber, fiber?.type);

    if (!fiber) {
      console.warn('[SourceLocation] No fiber found for element', element.tagName, element.id || element.className);
      console.warn('[SourceLocation] This usually means React is not rendering this element, or bippy is not properly configured');
      return null;
    }

    // Collect source locations by traversing up the fiber tree
    const sources: ComponentSource[] = [];
    let currentFiber: Fiber | null = fiber;

    // Traverse up to find all component fibers with source info
    while (currentFiber) {
      // Get the latest version of this fiber
      const latestFiber = getLatestFiber(currentFiber);

      // Only process composite fibers (components, not DOM elements)
      if (isCompositeFiber(latestFiber)) {
        const source = getSource(latestFiber);

        if (source && source.filename) {
          // Get component name
          const name = getComponentName(latestFiber);

          // Filter out framework internals
          if (name && !isFrameworkComponent(name)) {
            sources.push({
              name,
              file: normalizeFilename(source.filename),
              line: source.line || 0,
              column: source.column || 0,
            });
          }
        }
      }

      // Move up the tree
      currentFiber = traverseFiber(latestFiber, 'parent');
    }

    if (sources.length === 0) {
      return null;
    }

    // Create summary from the most immediate component (first in stack)
    const primary = sources[0];
    const lineRange = sources.length > 1
      ? `${primary.line}-${sources[sources.length - 1].line}`
      : `${primary.line}`;

    const summary = `${primary.file} (${lineRange})`;

    return {
      sources,
      summary,
    };
  } catch (error) {
    console.error('[SourceLocation] Error getting source location:', error);
    return null;
  }
}

/**
 * Get the display name of a component from its fiber
 */
function getComponentName(fiber: Fiber): string | null {
  try {
    // Try type.name first (function components)
    if (fiber.type && typeof fiber.type === 'function') {
      return fiber.type.name || null;
    }

    // Try type.displayName (class components)
    if (fiber.type && typeof fiber.type === 'object' && 'displayName' in fiber.type) {
      return (fiber.type as any).displayName || null;
    }

    // Try elementType for wrapped components
    if (fiber.elementType && typeof fiber.elementType === 'function') {
      return fiber.elementType.name || null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize filename to relative path
 */
function normalizeFilename(filename: string): string {
  // Remove webpack/vite internal prefixes
  let normalized = filename
    .replace(/^webpack:\/\/\//g, '')
    .replace(/^\/\//g, '')
    .replace(/^\.\//g, '');

  // Extract relative path (remove absolute path prefix)
  const match = normalized.match(/(?:src|components|pages|app)\/.+/);
  if (match) {
    return match[0];
  }

  // Return basename if no pattern matches
  const parts = normalized.split('/');
  return parts[parts.length - 1];
}

/**
 * Check if component name is from framework internals
 */
function isFrameworkComponent(name: string): boolean {
  const frameworkPrefixes = [
    '_',           // Internal React components
    'Router',      // React Router internals
    'Provider',    // Context providers (usually framework)
    'ErrorBoundary', // Error boundaries (usually framework)
  ];

  const frameworkNames = [
    'App',         // Skip root App for cleaner output
    'StrictMode',
    'Suspense',
    'Fragment',
  ];

  return (
    frameworkPrefixes.some(prefix => name.startsWith(prefix)) ||
    frameworkNames.includes(name)
  );
}

/**
 * Initialize source location tracking
 * Call this once when the app loads
 */
export function initSourceLocationTracking() {
  // Expose API globally for webview preload script to use
  (window as any).__SOURCE_LOCATION__ = {
    getElementSourceLocation,
  };

  console.log('[SourceLocation] Tracking initialized');
  console.log('[SourceLocation] API available at window.__SOURCE_LOCATION__');
  console.log('[SourceLocation] Testing bippy availability:', {
    getFiberFromHostInstance: typeof getFiberFromHostInstance,
    getSource: typeof getSource,
  });

  // Test if React is available
  setTimeout(() => {
    const reactRoot = document.getElementById('root');
    if (reactRoot) {
      const testFiber = getFiberFromHostInstance(reactRoot);
      console.log('[SourceLocation] React root fiber test:', !!testFiber);
    }
  }, 1000);
}
