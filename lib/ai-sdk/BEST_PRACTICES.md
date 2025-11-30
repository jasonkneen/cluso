# AI SDK v5 Wrapper - Best Practices Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Setup](#provider-setup)
3. [Tool Definition & Management](#tool-definition--management)
4. [Streaming Best Practices](#streaming-best-practices)
5. [Tool Calling Patterns](#tool-calling-patterns)
6. [Error Handling & Retries](#error-handling--retries)
7. [Reasoning & Thinking Blocks](#reasoning--thinking-blocks)
8. [Performance Optimization](#performance-optimization)
9. [TypeScript Best Practices](#typescript-best-practices)
10. [Integration Patterns](#integration-patterns)

---

## Architecture Overview

### Provider-Agnostic Design

The wrapper abstracts provider differences, allowing seamless switching between Anthropic, OpenAI, and Google:

```typescript
const config: AISDKWrapperConfig = {
  models: [
    { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
    { provider: 'openai', modelId: 'gpt-4o' },
    { provider: 'google', modelId: 'gemini-2.0-flash' },
  ],
  defaultModel: 'claude-3-5-sonnet-20241022',
}

const wrapper = createAISDKWrapper(config)

// Switch providers at runtime
const claudeResponse = await wrapper.generateText(messages, {
  modelId: 'claude-3-5-sonnet-20241022',
})

const gptResponse = await wrapper.generateText(messages, {
  modelId: 'gpt-4o',
})
```

### Core Components

- **Provider Factory**: Creates and manages language models
- **Tool Manager**: Registers, validates, and executes tools
- **Streaming Handler**: Manages text, tool call, and thinking streams
- **Middleware System**: Handles reasoning, error handling, request/response tracking
- **Error Manager**: Provides retry logic and error classification

---

## Provider Setup

### API Key Management

Always use environment variables for API keys:

```typescript
// .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

```typescript
// Automatic from environment
const config: AISDKWrapperConfig = {
  models: [
    { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
    // Will use ANTHROPIC_API_KEY from environment
  ],
}
```

### OAuth Integration (for Claude Code)

```typescript
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const { accessToken } = await getAccessTokenFromElectron()

  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'X-API-Key': '',
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

### Custom/Self-Hosted Endpoints

```typescript
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'custom',
      modelId: 'my-local-model',
      baseURL: 'http://localhost:8000/api',
      apiKey: 'local-api-key',
    },
  ],
}
```

---

## Tool Definition & Management

### Define Tools with Zod Validation

Always use Zod for runtime validation:

```typescript
const searchTool: AITool = {
  name: 'search_web',
  description: 'Search the internet for information',
  category: 'information',
  tags: ['web', 'search'],
  inputSchema: z.object({
    query: z.string()
      .describe('The search query'),
    limit: z.number()
      .min(1)
      .max(20)
      .default(5)
      .describe('Max results to return'),
    safeSearch: z.boolean()
      .default(true)
      .describe('Enable safe search filtering'),
  }),
  execute: async (input) => {
    // Input is automatically validated by wrapper
    const results = await performWebSearch(input.query, input.limit)
    return results
  },
}
```

### Best Practices for Tool Design

**1. Clear Descriptions**
```typescript
// Good
description: 'Search the web for current information and recent news'

// Bad
description: 'search'
```

**2. Descriptive Input Schemas**
```typescript
// Good
inputSchema: z.object({
  query: z.string()
    .min(1)
    .describe('Search query. Be specific and concise.'),
})

// Bad
inputSchema: z.object({
  q: z.string(),
})
```

**3. Organized Tool Categories**
```typescript
const tools = [
  // Information gathering
  { name: 'search_web', category: 'information' },
  { name: 'get_weather', category: 'information' },

  // File operations
  { name: 'read_file', category: 'file_operations' },
  { name: 'write_file', category: 'file_operations' },

  // Code execution
  { name: 'execute_code', category: 'execution' },
]

// Query by category
const infoTools = wrapper.getToolsByCategory('information')
```

**4. Error Handling in Tools**
```typescript
execute: async (input) => {
  try {
    const result = await someAsyncOperation(input)
    return { success: true, data: result }
  } catch (error) {
    // Return error info, don't throw
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**5. Performance Considerations**
```typescript
// Limit execution time
execute: async (input) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Tool timeout')), 5000)
  )

  const result = async function() {
    // Tool implementation
  }

  return Promise.race([result(), timeout])
}
```

### Tool Registration Patterns

```typescript
// Option 1: Register at wrapper creation
const wrapper = createAISDKWrapper({
  models: [...],
  tools: [searchTool, weatherTool, fileTool],
})

// Option 2: Register after creation
wrapper.registerTools([searchTool, weatherTool])

// Option 3: Register individual tools
wrapper.registerTool(searchTool)

// Option 4: Filter tools per request
const response = await wrapper.generateText(messages, {
  tools: [searchTool, weatherTool], // Only use these
})
```

---

## Streaming Best Practices

### Event-Based Streaming

```typescript
for await (const event of wrapper.streamText(messages)) {
  switch (event.type) {
    case 'text':
      // Accumulate text for display
      updateUI(event.content)
      break

    case 'thinking':
      // Show reasoning process (Claude extended thinking)
      logThinkingBlock(event.content)
      break

    case 'tool-call':
      // Prepare to execute tool
      prepareToolExecution(event.toolName, event.args)
      break

    case 'finish':
      // Handle completion and token usage
      finalizeResponse(event.usage)
      break

    case 'error':
      // Handle streaming errors
      handleError(event.error)
      break
  }
}
```

### Convert to ReadableStream (for Web APIs)

```typescript
// Browser/web server
const stream = await wrapper.toReadableStream(messages)

// Process with fetch
const response = new Response(stream)
return response

// Or handle manually
const reader = stream.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // Process chunk
}
```

### Aggregate Streaming (Get Full Response)

```typescript
// Use when you need complete response before processing
const response = await wrapper.aggregateStream(messages)

console.log('Full text:', response.text)
console.log('Thinking:', response.thinking)
console.log('Tool calls:', response.toolCalls)
console.log('Tokens:', response.usage)
```

### Best Practices

**1. Handle Backpressure**
```typescript
// Slow down streaming if consumer is slow
for await (const event of wrapper.streamText(messages)) {
  if (shouldThrottle()) {
    await new Promise(r => setTimeout(r, 100))
  }
  processEvent(event)
}
```

**2. Implement Cancellation**
```typescript
const controller = new AbortController()

// Cancel after 30 seconds
const timeout = setTimeout(() => controller.abort(), 30000)

try {
  for await (const event of wrapper.streamText(messages, {
    abortSignal: controller.signal,
  })) {
    processEvent(event)
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream cancelled')
  }
} finally {
  clearTimeout(timeout)
}
```

**3. Accumulate Complete Responses**
```typescript
const events: StreamEvent[] = []

for await (const event of wrapper.streamText(messages)) {
  events.push(event)
}

// Now process all events together
const response = await aggregateStreamingEvents(events)
```

---

## Tool Calling Patterns

### Automatic Tool Execution

```typescript
// Model will automatically call tools and continue conversation
const response = await wrapper.streamWithTools(messages, {
  autoExecuteTools: true,
  onToolCall: (toolName, args) => {
    console.log(`Executing: ${toolName}`)
  },
})

console.log('Final response:', response.text)
console.log('All tool calls made:', response.toolCalls)
```

### Manual Tool Execution with Continuation

```typescript
let messages: CoreMessage[] = [
  { role: 'user', content: 'Search for AI news' },
]

// First round - model decides to use tool
let response = await wrapper.generateText(messages)

while (response.toolCalls.length > 0) {
  // Execute tools
  for (const toolCall of response.toolCalls) {
    const result = await wrapper.executeTool(
      toolCall.name,
      toolCall.args
    )

    // Add to conversation
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          args: toolCall.args,
        },
      ],
    })

    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool-result',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
        },
      ],
    })
  }

  // Get next response
  response = await wrapper.generateText(messages)
}

