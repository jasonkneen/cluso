/**
 * Viewport Mode Hook
 *
 * Manages multi-viewport mode state and device preview configuration.
 */

import { useState, useRef, useMemo } from 'react'
import type {
  ViewportSize,
  ZoomLevel,
  DevicePreset,
  ViewportControls,
} from './types'

export interface UseViewportModeOptions {
  /** Display PPI for actual size calculation */
  displayPpi?: number
}

export interface UseViewportModeReturn {
  // Multi-viewport mode
  isMultiViewportMode: boolean
  setIsMultiViewportMode: React.Dispatch<React.SetStateAction<boolean>>
  viewportCount: number
  setViewportCount: React.Dispatch<React.SetStateAction<number>>
  viewportControlsRef: React.MutableRefObject<ViewportControls | null>

  // Device preview
  viewportSize: ViewportSize
  setViewportSize: React.Dispatch<React.SetStateAction<ViewportSize>>
  selectedDevice: DevicePreset | null
  setSelectedDevice: React.Dispatch<React.SetStateAction<DevicePreset | null>>
  customWidth: number
  setCustomWidth: React.Dispatch<React.SetStateAction<number>>
  customHeight: number
  setCustomHeight: React.Dispatch<React.SetStateAction<number>>
  isCustomDevice: boolean
  setIsCustomDevice: React.Dispatch<React.SetStateAction<boolean>>

  // Zoom
  zoomLevel: ZoomLevel
  setZoomLevel: React.Dispatch<React.SetStateAction<ZoomLevel>>
  actualScale: number

  // Computed values
  currentWidth: number
  currentHeight: number

  // Actions
  handleDeviceSelect: (device: DevicePreset) => void
  handleCustomSize: (width: number, height: number) => void
}

export const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 'actual', label: 'Actual' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
  { value: '125', label: '125%' },
  { value: '150', label: '150%' },
]

export const VIEWPORT_WIDTHS: Record<ViewportSize, number | null> = {
  mobile: 375,
  tablet: 768,
  desktop: null, // null means full width
}

/**
 * Hook for managing viewport mode state
 */
export function useViewportMode(options: UseViewportModeOptions = {}): UseViewportModeReturn {
  const { displayPpi } = options

  // Multi-viewport mode state
  const [isMultiViewportMode, setIsMultiViewportMode] = useState(false)
  const [viewportCount, setViewportCount] = useState(0)
  const viewportControlsRef = useRef<ViewportControls | null>(null)

  // Device preview state
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset | null>(null)
  const [customWidth, setCustomWidth] = useState<number>(375)
  const [customHeight, setCustomHeight] = useState<number>(667)
  const [isCustomDevice, setIsCustomDevice] = useState(false)

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit')

  // Calculate actual scale based on display PPI
  const actualScale = useMemo(() => {
    const ppi = typeof displayPpi === 'number' && Number.isFinite(displayPpi) && displayPpi > 0
      ? displayPpi
      : undefined
    if (!ppi) return 1
    return 96 / ppi
  }, [displayPpi])

  // Compute current dimensions
  const currentWidth = isCustomDevice
    ? customWidth
    : (selectedDevice?.width ?? (viewportSize === 'tablet' ? 768 : 375))
  const currentHeight = isCustomDevice
    ? customHeight
    : (selectedDevice?.height ?? (viewportSize === 'tablet' ? 1024 : 667))

  // Action: Select a device preset
  const handleDeviceSelect = (device: DevicePreset) => {
    setSelectedDevice(device)
    setIsCustomDevice(false)
  }

  // Action: Set custom dimensions
  const handleCustomSize = (width: number, height: number) => {
    setCustomWidth(width)
    setCustomHeight(height)
    setIsCustomDevice(true)
    setSelectedDevice(null)
  }

  return {
    // Multi-viewport mode
    isMultiViewportMode,
    setIsMultiViewportMode,
    viewportCount,
    setViewportCount,
    viewportControlsRef,
    // Device preview
    viewportSize,
    setViewportSize,
    selectedDevice,
    setSelectedDevice,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    isCustomDevice,
    setIsCustomDevice,
    // Zoom
    zoomLevel,
    setZoomLevel,
    actualScale,
    // Computed
    currentWidth,
    currentHeight,
    // Actions
    handleDeviceSelect,
    handleCustomSize,
  }
}
