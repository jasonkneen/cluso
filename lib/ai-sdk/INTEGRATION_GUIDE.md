# Integration Guide - Using the AI SDK Wrapper in Your Project

## Step 1: Import the Wrapper

```typescript
import {
  createAISDKWrapper,
  AISDKWrapper,
  type AISDKWrapperConfig,
  type AITool,
} from 'lib/ai-sdk'
```

## Step 2: Configure Models

Create a configuration with your API providers:

```typescript
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      // apiKey from ANTHROPIC_API_KEY env var
    },
    {
      provider: 'openai',
      modelId: 'gpt-4o',
      // apiKey from OPENAI_API_KEY env var
    },
  ],
  defaultModel: 'claude-3-5-sonnet-20241022',
}
```

## Step 3: Create the Wrapper Instance

For shared use across your app:

```typescript
// Create once at app initialization
const aiWrapper = createAISDKWrapper(config)

// Export for use in other files
export { aiWrapper }
```

For React apps:

```typescript
// In a context or singleton
import { createAISDKWrapper } from 'lib/ai-sdk'

export const AIProvider = ({ children }) => {
  const [wrapper] = useState(() => createAISDKWrapper(config))
  // ...
}
```

## Step 4: Define Your Tools

Create tools specific to your app:

```typescript
import { z } from 'zod'
import type { AITool } from 'lib/ai-sdk'

export const myTools: AITool[] = [
  {
    name: 'fetch_user_data',
    description: 'Fetch user data from the database',
    inputSchema: z.object({
      userId: z.string(),
    }),
    execute: async (input) => {
      const user = await database.getUser(input.userId)
      return user
    },
  },

  {
    name: 'update_settings',
    description: 'Update user settings',
    inputSchema: z.object({
      userId: z.string(),
      settings: z.record(z.any()),
    }),
    execute: async (input) => {
      await database.updateUser(input.userId, input.settings)
      return { success: true }
    },
  },
]
```

## Step 5: Use in Your Code

### Node.js / Express

```typescript
import { aiWrapper } from './ai'
import { myTools } from './tools'

aiWrapper.registerTools(myTools)

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body

    const response = await aiWrapper.generateText(messages)

    res.json(response)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/chat/stream', async (req, res) => {
  try {
    const { messages } = req.query as any

    const stream = await aiWrapper.toReadableStream(
      JSON.parse(messages)
    )

    stream.pipeTo(res)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### React Component

```typescript
import { useAISDK } from 'lib/ai-sdk/react-hook'
import { myTools } from './tools'

