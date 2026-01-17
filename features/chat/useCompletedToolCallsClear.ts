/**
 * Completed Tool Calls Clear Hook
 *
 * Handles auto-clearing completed tool calls after a delay.
 * Extracted from App.tsx lines 1321-1328.
 */

import { useEffect } from 'react'

interface UseCompletedToolCallsClearOptions {
  completedToolCalls: unknown[]
  setCompletedToolCalls: (calls: unknown[]) => void
  clearDelay?: number
}

/**
 * Hook for auto-clearing completed tool calls
 *
 * Clears the completed tool calls list after a specified delay.
 */
export function useCompletedToolCallsClear({
  completedToolCalls,
  setCompletedToolCalls,
  clearDelay = 5000,
}: UseCompletedToolCallsClearOptions): void {
  useEffect(() => {
    if (completedToolCalls.length > 0) {
      const timer = setTimeout(() => {
        setCompletedToolCalls([])
      }, clearDelay)
      return () => clearTimeout(timer)
    }
  }, [completedToolCalls, setCompletedToolCalls, clearDelay])
}
