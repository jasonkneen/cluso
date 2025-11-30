/**
 * Error Handling & Retry Strategies
 * Provides robust error handling with exponential backoff and provider-specific strategies
 */

import type { RetryConfig, ErrorConfig } from './types'

/**
 * Base error class for AI SDK operations
 */
export class AISDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AISDKError'
  }
}

/**
 * Specific error types
 */
export class APIError extends AISDKError {
  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message, 'API_ERROR', statusCode, originalError)
    this.name = 'APIError'
  }
}

export class RateLimitError extends AISDKError {
  constructor(
    message: string,
    public retryAfter?: number,
    originalError?: Error
  ) {
    super(message, 'RATE_LIMIT', 429, originalError)
    this.name = 'RateLimitError'
  }
}

export class AuthenticationError extends AISDKError {
  constructor(message: string, originalError?: Error) {
    super(message, 'AUTH_ERROR', 401, originalError)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends AISDKError {
  constructor(
    message: string,
    public validationErrors?: Record<string, string[]>,
    originalError?: Error
  ) {
    super(message, 'VALIDATION_ERROR', 400, originalError)
    this.name = 'ValidationError'
  }
}

export class TimeoutError extends AISDKError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TIMEOUT', undefined, originalError)
    this.name = 'TimeoutError'
  }
}

/**
 * Retry strategy with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    retryableStatusCodes = [408, 429, 500, 502, 503, 504],
  } = config

  let lastError: Error | null = null
  let delay = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw lastError
      }

      // Check if error is retryable
      const isRetryable = isRetryableError(lastError, retryableStatusCodes)
      if (!isRetryable) {
        throw lastError
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Exponential backoff with jitter
      delay = Math.min(
        Math.floor(delay * backoffFactor + Math.random() * delay),
        maxDelayMs
      )
    }
  }

  throw lastError
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(
  error: Error,
  retryableStatusCodes: number[] = [408, 429, 500, 502, 503, 504]
): boolean {
  // Timeout errors are retryable
  if (error instanceof TimeoutError) {
    return true
  }

  // Rate limit errors are retryable
  if (error instanceof RateLimitError) {
    return true
  }

  // API errors with specific status codes
  if (error instanceof APIError && error.statusCode) {
    return retryableStatusCodes.includes(error.statusCode)
  }

  // Network-related errors
  if (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('EHOSTUNREACH')
  ) {
    return true
  }

  return false
}

/**
 * Extract error information from different response formats
 */
export function parseErrorResponse(
  error: unknown
): {
  message: string
  code?: string
  statusCode?: number
  details?: unknown
} {
  if (error instanceof AISDKError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    // Try to parse as JSON response
    try {
      const parsed = JSON.parse(error.message)
      return {
        message: parsed.message || error.message,
        code: parsed.code,
        statusCode: parsed.status,
        details: parsed,
      }
    } catch {
      return {
        message: error.message,
      }
    }
  }

  return {
    message: String(error),
  }
}

/**
 * Handle fetch errors and convert to appropriate error types
 */
export function handleFetchError(
  response: Response,
  body?: string
): AISDKError {
  const statusCode = response.status
  const contentType = response.headers.get('content-type') || ''

  // Rate limit
  if (statusCode === 429) {
    const retryAfter = response.headers.get('retry-after')
    const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
    return new RateLimitError(
      'Rate limit exceeded',
      retryAfterSeconds ? retryAfterSeconds * 1000 : undefined
    )
  }

  // Authentication
  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError(
      'Authentication failed. Check your API key.'
    )
  }

  // Validation
  if (statusCode === 400) {
    let message = 'Validation error'
    let validationErrors: Record<string, string[]> | undefined

    if (contentType.includes('application/json') && body) {
      try {
        const parsed = JSON.parse(body)
        message = parsed.message || message
        validationErrors = parsed.errors
      } catch {
        // ignore
      }
    }

    return new ValidationError(message, validationErrors)
  }

  // Server errors
  if (statusCode >= 500) {
    return new APIError(
      `Server error: ${statusCode}`,
      statusCode
    )
  }

  // Generic API error
  return new APIError(
    `API error: ${statusCode}`,
    statusCode
  )
}

/**
 * Create a fetch wrapper with error handling and retry
 */
export function createFetchWithRetry(
  errorConfig: ErrorConfig = {}
): typeof fetch {
  const retryConfig = errorConfig.retryConfig || {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffFactor: 2,
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const fetcher = async () => {
      const response = await fetch(input, init)

      if (!response.ok) {
        const body = await response.text()
        throw handleFetchError(response, body)
      }

      return response
    }

    if (errorConfig.handleAPIErrors) {
      return retryWithBackoff(fetcher, retryConfig)
    }

    return fetcher()
  }
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ])
}

/**
 * Validate error configuration
 */
export function validateErrorConfig(config: ErrorConfig): {
  valid: boolean
  errors?: string[]
} {
  const errors: string[] = []

  if (config.retryConfig) {
    const rc = config.retryConfig

    if (rc.maxRetries !== undefined && rc.maxRetries < 0) {
      errors.push('maxRetries must be non-negative')
    }

    if (rc.initialDelayMs !== undefined && rc.initialDelayMs <= 0) {
      errors.push('initialDelayMs must be positive')
    }

    if (rc.maxDelayMs !== undefined && rc.maxDelayMs <= 0) {
      errors.push('maxDelayMs must be positive')
    }

    if (
      rc.maxDelayMs &&
      rc.initialDelayMs &&
      rc.maxDelayMs < rc.initialDelayMs
    ) {
      errors.push('maxDelayMs must be >= initialDelayMs')
    }

    if (rc.backoffFactor !== undefined && rc.backoffFactor <= 1) {
      errors.push('backoffFactor must be > 1')
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Get human-readable error message
 */
export function getErrorMessage(error: AISDKError): string {
  if (error instanceof RateLimitError) {
    if (error.retryAfter) {
      return `Rate limited. Retry after ${error.retryAfter}ms`
    }
    return 'Rate limited. Please try again later.'
  }

  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please check your API key.'
  }

  if (error instanceof ValidationError) {
    const details =
      error.validationErrors &&
      Object.entries(error.validationErrors)
        .map(([key, messages]) => `${key}: ${messages.join(', ')}`)
        .join('; ')

    return details ? `Validation error: ${details}` : error.message
  }

  if (error instanceof TimeoutError) {
    return 'Request timed out. Please try again.'
  }

  if (error instanceof APIError) {
    return `API error (${error.statusCode}): ${error.message}`
  }

  return error.message
}
