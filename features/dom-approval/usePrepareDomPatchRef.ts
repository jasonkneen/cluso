/**
 * Prepare DOM Patch Ref Hook
 *
 * Bridges prepareDomPatch function to ref for webview setup.
 *
 * Extracted from App.tsx to centralize ref bridging.
 */

import { useEffect } from 'react'
import type { UsePrepareDomPatchRefOptions } from './types'

/**
 * Hook for bridging prepareDomPatch to ref
 *
 * Keeps the ref updated with the latest prepareDomPatch function.
 * This allows webview setup hooks to call the function via ref.
 *
 * @param options - Configuration options for ref bridging
 */
export function usePrepareDomPatchRef(options: UsePrepareDomPatchRefOptions): void {
  const { prepareDomPatchRef, prepareDomPatch } = options

  useEffect(() => {
    prepareDomPatchRef.current = prepareDomPatch
  }, [prepareDomPatch, prepareDomPatchRef])
}
