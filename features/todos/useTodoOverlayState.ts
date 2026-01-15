/**
 * Todo Overlay State Management Hook
 *
 * Centralizes todo overlay-related state management extracted from App.tsx.
 * Handles the mini chat popup todo mode and the full todo overlay panel.
 */

import { useState, useCallback } from 'react'
import type {
  TodoPriority,
  TodoOverlayState,
  TodoOverlayStateActions,
} from './types'

export interface UseTodoOverlayStateReturn extends TodoOverlayState, TodoOverlayStateActions {}

/**
 * Hook for managing todo overlay state
 *
 * Extracts and centralizes todo overlay state management from App.tsx.
 * Provides state and actions for the mini chat popup todo mode
 * and the full todo overlay panel visibility.
 */
export function useTodoOverlayState(): UseTodoOverlayStateReturn {
  // Add Todo State (for mini chat popup)
  const [isAddingTodo, setIsAddingTodo] = useState(false)
  const [todoPriority, setTodoPriority] = useState<TodoPriority>('medium')
  const [todoDueDate, setTodoDueDate] = useState<string>('')

  // Todo Overlay State
  const [showTodoOverlay, setShowTodoOverlay] = useState(false)

  // Action: Toggle the todo overlay panel visibility
  const toggleTodoOverlay = useCallback(() => {
    setShowTodoOverlay(prev => !prev)
  }, [])

  // Action: Reset the todo form to default values
  const resetTodoForm = useCallback(() => {
    setIsAddingTodo(false)
    setTodoPriority('medium')
    setTodoDueDate('')
  }, [])

  return {
    // State
    isAddingTodo,
    todoPriority,
    todoDueDate,
    showTodoOverlay,
    // Setters
    setIsAddingTodo,
    setTodoPriority,
    setTodoDueDate,
    setShowTodoOverlay,
    // Actions
    toggleTodoOverlay,
    resetTodoForm,
  }
}
