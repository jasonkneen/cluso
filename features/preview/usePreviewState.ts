/**
 * Preview State Management Hook
 *
 * Centralizes preview/popup state management extracted from App.tsx.
 * Handles preview intent, popup input, and element chat visibility.
 */

import { useState, useCallback } from 'react'
import type {
  PreviewState,
  PreviewStateActions,
  PreviewIntent,
} from './types'

export interface UsePreviewStateReturn extends PreviewState, PreviewStateActions {}

/**
 * Hook for managing preview/popup state
 *
 * Extracts and centralizes preview state management from App.tsx.
 * Provides state and actions for preview intent, popup input, and element chat.
 */
export function usePreviewState(): UsePreviewStateReturn {
  // Preview intent state
  const [previewIntent, setPreviewIntent] = useState<PreviewIntent | null>(null)

  // Popup input state
  const [popupInput, setPopupInput] = useState('')

  // Element chat visibility state
  const [showElementChat, setShowElementChat] = useState(false)

  // Action: Clear all preview state
  const clearPreview = useCallback(() => {
    setPreviewIntent(null)
    setPopupInput('')
    setShowElementChat(false)
  }, [])

  // Action: Clear popup state only
  const clearPopup = useCallback(() => {
    setPopupInput('')
    setShowElementChat(false)
  }, [])

  return {
    // State
    previewIntent,
    popupInput,
    showElementChat,
    // Actions
    setPreviewIntent,
    setPopupInput,
    setShowElementChat,
    clearPreview,
    clearPopup,
  }
}
