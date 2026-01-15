/**
 * Model State Management Hook
 *
 * Centralizes model selection and thinking level state extracted from App.tsx.
 * Handles model selection, model menu visibility, thinking level, and popover.
 */

import { useState, useCallback } from 'react'
import { DEFAULT_MODEL } from '../../utils/modelIcons'
import type {
  ThinkingLevel,
  ModelDefinition,
  ModelState,
  ModelStateActions,
} from './types'

export interface UseModelStateReturn extends ModelState, ModelStateActions {}

/**
 * Hook for managing model selection and thinking level state
 *
 * Extracts and centralizes model state management from App.tsx.
 * Provides state and actions for model selection and thinking configuration.
 */
export function useModelState(): UseModelStateReturn {
  // Model selection state - default to configured DEFAULT_MODEL
  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(DEFAULT_MODEL)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)

  // Thinking/Reasoning mode state
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off')
  const [showThinkingPopover, setShowThinkingPopover] = useState(false)

  // Action: Toggle model menu visibility
  const toggleModelMenu = useCallback(() => {
    setIsModelMenuOpen(prev => !prev)
    // Close thinking popover when opening model menu
    setShowThinkingPopover(false)
  }, [])

  // Action: Toggle thinking popover visibility
  const toggleThinkingPopover = useCallback(() => {
    setShowThinkingPopover(prev => !prev)
    // Close model menu when opening thinking popover
    setIsModelMenuOpen(false)
  }, [])

  // Action: Close all menus/popovers
  const closeMenus = useCallback(() => {
    setIsModelMenuOpen(false)
    setShowThinkingPopover(false)
  }, [])

  return {
    // State
    selectedModel,
    isModelMenuOpen,
    thinkingLevel,
    showThinkingPopover,
    // Setters
    setSelectedModel,
    setIsModelMenuOpen,
    setThinkingLevel,
    setShowThinkingPopover,
    // Actions
    toggleModelMenu,
    toggleThinkingPopover,
    closeMenus,
  }
}
