/**
 * Media State Management Hook
 *
 * Centralizes voice/screen sharing state management extracted from App.tsx.
 * Handles voice mode, recording state, screen sharing, and toolbar visibility.
 */

import { useState, useCallback } from 'react'
import type { MediaState, MediaStateActions } from './types'

export interface UseMediaStateReturn extends MediaState, MediaStateActions {}

/**
 * Hook for managing media state (voice input, screen sharing, toolbar)
 *
 * Extracts and centralizes media state management from App.tsx.
 * Provides state and actions for voice input, screen sharing, and toolbar visibility.
 */
export function useMediaState(): UseMediaStateReturn {
  // Voice input state
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceInputText, setVoiceInputText] = useState('')

  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Toolbar visibility state
  const [isFloatingToolbarVisible, setIsFloatingToolbarVisible] = useState(true)

  // Action: Start voice input mode and recording
  const startVoiceInput = useCallback(() => {
    setIsVoiceMode(true)
    setIsRecording(true)
    setVoiceInputText('')
  }, [])

  // Action: Stop voice input mode and recording
  const stopVoiceInput = useCallback(() => {
    setIsVoiceMode(false)
    setIsRecording(false)
  }, [])

  // Action: Toggle screen sharing
  const toggleScreenSharing = useCallback(() => {
    setIsScreenSharing(prev => !prev)
  }, [])

  // Action: Toggle floating toolbar visibility
  const toggleFloatingToolbar = useCallback(() => {
    setIsFloatingToolbarVisible(prev => !prev)
  }, [])

  // Action: Clear voice input text
  const clearVoiceInput = useCallback(() => {
    setVoiceInputText('')
  }, [])

  return {
    // State
    isVoiceMode,
    isRecording,
    voiceInputText,
    isScreenSharing,
    isFloatingToolbarVisible,
    // Setters
    setIsVoiceMode,
    setIsRecording,
    setVoiceInputText,
    setIsScreenSharing,
    setIsFloatingToolbarVisible,
    // Actions
    startVoiceInput,
    stopVoiceInput,
    toggleScreenSharing,
    toggleFloatingToolbar,
    clearVoiceInput,
  }
}
