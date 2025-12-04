/**
 * Tool Execution Queue
 *
 * Orchestrates tool execution for the voice agent's agentic loop.
 * Instead of fire-and-forget dispatch, this queue:
 * 1. Collects all tool calls from a single model turn
 * 2. Executes them (parallel by default)
 * 3. Waits for all results
 * 4. Returns aggregated results for sending back to Gemini
 */

import { ToolCall, ToolArgs, ToolResponse, ToolHandlers } from './toolRouter'

export interface PendingToolCall {
  id: string
  name: string
  args: ToolArgs
  status: 'pending' | 'executing' | 'complete' | 'error'
  result?: ToolResponse
  error?: Error
  startTime?: number
  endTime?: number
}

export interface ToolExecutionResult {
  id: string
  name: string
  response: ToolResponse
}

export interface ToolStep {
  stepNumber: number
  toolCalls: ToolCall[]
  toolResults: ToolExecutionResult[]
  startTime: number
  endTime?: number
}

export interface ToolExecutionQueueOptions {
  /** Execute tools in parallel (default: true) */
  parallel?: boolean
  /** Timeout per tool in ms (default: 30000) */
  timeout?: number
  /** Callback when a tool starts executing */
  onToolStart?: (call: ToolCall) => void
  /** Callback when a tool completes */
  onToolComplete?: (call: ToolCall, result: ToolResponse) => void
  /** Callback when a tool errors */
  onToolError?: (call: ToolCall, error: Error) => void
}

/**
 * Tool executor function type - takes a call and handlers, returns a response
 */
export type ToolExecutor = (
  call: ToolCall,
  handlers: ToolHandlers
) => Promise<ToolResponse>

/**
 * Creates a tool execution queue for orchestrating voice agent tool calls
 */
export function createToolExecutionQueue(
  executor: ToolExecutor,
  handlers: ToolHandlers,
  options: ToolExecutionQueueOptions = {}
) {
  const {
    parallel = true,
    timeout = 30000,
    onToolStart,
    onToolComplete,
    onToolError,
  } = options

  const pendingCalls: PendingToolCall[] = []
  const stepHistory: ToolStep[] = []
  let currentStepNumber = 0

  /**
   * Enqueue tool calls for execution
   */
  function enqueue(calls: ToolCall[]): void {
    for (const call of calls) {
      pendingCalls.push({
        id: call.id,
        name: call.name,
        args: call.args,
        status: 'pending',
      })
    }
  }

  /**
   * Execute a single tool call with timeout
   */
  async function executeSingle(pending: PendingToolCall): Promise<ToolExecutionResult> {
    pending.status = 'executing'
    pending.startTime = Date.now()

    const call: ToolCall = {
      id: pending.id,
      name: pending.name,
      args: pending.args,
    }

    onToolStart?.(call)

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool ${call.name} timed out after ${timeout}ms`)), timeout)
      })

      // Race between execution and timeout
      const result = await Promise.race([
        executor(call, handlers),
        timeoutPromise,
      ])

      pending.status = 'complete'
      pending.result = result
      pending.endTime = Date.now()

      onToolComplete?.(call, result)

      return {
        id: call.id,
        name: call.name,
        response: result,
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      pending.status = 'error'
      pending.error = err
      pending.endTime = Date.now()

      const errorResponse: ToolResponse = {
        error: err.message,
      }
      pending.result = errorResponse

      onToolError?.(call, err)

      return {
        id: call.id,
        name: call.name,
        response: errorResponse,
      }
    }
  }

  /**
   * Execute all pending tool calls and return aggregated results
   */
  async function executeAll(): Promise<ToolExecutionResult[]> {
    if (pendingCalls.length === 0) {
      return []
    }

    const step: ToolStep = {
      stepNumber: ++currentStepNumber,
      toolCalls: pendingCalls.map(p => ({
        id: p.id,
        name: p.name,
        args: p.args,
      })),
      toolResults: [],
      startTime: Date.now(),
    }

    let results: ToolExecutionResult[]

    if (parallel) {
      // Execute all in parallel
      results = await Promise.all(
        pendingCalls.map(pending => executeSingle(pending))
      )
    } else {
      // Execute sequentially
      results = []
      for (const pending of pendingCalls) {
        const result = await executeSingle(pending)
        results.push(result)
      }
    }

    step.toolResults = results
    step.endTime = Date.now()
    stepHistory.push(step)

    // Clear pending calls after execution
    pendingCalls.length = 0

    return results
  }

  /**
   * Get execution history for debugging
   */
  function getHistory(): ToolStep[] {
    return [...stepHistory]
  }

  /**
   * Get current pending calls
   */
  function getPending(): PendingToolCall[] {
    return [...pendingCalls]
  }

  /**
   * Clear the queue without executing
   */
  function clear(): void {
    pendingCalls.length = 0
  }

  /**
   * Reset the queue and history
   */
  function reset(): void {
    pendingCalls.length = 0
    stepHistory.length = 0
    currentStepNumber = 0
  }

  return {
    enqueue,
    executeAll,
    executeSingle,
    getHistory,
    getPending,
    clear,
    reset,
  }
}

export type ToolExecutionQueue = ReturnType<typeof createToolExecutionQueue>
