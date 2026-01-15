/**
 * Agent Feature Types
 *
 * Type definitions for the Cluso Agent panel state.
 */

/**
 * Agent panel state
 */
export interface AgentPanelState {
  isAgentPanelOpen: boolean
}

/**
 * Agent panel actions
 */
export interface AgentPanelActions {
  setIsAgentPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggleAgentPanel: () => void
  openAgentPanel: () => void
  closeAgentPanel: () => void
}
