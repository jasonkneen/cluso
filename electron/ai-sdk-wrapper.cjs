/**
 * Unified AI SDK Wrapper for Electron Main Process
 *
 * This module handles ALL AI SDK operations server-side to avoid CORS issues.
 * It supports multiple providers (Anthropic, OpenAI, Google, Claude Code OAuth, Codex OAuth),
 * streaming, tool calling, and MCP server integration.
 *
 * @module electron/ai-sdk-wrapper
 */

const { ipcMain } = require('electron')
const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')

// Dynamic imports for ESM modules (AI SDK is ESM-only)
let ai = null
let anthropicSdk = null
let openaiSdk = null
let googleSdk = null

// Provider instances cache
const providerInstances = new Map()

// Reference to main window for sending events
let mainWindow = null

// OAuth modules
let oauth = null
let codex = null

// MCP module
let mcp = null

/**
 * Initialize the AI SDK modules (must be called before using)
 */
async function initialize() {
  if (ai) return // Already initialized

  console.log('[AI-SDK-Wrapper] Initializing AI SDK modules...')

  try {
    // Dynamic import of ESM modules
    ai = await import('ai')
    anthropicSdk = await import('@ai-sdk/anthropic')
    openaiSdk = await import('@ai-sdk/openai')
    googleSdk = await import('@ai-sdk/google')

    console.log('[AI-SDK-Wrapper] AI SDK modules loaded successfully')

    // Load local modules
    oauth = require('./oauth.cjs')
    codex = require('./codex-oauth.cjs')
    mcp = require('./mcp.cjs')

    console.log('[AI-SDK-Wrapper] Local modules loaded')
  } catch (error) {
    console.error('[AI-SDK-Wrapper] Failed to initialize:', error)
    throw error
  }
}

/**
 * Set the main window reference for IPC events
 */
function setMainWindow(window) {
  mainWindow = window
}

/**
 * Send event to renderer process
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ============================================================================
// Provider Types and Configuration
// ============================================================================

/**
 * Supported provider types
 * @typedef {'anthropic' | 'openai' | 'google' | 'claude-code' | 'codex'} ProviderType
 */

/**
 * Model ID to provider mapping
 */
const MODEL_PROVIDER_MAP = {
  // Google models
  'gemini-3-pro-preview': 'google',
  'gemini-2.5-flash': 'google',
  'gemini-2.5-pro': 'google',
  'gemini-2.0-flash': 'google',
  'gemini-2.0-flash-lite': 'google',
  'gemini-1.5-pro': 'google',
  'gemini-1.5-flash': 'google',
  // OpenAI models
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4': 'openai',
  'gpt-3.5-turbo': 'openai',
  'o1': 'openai',
  'o1-mini': 'openai',
  'o1-preview': 'openai',
  'o3': 'openai',
  'o3-mini': 'openai',
  // Anthropic models
  'claude-3-5-sonnet': 'anthropic',
  'claude-3-5-sonnet-20241022': 'anthropic',
  'claude-4-sonnet': 'anthropic',
  'claude-4-sonnet-20250514': 'anthropic',
  'claude-sonnet-4-20250514': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
  // Claude Code (OAuth)
  'claude-code': 'claude-code',
  'claude-sonnet-4-5': 'claude-code',
  'claude-sonnet-4-5-20250929': 'claude-code',
  'claude-opus-4-5': 'claude-code',
  'claude-opus-4-5-20251101': 'claude-code',
  'claude-haiku-4-5': 'claude-code',
  'claude-haiku-4-5-20251001': 'claude-code',
  // Codex (ChatGPT Plus/Pro OAuth)
  'codex': 'codex',
  'codex-gpt-4o': 'codex',
  'codex-o1': 'codex',
  'codex-o1-pro': 'codex',
  'gpt-5.1-codex': 'codex',
  'gpt-5.1-codex-mini': 'codex',
  'gpt-5.1-nano': 'codex',
  'gpt-5-codex': 'codex',
  'gpt-5-codex-mini': 'codex',
}

/**
 * Get provider type for a model ID
 * Supports both exact matches and pattern-based matching for variants
 */
