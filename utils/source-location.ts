import {
  getFiberFromHostInstance,
  getLatestFiber,
  isCompositeFiber,
  type Fiber,
} from 'bippy';

import {
  getSource,
  type FiberSource,
} from 'bippy/source';

import { debugLog } from './debug';

export interface ComponentSource {
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface ElementSourceInfo {
  sources: ComponentSource[];
  summary: string; // e.g., "App.tsx:45"
}

// ============================================================================
// SOURCE LOCATION CACHE
// Uses WeakMap for automatic garbage collection when elements are removed
// ============================================================================

const sourceCache = new WeakMap<HTMLElement, ElementSourceInfo | null>();
const cacheTimestamps = new WeakMap<HTMLElement, number>();
const CACHE_TTL_MS = 30000; // 30 seconds - source locations rarely change

// Cache stats for debugging
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Get cache statistics for debugging
 */
export function getSourceCacheStats(): { hits: number; misses: number; hitRate: string } {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) + '%' : 'N/A';
  return { hits: cacheHits, misses: cacheMisses, hitRate };
}

/**
 * Clear the source location cache (e.g., on page navigation)
 */
export function clearSourceCache(): void {
  // WeakMaps clear themselves when keys are garbage collected,
  // but we reset stats
  cacheHits = 0;
  cacheMisses = 0;
  debugLog.sourcePatch.log('[SourceCache] Cache stats reset');
}

/**
 * Check if cached result is still valid
 */
function isCacheValid(element: HTMLElement): boolean {
  const timestamp = cacheTimestamps.get(element);
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL_MS;
}

/**
 * Get source location information for a DOM element
 * Uses bippy's getFiberFromHostInstance and getSource for accurate source mapping
 * 
 * PERFORMANCE: Results are cached using WeakMap for instant repeated lookups.
 * Cache TTL is 30 seconds. Call clearSourceCache() on page navigation.
 */
export async function getElementSourceLocation(element: HTMLElement): Promise<ElementSourceInfo | null> {
  // Check cache first
  if (sourceCache.has(element) && isCacheValid(element)) {
    cacheHits++;
    const cached = sourceCache.get(element);
    debugLog.sourcePatch.log('[SourceCache] HIT - returning cached result', getSourceCacheStats());
    return cached ?? null;
  }

  cacheMisses++;
  const startTime = performance.now();

  try {
    debugLog.sourcePatch.log('Attempting to get source for element:', element.tagName, element.id || element.className);

    // Get the fiber from the DOM element
    const fiber = getFiberFromHostInstance(element);
    if (!fiber) {
      debugLog.sourcePatch.warn('No fiber found for element');
      sourceCache.set(element, null);
      cacheTimestamps.set(element, Date.now());
      return null;
    }

    // Get the latest fiber and walk up to find a composite (component) fiber
    const latestFiber = getLatestFiber(fiber);
    let compositeFiber: Fiber | null = latestFiber;
    while (compositeFiber && !isCompositeFiber(compositeFiber)) {
      compositeFiber = compositeFiber.return;
    }

    if (!compositeFiber) {
      debugLog.sourcePatch.warn('No composite fiber found');
      sourceCache.set(element, null);
      cacheTimestamps.set(element, Date.now());
      return null;
    }

    // Use bippy's getSource to get source location
    const sourceInfo: FiberSource | null = await getSource(compositeFiber);

    debugLog.sourcePatch.log('Source info from bippy:', sourceInfo);

    if (!sourceInfo || !sourceInfo.fileName) {
      debugLog.sourcePatch.warn('No source info found');
      sourceCache.set(element, null);
      cacheTimestamps.set(element, Date.now());
      return null;
    }

    const source: ComponentSource = {
      name: sourceInfo.functionName || 'Unknown',
      file: sourceInfo.fileName,
      line: sourceInfo.lineNumber || 0,
      column: sourceInfo.columnNumber || 0,
    };

    const summary = `${source.file}:${source.line}`;

    const result: ElementSourceInfo = {
      sources: [source],
      summary,
    };

    // Cache the result
    sourceCache.set(element, result);
    cacheTimestamps.set(element, Date.now());

    const durationMs = performance.now() - startTime;
    debugLog.sourcePatch.log(`[SourceCache] MISS - computed in ${durationMs.toFixed(1)}ms`, getSourceCacheStats());

    return result;
  } catch (error) {
    debugLog.sourcePatch.error('Error getting source location:', error);
    // Cache the failure to avoid repeated expensive lookups
    sourceCache.set(element, null);
    cacheTimestamps.set(element, Date.now());
    return null;
  }
}

/**
 * Synchronous version that gets basic fiber info without source mapping
 * Use this for quick lookups, the async version for full source info
 */
export function getElementFiberInfo(element: HTMLElement): { name: string; type: string } | null {
  try {
    const fiber = getFiberFromHostInstance(element);
    if (!fiber) return null;

    const latestFiber = getLatestFiber(fiber);

    // Walk up to find the nearest composite (component) fiber
    let current: Fiber | null = latestFiber;
    while (current) {
      if (isCompositeFiber(current)) {
        const name = getComponentName(current);
        if (name) {
          return { name, type: current.type?.name || 'Component' };
        }
      }
      current = current.return;
    }

    return null;
  } catch (error) {
    console.error('[SourceLocation] Error getting fiber info:', error);
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
 * Initialize source location tracking
 * Call this once when the app loads
 */
export function initSourceLocationTracking() {
  // Expose API globally for webview preload script to use
  (window as any).__SOURCE_LOCATION__ = {
    getElementSourceLocation,
    getElementFiberInfo,
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
