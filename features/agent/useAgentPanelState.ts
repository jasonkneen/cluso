/**
 * Agent Panel State Hook
 *
 * Manages state for the Cluso Agent demo panel.
 * Extracted from App.tsx for better organization.
 */

import { useState, useCallback } from 'react'
import type { AgentPanelState, AgentPanelActions } from './types'

export interface UseAgentPanelStateReturn extends AgentPanelState, AgentPanelActions {}

/**
 * Hook for managing agent panel state
 *
 * Provides state and actions for controlling the agent panel visibility.
 */
export function useAgentPanelState(): UseAgentPanelStateReturn {
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false)

  const toggleAgentPanel = useCallback(() => {
    setIsAgentPanelOpen(prev => !prev)
  }, [])

  const openAgentPanel = useCallback(() => {
    setIsAgentPanelOpen(true)
  }, [])

  const closeAgentPanel = useCallback(() => {
    setIsAgentPanelOpen(false)
  }, [])

  return {
    // State
    isAgentPanelOpen,
    // Setters
    setIsAgentPanelOpen,
    // Actions
    toggleAgentPanel,
    openAgentPanel,
    closeAgentPanel,
  }
}