function getProviderForModel(modelId) {
  // Check exact match first
  if (MODEL_PROVIDER_MAP[modelId]) {
    return MODEL_PROVIDER_MAP[modelId]
  }

  // Pattern-based matching for model variants
  const lowerModelId = modelId.toLowerCase()
  if (lowerModelId.startsWith('gemini-')) return 'google'
  if (lowerModelId.startsWith('gpt-') || lowerModelId.startsWith('o1') || lowerModelId.startsWith('o3')) return 'openai'
  if (lowerModelId.startsWith('claude-')) {
    // Check for OAuth variants
    if (lowerModelId.includes('sonnet-4-5') || lowerModelId.includes('opus-4-5') || lowerModelId.includes('haiku-4-5')) {
      return 'claude-code'
    }
    return 'anthropic'
  }
  if (lowerModelId.includes('codex')) return 'codex'

  return null
}

/**
 * Normalize model ID to what each provider expects
 */
function normalizeModelId(modelId, provider) {
  if (provider === 'google') {
    return modelId
  }

  if (provider === 'anthropic') {
    const map = {
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-4-sonnet': 'claude-sonnet-4-20250514',
      'claude-3-opus': 'claude-3-opus-20240229',
    }
    return map[modelId] || modelId
  }

  if (provider === 'claude-code') {
    const map = {
      'claude-code': 'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
      'claude-opus-4-5': 'claude-opus-4-5-20251101',
      'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    }
    return map[modelId] || 'claude-sonnet-4-5-20250929'
  }

  if (provider === 'codex') {
    const map = {
      'codex': 'gpt-5.1-codex-mini',
      'codex-gpt-4o': 'gpt-4o',
      'codex-o1': 'o1',
      'codex-o1-pro': 'o1-pro',
    }
    return map[modelId] || modelId
  }

  return modelId
}

// ============================================================================
// Provider Instance Management
// ============================================================================

/**
 * Claude Code system prompt - REQUIRED for OAuth tokens to work
 */
const CLAUDE_CODE_SYSTEM_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude."

/**
 * Codex constants
 * Direct chatgpt.com access is blocked by Cloudflare - use a proxy worker instead
 * Set CODEX_PROXY_URL to your deployed Cloudflare Worker URL
 * See: https://github.com/GewoonJaap/codex-openai-wrapper
 */
const CODEX_DIRECT_URL = 'https://chatgpt.com/backend-api'
const CODEX_PROXY_URL = process.env.CODEX_PROXY_URL || null
const CODEX_BASE_URL = CODEX_PROXY_URL || CODEX_DIRECT_URL
const CODEX_BETA_HEADER = 'responses=experimental'
const CODEX_ORIGINATOR = 'codex_cli_rs'
const CODEX_USE_PROXY = !!CODEX_PROXY_URL

/**
 * Create a custom fetch for Claude Code OAuth
 */
function createClaudeCodeFetch() {
  return async (url, options = {}) => {
    // Get fresh access token
    const accessToken = await oauth.getValidAccessToken()
    if (!accessToken) {
      throw new Error('Claude Code OAuth: No valid access token. Please authenticate first.')
    }

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
      'Authorization': `Bearer ${accessToken}`,
      'X-API-Key': '',
      ...options.headers,
    }

    // Remove conflicting headers
    delete headers['x-api-key']

    // Parse body and inject system prompt
    let body = options.body
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body)

        // Handle system prompt - can be string or array
        if (Array.isArray(parsed.system)) {
          // System is array of content blocks - prepend our system prompt
          parsed.system = [
            { type: 'text', text: CLAUDE_CODE_SYSTEM_PROMPT },
            ...parsed.system
          ]
        } else if (typeof parsed.system === 'string') {
          // System is a string
          parsed.system = `${CLAUDE_CODE_SYSTEM_PROMPT}\n\n${parsed.system}`
        } else {
          // No system prompt - set ours
          parsed.system = CLAUDE_CODE_SYSTEM_PROMPT
        }

        console.log('[Claude Code Fetch] System prompt type:', Array.isArray(parsed.system) ? 'array' : typeof parsed.system)

        // FIX: Ensure all tools have proper input_schema.type
        if (parsed.tools && Array.isArray(parsed.tools)) {
          for (const tool of parsed.tools) {
            if (tool.input_schema && typeof tool.input_schema === 'object') {
              if (!tool.input_schema.type) {
                tool.input_schema.type = 'object'
              }
              if (!tool.input_schema.properties) {
                tool.input_schema.properties = {}
              }
            }
          }
        }

        body = JSON.stringify(parsed)
      } catch (e) {
        // Keep original body if not JSON
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      body,
    })

    return response
  }
}

