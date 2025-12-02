/**
 * Tool Execution Tracker Hook
 * 
 * Tracks tool execution lifecycle: pending → running → success/error
 * Provides visibility into tool execution with timing and error info
 * 
 * Usage:
 *   const { toolCalls, trackStart, trackSuccess, trackError, clear } = useToolTracker()
 *   
 *   toolTracker.trackStart({ id: 'tool-1', name: 'select_element', args: {...} })
 *   try {
 *     const result = await executeTool(...)
 *     toolTracker.trackSuccess('tool-1', result)
 *   } catch (err) {
 *     toolTracker.trackError('tool-1', err.message)
 *   }
 */

import { useState, useCallback, useRef } from 'react'

export interface TrackedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: unknown
  error?: string
  startTime: number
  endTime?: number
  duration?: number
}

interface TimeoutTracker {
  [key: string]: NodeJS.Timeout
}

export function useToolTracker() {
  const [toolCalls, setToolCalls] = useState<Map<string, TrackedToolCall>>(new Map())
  const timeoutsRef = useRef<TimeoutTracker>({})

  /**
   * Start tracking a tool execution
   * Automatically sets a 30-second timeout
   */
  const trackStart = useCallback((call: { id: string; name: string; args: unknown }) => {
    const tracked: TrackedToolCall = {
      id: call.id,
      name: call.name,
      args: call.args as Record<string, unknown>,
      status: 'running',
      startTime: Date.now()
    }
    
    setToolCalls(prev => new Map(prev).set(call.id, tracked))

    // Auto-timeout protection after 30 seconds
    const timeoutId = setTimeout(() => {
      setToolCalls(prev => {
        const updated = new Map(prev)
        const existingCall = updated.get(tracked.id)
        
        // Only timeout if still running
        if (existingCall && existingCall.status === 'running') {
          const endTime = Date.now()
          existingCall.status = 'error'
          existingCall.error = 'Tool execution timeout (30s)'
          existingCall.endTime = endTime
          existingCall.duration = endTime - existingCall.startTime
        }
        
        return updated
      })
      
      // Clean up timeout reference
      delete timeoutsRef.current[call.id]
    }, 30000)

    timeoutsRef.current[call.id] = timeoutId
  }, [])

  /**
   * Mark tool as successfully completed
   */
  const trackSuccess = useCallback((toolId: string, result: unknown) => {
    // Clear timeout
    if (timeoutsRef.current[toolId]) {
      clearTimeout(timeoutsRef.current[toolId])
      delete timeoutsRef.current[toolId]
    }

    setToolCalls(prev => {
      const updated = new Map(prev)
      const call = updated.get(toolId)
      
      if (call) {
        const endTime = Date.now()
        call.status = 'success'
        call.result = result
        call.endTime = endTime
        call.duration = endTime - call.startTime
      }
      
      return updated
    })
  }, [])

  /**
   * Mark tool as failed with error message
   */
  const trackError = useCallback((toolId: string, error: string) => {
    // Clear timeout
    if (timeoutsRef.current[toolId]) {
      clearTimeout(timeoutsRef.current[toolId])
      delete timeoutsRef.current[toolId]
    }

    setToolCalls(prev => {
      const updated = new Map(prev)
      const call = updated.get(toolId)
      
      if (call) {
        const endTime = Date.now()
        call.status = 'error'
        call.error = error
        call.endTime = endTime
        call.duration = endTime - call.startTime
      }
      
      return updated
    })
  }, [])

  /**
   * Clear all tracked tool calls and cancel any pending timeouts
   */
  const clear = useCallback(() => {
    // Cancel all pending timeouts
    Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout))
    timeoutsRef.current = {}
    
    setToolCalls(new Map())
  }, [])

  /**
   * Get array of tool calls (for rendering)
   */
  const getToolCalls = useCallback(() => {
    return Array.from(toolCalls.values())
  }, [toolCalls])

  return {
    toolCalls: getToolCalls(),
    trackStart,
    trackSuccess,
    trackError,
    clear,
    // For testing/debugging
    _internal: { toolCalls }
  }
}
