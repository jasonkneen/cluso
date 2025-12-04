/**
 * Agent SDK Wrapper for Anthropic Models
 *
 * This module provides Agent SDK streaming for Claude models with:
 * - Extended thinking support
 * - Tool input streaming (partial JSON)
 * - Custom file system tools
 * - MCP tool integration
 * - Full streaming events to renderer
 *
 * @module electron/agent-sdk-wrapper
 */

const { query } = require('@anthropic-ai/claude-agent-sdk')
const { createRequire } = require('module')
const { existsSync, promises: fs } = require('fs')
const path = require('path')
const os = require('os')

// Reference to main window for sending events
let mainWindow = null

// Active query session state
let querySession = null
let isProcessing = false
let shouldAbortSession = false

// Message queue for the async generator
let messageQueue = []
let messageResolver = null
let isAborted = false

// Session tracking
let currentSessionId = null
let currentRequestId = null

// Map stream indices to tool IDs
const streamIndexToToolId = new Map()

// ============================================================================
// Model Configuration
// ============================================================================

const ANTHROPIC_MODELS = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5-20250929',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-opus-4-5-20251101': 'claude-opus-4-5-20251101',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5-20251001',
  // Legacy models (fall back to Vercel AI SDK)
  'claude-3-5-sonnet': null,
  'claude-3-5-sonnet-20241022': null,
  'claude-3-opus': null,
  'claude-3-opus-20240229': null,
}

const THINKING_BUDGETS = {
  off: 0,
  low: 1024,
  medium: 4096,
  high: 16384,
  ultra: 65536,
}

/**
 * Check if model supports Agent SDK
 */
function supportsAgentSDK(modelId) {
  const normalized = ANTHROPIC_MODELS[modelId]
  return normalized !== null && normalized !== undefined
}

/**
 * Normalize model ID for Agent SDK
 */
function normalizeModelId(modelId) {
  return ANTHROPIC_MODELS[modelId] || modelId
}

/**
 * Check if model supports extended thinking
 */
function supportsThinking(modelId) {
  if (modelId.includes('haiku')) return false
  return modelId.includes('sonnet-4') || modelId.includes('opus-4')
}

// ============================================================================
// CLI Path Resolution
// ============================================================================

/**
 * Resolve the Claude Code CLI path
 * Prefers the global CLI (which has working auth) over the SDK's bundled CLI
 */
function resolveClaudeCodeCli() {
  // Prefer global claude CLI which has working OAuth auth
  const globalPaths = [
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.npm', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
  ]

  for (const globalPath of globalPaths) {
    if (existsSync(globalPath)) {
      console.log('[Agent-SDK-Wrapper] Using global CLI:', globalPath)
      return globalPath
    }
  }

  // Fall back to SDK's bundled CLI
  const requireModule = createRequire(__filename)
  const cliPath = requireModule.resolve('@anthropic-ai/claude-agent-sdk/cli.js')

  // Handle asar packed apps
  if (cliPath.includes('app.asar')) {
    const unpackedPath = cliPath.replace('app.asar', 'app.asar.unpacked')
    if (existsSync(unpackedPath)) {
      console.log('[Agent-SDK-Wrapper] Using unpacked SDK CLI:', unpackedPath)
      return unpackedPath
    }
  }
  console.log('[Agent-SDK-Wrapper] Using SDK CLI:', cliPath)
  return cliPath
}

// ============================================================================
// Message Generator (Async)
// ============================================================================

/**
 * Wrap a message in the CLI's expected format
 */
function wrapMessage(message) {
  // If message has 'role' and 'content', wrap it in the CLI format
  if (message.role && message.content) {
    return {
      type: message.role, // "user" or "assistant"
      session_id: currentSessionId || '',
      message: {
        role: message.role,
        content: message.content,
      },
      parent_tool_use_id: null,
    }
  }
  // Otherwise return as-is (might already be wrapped)
  return message
}

/**
 * Async generator that yields messages from the queue
 */
async function* messageGenerator() {
  while (!isAborted) {
    if (messageQueue.length > 0) {
      const { message, resolve } = messageQueue.shift()
      resolve()
      yield wrapMessage(message)
    } else {
      // Wait for next message
      await new Promise(resolve => {
        messageResolver = resolve
      })
    }
  }
}

/**
 * Push a message to the queue
 */
