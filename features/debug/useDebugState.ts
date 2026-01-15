/**
 * Debug State Hook
 *
 * Manages debug mode and PTY terminal state:
 * - Debug mode toggle for console panel activity logging
 * - PTY server port for terminal WebSocket connections
 * - Debug logger function with console panel integration
 */

import { useState, useCallback, useEffect } from 'react'

import type { ConsoleLogEntry } from '../console/useConsolePanel'
import type { DebugState } from './types'

interface UseDebugStateOptions {
  /** Function to enqueue logs to the console panel */
  enqueueConsoleLog: (entry: ConsoleLogEntry) => void
  /** Whether running in Electron environment */
  isElectron: boolean
}

/**
 * Hook for managing debug mode and terminal state
 *
 * @param options - Configuration options including console log enqueue function
 */
export function useDebugState(options: UseDebugStateOptions): DebugState {
  const { enqueueConsoleLog, isElectron } = options

  // Debug Mode - shows all activity in console panel
  const [debugMode, setDebugMode] = useState(false)

  // PTY server port for terminal connections
  const [ptyPort, setPtyPort] = useState<number | null>(null)

  // Debug logger that shows in both console.log and the console panel when debug mode is on
  const debugLog = useCallback((prefix: string, message: string, data?: unknown) => {
    const fullMessage = data !== undefined
      ? `[${prefix}] ${message}: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`
      : `[${prefix}] ${message}`
    console.log(fullMessage)
    if (debugMode) {
      enqueueConsoleLog({ type: 'info', message: fullMessage, timestamp: new Date() })
    }
  }, [debugMode, enqueueConsoleLog])

  // Get PTY server port dynamically
  useEffect(() => {
    const fetchPtyPort = async () => {
      if (!isElectron || !window.electronAPI?.pty) return
      try {
        const result = await window.electronAPI.pty.getPort()
        if (result.success && result.port) {
          setPtyPort(result.port)
          console.log('[PTY] Server port:', result.port)
        }
      } catch (err) {
        console.error('[PTY] Failed to get port:', err)
      }
    }
    // Fetch immediately and retry after a delay in case server is still starting
    fetchPtyPort()
    const timer = setTimeout(fetchPtyPort, 1000)
    return () => clearTimeout(timer)
  }, [isElectron])

  return {
    debugMode,
    setDebugMode,
    ptyPort,
    setPtyPort,
    debugLog,
  }
}
