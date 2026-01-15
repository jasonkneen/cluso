import React, { useRef, useEffect, useState, useCallback, memo } from 'react'
import { cn } from '@/lib/utils'
import { Ghost } from 'lucide-react'
import { BaseNode } from './BaseNode'

export interface TerminalNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  isDarkMode: boolean
  // WebSocket URL for PTY connection
  wsUrl: string
  // Callbacks
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onRemove: () => void
  onFocus: () => void
  // Chromeless mode
  chromeless?: boolean
  // Canvas scale for fixed-size toolbar
  canvasScale?: number
}

export const TerminalNode = memo(function TerminalNode({
  id,
  x,
  y,
  width,
  height,
  zIndex,
  isDarkMode,
  wsUrl,
  onMove,
  onResize,
  onRemove,
  onFocus,
  chromeless,
  canvasScale,
}: TerminalNodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<unknown>(null)
  const fitAddonRef = useRef<unknown>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const initializedRef = useRef(false)
  const fitTimerRef = useRef<number | null>(null)

  // Refs for initialization values to avoid re-running mount effect
  const isDarkModeRef = useRef(isDarkMode)
  isDarkModeRef.current = isDarkMode
  const wsUrlRef = useRef(wsUrl)
  wsUrlRef.current = wsUrl

  // Ensure Ghostty/xterm DOM uses CSS percentages (not pixel sizing)
  const fixTerminalSizing = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Force common container nodes to fill available space.
    const roots = container.querySelectorAll<HTMLElement>(
      'canvas, .xterm, .xterm-screen, .xterm-viewport, .xterm-scroll-area, .terminal, .ghostty, .ghostty-terminal'
    )
    roots.forEach((el) => {
      el.style.width = '100%'
      el.style.height = '100%'
      if (el.tagName.toLowerCase() === 'canvas') {
        el.style.display = 'block'
      }
    })
  }, [])

  // Ref for fixTerminalSizing to avoid re-running mount effect
  const fixTerminalSizingRef = useRef(fixTerminalSizing)
  fixTerminalSizingRef.current = fixTerminalSizing

  // Initialize terminal - runs once on mount
  useEffect(() => {
    // Prevent double initialization from StrictMode
    if (initializedRef.current) return

    let mounted = true
    let ws: WebSocket | null = null

    async function initTerminal() {
      if (!containerRef.current) return

      try {
        // Dynamic import ghostty-web
        const ghostty = await import('ghostty-web')
        await ghostty.init()

        if (!mounted || !containerRef.current) return

        // Mark as initialized BEFORE creating terminal to prevent race conditions
        initializedRef.current = true

        // Use refs for current values at init time
        const darkMode = isDarkModeRef.current
        const term = new ghostty.Terminal({
          cols: 80,
          rows: 24,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          fontSize: 13,
          theme: {
            background: darkMode ? '#1e1e1e' : '#fafaf9',
            foreground: darkMode ? '#d4d4d4' : '#292524',
            cursor: darkMode ? '#d4d4d4' : '#292524',
          },
        })

        const fitAddon = new ghostty.FitAddon()
        term.loadAddon(fitAddon)

        await term.open(containerRef.current)
        fitAddon.fit()

        terminalRef.current = term
        fitAddonRef.current = fitAddon

        // Force Ghostty DOM to 100% sizing (fit sets pixel values)
        fixTerminalSizingRef.current()

        // Connect to WebSocket PTY
        const currentWsUrl = wsUrlRef.current
        if (currentWsUrl && mounted) {
          // @ts-expect-error - terminal type
          const cols = term.cols || 80
          // @ts-expect-error - terminal type
          const rows = term.rows || 24
          const url = `${currentWsUrl}?cols=${cols}&rows=${rows}`

          ws = new WebSocket(url)
          wsRef.current = ws

          ws.onopen = () => {
            if (mounted) {
              setIsConnected(true)
            } else {
              ws?.close()
            }
          }

          ws.onmessage = (event) => {
            if (mounted && terminalRef.current) {
              // @ts-expect-error - terminal write method
              terminalRef.current.write?.(event.data)
            }
          }

          ws.onclose = () => {
            if (mounted) {
              setIsConnected(false)
              // Only write if terminal is still active (not disposed)
              try {
                // @ts-expect-error - terminal write method
                if (terminalRef.current) terminalRef.current.write?.('\r\n\x1b[33mConnection closed.\x1b[0m\r\n')
              } catch {
                // Terminal was disposed, ignore
              }
            }
          }

          ws.onerror = () => {
            if (mounted) {
              setIsConnected(false)
            }
          }
        }

        // Handle terminal input
        term.onData((data: string) => {
          if (mounted && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data)
          }
        })

        // Handle resize
        term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (mounted && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        })
      } catch (error) {
        console.error('[TerminalNode] Failed to initialize terminal:', error)
        initializedRef.current = false
      }
    }

    initTerminal()

    return () => {
      mounted = false
      // Close WebSocket
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        ws.close()
      }
      wsRef.current = null
      // Dispose terminal
      // @ts-expect-error - terminal dispose method
      terminalRef.current?.dispose?.()
      terminalRef.current = null
      fitAddonRef.current = null
      // Reset initialized flag on unmount so a new instance can initialize
      initializedRef.current = false
    }
  }, [])

  // Fit terminal when size changes
  useEffect(() => {
    if (fitAddonRef.current) {
      if (fitTimerRef.current) {
        window.clearTimeout(fitTimerRef.current)
      }
      // Debounce fitting while resizing to reduce layout churn
      fitTimerRef.current = window.setTimeout(() => {
        // @ts-expect-error - fitAddon fit method
        fitAddonRef.current?.fit?.()
        // Fix terminal sizing after fit (fit sets pixel values)
        fixTerminalSizing()
        fitTimerRef.current = null
      }, 120)
      return () => {
        if (fitTimerRef.current) {
          window.clearTimeout(fitTimerRef.current)
          fitTimerRef.current = null
        }
      }
    }
  }, [width, height, fixTerminalSizing])

  // Title bar extras
  const titleBarExtra = (
    <div className="flex items-center gap-1">
      <span className={cn(
        "w-2 h-2 rounded-full",
        isConnected ? "bg-green-500" : "bg-red-500"
      )} />
    </div>
  )

  // Toolbar controls for chromeless mode
  const toolbarControls = (
    <div className="flex items-center gap-1">
      <span className={cn(
        "w-2 h-2 rounded-full",
        isConnected ? "bg-green-500" : "bg-red-500"
      )} />
    </div>
  )

  return (
    <BaseNode
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      zIndex={zIndex}
      isDarkMode={isDarkMode}
      title="Terminal"
      icon={<Ghost size={12} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />}
      titleBarExtra={titleBarExtra}
      toolbarControls={toolbarControls}
      onMove={onMove}
      onResize={onResize}
      onRemove={onRemove}
      onFocus={onFocus}
      chromeless={chromeless}
      canvasScale={canvasScale}
    >
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden pt-2 pl-2"
        style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#fafaf9' }}
      />
    </BaseNode>
  )
})