/**
 * Create a custom fetch for Codex OAuth
 * Codex uses the OpenAI Responses API - AI SDK supports this natively via openai.responses()
 *
 * The chatgpt.com backend is protected by Cloudflare. Direct Node.js requests are blocked.
 * Set CODEX_PROXY_URL to a deployed Cloudflare Worker proxy to bypass this.
 * See cloudflare-worker/codex-proxy.js for the proxy implementation.
 */
function createCodexFetch() {
  return async (url, options = {}) => {
    // Get fresh access token
    const accessToken = await codex.getValidAccessToken()
    if (!accessToken) {
      throw new Error('Codex OAuth: No valid access token. Please authenticate first.')
    }

    console.log('[Codex Fetch] Original URL:', url)
    console.log('[Codex Fetch] Using proxy:', CODEX_USE_PROXY ? CODEX_PROXY_URL : 'NO (direct)')
    console.log('[Codex Fetch] Token prefix:', accessToken?.substring(0, 50) + '...')
    console.log('[Codex Fetch] Token length:', accessToken?.length)

    // Get account ID (from CLI auth or token)
    const accountId = codex.getAccountId()

    let targetUrl
    let headers

    if (CODEX_USE_PROXY) {
      // When using proxy, send to the proxy URL with our token in a custom header
      // The proxy handles path mapping (/v1/responses -> /codex/responses)
      targetUrl = `${CODEX_PROXY_URL}/v1/responses`

      headers = {
        'Content-Type': 'application/json',
        // Proxy API key for authentication (optional, set PROXY_API_KEY in worker)
        'Authorization': `Bearer ${process.env.CODEX_PROXY_API_KEY || 'no-key'}`,
        // Our actual Codex OAuth token goes in a custom header
        'X-Codex-Token': accessToken,
        'OpenAI-Beta': CODEX_BETA_HEADER,
        'originator': CODEX_ORIGINATOR,
        'session_id': require('crypto').randomUUID(),
        ...options.headers,
      }

      if (accountId) {
        headers['chatgpt-account-id'] = accountId
      }
    } else {
      // Direct mode - use same headers as official Codex CLI (Rust)
      // See: https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client.rs
      targetUrl = url.includes('/responses')
        ? `${CODEX_DIRECT_URL}/codex/responses`
        : url

      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        // Use exact same User-Agent as official Codex CLI
        'User-Agent': 'codex-cli',
        // Required headers from opencode/codex implementations
        'OpenAI-Beta': CODEX_BETA_HEADER,
        'originator': CODEX_ORIGINATOR,
        'session_id': require('crypto').randomUUID(),
        ...options.headers,
      }

      if (accountId) {
        headers['chatgpt-account-id'] = accountId
        console.log('[Codex Fetch] Using account ID:', accountId)
      }
    }

    // Remove conflicting headers
    delete headers['x-api-key']
    delete headers['X-API-Key']

    console.log('[Codex Fetch] Target URL:', targetUrl)
    console.log('[Codex Fetch] Making request...')

    const response = await fetch(targetUrl, {
      ...options,
      headers,
    })

    console.log('[Codex Fetch] Response status:', response.status)

    // Check for Cloudflare challenge (only in direct mode)
    if (!CODEX_USE_PROXY && response.status === 403) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        console.error('[Codex Fetch] Cloudflare challenge detected')
        throw new Error(
          'Codex: Cloudflare blocked the request. ' +
          'Deploy the proxy worker (see cloudflare-worker/) and set CODEX_PROXY_URL environment variable.'
        )
      }
    }

    return response
  }
}

/**
 * Create or get cached provider instance
 */
