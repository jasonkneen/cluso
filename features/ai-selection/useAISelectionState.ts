/**
 * AI Selection State Management Hook
 *
 * Centralizes AI element selection state management extracted from App.tsx.
 * Handles AI-selected elements pending confirmation and displayed source code.
 */

import { useState, useCallback } from 'react'
import type {
  AISelectionState,
  AISelectionStateActions,
  AISelectedElement,
  DisplayedSourceCode,
} from './types'

export interface UseAISelectionStateReturn extends AISelectionState, AISelectionStateActions {}

/**
 * Hook for managing AI element selection state
 *
 * Extracts and centralizes AI selection state management from App.tsx.
 * Provides state and actions for AI element selection and source code display.
 */
export function useAISelectionState(): UseAISelectionStateReturn {
  // AI-selected element state (pending confirmation)
  const [aiSelectedElement, setAiSelectedElement] = useState<AISelectedElement | null>(null)

  // Displayed source code state
  const [displayedSourceCode, setDisplayedSourceCode] = useState<DisplayedSourceCode | null>(null)

  // Action: Clear AI selection
  const clearAISelection = useCallback(() => {
    setAiSelectedElement(null)
  }, [])

  // Action: Clear displayed source code
  const clearDisplayedSourceCode = useCallback(() => {
    setDisplayedSourceCode(null)
  }, [])

  return {
    // State
    aiSelectedElement,
    displayedSourceCode,
    // Actions
    setAiSelectedElement,
    setDisplayedSourceCode,
    clearAISelection,
    clearDisplayedSourceCode,
  }
}
