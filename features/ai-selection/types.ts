/**
 * AI Selection Feature Types
 *
 * Type definitions for AI element selection state management.
 * This handles AI-selected elements pending confirmation and displayed source code.
 */

import type { SelectedElement } from '../../types'

/**
 * AI-selected element pending user confirmation
 */
export interface AISelectedElement {
  /** CSS selector for the element */
  selector: string
  /** AI's reasoning for selecting this element */
  reasoning: string
  /** Number of elements matching the selector */
  count?: number
  /** Array of matched elements */
  elements?: SelectedElement[]
}

/**
 * Source code snippet displayed in the UI
 */
export interface DisplayedSourceCode {
  /** The source code content */
  code: string
  /** Name of the file */
  fileName: string
  /** Starting line number */
  startLine: number
  /** Ending line number */
  endLine: number
}

/**
 * AI selection state managed by useAISelectionState hook
 */
export interface AISelectionState {
  /** AI-selected element pending confirmation */
  aiSelectedElement: AISelectedElement | null
  /** Source code snippet being displayed */
  displayedSourceCode: DisplayedSourceCode | null
}

/**
 * Actions returned by useAISelectionState hook
 */
export interface AISelectionStateActions {
  setAiSelectedElement: React.Dispatch<React.SetStateAction<AISelectedElement | null>>
  setDisplayedSourceCode: React.Dispatch<React.SetStateAction<DisplayedSourceCode | null>>
  /** Clears the AI selection */
  clearAISelection: () => void
  /** Clears the displayed source code */
  clearDisplayedSourceCode: () => void
}
