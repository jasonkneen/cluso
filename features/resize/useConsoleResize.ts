/**
 * Console Resize Hook
 *
 * Handles mouse events for console panel resizing.
 * Uses delta from start position for smooth resize.
 *
 * Extracted from App.tsx to centralize resize logic.
 */

import { useEffect } from 'react'
import type { UseConsoleResizeOptions } from './types'

/**
 * Hook for managing console panel resize behavior
 *
 * Sets up global mouse event listeners when resizing is active.
 * Calculates delta from initial mouse position for accurate resize.
 *
 * @param options - Configuration options for console resize
 */
export function useConsoleResize(options: UseConsoleResizeOptions): void {
  const {
    isConsoleResizing,
    setIsConsoleResizing,
    setConsoleHeight,
    consoleResizeStartY,
    consoleResizeStartHeight,
    minHeight = 100,
    maxHeight = 500,
  } = options

  useEffect(() => {
    if (!isConsoleResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position (negative = dragging up = bigger)
      const delta = consoleResizeStartY.current - e.clientY
      const newHeight = consoleResizeStartHeight.current + delta
      // Clamp between min and max pixels
      setConsoleHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)))
    }

    const handleMouseUp = () => {
      setIsConsoleResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isConsoleResizing, setIsConsoleResizing, setConsoleHeight, consoleResizeStartY, consoleResizeStartHeight, minHeight, maxHeight])
}
