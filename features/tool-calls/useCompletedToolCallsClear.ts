/**
 * Completed Tool Calls Clear Hook
 *
 * Auto-clears completed tool calls after a delay.
 *
 * Extracted from App.tsx to centralize tool call cleanup.
 */

import { useEffect } from 'react'
import type { UseCompletedToolCallsClearOptions } from './types'

/**
 * Hook for auto-clearing completed tool calls
 *
 * Clears completed tool calls after a configurable delay.
 * Resets timer when new tool calls complete.
 *
 * @param options - Configuration options for tool call clearing
 */
export function useCompletedToolCallsClear(options: UseCompletedToolCallsClearOptions): void {
  const { completedToolCalls, setCompletedToolCalls, clearDelay = 5000 } = options

  useEffect(() => {
    if (completedToolCalls.length > 0) {
      const timer = setTimeout(() => {
        setCompletedToolCalls([])
      }, clearDelay) // Clear after delay
      return () => clearTimeout(timer)
    }
  }, [completedToolCalls, setCompletedToolCalls, clearDelay])
}
