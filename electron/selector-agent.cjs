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
const path = require('path')
const os = require('os')

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
      console.log('[SelectorAgent] Using global CLI:', globalPath)
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
      console.log('[SelectorAgent] Using unpacked SDK CLI:', unpackedPath)
      return unpackedPath
    }
  }
  console.log('[SelectorAgent] Using SDK CLI:', cliPath)
  return cliPath
}

/**
 * Wrap a message in the CLI's expected format
 */
function wrapMessage(message) {
  // If message has 'role' and 'content', wrap it in the CLI format
  if (message.role && message.content) {
    return {
      type: message.role, // "user" or "assistant"
      session_id: '',
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
 * Message generator that yields messages from the queue
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
 * System prompt for the UI assistant agent
 */
const SELECTOR_SYSTEM_PROMPT = `You are a creative UI assistant that helps users modify web pages. You can understand various requests and propose creative solutions.

CAPABILITIES:
- Select elements by description (visual, semantic, or structural)
- Suggest style changes (colors, sizes, layouts, animations)
- Propose structural changes (add, remove, rearrange elements)
- Generate code patches for source files
- Execute JavaScript for DOM manipulation

UNDERSTANDING USER INTENT:
Users may ask for things like:
- "Make the header blue" → style change
- "Add a shadow to this card" → style enhancement
- "Move the button to the right" → layout change
- "Make this section look more modern" → creative redesign
- "Select the navigation menu" → element selection
- "Change the text to say X" → content modification
- "Add a hover effect" → interaction enhancement

RESPONSE FORMAT:
For element selection requests, respond with JSON:
{
  "type": "selection",
  "selector": "CSS_SELECTOR",
  "reasoning": "Why this matches",
  "confidence": 0.0-1.0,
  "alternatives": []
}

For modification requests, respond with JSON:
{
  "type": "modification",
  "selector": "TARGET_CSS_SELECTOR",
  "action": "style|content|structure|code",
  "changes": {
    "description": "What will change",
    "css": { "property": "value" },  // for style changes
    "html": "new content",            // for content changes
    "javascript": "code to execute"   // for dynamic changes
  },
  "reasoning": "Why this approach"
}

For creative suggestions:
{
  "type": "suggestion",
  "ideas": [
    { "description": "...", "impact": "low|medium|high" }
  ]
}

BE CREATIVE: Don't just do property swaps. Think about:
- Visual hierarchy and balance
- Modern design patterns
- User experience improvements
- Accessibility enhancements

Be concise but helpful. Propose bold changes when appropriate.`

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
    // Note: Haiku doesn't support thinking, so maxThinkingTokens must be 0
    const cliPath = resolveClaudeCodeCli()
    console.log('[SelectorAgent] Creating session:', {
      model: SELECTOR_MODEL_ID,
      cwd,
      cliPath,
    })
    selectorSession = query({
      prompt: messageGenerator(),
      options: {
        model: SELECTOR_MODEL_ID,
        maxThinkingTokens: 0, // Haiku doesn't support thinking
        settingSources: ['project'],
        permissionMode: 'acceptEdits',
        allowedTools: [], // Selector agent doesn't need tools, just analysis
        pathToClaudeCodeExecutable: cliPath,
        cwd,
        includePartialMessages: true,
        systemPrompt: SELECTOR_SYSTEM_PROMPT,
      }
    })

    // Send initial message to bootstrap the session - required to keep connection alive
    await pushMessage({
      role: 'user',
      content: [{ type: 'text', text: 'Hello, I am the element selector interface. I will send you page contexts and element selection requests. Please respond with JSON format as specified in your instructions. Ready?' }]
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
    console.error('[SelectorAgent] Error in session:', error)
    console.error('[SelectorAgent] Error stack:', error?.stack)
    console.error('[SelectorAgent] Error details:', JSON.stringify({
      message: error?.message,
      code: error?.code,
      exitCode: error?.exitCode,
    }, null, 2))
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
