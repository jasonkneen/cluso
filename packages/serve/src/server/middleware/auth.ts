/**
 * Authentication middleware for Cluso server
 *
 * Validates API key or Bearer token in Authorization header
 * if apiKey is configured. Passes through if no auth is required.
 */

import { createMiddleware } from 'hono/factory'

/**
 * Creates authentication middleware
 * @param apiKey Optional API key to validate against
 * @returns Hono middleware function
 */
export function authMiddleware(apiKey?: string) {
  return createMiddleware(async (c, next) => {
    // Skip auth if no API key is configured
    if (!apiKey) {
      await next()
      return
    }

    // Check for Bearer token in Authorization header
    const authHeader = c.req.header('Authorization')
    if (authHeader) {
      const [scheme, token] = authHeader.split(' ')
      if (scheme === 'Bearer' && token === apiKey) {
        await next()
        return
      }
    }

    // Check for X-API-Key header
    const apiKeyHeader = c.req.header('X-API-Key')
    if (apiKeyHeader === apiKey) {
      await next()
      return
    }

    // No valid auth found
    return c.json(
      {
        success: false,
        data: null,
        error: 'Unauthorized: Invalid or missing API key',
        timestamp: new Date().toISOString(),
      },
      401
    )
  })
}
