// @ts-nocheck
/**
 * OAuth API Routes for Cluso Server
 *
 * Provides REST endpoints for OAuth authentication and token management
 */

import { Hono } from 'hono'

import {
  startLogin,
  completeLogin,
  getAccessToken,
  getStatus,
  logout,
} from '../../handlers/oauth.js'
import { success, error } from '../../types/api.js'

/**
 * Creates OAuth routes handler
 */
export function createOAuthRoutes(): Hono {
  const router = new Hono()

  /**
   * POST /api/oauth/start
   * Starts OAuth login flow
   *
   * Body: { mode: 'max' | 'console' }
   * Returns: { authUrl, verifier, state }
   */
  router.post('/start', async (c) => {
    try {
      const body = (await c.req.json()) as { mode: 'max' | 'console' }
      const mode = body.mode || 'console'

      const result = startLogin(mode)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success(result.data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/oauth/complete
   * Completes OAuth login by exchanging authorization code
   *
   * Body: { code: string, verifier: string, state: string, stateParam: string }
   * Returns: { accessToken, expiresIn }
   */
  router.post('/complete', async (c) => {
    try {
      const body = (await c.req.json()) as {
        code: string
        verifier: string
        state: string
        stateParam: string
      }

      if (!body.code || !body.verifier || !body.state || !body.stateParam) {
        return c.json(error('Code, verifier, state, and stateParam are required'), 400)
      }

      const result = await completeLogin(body.code, body.verifier, body.state, body.stateParam)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success(result.data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * GET /api/oauth/token
   * Gets current valid access token (auto-refreshes if needed)
   *
   * Returns: { accessToken, expiresIn, mode }
   */
  router.get('/token', async (c) => {
    try {
      const result = await getAccessToken()

      if (!result.success) {
        return c.json(error(result.error), 401)
      }

      return c.json(success(result.data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to get token: ${message}`), 500)
    }
  })

  /**
   * GET /api/oauth/status
   * Gets OAuth status and token expiry information
   *
   * Returns: { isLoggedIn, mode, expiresAt, expiresIn }
   */
  router.get('/status', async (c) => {
    try {
      const result = await getStatus()

      if (!result.success) {
        return c.json(error(result.error), 500)
      }

      return c.json(success(result.data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to get status: ${message}`), 500)
    }
  })

  /**
   * POST /api/oauth/logout
   * Clears stored OAuth tokens and logs out user
   *
   * Returns: { message: string }
   */
  router.post('/logout', async (c) => {
    try {
      const result = await logout()

      if (!result.success) {
        return c.json(error(result.error), 500)
      }

      return c.json(success({ message: result.data }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to logout: ${message}`), 500)
    }
  })

  return router
}
