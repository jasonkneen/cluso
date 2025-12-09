// @ts-nocheck
/**
 * AI Chat Routes
 *
 * REST API endpoints for AI chat completions in web mode.
 */

import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  generateChatCompletion,
  streamChatCompletion,
  getAvailableProviders,
  type ChatRequest,
} from '../../handlers/ai.js'

type Variables = {
  cwd: string
}

export function createAIRoutes() {
  const router = new Hono<{ Variables: Variables }>()

  /**
   * GET /api/ai/providers
   * Check which AI providers are available
   */
  router.get('/providers', async (c) => {
    const result = getAvailableProviders()
    return c.json(result)
  })

  /**
   * POST /api/ai/chat
   * Generate a chat completion (non-streaming)
   */
  router.post('/chat', async (c) => {
    try {
      const body = await c.req.json<ChatRequest>()

      if (!body.messages || !body.modelId) {
        return c.json({
          success: false,
          error: 'Missing required fields: messages, modelId',
          code: 'VALIDATION_ERROR',
        }, 400)
      }

      const result = await generateChatCompletion(body)
      return c.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return c.json({
        success: false,
        error: message,
        code: 'AI_ERROR',
      }, 500)
    }
  })

  /**
   * POST /api/ai/chat/stream
   * Stream a chat completion using Server-Sent Events
   */
  router.post('/chat/stream', async (c) => {
    try {
      const body = await c.req.json<ChatRequest>()

      if (!body.messages || !body.modelId) {
        return c.json({
          success: false,
          error: 'Missing required fields: messages, modelId',
          code: 'VALIDATION_ERROR',
        }, 400)
      }

      // Use Hono's streaming helper for SSE
      return stream(c, async (stream) => {
        try {
          for await (const chunk of streamChatCompletion(body)) {
            const data = JSON.stringify(chunk)
            await stream.write(`data: ${data}\n\n`)
          }
          await stream.write('data: [DONE]\n\n')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          await stream.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
        }
      }, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return c.json({
        success: false,
        error: message,
        code: 'AI_ERROR',
      }, 500)
    }
  })

  return router
}

export const aiRoutes = createAIRoutes()
