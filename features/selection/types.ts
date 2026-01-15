/**
 * Selection Feature Types
 *
 * Type definitions for element selection state management.
 */

import type { SelectedElement } from '../../types'
import type { ElementStyles } from '../../types/elementStyles'

/**
 * Source snippet information for selected element
 */
export type SelectedElementSourceSnippet = {
  filePath: string
  displayPath: string
  startLine: number
  focusLine: number
  language: string
  code: string
} | null

/**
 * Hovered element with bounding rect
 */
export interface HoveredElement {
  element: SelectedElement
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
}

/**
 * Selection state managed by useSelectionState hook
 */
export interface SelectionState {
  /** Currently selected element from the page */
  selectedElement: SelectedElement | null
  /** Source code snippet for the selected element */
  selectedElementSourceSnippet: SelectedElementSourceSnippet
  /** Element currently being hovered with its bounding rect */
  hoveredElement: HoveredElement | null
  /** Element captured for screenshot */
  screenshotElement: SelectedElement | null
  /** Base64 captured screenshot data */
  capturedScreenshot: string | null
  /** Whether to show the screenshot preview modal */
  showScreenshotPreview: boolean
  /** Element styles for the selected element */
  elementStyles: ElementStyles
}

/**
 * Actions returned by useSelectionState hook
 */
export interface SelectionStateActions {
  setSelectedElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setSelectedElementSourceSnippet: React.Dispatch<React.SetStateAction<SelectedElementSourceSnippet>>
  setHoveredElement: React.Dispatch<React.SetStateAction<HoveredElement | null>>
  setScreenshotElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setCapturedScreenshot: React.Dispatch<React.SetStateAction<string | null>>
  setShowScreenshotPreview: React.Dispatch<React.SetStateAction<boolean>>
  setElementStyles: React.Dispatch<React.SetStateAction<ElementStyles>>
  /** Clears the current selection */
  clearSelection: () => void
  /** Clears screenshot state */
  clearScreenshot: () => void
}

/**
 * Refs returned by useSelectionState hook for synchronous access
 */
export interface SelectionStateRefs {
  /** Ref to selected element for synchronous access (e.g., in event handlers) */
  selectedElementRef: React.MutableRefObject<SelectedElement | null>
  /** Ref to element styles for synchronous access */
  elementStylesRef: React.MutableRefObject<ElementStyles>
}
