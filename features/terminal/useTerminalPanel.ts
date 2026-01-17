/**
 * Terminal Panel Hook
 *
 * Manages ghostty-web terminal initialization and lifecycle.
 * Handles WebSocket PTY connection, resize events, and cleanup.
 *
 * Extracted from App.tsx to centralize terminal panel logic.
 */

import { useRef, useEffect } from 'react'
import type { TerminalInstance, UseTerminalPanelOptions, UseTerminalPanelReturn } from './types'

/**
 * Hook for managing terminal panel with ghostty-web
 *
 * @param options - Configuration options for terminal initialization
 * @returns Container ref and terminal instance access
 */
export function useTerminalPanel(options: UseTerminalPanelOptions): UseTerminalPanelReturn {
  const { consolePanelTab, isDarkMode, ptyPort, consoleHeight } = options

  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalInstanceRef = useRef<TerminalInstance | null>(null)

  // Initialize terminal when tab is active and PTY port is available
  useEffect(() => {
    if (consolePanelTab !== 'terminal' || !terminalContainerRef.current || terminalInstanceRef.current) return
    if (!ptyPort) return // Wait for PTY port to be available

    let mounted = true

    async function initTerminal() {
      try {
        // Dynamic import ghostty-web
        const ghostty = await import('ghostty-web')
        await ghostty.init()

        if (!mounted || !terminalContainerRef.current) return

        const term = new ghostty.Terminal({
          cols: 80,
          rows: 12,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          fontSize: 13,
          theme: {
            background: isDarkMode ? '#1e1e1e' : '#fafaf9',
            foreground: isDarkMode ? '#d4d4d4' : '#292524',
            cursor: isDarkMode ? '#d4d4d4' : '#292524',
          },
        })

        const fitAddon = new ghostty.FitAddon()
        term.loadAddon(fitAddon)

        await term.open(terminalContainerRef.current)
        fitAddon.fit()

        terminalInstanceRef.current = { term, fitAddon }

        // Connect to WebSocket PTY using dynamic port
        const wsUrl = `ws://127.0.0.1:${ptyPort}`
        const cols = term.cols || 80
        const rows = term.rows || 12
        const url = `${wsUrl}?cols=${cols}&rows=${rows}`

        const ws = new WebSocket(url)

        ws.onopen = () => {
          console.log('[Terminal Panel] Connected to PTY')
        }

        // Batch writes for performance
        let pendingWrites = ''
        let flushScheduled = false
        const scheduleFlush = () => {
          if (flushScheduled) return
          flushScheduled = true
          requestAnimationFrame(() => {
            flushScheduled = false
            if (!pendingWrites) return
            term.write(pendingWrites)
            pendingWrites = ''
          })
        }

        ws.onmessage = (event) => {
          pendingWrites += typeof event.data === 'string' ? event.data : String(event.data)
          scheduleFlush()
        }

        ws.onclose = () => {
          term.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n')
        }

        // Handle terminal input
        term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data)
          }
        })

        // Handle resize
        term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        })

        // Store WebSocket for cleanup
        terminalInstanceRef.current.ws = ws
      } catch (error) {
        console.error('[Terminal Panel] Failed to initialize terminal:', error)
      }
    }

    initTerminal()

    return () => {
      mounted = false
      if (terminalInstanceRef.current) {
        const instance = terminalInstanceRef.current
        instance.ws?.close()
        instance.term?.dispose?.()
        terminalInstanceRef.current = null
      }
    }
  }, [consolePanelTab, isDarkMode, ptyPort])

  // Fit terminal when console panel resizes
  useEffect(() => {
    if (consolePanelTab === 'terminal' && terminalInstanceRef.current) {
      const instance = terminalInstanceRef.current
      setTimeout(() => {
        instance.fitAddon?.fit?.()
      }, 50)
    }
  }, [consoleHeight, consolePanelTab])

  return {
    terminalContainerRef,
    terminalInstance: terminalInstanceRef.current,
  }
}
