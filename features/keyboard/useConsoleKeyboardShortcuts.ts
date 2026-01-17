/**
 * Console Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for console log actions.
 * Extracted from App.tsx lines 4614-4655.
 */

import { useEffect } from 'react'

interface ConsoleLog {
  type: string
  message: string
}

interface UseConsoleKeyboardShortcutsOptions {
  isConsolePanelOpen: boolean
  selectedLogIndices: Set<number>
  setSelectedLogIndices: (indices: Set<number>) => void
  consoleLogs: ConsoleLog[]
  performInstantSearch: (query: string) => Promise<void>
}

/**
 * Hook for console keyboard shortcuts
 *
 * Escape = Clear selection
 * CMD/Ctrl+G = Instant web search for selected logs
 * CMD/Ctrl+C = Copy selected logs (if not in input)
 */
export function useConsoleKeyboardShortcuts({
  isConsolePanelOpen,
  selectedLogIndices,
  setSelectedLogIndices,
  consoleLogs,
  performInstantSearch,
}: UseConsoleKeyboardShortcutsOptions): void {
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
  }, [isConsolePanelOpen, selectedLogIndices, consoleLogs, setSelectedLogIndices, performInstantSearch])
}
