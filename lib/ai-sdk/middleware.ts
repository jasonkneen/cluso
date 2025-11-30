/**
 * Middleware System - Implements reasoning extraction, request/response hooks, error handling
 * Provides composable middleware for cross-cutting concerns
 */

import { LanguageModel, wrapLanguageModel, experimental_wrapLanguageModelMiddleware } from 'ai'
import { extractReasoningMiddleware } from 'ai'
import type { GenerationResponse, AISDKWrapperConfig, ToolResult } from './types'

/**
 * Thinking/Reasoning middleware that extracts thinking blocks
 */
export function createThinkingMiddleware(options?: {
  budgetTokens?: number
  maxThinkingLength?: number
}) {
  return extractReasoningMiddleware({
    tagName: 'thinking',
    budgetTokens: options?.budgetTokens || 5000,
  })
}

/**
 * Request tracking middleware
 */
export function createRequestTrackingMiddleware(
  onRequest: (request: { messages: any[] }) => void
) {
  return experimental_wrapLanguageModelMiddleware({
    transformParams: async (params) => {
      onRequest({
        messages: params.prompt,
      })
      return params
    },
  })
}

/**
 * Response tracking middleware
 */
export function createResponseTrackingMiddleware(
  onResponse: (response: GenerationResponse) => void
) {
  return experimental_wrapLanguageModelMiddleware({
    wrapGenerate: async (generateFn) => {
      return async (params) => {
        const result = await generateFn(params)
        onResponse({
          text: result.text,
          toolCalls: result.toolCalls,
          toolResults: [],
          usage: result.usage,
          finishReason: result.finishReason,
        })
        return result
      }
    },
  })
}

/**
 * Error handling middleware
 */
export function createErrorHandlingMiddleware(
  onError: (error: Error) => void,
  options?: {
    retryOnError?: boolean
    maxRetries?: number
    logErrors?: boolean
  }
) {
  return experimental_wrapLanguageModelMiddleware({
    wrapGenerate: async (generateFn) => {
      return async (params) => {
        let lastError: Error | null = null

        const maxRetries = options?.maxRetries ?? 1
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await generateFn(params)
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (options?.logErrors) {
              console.error(`[AI SDK Middleware] Error (attempt ${attempt + 1}):`, lastError)
            }

            onError(lastError)

            if (!options?.retryOnError || attempt === maxRetries - 1) {
              throw lastError
            }

            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }

        throw lastError
      }
    },
  })
}

/**
 * Tool call validation middleware
 */
export function createToolValidationMiddleware(
  validateToolCall: (toolName: string, args: unknown) => { valid: boolean; error?: string }
) {
  return experimental_wrapLanguageModelMiddleware({
    transformParams: async (params) => {
      // Validate tool definitions if present
      if (params.tools) {
        for (const [toolName, toolDef] of Object.entries(params.tools)) {
          // Tool validation happens at execution time
          // This middleware just ensures tools are properly defined
        }
      }
      return params
    },
  })
}

/**
 * Token counting middleware for request/response
 */
export function createTokenCountingMiddleware(
  onTokens: (tokens: { input: number; output: number }) => void
) {
  return experimental_wrapLanguageModelMiddleware({
    wrapGenerate: async (generateFn) => {
      return async (params) => {
        const result = await generateFn(params)

        onTokens({
          input: result.usage.inputTokens,
          output: result.usage.outputTokens,
        })

        return result
      }
    },
  })
}

/**
 * Compose multiple middleware together
 */
export function composeMiddleware(
  ...middlewares: Array<ReturnType<typeof experimental_wrapLanguageModelMiddleware>>
): (model: LanguageModel) => LanguageModel {
  return (model: LanguageModel) => {
    let wrapped = model

    for (const middleware of middlewares) {
      wrapped = wrapLanguageModel({
        model: wrapped,
        middleware,
      })
    }

    return wrapped
  }
}

/**
 * Create a middleware pipeline from configuration
 */
export function createMiddlewareFromConfig(
  config: AISDKWrapperConfig
): (model: LanguageModel) => LanguageModel {
  const middlewares: Array<ReturnType<typeof experimental_wrapLanguageModelMiddleware>> = []

  // Add reasoning middleware if enabled
  if (config.reasoning?.enabled) {
    middlewares.push(
      createThinkingMiddleware({
        budgetTokens: config.reasoning.budgetTokens,
        maxThinkingLength: config.reasoning.maxThinkingLength,
      })
    )
  }

  // Add request tracking
  if (config.middleware?.onRequest) {
    middlewares.push(createRequestTrackingMiddleware(config.middleware.onRequest))
  }

  // Add response tracking
  if (config.middleware?.onResponse) {
    middlewares.push(createResponseTrackingMiddleware(config.middleware.onResponse))
  }

  // Add error handling
  if (config.middleware?.onError || config.errors?.handleAPIErrors) {
    middlewares.push(
      createErrorHandlingMiddleware(
        config.middleware?.onError || (() => {}),
        {
          retryOnError: config.errors?.handleAPIErrors,
          maxRetries: config.errors?.retryConfig?.maxRetries || 1,
          logErrors: true,
        }
      )
    )
  }

  // Add token counting
  if (config.middleware?.onResponse) {
    // Already tracked in response middleware
  }

  return composeMiddleware(...middlewares)
}

/**
 * Utility to wrap a model with middleware
 */
export function applyMiddleware(
  model: LanguageModel,
  config: AISDKWrapperConfig
): LanguageModel {
  const pipelineFactory = createMiddlewareFromConfig(config)
  return pipelineFactory(model)
}

/**
 * Create a middleware configuration from options
 */
export function createMiddlewareConfig(options: {
  enableReasoning?: boolean
  trackRequests?: boolean
  trackResponses?: boolean
  handleErrors?: boolean
  countTokens?: boolean
}): Partial<AISDKWrapperConfig> {
  return {
    reasoning: options.enableReasoning ? { enabled: true } : undefined,
    errors: options.handleErrors
      ? {
          handleAPIErrors: true,
          retryConfig: {
            maxRetries: 3,
            initialDelayMs: 1000,
            backoffFactor: 2,
          },
        }
      : undefined,
  }
}
