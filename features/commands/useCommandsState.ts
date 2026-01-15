/**
 * Commands State Management Hook
 *
 * Centralizes slash command state management extracted from App.tsx.
 * Handles available commands for the / autocomplete system.
 */

import { useState } from 'react'
import type { Command, CommandsState, CommandsStateActions } from './types'

export interface UseCommandsStateReturn extends CommandsState, CommandsStateActions {}

/**
 * Hook for managing slash commands state
 *
 * Extracts and centralizes commands state management from App.tsx.
 * Provides state and actions for available slash commands.
 */
export function useCommandsState(): UseCommandsStateReturn {
  // Available commands for / autocomplete
  const [availableCommands, setAvailableCommands] = useState<Command[]>([])

  return {
    // State
    availableCommands,
    // Setters
    setAvailableCommands,
  }
}