async function getProvider(providerType, apiKey = '') {
  await initialize()

  const cacheKey = `${providerType}:${apiKey}`
  if (providerInstances.has(cacheKey)) {
    return providerInstances.get(cacheKey)
  }

  let provider

  switch (providerType) {
    case 'anthropic':
      provider = anthropicSdk.createAnthropic({ apiKey })
      break

    case 'openai':
      provider = openaiSdk.createOpenAI({ apiKey })
      break

    case 'google':
      provider = googleSdk.createGoogleGenerativeAI({ apiKey })
      break

    case 'claude-code':
      provider = anthropicSdk.createAnthropic({
        apiKey: '',
        headers: {
          'anthropic-beta': 'oauth-2025-04-20,prompt-caching-2024-07-31',
        },
        fetch: createClaudeCodeFetch(),
      })
      break

    case 'codex':
      provider = openaiSdk.createOpenAI({
        apiKey: 'codex-oauth',
        baseURL: CODEX_BASE_URL,
        fetch: createCodexFetch(),
      })
      break

    default:
      throw new Error(`Unknown provider: ${providerType}`)
  }

  providerInstances.set(cacheKey, provider)
  return provider
}

// ============================================================================
// Tool Conversion
// ============================================================================

/**
 * Google placeholder description for empty schemas
 */
const GOOGLE_PLACEHOLDER_DESCRIPTION = 'Placeholder parameter (can be omitted)'

/**
 * Convert JSON Schema to Zod schema
 * @param {Object} schema - JSON Schema object
 */
function jsonSchemaToZod(schema) {
  const z = require('zod')

  if (!schema || schema.type !== 'object') {
    return z.object({})
  }

  const shape = {}
  const properties = schema.properties || {}
  const required = schema.required || []

  for (const [key, prop] of Object.entries(properties)) {
    let zodType

    switch (prop.type) {
      case 'string':
        zodType = z.string()
        break
      case 'number':
        zodType = z.number()
        break
      case 'boolean':
        zodType = z.boolean()
        break
      case 'array':
        zodType = z.array(z.any())
        break
      case 'object':
        zodType = z.object({})
        break
      default:
        zodType = z.any()
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description)
    }

    if (!required.includes(key)) {
      zodType = zodType.optional()
    }

    shape[key] = zodType
  }

  return z.object(shape)
}

/**
 * Convert tool definitions to AI SDK format
 * @param {Object} tools - Tool definitions from frontend
 * @param {ProviderType} providerType - Target provider type
 */
function convertTools(tools, providerType) {
  if (!tools || typeof tools !== 'object') return {}

  const result = {}

  for (const [name, def] of Object.entries(tools)) {
    let parameters = def.parameters || { type: 'object', properties: {} }

    // Ensure parameters always has type: 'object' (required by Anthropic/Claude)
    if (typeof parameters === 'object' && !parameters.type) {
      parameters = { type: 'object', ...parameters }
    }

    // Ensure properties exists
    if (typeof parameters === 'object' && parameters.type === 'object' && !parameters.properties) {
      parameters = { ...parameters, properties: {} }
    }

    // Google requires non-empty object schemas
    if (providerType === 'google' && parameters) {
      if (typeof parameters === 'object' && parameters.type === 'object') {
        if (!parameters.properties || Object.keys(parameters.properties).length === 0) {
          parameters = {
            type: 'object',
            properties: {
              _placeholder: {
                type: 'string',
                description: GOOGLE_PLACEHOLDER_DESCRIPTION,
              },
            },
          }
        }
      }
    }

    // Convert JSON Schema to Zod schema - this is required for proper AI SDK tool handling
    const zodSchema = jsonSchemaToZod(parameters)

    // Debug: log first tool
    if (name === 'read_file') {
      console.log('[AI-SDK-Wrapper] Creating tool for read_file with schema:', JSON.stringify(parameters))
    }

    // Create tool using Zod schema
    result[name] = ai.tool({
      description: def.description || `Tool: ${name}`,
      parameters: zodSchema,
    })
  }

  return result
}

// ============================================================================
// Streaming Implementation
// ============================================================================

