/**
 * Console Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for console log actions.
 * Supports Escape to clear selection, Cmd+G for search, Cmd+C for copy.
 *
 * Extracted from App.tsx to centralize keyboard shortcut logic.
 */

import { useEffect } from 'react'
import type { UseConsoleKeyboardShortcutsOptions } from './types'

/**
 * Hook for managing console panel keyboard shortcuts
 *
 * Sets up global keydown listener for console-specific shortcuts.
 * Only active when console is open and logs are selected.
 *
 * @param options - Configuration options for keyboard shortcuts
 */
export function useConsoleKeyboardShortcuts(options: UseConsoleKeyboardShortcutsOptions): void {
  const {
    isConsolePanelOpen,
    selectedLogIndices,
    setSelectedLogIndices,
    consoleLogs,
    performInstantSearch,
  } = options

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
      } else if (modKey && e.key === 'g') {
        // Instant web search for selected logs
        const logsText = Array.from(selectedLogIndices)
          .sort((a, b) => a - b)
          .map(i => consoleLogs[i]?.message || '')
          .join('\n')
        performInstantSearch(logsText)
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
  }, [isConsolePanelOpen, selectedLogIndices, consoleLogs, performInstantSearch, setSelectedLogIndices])
}
