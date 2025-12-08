/**
 * Cluso Agent Service
 *
 * Connects to a fast local LLM (Qwen 2.5) to control Cluso's UI.
 * The agent understands the app's capabilities and can highlight,
 * click, and orchestrate UI elements for demos and guidance.
 */

import { APP_KNOWLEDGE } from '../hooks/useAppControl'

// Local model configuration - pool of 4 instances for parallel execution (~4x throughput)
const LOCAL_MODEL_URL = 'http://127.0.0.1:1234/v1/chat/completions'
const MODEL_POOL = [
  'qwen2.5-0.5b-instruct-mlx',
  'qwen2.5-0.5b-instruct-mlx:2',
  'qwen2.5-0.5b-instruct-mlx:3',
  'qwen2.5-0.5b-instruct-mlx:4'
]
let modelIndex = 0

// Round-robin model selection for load distribution
function getNextModel(): string {
  const model = MODEL_POOL[modelIndex]
  modelIndex = (modelIndex + 1) % MODEL_POOL.length
  return model
}

// Tool definitions for UI control
const UI_CONTROL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'highlight_element',
      description: 'Highlight a UI element to draw user attention. Use for guiding users or demos.',
      parameters: {
        type: 'object',
        properties: {
          element: {
            type: 'string',
            description: 'Element ID: connect-button, video-button, screen-button, inspector-button, move-button, devtools-button, chat-input, send-button, url-bar, disconnect-button'
          },
          color: { type: 'string', description: 'Highlight color (default: blue). Options: blue, green, red, orange, purple' },
          label: { type: 'string', description: 'Optional label to show above the element' },
          duration: { type: 'number', description: 'Duration in ms (default: 3000)' }
        },
        required: ['element']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click_element',
      description: 'Click a UI element button',
      parameters: {
        type: 'object',
        properties: {
          element: {
            type: 'string',
            description: 'Element ID to click'
          }
        },
        required: ['element']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_tooltip',
      description: 'Show an informational tooltip near a UI element',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Element ID' },
          message: { type: 'string', description: 'Tooltip message' },
          position: { type: 'string', enum: ['top', 'bottom', 'left', 'right'], description: 'Tooltip position' }
        },
        required: ['element', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Type text into an input field with typewriter effect',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Input element ID (chat-input or url-bar)' },
          text: { type: 'string', description: 'Text to type' }
        },
        required: ['element', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'speak',
      description: 'Speak a message using text-to-speech for narration',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to speak aloud' }
        },
        required: ['message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Pause for a duration before next action',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: 'Duration in milliseconds' }
        },
        required: ['duration']
      }
    }
  }
]

// System prompt with full app knowledge
const SYSTEM_PROMPT = `You are Cluso Agent - an AI assistant that controls the Cluso application UI.

${APP_KNOWLEDGE}

## Available UI Elements
You can interact with these elements using their IDs:
- connect-button: Start voice streaming with AI
- disconnect-button: Stop voice streaming
- video-button: Toggle camera feed
- screen-button: Toggle screen sharing
- inspector-button: Toggle element inspector mode
- move-button: Toggle move/resize mode
- devtools-button: Open browser DevTools
- chat-input: Main chat text input
- send-button: Send chat message
- url-bar: URL navigation input

## Your Role
1. Guide users through features when asked
2. Demonstrate capabilities with highlight + tooltip + speak
3. Execute demo sequences for presentations
4. Answer questions about how to use features
5. Control the UI to help users accomplish tasks

## Important Rules
- ALWAYS use tools to interact with UI - don't just describe
- Highlight before clicking to show users what will happen
- Use speak() to narrate what you're doing
- Use wait() between actions so users can follow
- Be concise and helpful

When showing how to do something:
1. speak() what you're about to demonstrate
2. highlight_element() the relevant button with a label
3. wait() a moment
4. click_element() if appropriate
5. Repeat for multi-step workflows`

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

export interface ClusoAgentCallbacks {
  onHighlight: (element: string, options?: { color?: string; label?: string; duration?: number }) => void
  onClick: (element: string) => void
  onTooltip: (element: string, message: string, position?: string) => void
  onType: (element: string, text: string) => Promise<void>
  onSpeak: (message: string) => void
  onWait: (duration: number) => Promise<void>
}

export class ClusoAgent {
  private messages: AgentMessage[] = []
  private callbacks: ClusoAgentCallbacks
  private isProcessing = false

  constructor(callbacks: ClusoAgentCallbacks) {
    this.callbacks = callbacks
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  }

  async chat(userMessage: string): Promise<string> {
    if (this.isProcessing) {
      return 'Already processing a request...'
    }

    this.isProcessing = true
    this.messages.push({ role: 'user', content: userMessage })

    try {
      let response = await this.callModel()
      let iterations = 0
      const maxIterations = 10

      // Handle tool calls in a loop
      while (response.tool_calls && response.tool_calls.length > 0 && iterations < maxIterations) {
        iterations++

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments)
          const result = await this.executeTool(toolCall.function.name, args)

          // Add tool result to messages
          this.messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          })
        }

        // Get next response
        response = await this.callModel()
      }

      // Add final assistant message
      if (response.content) {
        this.messages.push({ role: 'assistant', content: response.content })
      }

      return response.content || 'Done!'

    } catch (error) {
      console.error('[ClusoAgent] Error:', error)
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      this.isProcessing = false
    }
  }

  private async callModel(): Promise<{ content: string; tool_calls?: AgentMessage['tool_calls'] }> {
    const response = await fetch(LOCAL_MODEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getNextModel(),
        messages: this.messages,
        tools: UI_CONTROL_TOOLS,
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error(`Model API error: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices[0]?.message

    if (!message) {
      throw new Error('No message in response')
    }

    // Add assistant message with tool calls to history
    if (message.tool_calls?.length) {
      this.messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls
      })
    }

    return {
      content: message.content || '',
      tool_calls: message.tool_calls
    }
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    console.log(`[ClusoAgent] Executing tool: ${name}`, args)

    try {
      switch (name) {
        case 'highlight_element':
          this.callbacks.onHighlight(
            args.element as string,
            {
              color: args.color as string,
              label: args.label as string,
              duration: args.duration as number
            }
          )
          return { success: true, message: `Highlighted ${args.element}` }

        case 'click_element':
          this.callbacks.onClick(args.element as string)
          return { success: true, message: `Clicked ${args.element}` }

        case 'show_tooltip':
          this.callbacks.onTooltip(
            args.element as string,
            args.message as string,
            args.position as string
          )
          return { success: true, message: `Showed tooltip on ${args.element}` }

        case 'type_text':
          await this.callbacks.onType(args.element as string, args.text as string)
          return { success: true, message: `Typed in ${args.element}` }

        case 'speak':
          this.callbacks.onSpeak(args.message as string)
          return { success: true, message: 'Speaking' }

        case 'wait':
          await this.callbacks.onWait(args.duration as number)
          return { success: true, message: `Waited ${args.duration}ms` }

        default:
          return { success: false, message: `Unknown tool: ${name}` }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tool execution failed'
      }
    }
  }

  reset() {
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  }
}

// Singleton instance creator
let agentInstance: ClusoAgent | null = null

export function createClusoAgent(callbacks: ClusoAgentCallbacks): ClusoAgent {
  agentInstance = new ClusoAgent(callbacks)
  return agentInstance
}

export function getClusoAgent(): ClusoAgent | null {
  return agentInstance
}