/**
 * Stream a chat completion with full support for tools and reasoning
 *
 * @param {Object} options - Stream options
 * @param {string} options.requestId - Unique request ID for tracking
 * @param {string} options.modelId - Model ID to use
 * @param {Array} options.messages - Chat messages
 * @param {Object} options.providers - Provider configurations { providerId: apiKey }
 * @param {string} options.system - System prompt
 * @param {Object} options.tools - Tool definitions
 * @param {number} options.maxSteps - Maximum tool execution steps
 * @param {boolean} options.enableReasoning - Enable extended thinking
 * @param {Object} options.mcpTools - MCP tool definitions
 */
async function streamChat(options) {
  const {
    requestId,
    modelId,
    messages,
    providers = {},
    system,
    tools = {},
    maxSteps = 5,
    enableReasoning = false,
    mcpTools = [],
  } = options

  await initialize()

  const providerType = getProviderForModel(modelId)
  if (!providerType) {
    sendToRenderer('ai-sdk:error', { requestId, error: `Unknown model: ${modelId}` })
    return
  }

  // Get API key for provider
  let apiKey = ''
  if (providerType !== 'claude-code' && providerType !== 'codex') {
    apiKey = providers[providerType]
    // Fall back to environment variables if no API key passed from frontend
    if (!apiKey) {
      if (providerType === 'google') {
        apiKey = process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
      } else if (providerType === 'openai') {
        apiKey = process.env.OPENAI_API_KEY
      } else if (providerType === 'anthropic') {
        apiKey = process.env.ANTHROPIC_API_KEY
      }
    }
    if (!apiKey) {
      sendToRenderer('ai-sdk:error', { requestId, error: `No API key for provider: ${providerType}. Configure in settings or set environment variable.` })
      return
    }
  }

  try {
    const provider = await getProvider(providerType, apiKey)
    const normalizedModelId = normalizeModelId(modelId, providerType)

    // Filter out system messages (provider-specific handling)
    const filteredMessages = messages.filter(msg => msg.role !== 'system')

    // Merge custom tools with MCP tools
    const allTools = { ...tools }

    // Convert MCP tools to tool definitions
    for (const mcpTool of mcpTools) {
      const uniqueName = `mcp_${mcpTool.serverId}_${mcpTool.name}`
      // Ensure MCP tool inputSchema has required type field
      let mcpParams = mcpTool.inputSchema || { type: 'object', properties: {} }
      if (typeof mcpParams === 'object' && !mcpParams.type) {
        mcpParams = { type: 'object', ...mcpParams }
      }
      if (typeof mcpParams === 'object' && !mcpParams.properties) {
        mcpParams = { ...mcpParams, properties: {} }
      }
      allTools[uniqueName] = {
        description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
        parameters: mcpParams,
        _mcpServerId: mcpTool.serverId,
        _mcpToolName: mcpTool.name,
      }
    }

    // Build stream options
    let modelInstance = provider(normalizedModelId)

    // Wrap with reasoning middleware if enabled for Claude
    if (enableReasoning && (providerType === 'anthropic' || providerType === 'claude-code')) {
      try {
        modelInstance = ai.wrapLanguageModel({
          model: modelInstance,
          middleware: ai.extractReasoningMiddleware({ tagName: 'thinking' }),
        })
      } catch (e) {
        console.warn('[AI-SDK-Wrapper] Failed to wrap with reasoning middleware:', e)
      }
    }

    const streamOptions = {
      model: modelInstance,
      messages: filteredMessages,
      system,
    }

    // Add tools if provided
    if (Object.keys(allTools).length > 0) {
      // Log raw tools before conversion
      const firstRawToolName = Object.keys(allTools)[0]
      if (firstRawToolName) {
        console.log('[AI-SDK-Wrapper] Raw tool before conversion:', firstRawToolName, JSON.stringify(allTools[firstRawToolName], null, 2))
      }
      const convertedTools = convertTools(allTools, providerType)
      console.log('[AI-SDK-Wrapper] Converted tools count:', Object.keys(convertedTools).length)
      streamOptions.tools = convertedTools
      streamOptions.maxSteps = maxSteps

      // Handle step finish callback
      streamOptions.onStepFinish = async (event) => {
        const stepData = {
          requestId,
          text: event.text,
          toolCalls: [],
          toolResults: [],
        }

        if (event.toolCalls) {
          for (const tc of event.toolCalls) {
            stepData.toolCalls.push({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            })
          }
        }

        if (event.toolResults) {
          for (const tr of event.toolResults) {
            stepData.toolResults.push({
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: tr.result,
            })
          }
        }

        sendToRenderer('ai-sdk:step-finish', stepData)
      }
    }

    // Add reasoning configuration
    if (enableReasoning) {
      if (providerType === 'anthropic' || providerType === 'claude-code') {
        streamOptions.providerOptions = {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 8000,
            },
          },
        }
      } else if (providerType === 'google') {
        const isGemini3 = normalizedModelId.includes('gemini-3')
        streamOptions.providerOptions = {
          google: {
            thinkingConfig: isGemini3
              ? { thinkingLevel: 'high', includeThoughts: true }
              : { thinkingBudget: 8000, includeThoughts: true },
          },
        }
      } else if (providerType === 'openai' || providerType === 'codex') {
        // Add reasoning prompt for OpenAI/Codex
        const reasoningPrompt = '\n\nIMPORTANT: Before providing your answer, first show your thinking process in a <thinking> tag. Reason through the problem step by step, then provide your final answer outside the thinking tag.'
        streamOptions.system = (streamOptions.system || '') + reasoningPrompt
      }
    }

    // Start streaming
    console.log('[AI-SDK-Wrapper] Starting stream for model:', normalizedModelId)
    const result = ai.streamText(streamOptions)

    let fullText = ''
    let fullReasoning = ''
    const allToolCalls = []
    const allToolResults = []

    // Process text stream
    for await (const chunk of result.textStream) {
      fullText += chunk
      sendToRenderer('ai-sdk:text-chunk', { requestId, chunk })
    }

    // Try to get reasoning
    try {
      if ('reasoning' in result) {
        const reasoningResult = await result.reasoning
        if (reasoningResult) {
          if (typeof reasoningResult === 'string') {
            fullReasoning = reasoningResult
          } else if (Array.isArray(reasoningResult)) {
            fullReasoning = reasoningResult
              .map(part => {
                if (typeof part === 'string') return part
                if (part && typeof part === 'object') {
                  return part.thinking || part.content || part.text || ''
                }
                return ''
              })
              .filter(Boolean)
              .join('\n')
          }
        }
      }
    } catch (e) {
      console.log('[AI-SDK-Wrapper] Reasoning not available:', e.message)
    }

    // Await final result
    const finalResult = await result

    // Process steps for tool calls/results (ensure serializable)
    if (Array.isArray(finalResult.steps)) {
      for (const step of finalResult.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            allToolCalls.push({
              toolCallId: String(tc.toolCallId || ''),
              toolName: String(tc.toolName || ''),
              args: JSON.parse(JSON.stringify(tc.args || {})),
            })
          }
        }
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            // Safely serialize result - it may contain non-serializable objects
            let safeResult
            try {
              safeResult = JSON.parse(JSON.stringify(tr.result))
            } catch {
              safeResult = String(tr.result)
            }
            allToolResults.push({
              toolCallId: String(tr.toolCallId || ''),
              toolName: String(tr.toolName || ''),
              result: safeResult,
            })
          }
        }
      }
    }

    // Extract <thinking> tags if reasoning not available
    let finalText = await finalResult.text
    if (!fullReasoning && finalText && enableReasoning) {
      const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/i)
      if (thinkingMatch) {
        fullReasoning = thinkingMatch[1].trim()
        finalText = finalText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
      }
    }

    // Send completion event (ensure all data is serializable)
    sendToRenderer('ai-sdk:complete', {
      requestId,
      text: String(finalText || ''),
      reasoning: fullReasoning || undefined,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      finishReason: String(finalResult.finishReason || 'stop'),
    })

    console.log('[AI-SDK-Wrapper] Stream completed for request:', requestId)

  } catch (error) {
    console.error('[AI-SDK-Wrapper] Stream error:', error)
    sendToRenderer('ai-sdk:error', {
      requestId,
      error: error.message || 'Unknown error',
    })
  }
}

