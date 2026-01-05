# Migrating electron/ai-sdk-wrapper.cjs to ToolLoopAgent

## Current Implementation Status

The `electron/ai-sdk-wrapper.cjs` currently uses **AI SDK 5 patterns** that are fully compatible with AI SDK 6:

```javascript
// Current approach (still works in AI SDK 6)
const result = ai.streamText({
  model: provider(modelId),
  messages,
  tools,
  maxSteps: 5,
  stopWhen: ai.stepCountIs(maxSteps),
})
```

**This code continues to work perfectly in AI SDK 6.** No migration is required.

## Why Consider ToolLoopAgent?

The new `ToolLoopAgent` API offers several advantages:

### 1. **Better Encapsulation**
```javascript
// Old way - configuration scattered across function calls
async function streamChat(options) {
  const result = ai.streamText({
    model: provider(modelId),
    messages,
    tools,
    maxSteps: 5,
    stopWhen: ai.stepCountIs(5),
  })
}

// New way - agent configured once, used many times
const agent = new ToolLoopAgent({
  id: 'cluso-assistant',
  model: provider(modelId),
  tools,
  instructions: systemPrompt,
  stopWhen: stepCountIs(20),
})

await agent.stream({ prompt: userMessage })
```

### 2. **Type Safety**
```javascript
// ToolLoopAgent provides full TypeScript inference
type AgentTools = typeof agent.tools
type AgentResult = Awaited<ReturnType<typeof agent.generate>>
```

### 3. **Reusability**
```javascript
// Create agent once, reuse for multiple conversations
const codingAgent = createCodingAgent()

// Use in different contexts
await codingAgent.generate({ prompt: "Fix bug" })
await codingAgent.stream({ prompt: "Add feature" })
```

### 4. **Built-in Progress Tracking**
```javascript
await agent.stream({
  prompt: userMessage,
  onStepFinish: async (step) => {
    // Automatically called after each agentic step
    sendToRenderer('agent:step-complete', {
      stepCount: step.stepCount,
      toolCalls: step.toolCalls,
    })
  },
})
```

## Should You Migrate?

### ✅ Migrate if:
- You want better code organization
- You're building multiple specialized agents
- You need better TypeScript inference
- You want cleaner progress tracking
- You're starting a new feature

### ⏸️ Don't migrate if:
- Current code works fine for your use case
- You need fine-grained control over each step
- You're maintaining legacy compatibility
- Migration effort > benefit

## Migration Path (Optional)

If you decide to migrate, here's how:

### Step 1: Create Agent Factory

```javascript
// electron/create-agent.cjs
async function createClusoAgent(options) {
  const {
    modelId,
    providerType,
    apiKey,
    tools,
    systemPrompt,
    maxSteps = 20,
  } = options

  await initialize()

  const provider = await getProvider(providerType, apiKey)
  const normalizedModelId = normalizeModelId(modelId, providerType)

  return new ai.ToolLoopAgent({
    id: 'cluso-assistant',
    model: provider(normalizedModelId),
    tools: convertTools(tools, providerType),
    instructions: systemPrompt,
    stopWhen: [
      ai.stepCountIs(maxSteps),
      // Custom: stop when no more tool calls
      (stepResult) => {
        const lastMsg = stepResult.messages[stepResult.messages.length - 1]
        return !lastMsg.toolInvocations?.some(t => t.state === 'call')
      },
    ],
    temperature: 0.7,
    maxTokens: 4096,
  })
}
```

### Step 2: Update streamChat Function

```javascript
async function streamChat(options) {
  const { requestId, modelId, messages, tools, system, maxSteps } = options

  try {
    // Create agent
    const agent = await createClusoAgent({
      modelId,
      providerType: getProviderForModel(modelId),
      apiKey: options.providers[getProviderForModel(modelId)],
      tools,
      systemPrompt: system,
      maxSteps,
    })

    // Stream with agent
    const result = await agent.stream({
      prompt: messages[messages.length - 1].content,

      // Progress tracking
      onStepFinish: async (step) => {
        sendToRenderer('ai-sdk:step-complete', {
          requestId,
          stepCount: step.stepCount,
          toolCalls: step.toolCalls?.length || 0,
        })
      },
    })

    // Stream text chunks
    for await (const chunk of result.textStream) {
      sendToRenderer('ai-sdk:text-chunk', { requestId, chunk })
    }

    // Get final result
    const finalResult = await result

    sendToRenderer('ai-sdk:complete', {
      requestId,
      text: finalResult.text,
      toolCalls: finalResult.toolCalls,
      toolResults: finalResult.toolResults,
      finishReason: finalResult.finishReason,
    })

  } catch (error) {
    sendToRenderer('ai-sdk:error', { requestId, error: error.message })
  }
}
```

### Step 3: Test Thoroughly

```bash
# Test streaming
# Test tool calling
# Test error handling
# Test abort signal
# Test MCP tools
# Test all providers
```

## Current Recommendation

**Keep the existing implementation.** It works perfectly with AI SDK 6 and requires no changes.

Consider migrating to `ToolLoopAgent` only if you:
1. Start building new agent-focused features
2. Need better code organization for multiple agents
3. Want improved TypeScript types

The existing `streamText`/`generateText` approach is **not deprecated** and will continue to be supported.

## References

- [AI SDK 6 Upgrade Guide](./AI_SDK_6_UPGRADE.md)
- [ToolLoopAgent Example](../src/lib/agent-loop-example.ts)
- [Current Implementation](../electron/ai-sdk-wrapper.cjs)
