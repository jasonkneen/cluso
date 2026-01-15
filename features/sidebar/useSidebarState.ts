/**
 * Sidebar State Hook
 *
 * Manages state for sidebar panels including:
 * - Right sidebar (chat/tools panel) open state and width
 * - Left panel (layers) open state and width
 * - Resize states for both panels
 */

import { useState, useRef, useEffect } from 'react'

export interface UseSidebarStateReturn {
  // Right sidebar state
  isSidebarOpen: boolean
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  sidebarWidth: number
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>
  isResizing: boolean
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>

  // Left panel state
  isLeftPanelOpen: boolean
  setIsLeftPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  isLeftPanelOpenRef: React.MutableRefObject<boolean>
  leftPanelWidth: number
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>
  isLeftResizing: boolean
  setIsLeftResizing: React.Dispatch<React.SetStateAction<boolean>>
}

export function useSidebarState(): UseSidebarStateReturn {
  // Right sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)

  // Left panel (Layers) state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false)
  const isLeftPanelOpenRef = useRef(false)
  useEffect(() => { isLeftPanelOpenRef.current = isLeftPanelOpen }, [isLeftPanelOpen])
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [isLeftResizing, setIsLeftResizing] = useState(false)

  return {
    // Right sidebar
    isSidebarOpen,
    setIsSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,

    // Left panel
    isLeftPanelOpen,
    setIsLeftPanelOpen,
    isLeftPanelOpenRef,
    leftPanelWidth,
    setLeftPanelWidth,
    isLeftResizing,
    setIsLeftResizing,
  }
}