function pushMessage(message) {
  return new Promise(resolve => {
    messageQueue.push({ message, resolve })
    if (messageResolver) {
      messageResolver()
      messageResolver = null
    }
  })
}

/**
 * Reset the message queue
 */
function resetMessageQueue() {
  messageQueue = []
  messageResolver = null
  isAborted = false
}

/**
 * Abort the message generator
 */
function abortGenerator() {
  isAborted = true
  if (messageResolver) {
    messageResolver()
    messageResolver = null
  }
}

// ============================================================================
// Window Reference
// ============================================================================

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
// Tool Building
// ============================================================================

/**
 * Build the list of allowed tools
 */
function buildAllowedTools(mcpTools = []) {
  // Base tools from Claude Code
  const baseTools = [
    'Bash',
    'Read',
    'Write',
    'Edit',
    'MultiEdit',
    'Glob',
    'Grep',
    'WebFetch',
    'WebSearch',
    'TodoWrite',
  ]

  // Add MCP tools (format: mcp__<server>__<tool>)
  const mcpToolNames = mcpTools.map(t => `mcp__${t.serverId}__${t.name}`)

  return [...baseTools, ...mcpToolNames]
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT_APPEND = `
**Workspace Context:**
You are working in a coding assistant application with direct file system access.

**Capabilities:**
- Read, write, edit files directly
- Execute bash commands
- Search the web for documentation and solutions
- Use MCP tools when connected

**Important:**
- Always use tools to take action, don't just explain
- When creating files, use Write directly
- When editing files, read first then use Edit
- Execute commands when asked, don't just show them
`

// ============================================================================
// Main Streaming Function
// ============================================================================

/**
 * Stream a chat with Agent SDK
 *
 * @param {Object} options - Stream options
 * @param {string} options.requestId - Unique request ID
 * @param {string} options.modelId - Model ID to use
 * @param {Array} options.messages - Chat messages
 * @param {string} options.system - System prompt
 * @param {number} options.maxThinkingTokens - Thinking budget
 * @param {string} options.projectFolder - Working directory
 * @param {Array} options.mcpTools - MCP tool definitions
 */
async function streamChat(options) {
  const {
    requestId,
    modelId,
    messages = [],
    system = '',
    maxThinkingTokens = 16384,
    projectFolder,
    mcpTools = [],
  } = options

  // Check if already processing - wait for previous session to complete
  if (isProcessing || querySession) {
    console.log('[Agent-SDK-Wrapper] Session already active, cleaning up...')
    // Signal abort to the running session
    shouldAbortSession = true
    abortGenerator()

    // Try to properly interrupt the session
    if (querySession) {
      try {
        await querySession.interrupt()
        console.log('[Agent-SDK-Wrapper] Previous session interrupted')
      } catch (e) {
        console.warn('[Agent-SDK-Wrapper] Could not interrupt session:', e.message)
      }
    }

    // Wait for the session to terminate (max 2 seconds)
    let waitCount = 0
    while ((isProcessing || querySession) && waitCount < 40) {
      await new Promise(resolve => setTimeout(resolve, 50))
      waitCount++
    }

    // Force cleanup if still stuck
    if (isProcessing || querySession) {
      console.log('[Agent-SDK-Wrapper] Force cleaning stale session state')
      isProcessing = false
      querySession = null
    }

    currentRequestId = null
    streamIndexToToolId.clear()
    resetMessageQueue()
  }

  // Validate model support
  if (!supportsAgentSDK(modelId)) {
    sendToRenderer('agent-sdk:error', {
      requestId,
      error: `Model ${modelId} is not supported by Agent SDK. Use Vercel AI SDK.`,
    })
    return
  }

  // Reset state
  shouldAbortSession = false
  resetMessageQueue()
  streamIndexToToolId.clear()
  isProcessing = true
  currentRequestId = requestId
  currentSessionId = require('crypto').randomUUID()

  const normalizedModel = normalizeModelId(modelId)
  const enableThinking = supportsThinking(normalizedModel)
  const thinkingBudget = enableThinking ? maxThinkingTokens : 0

  // Resolve working directory
  let workingDir = process.cwd()
  if (projectFolder && typeof projectFolder === 'string') {
    try {
      const resolved = path.resolve(projectFolder)
      const stats = await fs.stat(resolved)
      if (stats.isDirectory()) {
        workingDir = resolved
      }
    } catch {
      // Keep default
    }
  }

  const cliPath = resolveClaudeCodeCli()
  console.log('[Agent-SDK-Wrapper] Starting stream:', {
    requestId,
    model: normalizedModel,
    thinking: enableThinking,
    thinkingBudget,
    cwd: workingDir,
    mcpTools: mcpTools.length,
    cliPath,
    cliExists: existsSync(cliPath),
  })

  try {
    // Build allowed tools
    const allowedTools = buildAllowedTools(mcpTools)

    // Create the query session
    querySession = query({
      prompt: messageGenerator(),
      options: {
        model: normalizedModel,
        maxThinkingTokens: thinkingBudget,
        // Only read project-level config (.mcp.json), NOT user-level (Claude Desktop)
        // This prevents MCP servers with draft-07 schemas from causing API errors
        settingSources: ['project'],
        permissionMode: 'acceptEdits',
        allowedTools,
        pathToClaudeCodeExecutable: cliPath,
        cwd: workingDir,
        includePartialMessages: true,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: system ? `${system}\n\n${SYSTEM_PROMPT_APPEND}` : SYSTEM_PROMPT_APPEND,
        },
        env: {
          ...process.env,
          // Ensure proper working directory
          PWD: workingDir,
          HOME: os.homedir(),
        },
      },
    })

    // Convert messages to SDK format and push initial prompt
    const userContent = []
    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          userContent.push({ type: 'text', text: msg.content })
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              userContent.push({ type: 'text', text: part.text })
            } else if (part.type === 'image') {
              // Handle both formats:
              // Format 1 (from App.tsx): { type: 'image', image: { base64Data, mimeType } }
              // Format 2 (legacy): { type: 'image', mimeType, data }
              const imageData = part.image?.base64Data || part.data
              const mimeType = part.image?.mimeType || part.mimeType || 'image/png'

              if (imageData) {
                userContent.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: imageData,
                  },
                })
                console.log('[Agent-SDK-Wrapper] Added image to message, mimeType:', mimeType)
              }
            }
          }
        }
      }
    }

    // Push the initial message
    if (userContent.length > 0) {
      await pushMessage({
        role: 'user',
        content: userContent,
      })
    }

    // Process streaming responses
    let fullText = ''
    let fullThinking = ''
    let completeSent = false  // Track if complete event was sent

    for await (const sdkMessage of querySession) {
      if (shouldAbortSession) {
        console.log('[Agent-SDK-Wrapper] Session aborted')
        break
      }

      if (sdkMessage.type === 'stream_event') {
        const event = sdkMessage.event

        // Content block start
        if (event.type === 'content_block_start') {
          const block = event.content_block

          if (block.type === 'thinking') {
            sendToRenderer('agent-sdk:thinking-start', {
              requestId,
              index: event.index,
            })
          } else if (block.type === 'tool_use') {
            // Map stream index to tool ID
            streamIndexToToolId.set(event.index, block.id)
            sendToRenderer('agent-sdk:tool-start', {
              requestId,
              toolCallId: block.id,
              toolName: block.name,
              index: event.index,
            })
          } else if (block.type === 'text') {
            sendToRenderer('agent-sdk:text-start', {
              requestId,
              index: event.index,
            })
          }
        }

        // Content block delta
        else if (event.type === 'content_block_delta') {
          const delta = event.delta

          if (delta.type === 'text_delta') {
            fullText += delta.text
            sendToRenderer('agent-sdk:text-chunk', {
              requestId,
              chunk: delta.text,
            })
          } else if (delta.type === 'thinking_delta') {
            fullThinking += delta.thinking
            sendToRenderer('agent-sdk:thinking-chunk', {
              requestId,
              chunk: delta.thinking,
              index: event.index,
            })
          } else if (delta.type === 'input_json_delta') {
            const toolId = streamIndexToToolId.get(event.index)
            sendToRenderer('agent-sdk:tool-input-delta', {
              requestId,
              toolCallId: toolId || '',
              delta: delta.partial_json,
              index: event.index,
            })
          }
        }

        // Content block stop
        else if (event.type === 'content_block_stop') {
          sendToRenderer('agent-sdk:block-stop', {
            requestId,
            index: event.index,
          })
        }

        // Message stop - AI finished ONE turn (not necessarily the whole session)
        // In agentic mode with tools, the SDK will continue automatically:
        // AI outputs → message_stop → tools execute → results sent back → AI continues
        // So we should NOT abort here - let the agentic loop continue naturally
        else if (event.type === 'message_stop') {
          sendToRenderer('agent-sdk:message-stop', {
            requestId,
          })
          console.log('[Agent-SDK-Wrapper] Message stop - AI turn complete, waiting for tool results or session end')
          // Don't send complete or abort - the SDK manages the agentic loop
        }
      }

      // Assistant message (complete, after streaming)
      else if (sdkMessage.type === 'assistant') {
        const assistantMessage = sdkMessage.message

        if (assistantMessage.content) {
          for (const block of assistantMessage.content) {
            // Tool result block
            if (
              typeof block === 'object' &&
              block !== null &&
              'tool_use_id' in block
            ) {
              let contentStr = ''
              if (typeof block.content === 'string') {
                contentStr = block.content
              } else if (block.content) {
                contentStr = JSON.stringify(block.content, null, 2)
              }

              sendToRenderer('agent-sdk:tool-result', {
                requestId,
                toolCallId: block.tool_use_id,
                result: contentStr,
                isError: block.is_error || false,
              })
            }
          }
        }
      }

      // Error message
      else if (sdkMessage.type === 'error') {
        console.error('[Agent-SDK-Wrapper] SDK error:', sdkMessage.error)
        sendToRenderer('agent-sdk:error', {
          requestId,
          error: sdkMessage.error?.message || 'Unknown SDK error',
        })
      }

      // Result (session complete)
      else if (sdkMessage.type === 'result') {
        console.log('[Agent-SDK-Wrapper] Session result received')
      }
    }

    // Session complete (only if not already sent from message_stop)
    if (!completeSent) {
      sendToRenderer('agent-sdk:complete', {
        requestId,
        text: fullText,
        thinking: fullThinking || undefined,
      })
      completeSent = true
    }

    console.log('[Agent-SDK-Wrapper] Stream completed:', requestId)

  } catch (error) {
    console.error('[Agent-SDK-Wrapper] Stream error:', error)
    console.error('[Agent-SDK-Wrapper] Error stack:', error.stack)
    console.error('[Agent-SDK-Wrapper] Error details:', JSON.stringify({
      message: error.message,
      code: error.code,
      exitCode: error.exitCode,
    }, null, 2))
    sendToRenderer('agent-sdk:error', {
      requestId,
      error: error.message || 'Unknown error',
    })
  } finally {
    isProcessing = false
    querySession = null
    currentRequestId = null
    streamIndexToToolId.clear()
  }
}

