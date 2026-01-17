/**
 * Selector Agent Priming Hook
 *
 * Auto-primes selector agent when page loads.
 *
 * Extracted from App.tsx to centralize agent priming.
 */

import { useEffect } from 'react'
import type { UseSelectorAgentPrimingOptions } from './types'

/**
 * Hook for auto-priming selector agent
 *
 * Primes the agent with page context when conditions are met.
 * Debounces priming to ensure page stability.
 *
 * @param options - Configuration options for agent priming
 */
export function useSelectorAgentPriming(options: UseSelectorAgentPrimingOptions): void {
  const {
    selectorAgentActive,
    isWebviewReady,
    selectorAgentPrimed,
    primeAgentWithPageContext,
  } = options

  useEffect(() => {
    if (selectorAgentActive && isWebviewReady && !selectorAgentPrimed) {
      // Debounce priming slightly to ensure page is stable
      const timer = setTimeout(() => {
        primeAgentWithPageContext()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [selectorAgentActive, isWebviewReady, selectorAgentPrimed, primeAgentWithPageContext])
}
