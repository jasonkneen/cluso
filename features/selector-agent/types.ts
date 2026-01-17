/**
 * Selector Agent Types
 *
 * Type definitions for selector agent initialization.
 */

export interface UseSelectorAgentInitOptions {
  isElectron: boolean
  selectorAgentActive: boolean
  selectedModelRef: React.MutableRefObject<{ id: string } | undefined>
  initializeSelectorAgent: (options?: { modelId?: string }) => Promise<boolean>
}

export interface UseSelectorAgentPrimingOptions {
  selectorAgentActive: boolean
  isWebviewReady: boolean
  selectorAgentPrimed: boolean
  primeAgentWithPageContext: () => void
}
