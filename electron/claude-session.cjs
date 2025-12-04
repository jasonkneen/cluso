/**
 * Claude Agent SDK session handler for Claude Code OAuth
 * Uses the Claude Agent SDK to spawn Claude Code CLI which handles OAuth authentication
 */

const { query } = require('@anthropic-ai/claude-agent-sdk')
const { createRequire } = require('module')
const { existsSync } = require('fs')
const path = require('path')

// Model IDs
const FAST_MODEL_ID = 'claude-haiku-4-5-20251001'
const SMART_MODEL_ID = 'claude-sonnet-4-5-20250929'

// Active query session
let querySession = null
let isProcessing = false
let shouldAbortSession = false

// Message queue for the generator
let messageQueue = []
let messageResolver = null
let isAborted = false

/**
 * Resolve the CLI path from the SDK
 */
function resolveClaudeCodeCli() {
  const requireModule = createRequire(__filename)
  const cliPath = requireModule.resolve('@anthropic-ai/claude-agent-sdk/cli.js')

  // Handle asar packed apps
  if (cliPath.includes('app.asar')) {
    const unpackedPath = cliPath.replace('app.asar', 'app.asar.unpacked')
    if (existsSync(unpackedPath)) {
      return unpackedPath
    }
  }
  return cliPath
}

/**
 * Message generator that yields messages from the queue
 */
async function* messageGenerator() {
  while (!isAborted) {
    if (messageQueue.length > 0) {
      const { message, resolve } = messageQueue.shift()
      resolve()
      yield message
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

/**
 * Check if a session is active
 */
function isSessionActive() {
  return isProcessing || querySession !== null
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
    return true
  } catch (error) {
    console.error('Failed to interrupt response:', error)
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
  while (querySession !== null) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  querySession = null
  isProcessing = false
}

/**
 * Start a streaming session with Claude Agent SDK
 * @param {Object} options - Session options
 * @param {string} options.prompt - Initial prompt/message
 * @param {string} options.model - Model to use ('fast' or 'smart')
 * @param {string} options.cwd - Working directory
 * @param {Function} options.onTextChunk - Callback for text chunks
 * @param {Function} options.onToolUse - Callback for tool use
 * @param {Function} options.onToolResult - Callback for tool results
 * @param {Function} options.onComplete - Callback when complete
 * @param {Function} options.onError - Callback for errors
 */
async function startStreamingSession(options) {
  const {
    prompt,
    model = 'smart',
    cwd = process.cwd(),
    onTextChunk,
    onToolUse,
    onToolResult,
    onComplete,
    onError,
  } = options

  if (isProcessing || querySession) {
    throw new Error('Session already active')
  }

  // Reset state
  shouldAbortSession = false
  resetMessageQueue()
  isProcessing = true

  const modelId = model === 'fast' ? FAST_MODEL_ID : SMART_MODEL_ID

  try {
    // Create the query session
    querySession = query({
      prompt: messageGenerator(),
      options: {
        model: modelId,
        maxThinkingTokens: 32_000,
        // Only read project-level config (.mcp.json), NOT user-level (Claude Desktop)
        settingSources: ['project'],
        permissionMode: 'acceptEdits',
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
        pathToClaudeCodeExecutable: resolveClaudeCodeCli(),
        cwd,
        includePartialMessages: true,
      }
    })

    // Push the initial message
    await pushMessage({
      role: 'user',
      content: [{ type: 'text', text: prompt }]
    })

    // Process streaming responses
    for await (const sdkMessage of querySession) {
      if (shouldAbortSession) {
        break
      }

      if (sdkMessage.type === 'stream_event') {
        const streamEvent = sdkMessage.event

        if (streamEvent.type === 'content_block_delta') {
          if (streamEvent.delta.type === 'text_delta') {
            onTextChunk?.(streamEvent.delta.text)
          }
        } else if (streamEvent.type === 'content_block_start') {
          if (streamEvent.content_block.type === 'tool_use') {
            onToolUse?.({
              id: streamEvent.content_block.id,
              name: streamEvent.content_block.name,
              input: streamEvent.content_block.input || {},
            })
          }
        }
      } else if (sdkMessage.type === 'assistant') {
        // Process tool results from assistant messages
        const assistantMessage = sdkMessage.message
        if (assistantMessage.content) {
          for (const block of assistantMessage.content) {
            if (
              typeof block === 'object' &&
              block !== null &&
              'tool_use_id' in block &&
              'content' in block
            ) {
              let contentStr = ''
              if (typeof block.content === 'string') {
                contentStr = block.content
              } else if (block.content) {
                contentStr = JSON.stringify(block.content, null, 2)
              }

              onToolResult?.({
                toolUseId: block.tool_use_id,
                content: contentStr,
                isError: block.is_error || false,
              })
            }
          }
        }
      } else if (sdkMessage.type === 'result') {
        // Final result
        onComplete?.()
      }
    }
  } catch (error) {
    console.error('Error in streaming session:', error)
    onError?.(error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isProcessing = false
    querySession = null
  }
}

/**
 * Send a message to an active session
 */
async function sendMessage(text) {
  if (!querySession) {
    throw new Error('No active session')
  }

  await pushMessage({
    role: 'user',
    content: [{ type: 'text', text }]
  })
}

module.exports = {
  startStreamingSession,
  sendMessage,
  isSessionActive,
  interruptCurrentResponse,
  resetSession,
}
