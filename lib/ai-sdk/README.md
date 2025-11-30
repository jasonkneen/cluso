# AI SDK v5 Wrapper - Production-Ready Implementation

A comprehensive, type-safe wrapper around the Vercel AI SDK v5 that provides a unified interface for multiple AI providers, streaming, tool calling, and advanced features like reasoning/thinking blocks.

## Features

- **Multi-Provider Support**: Seamless integration with Anthropic (Claude), OpenAI, Google Gemini, and custom providers
- **Streaming Support**: Full support for text streaming, tool call streaming, and thinking blocks
- **Tool Management**: Type-safe tool definitions with Zod validation, automatic tool execution
- **Error Handling**: Sophisticated error handling with exponential backoff retry logic
- **Reasoning Middleware**: Extract and handle thinking/reasoning blocks (Claude extended thinking)
- **Middleware System**: Request/response hooks, error tracking, token monitoring
- **React Hooks**: Easy integration into React applications with state management
- **MCP Support**: Model Context Protocol server integration
- **TypeScript**: Full type safety with comprehensive type definitions

## Installation

The wrapper is included in this project. No additional installation needed.

## Quick Start

### Basic Setup

```typescript
import { createAISDKWrapper, type AISDKWrapperConfig } from 'lib/ai-sdk'

// Configure with your API keys
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  ],
  defaultModel: 'claude-3-5-sonnet-20241022',
}

const wrapper = createAISDKWrapper(config)

// Generate text
const response = await wrapper.generateText([
  { role: 'user', content: 'Hello!' },
])

console.log(response.text)
```

### Stream Text

```typescript
// Stream events
for await (const event of wrapper.streamText(messages)) {
  if (event.type === 'text') {
    process.stdout.write(event.content)
  }
}

// Or convert to readable stream (for web)
const stream = await wrapper.toReadableStream(messages)
const response = new Response(stream)
```

### Use Tools

```typescript
import { z } from 'zod'
import type { AITool } from 'lib/ai-sdk'

const searchTool: AITool = {
  name: 'search_web',
  description: 'Search the internet for information',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async (input) => {
    const results = await performWebSearch(input.query)
    return results
  },
}

wrapper.registerTool(searchTool)

// Tools are automatically available to the model
const response = await wrapper.generateText([
  { role: 'user', content: 'Search for AI news' },
])
```

### React Integration

```typescript
import { useAISDK } from 'lib/ai-sdk/react-hook'

function ChatComponent() {
  const { state, generateText, streamText } = useAISDK({
    models: [{
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
    }],
  })

  const handleSend = async (message: string) => {
    const response = await generateText(message)
    console.log(response.text)
  }

  return (
    <div>
      <p>Messages: {state.messages.length}</p>
      <button onClick={() => handleSend('Hello!')}>Send</button>
      {state.loading && <p>Loading...</p>}
      {state.error && <p>Error: {state.error.message}</p>}
    </div>
  )
}
```

## Configuration

### AISDKWrapperConfig

```typescript
interface AISDKWrapperConfig {
  // Required: List of model configurations
  models: ModelConfig[]

  // Optional: Which model to use by default
  defaultModel?: string

  // Optional: Tools available to models
  tools?: AITool[]

  // Optional: MCP servers to integrate
  mcpServers?: MCPServerConfig[]

  // Optional: Reasoning/thinking configuration
  reasoning?: {
    enabled?: boolean
    budgetTokens?: number
    maxThinkingLength?: number
  }

  // Optional: Error handling configuration
  errors?: {
    handleAPIErrors?: boolean
    handleRateLimits?: boolean
    handleTimeouts?: boolean
    retryConfig?: {
      maxRetries?: number
      initialDelayMs?: number
      maxDelayMs?: number
      backoffFactor?: number
    }
  }

  // Optional: Middleware hooks
  middleware?: {
    onRequest?: (request) => void
    onResponse?: (response) => void
    onError?: (error) => void
  }
}
```

### Model Configuration

```typescript
interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  modelId: string

  // Optional: API key (falls back to environment variable)
  apiKey?: string

  // Optional: Custom endpoint (for self-hosted)
  baseURL?: string

  // Optional: Custom fetch implementation (for OAuth, proxies, etc)
  customFetch?: typeof fetch
}
```

## API Reference

### AISDKWrapper

Main class for all AI SDK operations.

#### Methods

