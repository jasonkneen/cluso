/**
 * Selector Agent Auto-Initialization Hook
 *
 * Handles auto-priming the selector agent when page loads.
 * Extracted from App.tsx lines 2328-2336.
 */

import { useEffect } from 'react'

interface UseSelectorAgentAutoInitOptions {
  selectorAgentActive: boolean
  isWebviewReady: boolean
  selectorAgentPrimed: boolean
  primeAgentWithPageContext: () => Promise<void>
}

/**
 * Hook for auto-priming selector agent when page loads
 *
 * Debounces priming slightly to ensure page is stable.
 */
export function useSelectorAgentAutoInit({
  selectorAgentActive,
  isWebviewReady,
  selectorAgentPrimed,
  primeAgentWithPageContext,
}: UseSelectorAgentAutoInitOptions): void {
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
