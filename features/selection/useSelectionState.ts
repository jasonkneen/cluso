/**
 * Selection State Management Hook
 *
 * Centralizes element selection state management extracted from App.tsx.
 * Handles selected elements, source snippets, hover state, screenshots, and element styles.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { SelectedElement } from '../../types'
import { DEFAULT_ELEMENT_STYLES, type ElementStyles } from '../../types/elementStyles'
import type {
  SelectionState,
  SelectionStateActions,
  SelectionStateRefs,
  SelectedElementSourceSnippet,
  HoveredElement,
} from './types'

export interface UseSelectionStateReturn extends SelectionState, SelectionStateActions, SelectionStateRefs {}

/**
 * Hook for managing element selection state
 *
 * Extracts and centralizes selection state management from App.tsx.
 * Provides state, actions, and refs for element selection, screenshots, and styling.
 */
export function useSelectionState(): UseSelectionStateReturn {
  // Selected element state
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const selectedElementRef = useRef<SelectedElement | null>(null)

  // Keep ref in sync with state for synchronous access in event handlers
  useEffect(() => {
    selectedElementRef.current = selectedElement
  }, [selectedElement])

  // Source snippet state
  const [selectedElementSourceSnippet, setSelectedElementSourceSnippet] = useState<SelectedElementSourceSnippet>(null)

  // Hovered element state
  const [hoveredElement, setHoveredElement] = useState<HoveredElement | null>(null)

  // Screenshot state
  const [screenshotElement, setScreenshotElement] = useState<SelectedElement | null>(null)
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null)
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false)

  // Element styles state
  const [elementStyles, setElementStyles] = useState<ElementStyles>(DEFAULT_ELEMENT_STYLES)
  const elementStylesRef = useRef<ElementStyles>(DEFAULT_ELEMENT_STYLES)

  // Keep styles ref in sync
  useEffect(() => {
    elementStylesRef.current = elementStyles
  }, [elementStyles])

  // Action: Clear the current selection
  const clearSelection = useCallback(() => {
    setSelectedElement(null)
    setSelectedElementSourceSnippet(null)
    setHoveredElement(null)
  }, [])

  // Action: Clear screenshot state
  const clearScreenshot = useCallback(() => {
    setScreenshotElement(null)
    setCapturedScreenshot(null)
    setShowScreenshotPreview(false)
  }, [])

  return {
    // State
    selectedElement,
    selectedElementSourceSnippet,
    hoveredElement,
    screenshotElement,
    capturedScreenshot,
    showScreenshotPreview,
    elementStyles,
    // Actions
    setSelectedElement,
    setSelectedElementSourceSnippet,
    setHoveredElement,
    setScreenshotElement,
    setCapturedScreenshot,
    setShowScreenshotPreview,
    setElementStyles,
    clearSelection,
    clearScreenshot,
    // Refs
    selectedElementRef,
    elementStylesRef,
  }
}
