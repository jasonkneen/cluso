/**
 * Sidebar Resize Hook
 *
 * Handles mouse events for sidebar resizing.
 * Clamps width between configurable min/max values.
 *
 * Extracted from App.tsx to centralize resize logic.
 */

import { useEffect } from 'react'
import type { UseSidebarResizeOptions } from './types'

/**
 * Hook for managing sidebar resize behavior
 *
 * Sets up global mouse event listeners when resizing is active.
 * Automatically cleans up listeners when resizing stops.
 *
 * @param options - Configuration options for sidebar resize
 */
export function useSidebarResize(options: UseSidebarResizeOptions): void {
  const {
    isResizing,
    setIsResizing,
    setSidebarWidth,
    minWidth = 430,
    maxWidth = 800,
  } = options

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Clamp between min and max pixels
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setIsResizing, setSidebarWidth, minWidth, maxWidth])
}
