# AI SDK 6 Upgrade Guide

## Overview

Cluso has been upgraded to use **AI SDK 6.0.6**, which introduces powerful new agentic capabilities while maintaining backward compatibility with existing code.

## What's New in AI SDK 6

### ToolLoopAgent - Built-in Agentic Loops

The headline feature of AI SDK 6 is the `ToolLoopAgent` class, which provides:

- **Automatic tool execution loops** - The agent calls tools and processes results automatically
- **Built-in stop conditions** - Control when the loop terminates (step count, task completion, etc.)
- **Type-safe tool definitions** - Full TypeScript support with Zod schemas
- **Step callbacks** - Monitor progress and intermediate results
- **Streaming support** - Stream responses while the agent executes tools

### Key Improvements

1. **No manual loop management** - The SDK handles the agentic loop for you
2. **Better type inference** - Full TypeScript support for tools and results
3. **Flexible stop conditions** - Multiple ways to control when execution stops
4. **Progress tracking** - Built-in callbacks for monitoring steps

## Migration Guide

### Existing Code (Still Supported)

Your existing code using `streamText` and `generateText` continues to work without changes:

```typescript
import { streamText, generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// These still work exactly the same way
const result = await generateText({
  model: anthropic('claude-sonnet-4-5-20250929'),
  messages: [{ role: 'user', content: 'Hello!' }],
})

const stream = streamText({
  model: anthropic('claude-sonnet-4-5-20250929'),
  messages: [{ role: 'user', content: 'Hello!' }],
})
```

### New Agentic Code (Recommended)

For autonomous agents that use tools, migrate to `ToolLoopAgent`:

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// Define tools
const tools = {
  readFile: {
    description: 'Read a file',
    parameters: z.object({
      path: z.string(),
    }),
    execute: async ({ path }) => {
      // Your implementation
      return `Contents of ${path}`
    },
  },
}

// Create agent
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const agent = new ToolLoopAgent({
  id: 'my-agent',
  instructions: 'You are a helpful assistant',
  model: anthropic('claude-sonnet-4-5-20250929'),
  tools,
  stopWhen: stepCountIs(20),
})

// Use it
const result = await agent.generate({
  prompt: 'Read config.json and summarize it',
})
```

## Updated Dependencies

```json
{
  "ai": "^6.0.6",
  "@ai-sdk/anthropic": "^3.0.2",
  "@ai-sdk/google": "^2.0.44",
  "@ai-sdk/openai": "^2.0.74",
  "@ai-sdk/react": "^3.0.6",
  "@ai-sdk/mcp": "^0.0.11"
}
```

## Example: Complete Agent

See `src/lib/agent-loop-example.ts` for a comprehensive example including:

- Tool definitions with Zod schemas
- Non-streaming and streaming usage
- Custom stop conditions
- Progress callbacks
- Type inference
- Abort signal support

## Breaking Changes

None! AI SDK 6 is fully backward compatible. Existing code using `streamText` and `generateText` continues to work.

## When to Use What

### Use `ToolLoopAgent` when:
- Building autonomous agents
- You need automatic tool execution loops
- You want built-in stop conditions
- You need progress tracking

### Use `streamText`/`generateText` when:
- Simple completions without tools
- You need fine-grained control over the loop
- Building chat interfaces with manual tool handling
- Working with existing code that doesn't need agentic features

## Resources

- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Agent Loop Example](../src/lib/agent-loop-example.ts)
- [AI SDK GitHub](https://github.com/vercel/ai)

## Testing

All builds pass after the upgrade:

```bash
npm run build          # ✅ Passes
npm run test           # ✅ Passes
npm -w cluso run build # ✅ Passes
```

## Next Steps

1. Review `src/lib/agent-loop-example.ts` for usage patterns
2. Consider migrating agent-sdk-wrapper.cjs to use ToolLoopAgent
3. Experiment with custom stop conditions for your use cases
4. Add progress tracking to provide better UX feedback
