/**
 * @ai-cluso/shared-inspector
 *
 * DOM inspection and element selection for ai-cluso applications.
 * Used by both the Electron desktop app and Chrome extension.
 */

// React fiber extraction scripts
export {
  REACT_FIBER_EXTRACTION_SCRIPT,
  RSC_EXTRACTION_SCRIPT,
  type ElementContext,
} from './react-fiber'

// Inspector styles
export {
  INSPECTOR_OVERLAY_STYLES,
  INSPECTOR_COLORS,
  type InspectorMode,
} from './inspector-styles'

// Utility functions
export {
  generateXPath,
  getComputedStyles,
  getElementAttributes,
  getElementRect,
  extractBasicElementSummary,
  extractElementSummary,
  getElementsInRect,
  createNumberBadge,
} from './utils'

// Re-export types from shared-types
export type { SelectedElement, ReactComponentInfo, ElementSourceInfo } from '@ai-cluso/shared-types'
