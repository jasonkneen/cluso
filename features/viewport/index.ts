/**
 * Viewport Feature Module
 *
 * Exports viewport mode state management and types.
 */

export { useViewportMode, ZOOM_OPTIONS, VIEWPORT_WIDTHS, DEVICE_PRESETS } from './useViewportMode'
export type { UseViewportModeReturn, UseViewportModeOptions } from './useViewportMode'
export { useMultiViewportData } from './useMultiViewportData'
export type { UseMultiViewportDataReturn } from './useMultiViewportData'
export type {
  ViewportSize,
  ZoomLevel,
  DevicePreset,
  ViewportControls,
  MultiViewportState,
  DevicePreviewState,
  MultiViewportDataItem,
  MultiViewportData,
} from './types'
