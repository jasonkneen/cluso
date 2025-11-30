/**
 * AI SDK Wrapper - Comprehensive Examples
 * Demonstrates all features and best practices
 */

import { z } from 'zod'
import type { CoreMessage } from 'ai'
import {
  AISDKWrapper,
  createAISDKWrapper,
  type AITool,
  type AISDKWrapperConfig,
} from './index'

// ============================================================================
// EXAMPLE 1: Basic Setup with Multiple Providers
// ============================================================================

export function createBasicWrapper(): AISDKWrapper {
  const config: AISDKWrapperConfig = {
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      {
        provider: 'openai',
        modelId: 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
      },
      {
        provider: 'google',
        modelId: 'gemini-2.0-flash',
        apiKey: process.env.GOOGLE_API_KEY,
      },
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
  }

  return createAISDKWrapper(config)
}

// ============================================================================
// EXAMPLE 2: Define Tools with Zod Validation
// ============================================================================

const tools: AITool[] = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    category: 'information',
    inputSchema: z.object({
      location: z.string().describe('The city and state'),
      unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
    }),
    execute: async (input) => {
      // Simulated weather API call
      return {
        location: input.location,
        temperature: 72,
        unit: input.unit,
        conditions: 'Partly Cloudy',
      }
    },
  },

  {
    name: 'search_web',
    description: 'Search the web for information',
    category: 'information',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      limit: z.number().default(5).describe('Number of results'),
    }),
    execute: async (input) => {
      // Simulated web search
      return {
        results: [
          {
            title: 'Example Result',
            url: 'https://example.com',
            snippet: 'Example snippet...',
          },
        ],
      }
    },
  },

  {
    name: 'read_file',
    description: 'Read the contents of a file',
    category: 'file_operations',
    inputSchema: z.object({
      path: z.string().describe('File path to read'),
    }),
    execute: async (input) => {
      // File reading implementation
      return {
        path: input.path,
        content: 'File contents...',
      }
    },
  },

  {
    name: 'write_file',
    description: 'Write content to a file',
    category: 'file_operations',
    inputSchema: z.object({
      path: z.string().describe('File path to write'),
      content: z.string().describe('Content to write'),
      append: z.boolean().default(false),
    }),
    execute: async (input) => {
      // File writing implementation
      return {
        success: true,
        path: input.path,
        bytesWritten: input.content.length,
      }
    },
  },
]

// ============================================================================
// EXAMPLE 3: Basic Text Generation
// ============================================================================

export async function basicTextGeneration() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'What is the weather in San Francisco?',
    },
  ]

  // Generate text response
  const response = await wrapper.generateText(messages)

  console.log('Response:', response.text)
  console.log('Tokens used:', response.usage)
  console.log('Tool calls:', response.toolCalls)

  return response
}

// ============================================================================
// EXAMPLE 4: Streaming Text with Tool Calls
// ============================================================================

export async function streamingWithTools() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Search for AI news and tell me what the weather is like',
    },
  ]

  console.log('Streaming response:')

  for await (const event of wrapper.streamText(messages)) {
    switch (event.type) {
      case 'text':
        process.stdout.write(event.content)
        break
      case 'thinking':
        console.log('[THINKING]', event.content)
        break
      case 'tool-call':
        console.log(`[TOOL CALL] ${event.toolName}:`, event.args)
        break
      case 'finish':
        console.log('\n[FINISH]', event.usage)
        break
    }
  }
}

// ============================================================================
// EXAMPLE 5: Streaming with Automatic Tool Execution
// ============================================================================

export async function streamingWithAutoExecution() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Check the weather and search for technology news',
    },
  ]

  // This will automatically execute tools and continue conversation
  const response = await wrapper.streamWithTools(messages, {
    autoExecuteTools: true,
    onToolCall: (toolName, args) => {
      console.log(`Executing: ${toolName}(${JSON.stringify(args)})`)
    },
  })

  console.log('Final response:', response.text)
  console.log('All tool calls:', response.toolCalls)
}

// ============================================================================
// EXAMPLE 6: Multi-Provider Selection
// ============================================================================

export async function multiProviderExample() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Explain quantum computing',
    },
  ]

  // Use Claude
  console.log('Claude response:')
  const claudeResponse = await wrapper.generateText(messages, {
    modelId: 'claude-3-5-sonnet-20241022',
  })
  console.log(claudeResponse.text)

  // Use GPT-4
  console.log('\nGPT-4 response:')
  const gptResponse = await wrapper.generateText(messages, {
    modelId: 'gpt-4o',
  })
  console.log(gptResponse.text)

  // Use Gemini
  console.log('\nGemini response:')
  const geminiResponse = await wrapper.generateText(messages, {
    modelId: 'gemini-2.0-flash',
  })
  console.log(geminiResponse.text)
}

// ============================================================================
// EXAMPLE 7: Error Handling and Retries
// ============================================================================

export async function errorHandlingExample() {
  const config: AISDKWrapperConfig = {
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
      },
    ],
    errors: {
      handleAPIErrors: true,
      handleRateLimits: true,
      handleTimeouts: true,
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffFactor: 2,
      },
    },
    middleware: {
      onError: (error) => {
        console.error('AI Error:', error.message)
      },
    },
  }

  const wrapper = createAISDKWrapper(config)

  try {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: 'Hello!',
      },
    ]

    const response = await wrapper.generateText(messages)
    console.log('Success:', response.text)
  } catch (error) {
    console.error('Failed after retries:', error)
  }
}

// ============================================================================
// EXAMPLE 8: Reasoning/Thinking Blocks (Claude)
// ============================================================================

