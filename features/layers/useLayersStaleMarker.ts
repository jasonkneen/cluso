/**
 * Layers Stale Marker Hook
 *
 * Marks layers tree as stale on navigation changes.
 * Extracted from App.tsx lines 2254-2256.
 */

import { useEffect } from 'react'

interface UseLayersStaleMarkerOptions {
  url: string | undefined
  layersTreeStaleRef: React.MutableRefObject<boolean>
}

/**
 * Hook for marking layers tree as stale
 *
 * Sets the stale ref to true whenever the URL changes.
 */
export function useLayersStaleMarker({
  url,
  layersTreeStaleRef,
}: UseLayersStaleMarkerOptions): void {
  useEffect(() => {
    if (url) layersTreeStaleRef.current = true
  }, [url, layersTreeStaleRef])
}
