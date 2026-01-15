/**
 * Viewport Feature Types
 *
 * Type definitions for the viewport/device preview system.
 */

import type { Viewport } from '../../components/multi-viewport/types'
import type { LayoutDirection } from '../../components/multi-viewport/canvas/elkLayout'

/**
 * Viewport size presets
 */
export type ViewportSize = 'mobile' | 'tablet' | 'desktop'

/**
 * Zoom level options
 */
export type ZoomLevel = 'fit' | 'actual' | '50' | '75' | '100' | '125' | '150'

/**
 * Device preset definition
 */
export interface DevicePreset {
  name: string
  width: number
  height: number
  type: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Viewport controls exposed by ViewportGrid
 */
export interface ViewportControls {
  viewportCount: number
  addDevice: (type: 'mobile' | 'tablet' | 'desktop') => void
  addInternalWindow: (type: 'kanban' | 'todo' | 'notes') => void
  addTerminal: () => void
  autoLayout: (direction?: LayoutDirection) => void
  fitView: () => void
  getViewports: () => Viewport[]
  focusViewport: (id: string) => void
}

/**
 * Multi-viewport mode state
 */
export interface MultiViewportState {
  isMultiViewportMode: boolean
  viewportCount: number
}

/**
 * Device preview state
 */
export interface DevicePreviewState {
  viewportSize: ViewportSize
  selectedDevice: DevicePreset | null
  customWidth: number
  customHeight: number
  isCustomDevice: boolean
  zoomLevel: ZoomLevel
}
