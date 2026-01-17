/**
 * Console Handlers Hook
 *
 * Extends useConsolePanel with additional event handlers:
 * - Console resize effect (mouse move/up during resize)
 * - Keyboard shortcuts for console log actions (Escape, Cmd+G, Cmd+C)
 */

import { useEffect, useRef } from 'react'
import { useConsolePanel, type UseConsolePanelReturn } from './useConsolePanel'

export interface UseConsoleHandlersReturn extends UseConsolePanelReturn {
  /**
   * Ref to set the instant search callback (allows late binding)
   * Set this ref's current to your performInstantSearch function after defining it
   */
  performInstantSearchRef: React.MutableRefObject<((text: string) => void) | null>
}

export function useConsoleHandlers(): UseConsoleHandlersReturn {
  // Ref for late-bound instant search callback
  const performInstantSearchRef = useRef<((text: string) => void) | null>(null)

  // Get all console panel state and handlers
  const consolePanelState = useConsolePanel()

  const {
    isConsoleResizing,
    setIsConsoleResizing,
    consoleResizeStartY,
    consoleResizeStartHeight,
    setConsoleHeight,
    isConsolePanelOpen,
    selectedLogIndices,
    setSelectedLogIndices,
    consoleLogs,
  } = consolePanelState

  // Console panel resize effect (handles mouse move/up events)
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
  }, [isConsoleResizing, setIsConsoleResizing, consoleResizeStartY, consoleResizeStartHeight, setConsoleHeight])

  // Keyboard shortcuts for console log actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if console is open and logs are selected
      if (!isConsolePanelOpen || selectedLogIndices.size === 0) return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (e.key === 'Escape') {
        // Clear selection
        setSelectedLogIndices(new Set())
        e.preventDefault()
      } else if (modKey && e.key === 'g' && performInstantSearchRef.current) {
        // Instant web search for selected logs
        const logsText = Array.from(selectedLogIndices)
          .sort((a, b) => a - b)
          .map(i => consoleLogs[i]?.message || '')
          .join('\n')
        performInstantSearchRef.current(logsText)
        e.preventDefault()
      } else if (modKey && e.key === 'c' && selectedLogIndices.size > 0) {
        // Copy (only if in console context, don't override normal copy)
        const activeElement = document.activeElement
        const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
        if (!isInputFocused) {
          const logsText = Array.from(selectedLogIndices)
            .sort((a, b) => a - b)
            .map(i => {
              const log = consoleLogs[i]
              return log ? `[${log.type}] ${log.message}` : ''
            })
            .filter(Boolean)
            .join('\n')
          navigator.clipboard.writeText(logsText)
          e.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConsolePanelOpen, selectedLogIndices, setSelectedLogIndices, consoleLogs])

  return {
    ...consolePanelState,
    performInstantSearchRef,
  }
}