**generateText(messages, options)**
```typescript
const response = await wrapper.generateText(messages, {
  temperature: 0.7,
  maxTokens: 1000,
  tools: [searchTool],
})

// Returns GenerationResponse
console.log(response.text)
console.log(response.toolCalls)
console.log(response.usage)
```

**streamText(messages, options)**
```typescript
for await (const event of wrapper.streamText(messages)) {
  // event.type: 'text' | 'thinking' | 'tool-call' | 'finish' | 'error'
}
```

**streamWithTools(messages, options)**
```typescript
const response = await wrapper.streamWithTools(messages, {
  autoExecuteTools: true,
  onToolCall: (toolName, args) => console.log(`Calling ${toolName}`),
})
```

**toReadableStream(messages, options)**
```typescript
const stream = await wrapper.toReadableStream(messages)
// Returns ReadableStream<string> for web/server use
```

**registerTool(tool) / registerTools(tools)**
```typescript
wrapper.registerTool(searchTool)
wrapper.registerTools([searchTool, weatherTool])
```

**getTool(name)**
```typescript
const tool = wrapper.getTool('search_web')
```

**getAllTools()**
```typescript
const tools = wrapper.getAllTools()
```

**getToolsByCategory(category)**
```typescript
const informationTools = wrapper.getToolsByCategory('information')
```

**executeTool(toolName, args)**
```typescript
const result = await wrapper.executeTool('search_web', {
  query: 'AI news',
})
```

**getModelCapabilities(modelId)**
```typescript
const caps = wrapper.getModelCapabilities('claude-3-5-sonnet-20241022')
console.log(caps.supportsReasoning) // true
console.log(caps.supportsToolCalling) // true
```

**getToolStats()**
```typescript
const stats = wrapper.getToolStats()
console.log(`Total executions: ${stats.totalExecutions}`)
```

**getAvailableModels()**
```typescript
const models = wrapper.getAvailableModels()
```

## Tool Definition

Define tools with Zod schemas for type safety and validation:

```typescript
import { z } from 'zod'
import type { AITool } from 'lib/ai-sdk'

const tool: AITool = {
  // Required fields
  name: 'search_web',
  description: 'Search the internet for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Max results'),
  }),
  execute: async (input) => {
    // input is automatically validated by Zod
    return await performSearch(input.query, input.limit)
  },

  // Optional fields
  category: 'information',
  tags: ['search', 'web'],
}
```

## Streaming

### Event Types

```typescript
type StreamEvent =
  | { type: 'text'; content: string }                    // Text chunk
  | { type: 'thinking'; content: string }               // Thinking/reasoning
  | { type: 'tool-call'; toolName: string; args: unknown } // Tool invocation
  | { type: 'finish'; usage?: TokenUsage }              // Stream complete
  | { type: 'error'; error: Error }                     // Error occurred
```

### Example: Process Events

```typescript
for await (const event of wrapper.streamText(messages)) {
  switch (event.type) {
    case 'text':
      updateUIWithText(event.content)
      break
    case 'thinking':
      showReasoningProcess(event.content)
      break
    case 'tool-call':
      console.log(`Will execute: ${event.toolName}`)
      break
    case 'finish':
      console.log(`Tokens used: ${event.usage?.totalTokens}`)
      break
  }
}
```

## Error Handling

### Error Classes

```typescript
import {
  AISDKError,
  APIError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
  getErrorMessage,
} from 'lib/ai-sdk'

try {
  const response = await wrapper.generateText(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}ms`)
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key')
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out')
  }

  console.log(getErrorMessage(error))
}
```

### Automatic Retries

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  errors: {
    handleAPIErrors: true,
    handleRateLimits: true,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
    },
  },
}
```

## Reasoning & Thinking Blocks

For Claude models with extended thinking:

```typescript
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-7-sonnet-20250219', // Use thinking model
    },
  ],
  reasoning: {
    enabled: true,
    budgetTokens: 5000,
  },
}

const wrapper = createAISDKWrapper(config)

const response = await wrapper.generateText(messages)

if (response.thinking) {
  console.log('Model reasoning:')
  console.log(response.thinking)
}

console.log('Final answer:')
console.log(response.text)
```

## React Hooks

### useAISDK

Main hook for AI operations:

```typescript
const {
  state,              // { loading, error, messages, currentResponse }
  generateText,       // Generate complete response
  streamText,         // Stream response with events
  streamWithTools,    // Stream with automatic tool execution
  addMessage,         // Add message to history
  clearMessages,      // Clear all messages
  registerTool,       // Register a tool
  getAllTools,        // Get all tools
} = useAISDK(config)
```

