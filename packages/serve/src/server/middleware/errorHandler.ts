/**
 * Error handling middleware for Cluso server
 *
 * Catches all errors and returns consistent JSON responses
 * Handles different error types and logs them appropriately
 */

import { createMiddleware } from 'hono/factory'
import { error } from '../../types/api.js'

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Error handling middleware
 * Wraps all request handling to catch and log errors
 */
export function errorHandler() {
  return createMiddleware(async (c, next) => {
    try {
      await next()
    } catch (err) {
      const timestamp = new Date().toISOString()

      // Determine error type and status code
      let statusCode = 500
      let errorMessage = 'Internal server error'
      let errorCode = 'INTERNAL_ERROR'

      if (err instanceof ValidationError) {
        statusCode = 400
        errorMessage = err.message
        errorCode = 'VALIDATION_ERROR'
      } else if (err instanceof NotFoundError) {
        statusCode = 404
        errorMessage = err.message
        errorCode = 'NOT_FOUND'
      } else if (err instanceof SyntaxError) {
        statusCode = 400
        errorMessage = `Invalid JSON: ${err.message}`
        errorCode = 'INVALID_JSON'
      } else if (err instanceof Error) {
        errorMessage = err.message
        // Check error message patterns for specific handling
        if (err.message.includes('not found') || err.message.includes('ENOENT')) {
          statusCode = 404
          errorCode = 'NOT_FOUND'
        } else if (
          err.message.includes('invalid') ||
          err.message.includes('Invalid')
        ) {
          statusCode = 400
          errorCode = 'VALIDATION_ERROR'
        }
      }

      // Log the error with context
      const errorInfo = {
        timestamp,
        status: statusCode,
        code: errorCode,
        message: errorMessage,
        path: c.req.path,
        method: c.req.method,
        url: c.req.url,
      }

      console.error('[ERROR]', JSON.stringify(errorInfo, null, 2))
      if (err instanceof Error && err.stack) {
        console.error('[STACK]', err.stack)
      }

      // Return error response
      const response = error(errorMessage, errorCode)
      return new Response(JSON.stringify(response), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
}