// ============================================================================
// Session Control
// ============================================================================

/**
 * Check if a session is active
 */
function isSessionActive() {
  return isProcessing || querySession !== null
}

/**
 * Get current request ID
 */
function getCurrentRequestId() {
  return currentRequestId
}

/**
 * Interrupt the current response
 */
async function interruptCurrentResponse() {
  if (!querySession) {
    return false
  }

  try {
    await querySession.interrupt()
    sendToRenderer('agent-sdk:interrupted', {
      requestId: currentRequestId,
    })
    return true
  } catch (error) {
    console.error('[Agent-SDK-Wrapper] Failed to interrupt:', error)
    return false
  }
}

/**
 * Reset the session
 */
async function resetSession() {
  shouldAbortSession = true
  abortGenerator()
  messageQueue = []

  // Wait for session to terminate
  let waitCount = 0
  while (querySession !== null && waitCount < 100) {
    await new Promise(resolve => setTimeout(resolve, 50))
    waitCount++
  }

  querySession = null
  isProcessing = false
  currentRequestId = null
  streamIndexToToolId.clear()

  console.log('[Agent-SDK-Wrapper] Session reset')
}

/**
 * Send a follow-up message to an active session
 */
async function sendMessage(text) {
  if (!querySession) {
    throw new Error('No active session')
  }

  await pushMessage({
    role: 'user',
    content: [{ type: 'text', text }],
  })
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  setMainWindow,
  streamChat,
  sendMessage,
  isSessionActive,
  getCurrentRequestId,
  interruptCurrentResponse,
  resetSession,
  supportsAgentSDK,
  normalizeModelId,
  supportsThinking,
  ANTHROPIC_MODELS,
}
