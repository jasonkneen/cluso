/**
 * Sidebar Resize Handlers Hook
 *
 * Manages resize interactions for both left and right sidebar panels:
 * - Right sidebar: drag from left edge to resize
 * - Left panel: drag from right edge to resize
 * - Mouse event listeners for drag operations
 * - Clamped width ranges
 */

import { useCallback, useEffect } from 'react'

export interface UseResizeHandlersProps {
  // Right sidebar
  isResizing: boolean
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>

  // Left panel
  leftPanelWidth: number
  setIsLeftResizing: React.Dispatch<React.SetStateAction<boolean>>
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>
}

export interface UseResizeHandlersReturn {
  handleResizeStart: (e: React.MouseEvent) => void
  handleLeftResizeStart: (e: React.MouseEvent) => void
}

export function useResizeHandlers({
  isResizing,
  setIsResizing,
  setSidebarWidth,
  leftPanelWidth,
  setIsLeftResizing,
  setLeftPanelWidth,
}: UseResizeHandlersProps): UseResizeHandlersReturn {
  // Right sidebar resize handler - start drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [setIsResizing])

  // Right sidebar resize - mouse move/up effect
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

  // Left panel resize handler - handles drag in callback
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsLeftResizing(true)
    const startX = e.clientX
    const startWidth = leftPanelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(200, Math.min(400, startWidth + deltaX))
      setLeftPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsLeftResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [leftPanelWidth, setIsLeftResizing, setLeftPanelWidth])

  return {
    handleResizeStart,
    handleLeftResizeStart,
  }
}