export async function reasoningExample() {
  const config: AISDKWrapperConfig = {
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-3-7-sonnet-20250219', // Use model with extended thinking
      },
    ],
    reasoning: {
      enabled: true,
      budgetTokens: 10000,
      maxThinkingLength: 5000,
    },
    middleware: {
      onResponse: (response) => {
        if (response.thinking) {
          console.log('Model thinking:', response.thinking)
        }
      },
    },
  }

  const wrapper = createAISDKWrapper(config)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Solve this math problem: If a car travels at 60mph for 2.5 hours, how far did it go?',
    },
  ]

  const response = await wrapper.generateText(messages)

  console.log('Thinking process:')
  if (response.thinking) {
    console.log(response.thinking)
  }

  console.log('\nFinal answer:')
  console.log(response.text)
}

// ============================================================================
// EXAMPLE 9: Tool Filtering and Limiting
// ============================================================================

export async function toolFilteringExample() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  // Filter tools by category
  const fileTools = wrapper.getToolsByCategory('file_operations')
  console.log('File operation tools:', fileTools.map((t) => t.name))

  // Generate with only specific tools
  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Create a new file called "data.json"',
    },
  ]

  const response = await wrapper.generateText(messages, {
    tools: fileTools,
  })

  console.log('Response:', response.text)
  console.log('Tool calls:', response.toolCalls)
}

// ============================================================================
// EXAMPLE 10: Tool Execution Statistics
// ============================================================================

export async function toolStatsExample() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  // Execute some tools
  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Get the weather and search for news',
    },
  ]

  await wrapper.streamWithTools(messages, {
    autoExecuteTools: true,
  })

  // Get statistics
  const stats = wrapper.getToolStats()
  console.log('Tool execution statistics:')
  console.log(`Total executions: ${stats.totalExecutions}`)
  console.log('Per-tool stats:')

  for (const toolStat of stats.toolStats) {
    console.log(
      `  ${toolStat.name}: ${toolStat.count} calls, ${toolStat.averageDuration.toFixed(2)}ms avg`
    )
  }
}

// ============================================================================
// EXAMPLE 11: Multi-Turn Conversation with State
// ============================================================================

export async function multiTurnConversation() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = []

  // Turn 1
  messages.push({
    role: 'user',
    content: 'What is the weather in New York?',
  })

  let response = await wrapper.generateText(messages)
  messages.push({
    role: 'assistant',
    content: response.text,
  })
  console.log('Turn 1:', response.text)

  // Turn 2
  messages.push({
    role: 'user',
    content: 'How about in Los Angeles?',
  })

  response = await wrapper.generateText(messages)
  messages.push({
    role: 'assistant',
    content: response.text,
  })
  console.log('Turn 2:', response.text)

  // Turn 3
  messages.push({
    role: 'user',
    content: 'Which one is warmer?',
  })

  response = await wrapper.generateText(messages)
  console.log('Turn 3:', response.text)
}

// ============================================================================
// EXAMPLE 12: Custom Middleware
// ============================================================================

export async function customMiddlewareExample() {
  const config: AISDKWrapperConfig = {
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
      },
    ],
    middleware: {
      onRequest: (request) => {
        console.log(`[REQUEST] Messages: ${request.messages.length}`)
        console.log(
          `[REQUEST] Last message: ${JSON.stringify(request.messages.at(-1))}`
        )
      },
      onResponse: (response) => {
        console.log(`[RESPONSE] Tokens: ${response.usage.totalTokens}`)
        console.log(`[RESPONSE] Finish reason: ${response.finishReason}`)
      },
      onError: (error) => {
        console.error(`[ERROR] ${error.message}`)
      },
    },
  }

  const wrapper = createAISDKWrapper(config)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Hello, how are you?',
    },
  ]

  const response = await wrapper.generateText(messages)
  console.log('Response:', response.text)
}

// ============================================================================
// EXAMPLE 13: Streaming to Readable Stream (for web)
// ============================================================================

export async function readableStreamExample() {
  const wrapper = createBasicWrapper()
  wrapper.registerTools(tools)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Tell me about artificial intelligence',
    },
  ]

  // Convert to readable stream for web/server use
  const stream = await wrapper.toReadableStream(messages)

  // Process the stream
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const event = JSON.parse(text)
    console.log('[EVENT]', event)
  }
}

// ============================================================================
// EXAMPLE 14: Provider Features and Capabilities
// ============================================================================

export function capabilitiesExample() {
  const wrapper = createBasicWrapper()

  console.log('Available models:', wrapper.getAvailableModels())

  for (const modelId of wrapper.getAvailableModels()) {
    const capabilities = wrapper.getModelCapabilities(modelId)
    console.log(`\n${modelId}:`)
    console.log(`  Streaming: ${capabilities.supportsStreaming}`)
    console.log(`  Tool Calling: ${capabilities.supportsToolCalling}`)
    console.log(`  Reasoning: ${capabilities.supportsReasoning}`)
    console.log(`  Vision: ${capabilities.supportsVision}`)
    console.log(`  Max Tokens: ${capabilities.maxTokens}`)
    console.log(`  Max Tools: ${capabilities.maxToolsPerRequest}`)
  }
}

// ============================================================================
// EXAMPLE 15: OAuth Integration (from project context)
// ============================================================================

export async function oauthExample(getAccessToken: () => Promise<{ accessToken?: string }>) {
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await getAccessToken()

    const headers = {
      ...init?.headers,
      'Authorization': `Bearer ${token.accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
    } as any

    return fetch(input, { ...init, headers })
  }

  const config: AISDKWrapperConfig = {
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        customFetch,
      },
    ],
  }

  const wrapper = createAISDKWrapper(config)

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Hello!',
    },
  ]

  const response = await wrapper.generateText(messages)
  console.log('OAuth response:', response.text)
}
