/**
 * AI SDK 6 ToolLoopAgent Example
 *
 * This demonstrates how to use the new ToolLoopAgent API from AI SDK 6
 * for building autonomous agents with tool calling loops.
 *
 * Key features:
 * - Automatic tool execution in a loop
 * - Built-in stop conditions
 * - Step-by-step callbacks
 * - Type-safe tool definitions
 */

import { ToolLoopAgent, stepCountIs, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Define tools with Zod schemas for type safety
 */
const tools = {
  readFile: {
    description: 'Read the contents of a file',
    parameters: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: async ({ path }) => {
      // In a real implementation, this would read from the file system
      return `Contents of ${path}: ...`
    },
  },

  writeFile: {
    description: 'Write content to a file',
    parameters: z.object({
      path: z.string().describe('The path to the file to write'),
      content: z.string().describe('The content to write'),
    }),
    execute: async ({ path, content }) => {
      // In a real implementation, this would write to the file system
      return `Successfully wrote to ${path}`
    },
  },

  searchWeb: {
    description: 'Search the web for information',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      // In a real implementation, this would call a search API
      return `Search results for "${query}": ...`
    },
  },
}

// ============================================================================
// Agent Creation
// ============================================================================

/**
 * Create a ToolLoopAgent with Anthropic's Claude
 */
export function createCodingAgent() {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  })

  return new ToolLoopAgent({
    // Agent identification
    id: 'coding-assistant',

    // Instructions (system prompt)
    instructions: `You are a helpful coding assistant with access to file system tools.
You can read files, write files, and search the web for information.
Always use tools to accomplish tasks rather than just explaining what to do.`,

    // The language model to use
    model: anthropic('claude-sonnet-4-5-20250929'),

    // Tools available to the agent
    tools,

    // Tool choice strategy
    toolChoice: 'auto', // Let the model decide when to use tools

    // Stop conditions - when to stop the loop
    stopWhen: [
      stepCountIs(20), // Stop after 20 steps max
      // Or stop when the last message has no tool calls (task complete)
      (stepResult) => {
        const lastMessage = stepResult.messages[stepResult.messages.length - 1]
        return (
          lastMessage.role === 'assistant' &&
          !lastMessage.toolInvocations?.some(t => t.state === 'call')
        )
      },
    ],

    // Temperature for creativity
    temperature: 0.7,

    // Max tokens per response
    maxTokens: 4096,
  })
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example 1: Non-streaming generation
 */
export async function generateWithAgent() {
  const agent = createCodingAgent()

  const result = await agent.generate({
    prompt: 'Create a simple hello.txt file with "Hello, World!" in it',

    // Optional: Handle step completion
    onStepFinish: async (stepResult) => {
      console.log(`Step ${stepResult.stepCount} finished`)
      console.log('Tool calls:', stepResult.toolCalls?.length || 0)
      console.log('Tool results:', stepResult.toolResults?.length || 0)
    },

    // Optional: Handle final completion
    onFinish: async (result) => {
      console.log('Agent finished!')
      console.log('Final text:', result.text)
      console.log('Total steps:', result.steps?.length || 0)
      console.log('Usage:', result.usage)
    },
  })

  return result
}

/**
 * Example 2: Streaming generation
 */
export async function streamWithAgent() {
  const agent = createCodingAgent()

  const result = await agent.stream({
    prompt: 'Read hello.txt and modify it to say "Hello, AI SDK 6!"',

    // Handle text chunks as they arrive
    onChunk: async (chunk) => {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.textDelta)
      }
    },

    // Handle step completion
    onStepFinish: async (stepResult) => {
      console.log(`\n[Step ${stepResult.stepCount} complete]`)
    },
  })

  // Stream the text
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk)
  }

  // Get final result after streaming
  const finalResult = await result

  return finalResult
}

/**
 * Example 3: With abort signal
 */
export async function generateWithTimeout() {
  const agent = createCodingAgent()

  // Create an abort controller for timeout
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 30000) // 30 second timeout

  try {
    const result = await agent.generate({
      prompt: 'Search the web for the latest TypeScript features and summarize them',
      abortSignal: abortController.signal,
    })

    clearTimeout(timeout)
    return result
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Agent execution timed out')
    }
    throw error
  }
}

// ============================================================================
// Advanced: Custom Stop Conditions
// ============================================================================

/**
 * Create an agent with custom stop conditions
 */
export function createAgentWithCustomStops() {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  })

  return new ToolLoopAgent({
    id: 'advanced-agent',
    instructions: 'You are an advanced coding assistant.',
    model: anthropic('claude-sonnet-4-5-20250929'),
    tools,

    // Multiple stop conditions (ANY can trigger stop)
    stopWhen: [
      // Stop after 10 steps
      stepCountIs(10),

      // Stop if a specific tool was called
      (stepResult) => {
        return stepResult.toolCalls?.some(
          call => call.toolName === 'writeFile'
        ) || false
      },

      // Stop if no more tool calls are pending
      (stepResult) => {
        const lastMessage = stepResult.messages[stepResult.messages.length - 1]
        return (
          lastMessage.role === 'assistant' &&
          !lastMessage.toolInvocations?.some(t => t.state === 'call')
        )
      },
    ],
  })
}

// ============================================================================
// Type Inference
// ============================================================================

/**
 * The agent's types can be inferred
 */
type CodingAgentType = ReturnType<typeof createCodingAgent>

// Infer tool types
type AgentTools = CodingAgentType['tools']

// Use in your application
export async function typedAgentExample() {
  const agent = createCodingAgent()

  // TypeScript knows the exact shape of the result
  const result = await agent.generate({
    prompt: 'Test the typed agent',
  })

  // Access typed properties
  const text: string = result.text
  const steps: typeof result.steps = result.steps
  const usage: typeof result.usage = result.usage

  return { text, steps, usage }
}
