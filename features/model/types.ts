/**
 * Model Feature Types
 *
 * Type definitions for model selection and thinking level state.
 */

import type { IconComponent } from '../../utils/modelIcons'

/**
 * Thinking level for extended reasoning mode
 * - 'off': No extended thinking
 * - 'low': Brief reasoning
 * - 'med': Medium reasoning
 * - 'high': Extended reasoning
 * - 'ultrathink': Maximum reasoning depth
 */
export type ThinkingLevel = 'off' | 'low' | 'med' | 'high' | 'ultrathink'

/**
 * Model definition with display info
 */
export interface ModelDefinition {
  id: string
  name: string
  Icon: IconComponent
  provider?: string
}

/**
 * Model state managed by useModelState hook
 */
export interface ModelState {
  selectedModel: ModelDefinition
  isModelMenuOpen: boolean
  thinkingLevel: ThinkingLevel
  showThinkingPopover: boolean
}

/**
 * Actions returned by useModelState hook
 */
export interface ModelStateActions {
  setSelectedModel: React.Dispatch<React.SetStateAction<ModelDefinition>>
  setIsModelMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setThinkingLevel: React.Dispatch<React.SetStateAction<ThinkingLevel>>
  setShowThinkingPopover: React.Dispatch<React.SetStateAction<boolean>>
  toggleModelMenu: () => void
  toggleThinkingPopover: () => void
  closeMenus: () => void
}
