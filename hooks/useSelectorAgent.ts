import { useState, useEffect, useCallback, useRef } from 'react'
import { debugLog } from '../utils/debug'
import { SelectedElement } from '../types'

/**
 * Selection result from the selector agent
 */
export interface SelectionResult {
  selector: string | null
  reasoning: string
  confidence: number
  alternatives: string[]
  suggestions?: string[]
  raw?: string
  parseError?: string
}

/**
 * Context state for the selector agent
 */
export interface SelectorContextState {
  isPrimed: boolean
  pageUrl: string | null
  pageTitle: string | null
  lastPrimedAt: number | null
}

/**
 * Page context to prime the selector agent
 */
export interface PageContext {
  pageElements: string | object
  pageUrl?: string
  pageTitle?: string
}

/**
 * Options for useSelectorAgent hook
 */
export interface UseSelectorAgentOptions {
  /** Callback when selection result is received */
  onSelectionResult?: (result: SelectionResult) => void
  /** Callback when streaming text is received */
  onTextChunk?: (text: string) => void
  /** Callback when agent is ready */
  onReady?: () => void
  /** Callback when error occurs */
  onError?: (error: string) => void
  /** Auto-initialize the session on mount */
  autoInit?: boolean
  /** Working directory for the agent */
  cwd?: string
}

/**
 * Return type for useSelectorAgent hook
 */
export interface UseSelectorAgentReturn {
  /** Whether the Electron API is available */
  isAvailable: boolean
  /** Whether a session is active */
  isActive: boolean
  /** Whether currently waiting for a response */
  isWaiting: boolean
  /** Whether the context is primed */
  isPrimed: boolean
  /** Current error message */
  error: string | null
  /** Latest selection result */
  latestResult: SelectionResult | null
  /** Context state */
  contextState: SelectorContextState | null
  /** Initialize the selector session */
  initialize: (options?: { cwd?: string; modelId?: string }) => Promise<boolean>
  /** Prime the agent with page context */
  primeContext: (context: PageContext) => Promise<boolean>
  /** Request element selection */
  selectElement: (description: string, options?: { includeContext?: boolean; pageElements?: string }) => Promise<boolean>
  /** Send a general message */
  sendMessage: (text: string) => Promise<boolean>
  /** Interrupt the current response */
  interrupt: () => Promise<boolean>
  /** Reset the session */
  reset: () => Promise<boolean>
  /** Refresh context state from the agent */
  refreshContextState: () => Promise<void>
}

/**
 * Hook for interacting with the Selector Agent
 *
 * The Selector Agent maintains a persistent claude-agent-sdk session
 * specifically for fast element selection. It supports:
 *
 * 1. **Context Priming**: Send DOM snapshots proactively so the agent
 *    already has page context when a selection is requested
 *
 * 2. **Fast Selection**: With context pre-loaded, element selection
 *    requests return almost instantly
 *
 * 3. **Multi-turn Conversations**: Build on previous context for
 *    more accurate suggestions over time
 *
 * @example
 * ```tsx
 * const {
 *   isActive,
 *   isPrimed,
 *   initialize,
 *   primeContext,
 *   selectElement,
 *   latestResult
 * } = useSelectorAgent({
 *   onSelectionResult: (result) => {
 *     if (result.selector) {
 *       handleAiElementSelect(result.selector, result.reasoning)
 *     }
 *   }
 * })
 *
 * // Initialize on mount
 * useEffect(() => {
 *   if (isAvailable && !isActive) {
 *     initialize()
 *   }
 * }, [isAvailable])
 *
 * // Prime context when page changes
 * useEffect(() => {
 *   if (isActive && pageElements) {
 *     primeContext({
 *       pageElements,
 *       pageUrl: currentUrl,
 *       pageTitle: document.title
 *     })
 *   }
 * }, [isActive, pageElements])
 *
 * // Request selection
 * const handleUserRequest = async (description: string) => {
 *   await selectElement(description)
 * }
 * ```
 */
