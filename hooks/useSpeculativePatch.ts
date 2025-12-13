/**
 * Speculative Patch Pre-computation Hook
 * 
 * Pre-generates source patches while the user is editing, so when they
 * click "save" the patch is already ready (or nearly ready).
 * 
 * PERFORMANCE: Makes edits feel instant by doing work ahead of time.
 * 
 * Usage:
 *   const { speculativePatch, startSpeculation, cancelSpeculation } = useSpeculativePatch()
 *   
 *   // When user makes a change (e.g., types in CSS input)
 *   startSpeculation({ element, cssChanges, ... })
 *   
 *   // When user clicks save
 *   if (speculativePatch) {
 *     // Patch already ready! Use it immediately
 *     applyPatch(speculativePatch)
 *   } else {
 *     // Fall back to generating patch now
 *     const patch = await generateSourcePatch(...)
 *   }
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { generateSourcePatch, GenerateSourcePatchParams, SourcePatch } from '../utils/generateSourcePatch'

// Debounce delay before starting speculative generation
const SPECULATION_DELAY_MS = 300

// Don't speculate if params haven't changed
const CACHE_TTL_MS = 5000

interface SpeculationState {
  status: 'idle' | 'pending' | 'generating' | 'ready' | 'failed'
  patch: SourcePatch | null
  error: string | null
  paramsHash: string | null
  startedAt: number | null
  completedAt: number | null
}

interface UseSpeculativePatchReturn {
  /** Current speculation state */
  state: SpeculationState
  /** The ready patch (if available) */
  speculativePatch: SourcePatch | null
  /** Whether a patch is ready to use */
  isReady: boolean
  /** Whether speculation is in progress */
  isGenerating: boolean
  /** Start speculative patch generation (debounced) */
  startSpeculation: (params: GenerateSourcePatchParams) => void
  /** Cancel any pending speculation */
  cancelSpeculation: () => void
  /** Clear the ready patch (e.g., after using it) */
  clearPatch: () => void
  /** Get stats for debugging */
  getStats: () => { totalSpeculations: number; hits: number; misses: number; hitRate: string }
}

/**
 * Create a simple hash of params for change detection
 */
function hashParams(params: GenerateSourcePatchParams): string {
  const key = JSON.stringify({
    elementId: params.element.id,
    elementClass: params.element.className,
    elementTag: params.element.tagName,
    sourceLine: params.element.sourceLocation?.sources?.[0]?.line,
    cssChanges: params.cssChanges,
    textChange: params.textChange,
    srcChange: params.srcChange,
    userRequest: params.userRequest,
  })
  // Simple hash
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export function useSpeculativePatch(): UseSpeculativePatchReturn {
  const [state, setState] = useState<SpeculationState>({
    status: 'idle',
    patch: null,
    error: null,
    paramsHash: null,
    startedAt: null,
    completedAt: null,
  })

  // Refs for managing async operations
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentParamsRef = useRef<GenerateSourcePatchParams | null>(null)

  // Stats for debugging
  const statsRef = useRef({ totalSpeculations: 0, hits: 0, misses: 0 })

  /**
   * Cancel any pending or in-progress speculation
   */
  const cancelSpeculation = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Abort any in-progress generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state (but keep stats)
    setState(prev => ({
      ...prev,
      status: 'idle',
      patch: null,
      error: null,
    }))
  }, [])

  /**
   * Start speculative patch generation (debounced)
   */
  const startSpeculation = useCallback((params: GenerateSourcePatchParams) => {
    const paramsHash = hashParams(params)

    // Check if we already have a valid patch for these params
    if (state.paramsHash === paramsHash && 
        state.status === 'ready' && 
        state.patch &&
        state.completedAt &&
        Date.now() - state.completedAt < CACHE_TTL_MS) {
      console.log('[Speculative] Cache hit - reusing existing patch')
      statsRef.current.hits++
      return
    }

    // Cancel any existing speculation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Store current params
    currentParamsRef.current = params

    // Set pending state
    setState(prev => ({
      ...prev,
      status: 'pending',
      paramsHash,
      error: null,
    }))

    // Debounce the actual generation
    debounceTimerRef.current = setTimeout(async () => {
      // Create abort controller for this generation
      const controller = new AbortController()
      abortControllerRef.current = controller

      setState(prev => ({
        ...prev,
        status: 'generating',
        startedAt: Date.now(),
      }))

      statsRef.current.totalSpeculations++

      try {
        console.log('[Speculative] Starting patch generation...')
        const startTime = performance.now()

        // Generate the patch
        const patch = await generateSourcePatch(params)

        // Check if we were aborted
        if (controller.signal.aborted) {
          console.log('[Speculative] Generation aborted')
          return
        }

        const durationMs = performance.now() - startTime

        if (patch) {
          console.log(`[Speculative] Patch ready in ${durationMs.toFixed(0)}ms`)
          setState({
            status: 'ready',
            patch,
            error: null,
            paramsHash,
            startedAt: Date.now() - durationMs,
            completedAt: Date.now(),
          })
        } else {
          console.log('[Speculative] Generation returned null')
          setState(prev => ({
            ...prev,
            status: 'failed',
            patch: null,
            error: 'Generation returned null',
            completedAt: Date.now(),
          }))
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('[Speculative] Generation failed:', errorMessage)
        setState(prev => ({
          ...prev,
          status: 'failed',
          patch: null,
          error: errorMessage,
          completedAt: Date.now(),
        }))
      }
    }, SPECULATION_DELAY_MS)
  }, [state.paramsHash, state.status, state.patch, state.completedAt])

  /**
   * Clear the ready patch (e.g., after it's been used)
   */
  const clearPatch = useCallback(() => {
    setState({
      status: 'idle',
      patch: null,
      error: null,
      paramsHash: null,
      startedAt: null,
      completedAt: null,
    })
  }, [])

  /**
   * Get stats for debugging
   */
  const getStats = useCallback(() => {
    const { totalSpeculations, hits, misses } = statsRef.current
    const total = hits + misses
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) + '%' : 'N/A'
    return { totalSpeculations, hits, misses, hitRate }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    state,
    speculativePatch: state.status === 'ready' ? state.patch : null,
    isReady: state.status === 'ready' && state.patch !== null,
    isGenerating: state.status === 'generating',
    startSpeculation,
    cancelSpeculation,
    clearPatch,
    getStats,
  }
}

/**
 * Record a speculative patch hit (patch was used)
 * Call this when using a speculative patch to track hit rate
 */
export function recordSpeculativeHit(): void {
  // This would be called from the consumer to track stats
  console.log('[Speculative] Patch HIT - used speculative result')
}

/**
 * Record a speculative patch miss (had to generate fresh)
 * Call this when falling back to fresh generation
 */
export function recordSpeculativeMiss(): void {
  console.log('[Speculative] Patch MISS - fell back to fresh generation')
}