console.log('Final response:', response.text)
```

### Conditional Tool Selection

```typescript
// Different tools for different tasks
const response = await wrapper.generateText(messages, {
  tools: messageContent.includes('weather')
    ? [weatherTool]
    : [searchTool],
})
```

### Tool Call Validation

```typescript
const response = await wrapper.generateText(messages)

for (const toolCall of response.toolCalls) {
  const validation = wrapper.getTool(toolCall.name)
    ? 'valid'
    : 'invalid'

  console.log(`Tool ${toolCall.name}: ${validation}`)
}
```

---

## Error Handling & Retries

### Configure Retry Strategy

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  errors: {
    handleAPIErrors: true,
    handleRateLimits: true,
    handleTimeouts: true,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
  },
}

const wrapper = createAISDKWrapper(config)
```

### Error Handling in Code

```typescript
import {
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
    console.log('Check your API key')
  } else if (error instanceof ValidationError) {
    console.log('Invalid input:', error.validationErrors)
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out')
  } else if (error instanceof APIError) {
    console.log(`API error ${error.statusCode}: ${error.message}`)
  }

  console.log(getErrorMessage(error as any))
}
```

### Middleware Error Tracking

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  middleware: {
    onError: (error) => {
      // Log to monitoring service
      logToSentry({
        message: error.message,
        code: (error as any).code,
        timestamp: new Date(),
      })

      // Notify user if critical
      if (isCritical(error)) {
        showUserNotification('Service temporarily unavailable')
      }
    },
  },
}
```

---

## Reasoning & Thinking Blocks

### Enable Extended Thinking (Claude)

```typescript
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-7-sonnet-20250219', // Use model with thinking
    },
  ],
  reasoning: {
    enabled: true,
    budgetTokens: 5000,
    maxThinkingLength: 3000,
  },
}

