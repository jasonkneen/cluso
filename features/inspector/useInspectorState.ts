/**
 * Inspector State Management Hook
 *
 * Centralizes inspector tool state management extracted from App.tsx.
 * Handles inspector, screenshot, and move modes as mutually exclusive tools.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type {
  InspectorState,
  InspectorStateActions,
  InspectorStateRefs,
  MoveTargetPosition,
  PreInspectorSettings,
} from './types'

export interface UseInspectorStateReturn extends InspectorState, InspectorStateActions, InspectorStateRefs {}

/**
 * Hook for managing inspector tool state
 *
 * Extracts and centralizes inspector state management from App.tsx.
 * These tools are mutually exclusive - only one can be active at a time.
 */
export function useInspectorState(): UseInspectorStateReturn {
  // Inspector mode state
  const [isInspectorActive, setIsInspectorActive] = useState(false)
  const [isScreenshotActive, setIsScreenshotActive] = useState(false)
  const [isMoveActive, setIsMoveActive] = useState(false)

  // Move mode state - tracks target position for element repositioning
  const [moveTargetPosition, setMoveTargetPosition] = useState<MoveTargetPosition | null>(null)

  // Refs to track current state values for closures (webview event handlers)
  const isInspectorActiveRef = useRef(false)
  const isScreenshotActiveRef = useRef(false)
  const isMoveActiveRef = useRef(false)

  // Store previous settings when inspector is activated
  const preInspectorSettingsRef = useRef<PreInspectorSettings | null>(null)

  // Keep refs in sync with state for webview event handler closures
  useEffect(() => {
    isInspectorActiveRef.current = isInspectorActive
  }, [isInspectorActive])

  useEffect(() => {
    isScreenshotActiveRef.current = isScreenshotActive
  }, [isScreenshotActive])

  useEffect(() => {
    isMoveActiveRef.current = isMoveActive
  }, [isMoveActive])

  // Action: Toggle inspector mode (deactivates other tools)
  const toggleInspector = useCallback(() => {
    setIsInspectorActive(prev => {
      const newState = !prev
      if (newState) {
        // Deactivate other tools when activating inspector
        setIsScreenshotActive(false)
        setIsMoveActive(false)
      }
      return newState
    })
  }, [])

  // Action: Toggle screenshot mode (deactivates other tools)
  const toggleScreenshot = useCallback(() => {
    setIsScreenshotActive(prev => {
      const newState = !prev
      if (newState) {
        // Deactivate other tools when activating screenshot
        setIsInspectorActive(false)
        setIsMoveActive(false)
      }
      return newState
    })
  }, [])

  // Action: Toggle move mode (deactivates other tools)
  const toggleMove = useCallback(() => {
    setIsMoveActive(prev => {
      const newState = !prev
      if (newState) {
        // Deactivate other tools when activating move
        setIsInspectorActive(false)
        setIsScreenshotActive(false)
      }
      return newState
    })
  }, [])

  // Action: Deactivate all tools
  const deactivateAll = useCallback(() => {
    setIsInspectorActive(false)
    setIsScreenshotActive(false)
    setIsMoveActive(false)
    setMoveTargetPosition(null)
  }, [])

  return {
    // State
    isInspectorActive,
    isScreenshotActive,
    isMoveActive,
    moveTargetPosition,
    // Actions
    setIsInspectorActive,
    setIsScreenshotActive,
    setIsMoveActive,
    setMoveTargetPosition,
    toggleInspector,
    toggleScreenshot,
    toggleMove,
    deactivateAll,
    // Refs
    isInspectorActiveRef,
    isScreenshotActiveRef,
    isMoveActiveRef,
    preInspectorSettingsRef,
  }
}