### useChatHistory

Persist chat messages to localStorage:

```typescript
const { messages, clearHistory } = useChatHistory(sdk, {
  maxMessages: 50,
  storageKey: 'my_chat',
})
```

### useStreaming

Enhanced streaming with visual feedback:

```typescript
const {
  displayedText,      // Streamed text so far
  displayedThinking,  // Thinking process
  streamWithDisplay,  // Method to start streaming
  resetDisplay,       // Reset displayed content
} = useStreaming(sdk, {
  chunkSize: 1,      // Display 1 character at a time
  delayMs: 50,       // Wait 50ms between chunks
})
```

### useToolExecution

Track tool execution:

```typescript
const {
  executingTools,     // Set of currently executing tools
  toolResults,        // Map of tool results
  executeTool,        // Execute a tool
  isExecuting,        // Check if tool is executing
  getToolResult,      // Get result of a tool
} = useToolExecution(sdk)
```

## Provider-Specific Features

### Anthropic (Claude)

- Extended thinking/reasoning blocks
- Vision capabilities
- Large context windows (up to 200K tokens)
- Excellent tool use

### OpenAI (GPT)

- GPT-4o vision capabilities
- Function calling
- Consistent API

### Google (Gemini)

- Large context window (1M tokens)
- Multimodal support
- Cost-effective

## Advanced Usage

### Multiple Providers with Failover

```typescript
const config: AISDKWrapperConfig = {
  models: [
    { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
    { provider: 'openai', modelId: 'gpt-4o' },
  ],
}

const wrapper = createAISDKWrapper(config)

// Try with Claude first, fall back to GPT-4 on error
try {
  const response = await wrapper.generateText(messages)
} catch (error) {
  const response = await wrapper.generateText(messages, {
    modelId: 'gpt-4o',
  })
}
```

### OAuth Integration

```typescript
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = await getAccessTokenFromElectron()
  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
  })
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
```

### Token Monitoring

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  middleware: {
    onResponse: (response) => {
      const costUSD = calculateCost(
        response.usage.inputTokens,
        response.usage.outputTokens
      )
      console.log(`Cost: $${costUSD}`)
    },
  },
}
```

## File Structure

```
lib/ai-sdk/
├── index.ts              # Main export and AISDKWrapper class
├── types.ts              # TypeScript type definitions
├── provider-factory.ts   # Model creation and management
├── tool-manager.ts       # Tool registration and execution
├── streaming.ts          # Streaming utilities
├── middleware.ts         # Request/response middleware
├── error-handling.ts     # Error classes and retry logic
├── react-hook.ts         # React hooks integration
├── examples.ts           # Comprehensive examples
├── BEST_PRACTICES.md     # Best practices guide
└── README.md             # This file
```

## Testing

Example test structure:

```typescript
import { createAISDKWrapper } from 'lib/ai-sdk'
import { describe, it, expect } from 'vitest'

describe('AISDKWrapper', () => {
  it('should generate text', async () => {
    const wrapper = createAISDKWrapper({
      models: [{
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
      }],
    })

    const response = await wrapper.generateText([
      { role: 'user', content: 'Hello' },
    ])

    expect(response.text).toBeTruthy()
    expect(response.usage).toBeDefined()
  })
})
```

## Performance Tips

1. **Reuse wrapper instance**: Don't create new wrappers for each request
2. **Limit tools**: Only pass relevant tools to reduce token usage
3. **Use appropriate models**: Claude for reasoning, GPT-4 for cost
4. **Stream for UX**: Stream responses for better perceived performance
5. **Cache responses**: Implement caching for repeated queries
6. **Monitor tokens**: Track token usage and costs

## Migration from Previous Versions

If you're migrating from the old `useAIChat.ts`:

```typescript
// Old way
import { useAIChat } from 'hooks/useAIChat'

// New way
import { useAISDK } from 'lib/ai-sdk/react-hook'
import { createAISDKWrapper } from 'lib/ai-sdk'

// Create wrapper (once, at app level)
const wrapper = createAISDKWrapper({
  models: [/* ... */],
})

// Use in components
const { generateText, streamText } = useAISDK(config)
```

## Support and Documentation

- See `BEST_PRACTICES.md` for detailed patterns and examples
- See `examples.ts` for 15+ complete code examples
- Check AI SDK docs: https://sdk.vercel.ai/docs

## License

Same as the main project.
