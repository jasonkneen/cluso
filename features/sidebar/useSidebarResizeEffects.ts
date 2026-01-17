/**
 * Sidebar Resize Effects Hook
 *
 * Handles mouse move/up events during sidebar resize operations.
 * Extracted from App.tsx lines 1989-2009 and 2012-2034.
 */

import { useEffect } from 'react'

interface UseSidebarResizeEffectsOptions {
  isResizing: boolean
  setIsResizing: (v: boolean) => void
  setSidebarWidth: (w: number) => void
}

/**
 * Hook for handling sidebar resize mouse events
 *
 * Adds document-level mouse listeners during resize operations.
 */
export function useSidebarResizeEffects({
  isResizing,
  setIsResizing,
  setSidebarWidth,
}: UseSidebarResizeEffectsOptions): void {
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Clamp between 430 and 800 pixels
      setSidebarWidth(Math.max(430, Math.min(800, newWidth)))
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
  }, [isResizing, setIsResizing, setSidebarWidth])
}

interface UseConsoleResizeEffectsOptions {
  isConsoleResizing: boolean
  setIsConsoleResizing: (v: boolean) => void
  setConsoleHeight: (h: number) => void
  consoleResizeStartY: React.MutableRefObject<number>
  consoleResizeStartHeight: React.MutableRefObject<number>
}

/**
 * Hook for handling console panel resize mouse events
 *
 * Adds document-level mouse listeners during console resize operations.
 */
export function useConsoleResizeEffects({
  isConsoleResizing,
  setIsConsoleResizing,
  setConsoleHeight,
  consoleResizeStartY,
  consoleResizeStartHeight,
}: UseConsoleResizeEffectsOptions): void {
  useEffect(() => {
    if (!isConsoleResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position (negative = dragging up = bigger)
      const delta = consoleResizeStartY.current - e.clientY
      const newHeight = consoleResizeStartHeight.current + delta
      // Clamp between 100 and 500 pixels
      setConsoleHeight(Math.max(100, Math.min(500, newHeight)))
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
  }, [isConsoleResizing, setIsConsoleResizing, setConsoleHeight, consoleResizeStartY, consoleResizeStartHeight])
}