export function ChatComponent() {
  const { state, generateText, streamText } = useAISDK({
    models: [{
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
    }],
    tools: myTools,
  })

  const [userMessage, setUserMessage] = useState('')

  const handleSend = async () => {
    try {
      const response = await generateText(userMessage)
      setUserMessage('')
      // Display response
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div>
      <div>
        {state.messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>

      <input
        value={userMessage}
        onChange={(e) => setUserMessage(e.target.value)}
        placeholder="Type a message..."
      />

      <button onClick={handleSend} disabled={state.loading}>
        {state.loading ? 'Loading...' : 'Send'}
      </button>

      {state.error && (
        <div className="error">Error: {state.error.message}</div>
      )}
    </div>
  )
}
```

### Next.js Route Handler

```typescript
// app/api/chat/route.ts
import { aiWrapper } from '@/lib/ai'
import { myTools } from '@/lib/tools'

aiWrapper.registerTools(myTools)

export async function POST(request: Request) {
  const { messages } = await request.json()

  try {
    const response = await aiWrapper.generateText(messages)
    return Response.json(response)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const messages = JSON.parse(searchParams.get('messages') || '[]')

  try {
    const stream = await aiWrapper.toReadableStream(messages)
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

## Step 6: Add Error Handling

```typescript
import {
  RateLimitError,
  AuthenticationError,
  getErrorMessage,
} from 'lib/ai-sdk'

try {
  const response = await aiWrapper.generateText(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, will retry...')
    // Handle rate limit
  } else if (error instanceof AuthenticationError) {
    console.log('Check your API keys')
    // Handle auth error
  } else {
    console.error(getErrorMessage(error as any))
  }
}
```

## Step 7: Configure Advanced Features

### Enable Reasoning (Claude)

```typescript
const config: AISDKWrapperConfig = {
  models: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-7-sonnet-20250219',
    },
  ],
  reasoning: {
    enabled: true,
    budgetTokens: 5000,
  },
}
```

### Enable Automatic Retries

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

### Add Middleware Hooks

```typescript
const config: AISDKWrapperConfig = {
  models: [...],
  middleware: {
    onRequest: (request) => {
      console.log('Sending request with', request.messages.length, 'messages')
    },
    onResponse: (response) => {
      console.log('Used', response.usage.totalTokens, 'tokens')
    },
    onError: (error) => {
      console.error('AI error:', error.message)
      // Send to error tracking service
      Sentry.captureException(error)
    },
  },
}
```

## Step 8: Use OAuth (if available)

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

## Integration Patterns

### Pattern 1: Singleton Wrapper

```typescript
// lib/ai.ts
import { createAISDKWrapper } from 'lib/ai-sdk'

export const aiWrapper = createAISDKWrapper({
  models: [
    { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
  ],
})
```

Use everywhere:
```typescript
import { aiWrapper } from '@/lib/ai'

const response = await aiWrapper.generateText(messages)
```

### Pattern 2: React Context

```typescript
const AIContext = createContext<AISDKWrapper | null>(null)

export function AIProvider({ children }) {
  const [wrapper] = useState(() => createAISDKWrapper(config))

  return (
    <AIContext.Provider value={wrapper}>
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const context = useContext(AIContext)
  if (!context) throw new Error('useAI must be used within AIProvider')
  return context
}
```

Use in components:
```typescript
const wrapper = useAI()
```

### Pattern 3: Per-Request Wrapper

For serverless/lambda functions where state isolation is important:

```typescript
export function createRequestWrapper() {
  return createAISDKWrapper(config)
}
```

### Pattern 4: Tool Factory

```typescript
export function createAppTools(): AITool[] {
  return [
    {
      name: 'search_docs',
      description: 'Search application documentation',
      inputSchema: z.object({ query: z.string() }),
      execute: async (input) => {
        return await searchDocumentation(input.query)
      },
    },
    {
      name: 'execute_command',
      description: 'Execute a shell command',
      inputSchema: z.object({ command: z.string() }),
      execute: async (input) => {
        return await exec(input.command)
      },
    },
  ]
}

// Use
aiWrapper.registerTools(createAppTools())
```

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createAISDKWrapper } from 'lib/ai-sdk'

describe('AI Integration', () => {
  it('should generate text', async () => {
    const wrapper = createAISDKWrapper({
      models: [{
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
      }],
    })

    const response = await wrapper.generateText([
      { role: 'user', content: 'Test' },
    ])

    expect(response.text).toBeTruthy()
  })

  it('should handle errors', async () => {
    const wrapper = createAISDKWrapper({
      models: [{
        provider: 'anthropic',
        modelId: 'invalid-model',
      }],
    })

    await expect(() =>
      wrapper.generateText([{ role: 'user', content: 'Test' }])
    ).rejects.toThrow()
  })
})
```

## Migration Checklist

If migrating from the old `useAIChat.ts`:

- [ ] Move tool definitions to `lib/ai-sdk` format
- [ ] Update import statements to use new wrapper
- [ ] Replace `useAIChat` with `useAISDK` in React components
- [ ] Update error handling to use new error classes
- [ ] Test streaming behavior
- [ ] Test tool calling behavior
- [ ] Update TypeScript types
- [ ] Run full test suite
- [ ] Deploy to staging environment

## Common Issues and Solutions

### Issue: "API key not found"

**Solution**: Ensure environment variables are set:
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

### Issue: Tool validation errors

**Solution**: Ensure Zod schema matches tool execution:
```typescript
inputSchema: z.object({
  query: z.string(), // Must match what execute() expects
})
```

### Issue: Streaming not working in browser

**Solution**: Use `toReadableStream()` for web APIs:
```typescript
const stream = await aiWrapper.toReadableStream(messages)
// Now can pipe to Response or use with fetch
```

### Issue: Rate limited

**Solution**: Enable automatic retries:
```typescript
errors: {
  handleRateLimits: true,
  retryConfig: { maxRetries: 3 }
}
```

## Next Steps

1. Check `BEST_PRACTICES.md` for detailed patterns
2. Review `examples.ts` for code examples
3. Read `ARCHITECTURE.md` for design details
4. Review `README.md` for full API reference

## Support

- Check TypeScript types for method signatures
- See examples in `examples.ts`
- Review test files for usage patterns
- Check AI SDK docs: https://sdk.vercel.ai
