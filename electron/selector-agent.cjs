/**
 * Selector Agent - Claude Agent SDK session for element selection
 *
 * Maintains a persistent streaming connection for fast element selection.
 * Supports context priming (sending DOM snapshots proactively) and
 * quick selection requests with pre-loaded context.
 */

const { query } = require('@anthropic-ai/claude-agent-sdk')
const { createRequire } = require('module')
const { existsSync } = require('fs')

// Model IDs - use fast model for selector to minimize latency
const SELECTOR_MODEL_ID = 'claude-haiku-4-5-20251001'

// Session state
let selectorSession = null
let isProcessing = false
let shouldAbortSession = false

// Message queue for the generator
let messageQueue = []
let messageResolver = null
let isAborted = false

// Context state
let currentContext = {
  pageElements: null,
  pageUrl: null,
  pageTitle: null,
  lastPrimedAt: null,
}

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
 * Check if selector session is active
 */
function isSessionActive() {
  return isProcessing || selectorSession !== null
}

/**
 * Get current context state
 */
function getContextState() {
  return {
    isPrimed: currentContext.pageElements !== null,
    pageUrl: currentContext.pageUrl,
    pageTitle: currentContext.pageTitle,
    lastPrimedAt: currentContext.lastPrimedAt,
  }
}

/**
 * System prompt for the selector agent
 */
const SELECTOR_SYSTEM_PROMPT = `You are a precise element selector assistant. Your job is to help identify and select DOM elements based on user descriptions.

When the user describes an element they want to select, you should:
1. Analyze the provided page elements context
2. Identify the most likely matching element(s)
3. Return a CSS selector that uniquely identifies the element
4. Provide brief reasoning for your selection

IMPORTANT RESPONSE FORMAT:
When selecting an element, respond with a JSON object in this exact format:
{
  "selector": "CSS_SELECTOR_HERE",
  "reasoning": "Brief explanation of why this element matches",
  "confidence": 0.0-1.0,
  "alternatives": ["ALTERNATIVE_SELECTOR_1", "ALTERNATIVE_SELECTOR_2"]
}

If no matching element is found, respond with:
{
  "selector": null,
  "reasoning": "Explanation of why no match was found",
  "confidence": 0,
  "suggestions": ["Description of what might work"]
}

Be concise. Prioritize unique selectors using IDs, data attributes, or specific class combinations.
Avoid overly complex selectors that may break with minor page changes.`

/**
 * Initialize the selector agent session
 */
async function initializeSession(options = {}) {
  const {
    cwd = process.cwd(),
    onTextChunk,
    onSelectionResult,
    onError,
    onReady,
  } = options

  if (isProcessing || selectorSession) {
    throw new Error('Selector session already active')
  }

  // Reset state
  shouldAbortSession = false
  resetMessageQueue()
  isProcessing = true

  try {
    // Create the query session
    selectorSession = query({
      prompt: messageGenerator(),
      options: {
        model: SELECTOR_MODEL_ID,
        maxThinkingTokens: 8_000,
        settingSources: ['project'],
        permissionMode: 'acceptEdits',
        allowedTools: [], // Selector agent doesn't need tools, just analysis
        pathToClaudeCodeExecutable: resolveClaudeCodeCli(),
        cwd,
        includePartialMessages: true,
        systemPrompt: SELECTOR_SYSTEM_PROMPT,
      }
    })

    // Signal ready
    onReady?.()

    // Process streaming responses
    let currentResponse = ''

    for await (const sdkMessage of selectorSession) {
      if (shouldAbortSession) {
        break
      }

      if (sdkMessage.type === 'stream_event') {
        const streamEvent = sdkMessage.event

        if (streamEvent.type === 'content_block_delta') {
          if (streamEvent.delta.type === 'text_delta') {
            currentResponse += streamEvent.delta.text
            onTextChunk?.(streamEvent.delta.text)
          }
        } else if (streamEvent.type === 'message_stop') {
          // Parse and emit selection result
          try {
            const result = parseSelectionResult(currentResponse)
            onSelectionResult?.(result)
          } catch (err) {
            console.error('Failed to parse selection result:', err)
            // Still emit raw response
            onSelectionResult?.({ raw: currentResponse, parseError: err.message })
          }
          currentResponse = ''
        }
      } else if (sdkMessage.type === 'result') {
        // Session ended
        break
      }
    }
  } catch (error) {
    console.error('Error in selector session:', error)
    onError?.(error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isProcessing = false
    selectorSession = null
  }
}

/**
 * Parse selection result from agent response
 */
function parseSelectionResult(response) {
  // Try to extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { raw: response, parseError: 'No JSON found in response' }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      selector: parsed.selector || null,
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 0,
      alternatives: parsed.alternatives || [],
      suggestions: parsed.suggestions || [],
    }
  } catch (err) {
    return { raw: response, parseError: err.message }
  }
}

/**
 * Prime the session with page context
 * This sends context without expecting immediate element selection
 */
async function primeContext(context) {
  if (!selectorSession) {
    throw new Error('No active selector session')
  }

  const { pageElements, pageUrl, pageTitle } = context

  // Store context
  currentContext = {
    pageElements,
    pageUrl,
    pageTitle,
    lastPrimedAt: Date.now(),
  }

  // Format context message
  const contextMessage = `CONTEXT UPDATE:
Page URL: ${pageUrl || 'Unknown'}
Page Title: ${pageTitle || 'Unknown'}

Available Page Elements:
${typeof pageElements === 'string' ? pageElements : JSON.stringify(pageElements, null, 2)}

I have updated my context with the current page structure. Ready for element selection requests.`

  await pushMessage({
    role: 'user',
    content: [{ type: 'text', text: contextMessage }]
  })
}

/**
 * Request element selection
 */
async function selectElement(description, options = {}) {
  if (!selectorSession) {
    throw new Error('No active selector session')
  }

  const { includeContext = false, pageElements } = options

  let message = `SELECT ELEMENT:
${description}`

  // Optionally include fresh context with the request
  if (includeContext && pageElements) {
    message += `

CURRENT PAGE ELEMENTS:
${typeof pageElements === 'string' ? pageElements : JSON.stringify(pageElements, null, 2)}`
  }

  await pushMessage({
    role: 'user',
    content: [{ type: 'text', text: message }]
  })
}

/**
 * Send a general message to the session
 */
async function sendMessage(text) {
  if (!selectorSession) {
    throw new Error('No active selector session')
  }

  await pushMessage({
    role: 'user',
    content: [{ type: 'text', text }]
  })
}

/**
 * Reset the selector session
 */
async function resetSession() {
  shouldAbortSession = true
  abortGenerator()
  messageQueue = []
  currentContext = {
    pageElements: null,
    pageUrl: null,
    pageTitle: null,
    lastPrimedAt: null,
  }

  // Wait for session to terminate
  while (selectorSession !== null) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  selectorSession = null
  isProcessing = false
}

/**
 * Interrupt the current response
 */
async function interruptResponse() {
  if (!selectorSession) {
    return false
  }

  try {
    await selectorSession.interrupt()
    return true
  } catch (error) {
    console.error('Failed to interrupt selector response:', error)
    return false
  }
}

module.exports = {
  initializeSession,
  primeContext,
  selectElement,
  sendMessage,
  isSessionActive,
  getContextState,
  resetSession,
  interruptResponse,
}
