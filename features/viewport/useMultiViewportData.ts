/**
 * Multi-Viewport Data Hook
 *
 * Manages the array of viewport data for multi-viewport mode.
 */

import { useState, useCallback } from 'react'
import type { MultiViewportData, MultiViewportDataItem } from './types'

export interface UseMultiViewportDataReturn {
  /** Current viewport data array */
  multiViewportData: MultiViewportData
  /** Set viewport data array */
  setMultiViewportData: React.Dispatch<React.SetStateAction<MultiViewportData>>
  /** Add a viewport */
  addViewport: (item: MultiViewportDataItem) => void
  /** Remove a viewport by id */
  removeViewport: (id: string) => void
  /** Update a viewport by id */
  updateViewport: (id: string, updates: Partial<MultiViewportDataItem>) => void
  /** Clear all viewports */
  clearViewports: () => void
  /** Check if a viewport exists */
  hasViewport: (id: string) => boolean
  /** Get viewport by id */
  getViewport: (id: string) => MultiViewportDataItem | undefined
}

/**
 * Hook for managing multi-viewport data state
 */
export function useMultiViewportData(
  initialData: MultiViewportData = []
): UseMultiViewportDataReturn {
  const [multiViewportData, setMultiViewportData] = useState<MultiViewportData>(initialData)

  const addViewport = useCallback((item: MultiViewportDataItem) => {
    setMultiViewportData(prev => [...prev, item])
  }, [])

  const removeViewport = useCallback((id: string) => {
    setMultiViewportData(prev => prev.filter(v => v.id !== id))
  }, [])

  const updateViewport = useCallback((id: string, updates: Partial<MultiViewportDataItem>) => {
    setMultiViewportData(prev =>
      prev.map(v => (v.id === id ? { ...v, ...updates } : v))
    )
  }, [])

  const clearViewports = useCallback(() => {
    setMultiViewportData([])
  }, [])

  const hasViewport = useCallback(
    (id: string) => multiViewportData.some(v => v.id === id),
    [multiViewportData]
  )

  const getViewport = useCallback(
    (id: string) => multiViewportData.find(v => v.id === id),
    [multiViewportData]
  )

  return {
    multiViewportData,
    setMultiViewportData,
    addViewport,
    removeViewport,
    updateViewport,
    clearViewports,
    hasViewport,
    getViewport,
  }
}