const wrapper = createAISDKWrapper(config)
```

### Process Thinking Blocks

```typescript
const response = await wrapper.generateText(messages)

if (response.thinking) {
  console.log('Model reasoning:')
  console.log(response.thinking)
  console.log('\nFinal answer:')
}

console.log(response.text)
```

### Streaming with Thinking

```typescript
for await (const event of wrapper.streamText(messages)) {
  if (event.type === 'thinking') {
    console.log('[THINKING]', event.content)
  } else if (event.type === 'text') {
    console.log('[RESPONSE]', event.content)
  }
}
```

---

## Performance Optimization

### Token Usage Monitoring

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  middleware: {
    onResponse: (response) => {
      const cost = calculateAPICost(
        response.usage.inputTokens,
        response.usage.outputTokens
      )

      console.log(`Tokens: ${response.usage.totalTokens}, Cost: $${cost}`)
    },
  },
}
```

### Tool Statistics

```typescript
const stats = wrapper.getToolStats()

console.log(`Total tool calls: ${stats.totalExecutions}`)
for (const tool of stats.toolStats) {
  console.log(
    `${tool.name}: ${tool.count} calls, ${tool.averageDuration}ms avg`
  )
}
```

### Limit Tools for Faster Processing

```typescript
// Instead of passing all tools
const response = await wrapper.generateText(messages, {
  // Only pass relevant tools
  tools: [searchTool, weatherTool],
})
```

### Batch Processing

```typescript
// Process multiple requests efficiently
const requests = [
  { messages: messages1 },
  { messages: messages2 },
  { messages: messages3 },
]

const results = await Promise.all(
  requests.map(req => wrapper.generateText(req.messages))
)
```

### Cache Responses

```typescript
const cache = new Map<string, GenerationResponse>()

async function cachedGenerate(messages: CoreMessage[]) {
  const key = JSON.stringify(messages)

  if (cache.has(key)) {
    return cache.get(key)!
  }

  const response = await wrapper.generateText(messages)
  cache.set(key, response)
  return response
}
```

---

## TypeScript Best Practices

### Type-Safe Tool Definitions

```typescript
// Define tool input/output types
interface SearchInput {
  query: string
  limit?: number
}

interface SearchOutput {
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
}

// Create typed tool
const searchTool: AITool<SearchInput, SearchOutput> = {
  name: 'search',
  description: 'Search the web',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  execute: async (input) => {
    // input is typed as SearchInput
    return {
      results: [],
    }
  },
}
```

### Use const for Config

```typescript
// Prevents accidental mutation
const CONFIG = {
  models: [
    { provider: 'anthropic' as const, modelId: 'claude-3-5-sonnet-20241022' },
  ],
} as const
```

### Typed Event Handlers

```typescript
async function handleStreamEvent(event: StreamEvent) {
  switch (event.type) {
    case 'text':
      // event.content is string
      displayText(event.content)
      break
    case 'tool-call':
      // event.toolName and event.args are available
      executeToolSafely(event.toolName, event.args)
      break
  }
}
```

---

## Integration Patterns

### React Hook Integration

```typescript
function useAISDK(config: AISDKWrapperConfig) {
  const [wrapper] = useState(() => createAISDKWrapper(config))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateText = useCallback(
    async (messages: CoreMessage[]) => {
      setLoading(true)
      setError(null)

      try {
        return await wrapper.generateText(messages)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [wrapper]
  )

  return { generateText, loading, error }
}
```

### Server Integration

```typescript
// Express.js endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const messages = req.body.messages as CoreMessage[]

    // Stream response
    const stream = await wrapper.toReadableStream(messages)
    stream.pipeTo(res)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### MCP Server Integration

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  mcpServers: [
    {
      name: 'filesystem',
      type: 'stdio',
      command: 'node',
      args: ['mcp-server-filesystem.js'],
    },
    {
      name: 'github',
      type: 'sse',
      url: 'http://localhost:3001/mcp',
    },
  ],
}

wrapper.addMCPTools([/* tools from MCP servers */])
```

---

## Summary Checklist

- [ ] Set up API keys in environment variables
- [ ] Create AISDKWrapperConfig with at least one model
- [ ] Define tools with Zod schemas and descriptions
- [ ] Implement error handling with retry logic
- [ ] Enable reasoning if using Claude extended thinking
- [ ] Monitor token usage and costs
- [ ] Implement proper streaming handlers
- [ ] Use TypeScript for type safety
- [ ] Test with multiple providers
- [ ] Document tool capabilities and limitations
