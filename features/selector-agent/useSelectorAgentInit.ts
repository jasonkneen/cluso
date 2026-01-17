/**
 * Selector Agent Init Hook
 *
 * Initializes selector agent when Electron is available.
 *
 * Extracted from App.tsx to centralize agent initialization.
 */

import { useEffect } from 'react'
import type { UseSelectorAgentInitOptions } from './types'

/**
 * Hook for initializing selector agent
 *
 * Initializes the selector agent with preferred model when Electron is available.
 * Falls back to default model if custom model fails.
 *
 * @param options - Configuration options for agent init
 */
export function useSelectorAgentInit(options: UseSelectorAgentInitOptions): void {
  const {
    isElectron,
    selectorAgentActive,
    selectedModelRef,
    initializeSelectorAgent,
  } = options

  useEffect(() => {
    if (isElectron && !selectorAgentActive) {
      const preferredModelId = selectedModelRef.current?.id
      initializeSelectorAgent({ modelId: preferredModelId }).then(success => {
        if (success) {
          console.log('[SelectorAgent] Initialized successfully', preferredModelId ? `with model ${preferredModelId}` : '')
          return
        }
        // Retry with default model if custom selection failed
        if (preferredModelId) {
          console.warn('[SelectorAgent] Init failed with model', preferredModelId, '- retrying default')
          initializeSelectorAgent().then(retrySuccess => {
            if (retrySuccess) {
              console.log('[SelectorAgent] Initialized successfully with default model')
            }
          })
        }
      })
    }
  }, [isElectron, selectorAgentActive, initializeSelectorAgent, selectedModelRef])
}
