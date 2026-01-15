/**
 * Extension State Management Hook
 *
 * Centralizes Chrome extension bridge state management extracted from App.tsx.
 * Handles extension connection status, cursor sharing, and cursor position data.
 */

import { useState, useCallback } from 'react'
import type { ExtensionState, ExtensionStateActions, ExtensionCursor } from './types'

export interface UseExtensionStateReturn extends ExtensionState, ExtensionStateActions {}

/**
 * Hook for managing Chrome extension bridge state
 *
 * Extracts and centralizes extension state management from App.tsx.
 * Provides state and actions for extension connection and cursor sharing.
 */
export function useExtensionState(): UseExtensionStateReturn {
  // Extension connection state
  const [extensionConnected, setExtensionConnected] = useState(false)

  // Cursor sharing state
  const [extensionSharing, setExtensionSharing] = useState(false)
  const [extensionCursor, setExtensionCursor] = useState<ExtensionCursor | null>(null)

  // Action: Toggle cursor sharing
  const toggleSharing = useCallback(() => {
    setExtensionSharing(prev => {
      // Clear cursor data when turning off sharing
      if (prev) {
        setExtensionCursor(null)
      }
      return !prev
    })
  }, [])

  // Action: Clear cursor data
  const clearCursor = useCallback(() => {
    setExtensionCursor(null)
  }, [])

  return {
    // State
    extensionConnected,
    extensionSharing,
    extensionCursor,
    // Setters
    setExtensionConnected,
    setExtensionSharing,
    setExtensionCursor,
    // Actions
    toggleSharing,
    clearCursor,
  }
}
