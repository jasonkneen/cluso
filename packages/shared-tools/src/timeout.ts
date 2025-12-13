/**
 * Timeout Utilities
 *
 * Utilities for wrapping promises with timeouts.
 */

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  constructor(operation: string, ms: number) {
    super(`Operation "${operation}" timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/**
 * Wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds
 * @param operation Name of the operation for error messages
 * @returns The promise result or throws a TimeoutError
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, ms))
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}

/**
 * Default timeout values for different operation types
 */
export const TIMEOUTS = {
  /** 30 seconds for tool calls */
  TOOL_CALL: 30000,
  /** 10 seconds for file reads */
  FILE_READ: 10000,
  /** 10 seconds for directory listings */
  FILE_LIST: 10000,
  /** 60 seconds for API calls */
  API_CALL: 60000,
  /** 5 seconds for quick operations */
  QUICK: 5000,
} as const

export type TimeoutType = keyof typeof TIMEOUTS