/**
 * Generate (non-streaming) chat completion
 */
async function generateChat(options) {
  const {
    requestId,
    modelId,
    messages,
    providers = {},
    system,
    tools = {},
    maxSteps = 5,
    mcpTools = [],
  } = options

  await initialize()

  const providerType = getProviderForModel(modelId)
  if (!providerType) {
    return { success: false, error: `Unknown model: ${modelId}` }
  }

  let apiKey = ''
  if (providerType !== 'claude-code' && providerType !== 'codex') {
    apiKey = providers[providerType]
    if (!apiKey) {
      return { success: false, error: `No API key for provider: ${providerType}` }
    }
  }

  try {
    const provider = await getProvider(providerType, apiKey)
    const normalizedModelId = normalizeModelId(modelId, providerType)

    const filteredMessages = messages.filter(msg => msg.role !== 'system')

    // Merge tools
    const allTools = { ...tools }
    for (const mcpTool of mcpTools) {
      const uniqueName = `mcp_${mcpTool.serverId}_${mcpTool.name}`
      allTools[uniqueName] = {
        description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
        parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
      }
    }

    const generateOptions = {
      model: provider(normalizedModelId),
      messages: filteredMessages,
      system,
    }

    if (Object.keys(allTools).length > 0) {
      generateOptions.tools = convertTools(allTools, providerType)
      generateOptions.maxSteps = maxSteps
    }

    console.log('[AI-SDK-Wrapper] Generating for model:', normalizedModelId)
    const result = await ai.generateText(generateOptions)

    const toolCalls = []
    const toolResults = []

    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            })
          }
        }
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            toolResults.push({
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: tr.result,
            })
          }
        }
      }
    }

    return {
      success: true,
      text: result.text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      finishReason: result.finishReason,
    }

  } catch (error) {
    console.error('[AI-SDK-Wrapper] Generate error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

// ============================================================================
// MCP Tool Execution
// ============================================================================

/**
 * Execute an MCP tool
 */
async function executeMCPTool(serverId, toolName, args) {
  if (!mcp) {
    mcp = require('./mcp.cjs')
  }

  try {
    const result = await mcp.callTool({ serverId, toolName, arguments: args })
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

/**
 * Register all AI SDK IPC handlers
 */
function registerHandlers() {
  if (!ipcMain) {
    console.error('[AI-SDK-Wrapper] ipcMain is not available - cannot register handlers')
    return
  }

  console.log('[AI-SDK-Wrapper] Registering IPC handlers...')

  // Stream chat completion
  ipcMain.handle('ai-sdk:stream', async (_event, options) => {
    const requestId = options.requestId || require('crypto').randomUUID()
    options.requestId = requestId

    // Start streaming in background
    streamChat(options).catch(error => {
      console.error('[AI-SDK-Wrapper] Stream handler error:', error)
      sendToRenderer('ai-sdk:error', { requestId, error: error.message })
    })

    return { success: true, requestId }
  })

  // Generate (non-streaming) chat completion
  ipcMain.handle('ai-sdk:generate', async (_event, options) => {
    return generateChat(options)
  })

  // Execute MCP tool
  ipcMain.handle('ai-sdk:execute-mcp-tool', async (_event, { serverId, toolName, args }) => {
    return executeMCPTool(serverId, toolName, args)
  })

  // Get supported models
  ipcMain.handle('ai-sdk:get-models', () => {
    return {
      models: Object.keys(MODEL_PROVIDER_MAP),
      providers: [...new Set(Object.values(MODEL_PROVIDER_MAP))],
    }
  })

  // Get provider for model
  ipcMain.handle('ai-sdk:get-provider', (_event, modelId) => {
    return { provider: getProviderForModel(modelId) }
  })

  // Initialize (pre-load modules)
  ipcMain.handle('ai-sdk:initialize', async () => {
    try {
      await initialize()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  console.log('[AI-SDK-Wrapper] IPC handlers registered')
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  initialize,
  setMainWindow,
  registerHandlers,
  getProviderForModel,
  normalizeModelId,
  streamChat,
  generateChat,
  executeMCPTool,
  MODEL_PROVIDER_MAP,
}
