/**
 * CORS middleware for Cluso server
 *
 * Handles Cross-Origin Resource Sharing for browser requests
 * Supports configurable allowed origins with wildcard default
 */

import { createMiddleware } from 'hono/factory'

/**
 * Creates CORS middleware
 * @param allowedOrigins Array of allowed origins, defaults to ['*']
 * @returns Hono middleware function
 */
export function corsMiddleware(allowedOrigins: string[] = ['*']) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header('Origin')
    const isOriginAllowed = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))

    // Handle preflight OPTIONS request
    if (c.req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-API-Key, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      }

      if (isOriginAllowed && origin) {
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Credentials'] = 'true'
      } else if (allowedOrigins.includes('*')) {
        headers['Access-Control-Allow-Origin'] = '*'
      }

      return new Response('', { status: 204, headers })
    }

    // Set CORS headers for actual request
    await next()

    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-API-Key, X-Requested-With',
    }

    if (isOriginAllowed && origin) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
    } else if (allowedOrigins.includes('*')) {
      headers['Access-Control-Allow-Origin'] = '*'
    }

    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value)
    }
  })
}
