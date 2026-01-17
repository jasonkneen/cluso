/**
 * Console Panel Hook
 *
 * Manages state for the console panel including:
 * - Console logs and filtering
 * - Panel visibility and sizing
 * - Log selection
 * - Resize handling
 * - Log buffering for performance
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

export type ConsoleLogType = 'log' | 'warn' | 'error' | 'info'

export interface ConsoleLogEntry {
  type: ConsoleLogType
  message: string
  timestamp: Date
}

export type ConsolePanelTab = 'console' | 'terminal'

export interface UseConsolePanelReturn {
  // Console logs state
  consoleLogs: ConsoleLogEntry[]
  setConsoleLogs: React.Dispatch<React.SetStateAction<ConsoleLogEntry[]>>

  // Panel visibility
  isConsolePanelOpen: boolean
  setIsConsolePanelOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Panel sizing
  consoleHeight: number
  setConsoleHeight: React.Dispatch<React.SetStateAction<number>>

  // Filtering
  consoleFilters: Set<ConsoleLogType>
  setConsoleFilters: React.Dispatch<React.SetStateAction<Set<ConsoleLogType>>>
  filteredLogs: ConsoleLogEntry[]
  toggleConsoleFilter: (type: ConsoleLogType) => void
  clearConsoleFilters: () => void

  // Resize state
  isConsoleResizing: boolean
  setIsConsoleResizing: React.Dispatch<React.SetStateAction<boolean>>
  consoleResizeStartY: React.MutableRefObject<number>
  consoleResizeStartHeight: React.MutableRefObject<number>
  handleConsoleResizeStart: (e: React.MouseEvent) => void

  // Tab state
  consolePanelTab: ConsolePanelTab
  setConsolePanelTab: React.Dispatch<React.SetStateAction<ConsolePanelTab>>

  // Scroll ref
  consoleEndRef: React.RefObject<HTMLDivElement>

  // Selection state
  selectedLogIndices: Set<number>
  setSelectedLogIndices: React.Dispatch<React.SetStateAction<Set<number>>>
  lastClickedLogIndex: React.MutableRefObject<number | null>
  handleLogRowClick: (index: number, event: React.MouseEvent) => void
  selectedLogs: ConsoleLogEntry[] | null

  // Log buffering
  consoleLogBufferRef: React.MutableRefObject<ConsoleLogEntry[]>
  consoleLogFlushTimerRef: React.MutableRefObject<number | null>
  flushConsoleLogBuffer: () => void
  enqueueConsoleLog: (entry: ConsoleLogEntry) => void

  // Clear actions
  handleClearConsole: () => void
}

export function useConsolePanel(): UseConsolePanelReturn {
  // Console logs state
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([])

  // Panel visibility
  const [isConsolePanelOpen, setIsConsolePanelOpen] = useState(false)

  // Panel sizing (192px = h-48)
  const [consoleHeight, setConsoleHeight] = useState(192)

  // Filtering
  const [consoleFilters, setConsoleFilters] = useState<Set<ConsoleLogType>>(new Set())

  // Resize state
  const [isConsoleResizing, setIsConsoleResizing] = useState(false)
  const consoleResizeStartY = useRef<number>(0)
  const consoleResizeStartHeight = useRef<number>(192)

  // Tab state
  const [consolePanelTab, setConsolePanelTab] = useState<ConsolePanelTab>('console')

  // Scroll ref
  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Selection state
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set())
  const lastClickedLogIndex = useRef<number | null>(null)

  // Log buffering refs
  const consoleLogBufferRef = useRef<ConsoleLogEntry[]>([])
  const consoleLogFlushTimerRef = useRef<number | null>(null)

  // Flush buffered logs to state
  const flushConsoleLogBuffer = useCallback(() => {
    if (consoleLogFlushTimerRef.current) {
      window.clearTimeout(consoleLogFlushTimerRef.current)
      consoleLogFlushTimerRef.current = null
    }
    if (consoleLogBufferRef.current.length === 0) return
    const buffered = consoleLogBufferRef.current
    consoleLogBufferRef.current = []

    setConsoleLogs(prev => {
      const next = [...prev, ...buffered]
      // Keep at most 200 entries to bound render cost
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  // Enqueue a log entry with batching
  const enqueueConsoleLog = useCallback((entry: ConsoleLogEntry) => {
    consoleLogBufferRef.current.push(entry)
    if (consoleLogFlushTimerRef.current) return
    // Batch multiple console-message events into a single React update
    consoleLogFlushTimerRef.current = window.setTimeout(flushConsoleLogBuffer, 100)
  }, [flushConsoleLogBuffer])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (consoleLogFlushTimerRef.current) {
        window.clearTimeout(consoleLogFlushTimerRef.current)
        consoleLogFlushTimerRef.current = null
      }
    }
  }, [])

  // Filtered logs memo
  const filteredLogs = useMemo(() => {
    if (consoleFilters.size === 0) return consoleLogs
    return consoleLogs.filter(log => consoleFilters.has(log.type))
  }, [consoleLogs, consoleFilters])

  // Toggle a console filter
  const toggleConsoleFilter = useCallback((type: ConsoleLogType) => {
    setConsoleFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // Clear all console filters (show all)
  const clearConsoleFilters = useCallback(() => {
    setConsoleFilters(new Set())
  }, [])

  // Handle console resize start
  const handleConsoleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    consoleResizeStartY.current = e.clientY
    consoleResizeStartHeight.current = consoleHeight
    setIsConsoleResizing(true)
  }, [consoleHeight])

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
  }, [isConsoleResizing])

  // Handle log row click with shift-click range selection
  const handleLogRowClick = useCallback((index: number, event: React.MouseEvent) => {
    setSelectedLogIndices(prev => {
      const newSet = new Set(prev)

      if (event.shiftKey && lastClickedLogIndex.current !== null) {
        // Shift-click: select range from last clicked to current
        const start = Math.min(lastClickedLogIndex.current, index)
        const end = Math.max(lastClickedLogIndex.current, index)
        for (let i = start; i <= end; i++) {
          newSet.add(i)
        }
      } else {
        // Regular click: toggle single item
        if (newSet.has(index)) {
          newSet.delete(index)
        } else {
          newSet.add(index)
        }
      }

      return newSet
    })

    // Update last clicked index for shift-click range selection
    lastClickedLogIndex.current = index
  }, [])

  // Selected logs memo
  const selectedLogs = useMemo(() => {
    if (selectedLogIndices.size === 0) return null
    return Array.from(selectedLogIndices)
      .sort((a, b) => a - b)
      .map(i => consoleLogs[i])
      .filter(Boolean)
  }, [selectedLogIndices, consoleLogs])

  // Clear selected logs when console is cleared
  const handleClearConsole = useCallback(() => {
    setConsoleLogs([])
    setSelectedLogIndices(new Set())
    lastClickedLogIndex.current = null
  }, [])

  // Auto-scroll console panel to bottom when new logs arrive
  useEffect(() => {
    if (consoleEndRef.current && isConsolePanelOpen) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleLogs, isConsolePanelOpen])

  return {
    // Console logs state
    consoleLogs,
    setConsoleLogs,

    // Panel visibility
    isConsolePanelOpen,
    setIsConsolePanelOpen,

    // Panel sizing
    consoleHeight,
    setConsoleHeight,

    // Filtering
    consoleFilters,
    setConsoleFilters,
    filteredLogs,
    toggleConsoleFilter,
    clearConsoleFilters,

    // Resize state
    isConsoleResizing,
    setIsConsoleResizing,
    consoleResizeStartY,
    consoleResizeStartHeight,
    handleConsoleResizeStart,

    // Tab state
    consolePanelTab,
    setConsolePanelTab,

    // Scroll ref
    consoleEndRef,

    // Selection state
    selectedLogIndices,
    setSelectedLogIndices,
    lastClickedLogIndex,
    handleLogRowClick,
    selectedLogs,

    // Log buffering
    consoleLogBufferRef,
    consoleLogFlushTimerRef,
    flushConsoleLogBuffer,
    enqueueConsoleLog,

    // Clear actions
    handleClearConsole,
  }
}