export function useSelectorAgent(options: UseSelectorAgentOptions = {}): UseSelectorAgentReturn {
  const {
    onSelectionResult,
    onTextChunk,
    onReady,
    onError,
    autoInit = false,
    cwd,
  } = options

  const [isAvailable, setIsAvailable] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isPrimed, setIsPrimed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<SelectionResult | null>(null)
  const [contextState, setContextState] = useState<SelectorContextState | null>(null)

  // Store callbacks in refs to avoid re-registering listeners
  const callbacksRef = useRef({
    onSelectionResult,
    onTextChunk,
    onReady,
    onError,
  })
  callbacksRef.current = { onSelectionResult, onTextChunk, onReady, onError }

  // Guard against concurrent init calls (React Strict Mode fires effects twice)
  const isInitializingRef = useRef(false)

  // Check if Selector Agent API is available (Electron only)
  useEffect(() => {
    const available = !!(window.electronAPI?.selectorAgent)
    setIsAvailable(available)

    if (!available || !window.electronAPI?.selectorAgent) {
      return
    }

    const selectorAgent = window.electronAPI.selectorAgent

    // Set up event listeners
    const unsubTextChunk = selectorAgent.onTextChunk((text) => {
      callbacksRef.current.onTextChunk?.(text)
    })

    const unsubSelectionResult = selectorAgent.onSelectionResult((result) => {
      setIsWaiting(false)
      setLatestResult(result)
      callbacksRef.current.onSelectionResult?.(result)
    })

    const unsubReady = selectorAgent.onReady(() => {
      isInitializingRef.current = false  // Clear init guard
      setIsActive(true)
      setError(null)
      callbacksRef.current.onReady?.()
    })

    const unsubError = selectorAgent.onError((err) => {
      isInitializingRef.current = false  // Clear init guard on error
      setIsWaiting(false)
      setError(err)
      callbacksRef.current.onError?.(err)
    })

    // Check initial active state
    selectorAgent.isActive().then((result) => {
      setIsActive(result.active)
      if (result.active) {
        // If already active, get context state
        selectorAgent.getContextState().then(setContextState)
      }
    })

    // Cleanup
    return () => {
      unsubTextChunk()
      unsubSelectionResult()
      unsubReady()
      unsubError()
    }
  }, [])

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInit && isAvailable && !isActive) {
      initialize({ cwd })
    }
  }, [autoInit, isAvailable, isActive, cwd])

  /**
   * Initialize the selector agent session
   */
  const initialize = useCallback(async (initOptions?: { cwd?: string; modelId?: string }): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      setError('Selector agent is only available in the desktop app')
      return false
    }

    // Guard against concurrent init calls (React Strict Mode double-fires effects)
    if (isInitializingRef.current || isActive) {
      debugLog.general.log('[SelectorAgent] Skipping init - already initializing or active')
      return true
    }

    isInitializingRef.current = true
    setError(null)

    try {
      const result = await window.electronAPI.selectorAgent.init({
        cwd: initOptions?.cwd || cwd,
        modelId: initOptions?.modelId,
      })

      if (!result.success) {
        setError(result.error || 'Failed to initialize selector agent')
        isInitializingRef.current = false
        return false
      }

      // Note: isActive will be set when onReady event fires
      // Keep isInitializingRef true until ready or error
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      isInitializingRef.current = false
      return false
    }
  }, [cwd, isActive])

  /**
   * Prime the agent with page context
   */
  const primeContext = useCallback(async (context: PageContext): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      setError('Selector agent is only available in the desktop app')
      return false
    }

    setError(null)

    try {
      const result = await window.electronAPI.selectorAgent.prime(context)

      if (!result.success) {
        setError(result.error || 'Failed to prime context')
        return false
      }

      setIsPrimed(true)

      // Refresh context state
      const state = await window.electronAPI.selectorAgent.getContextState()
      setContextState(state)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return false
    }
  }, [])

  /**
   * Request element selection
   */
  const selectElement = useCallback(async (
    description: string,
    selectOptions?: { includeContext?: boolean; pageElements?: string }
  ): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      setError('Selector agent is only available in the desktop app')
      return false
    }

    setError(null)
    setIsWaiting(true)

    try {
      const result = await window.electronAPI.selectorAgent.select(description, selectOptions)

      if (!result.success) {
        setIsWaiting(false)
        setError(result.error || 'Failed to request selection')
        return false
      }

      // isWaiting will be cleared when onSelectionResult fires
      return true
    } catch (err) {
      setIsWaiting(false)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return false
    }
  }, [])

  /**
   * Send a general message to the session
   */
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      setError('Selector agent is only available in the desktop app')
      return false
    }

    setError(null)
    setIsWaiting(true)

    try {
      const result = await window.electronAPI.selectorAgent.send(text)

      if (!result.success) {
        setIsWaiting(false)
        setError(result.error || 'Failed to send message')
        return false
      }

      return true
    } catch (err) {
      setIsWaiting(false)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return false
    }
  }, [])

  /**
   * Interrupt the current response
   */
  const interrupt = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      return false
    }

    try {
      const result = await window.electronAPI.selectorAgent.interrupt()
      if (result.success) {
        setIsWaiting(false)
      }
      return result.success
    } catch (err) {
      debugLog.general.error('Failed to interrupt selector agent:', err)
      return false
    }
  }, [])

  /**
   * Reset the session
   */
  const reset = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI?.selectorAgent) {
      return false
    }

    try {
      const result = await window.electronAPI.selectorAgent.reset()

      if (result.success) {
        setIsActive(false)
        setIsWaiting(false)
        setIsPrimed(false)
        setLatestResult(null)
        setContextState(null)
        setError(null)
      }

      return result.success
    } catch (err) {
      debugLog.general.error('Failed to reset selector agent:', err)
      return false
    }
  }, [])

  /**
   * Refresh context state from the agent
   */
  const refreshContextState = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.selectorAgent) {
      return
    }

    try {
      const state = await window.electronAPI.selectorAgent.getContextState()
      setContextState(state)
      setIsPrimed(state.isPrimed)
    } catch (err) {
      debugLog.general.error('Failed to refresh context state:', err)
    }
  }, [])

  return {
    isAvailable,
    isActive,
    isWaiting,
    isPrimed,
    error,
    latestResult,
    contextState,
    initialize,
    primeContext,
    selectElement,
    sendMessage,
    interrupt,
    reset,
    refreshContextState,
  }
}
