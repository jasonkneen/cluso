# AI SDK Wrapper - Architecture & Design Decisions

## Overview

This document explains the architecture, design decisions, and rationale behind the AI SDK v5 wrapper implementation.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Application                         │
│                   (React, Server, etc)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    AISDKWrapper                              │
│              (Main Public Interface)                         │
└────────────┬───────────────┬───────────────┬────────────────┘
             │               │               │
        ┌────▼───┐      ┌────▼───┐      ┌────▼────┐
        │Provider │      │  Tool  │      │ Streaming
        │Factory  │      │ Manager│      │ Handler
        └────┬───┘      └────┬───┘      └────┬────┘
             │               │               │
        ┌────▼──────────────▼───────────────▼────┐
        │      Middleware System                  │
        │  (Reasoning, Error, Tracking, etc)     │
        └────────┬───────────────────────────────┘
                 │
         ┌───────▼──────────┐
         │ Error Handling   │
         │ (Retries, etc)   │
         └───────┬──────────┘
                 │
    ┌────────────▼────────────────┐
    │   Language Model Providers  │
    │  (Anthropic/OpenAI/Google)  │
    └────────────────────────────┘
```

## Component Design

### 1. AISDKWrapper (index.ts)

**Purpose**: Main orchestrator class that provides the unified API.

**Responsibilities**:
- Model management (creation, selection, switching)
- Tool registration and execution
- Streaming and generation orchestration
- State management (messages, current response)
- Middleware application

**Design Pattern**: Facade pattern - simplifies complex subsystem interactions.

**Key Methods**:
```typescript
generateText()      // Non-streaming generation
streamText()        // Streaming with events
streamWithTools()   // Auto-executing tools
registerTool()      // Add tool definitions
getTool()           // Retrieve tools
```

### 2. Provider Factory (provider-factory.ts)

**Purpose**: Abstract provider differences and create language models.

**Responsibilities**:
- Create providers (Anthropic, OpenAI, Google, custom)
- Validate API keys and configuration
- Get provider capabilities/features
- Handle custom endpoints

**Design Pattern**: Factory pattern - creates objects based on configuration.

**Key Functions**:
```typescript
createLanguageModel()      // Create model from config
createModelMap()           // Create multiple models
getProviderFeatures()      // Get capabilities
validateModelConfig()      // Validate configuration
```

**Why This Approach**:
- Abstracts provider-specific initialization
- Allows runtime provider switching
- Centralizes capability information
- Handles API key management

### 3. Tool Manager (tool-manager.ts)

**Purpose**: Manage tool definitions and execution with validation.

**Responsibilities**:
- Register/retrieve tools
- Convert to AI SDK format
- Validate tool inputs against schemas
- Execute tools with error handling
- Track execution statistics
- Organize tools by category

**Design Pattern**: Composite pattern - manages collections of tools.

**Key Methods**:
```typescript
registerTool()          // Register single tool
registerTools()         // Register multiple
validateToolCall()      // Validate against schema
executeTool()           // Execute with validation
getExecutionStats()     // Track metrics
```

**Key Features**:
- Zod schema validation before execution
- Execution tracking (count, duration, errors)
- Category-based organization
- Automatic error handling

### 4. Streaming Handler (streaming.ts)

**Purpose**: Manage all streaming operations and event generation.

**Responsibilities**:
- Stream text from models
- Extract and yield thinking blocks
- Handle tool call streaming
- Convert between stream formats
- Aggregate streaming events
- Auto-execute tools in conversation flow

**Design Pattern**: Generator pattern - yields events asynchronously.

**Key Functions**:
```typescript
streamModelResponse()           // Core streaming
generateModelResponse()         // Non-streaming
aggregateStreamingEvents()      // Collect all events
streamWithToolExecution()       // Auto tool execution
parseStreamingEvents()          // Convert readable stream
```

**Stream Event Flow**:
```
Model API
   ↓
streamText → [text event, thinking event, tool-call event]
   ↓
Application processes events
   ↓
Optional: Auto-execute tools and continue
```

### 5. Middleware System (middleware.ts)

**Purpose**: Apply cross-cutting concerns like reasoning, error handling, tracking.

**Responsibilities**:
- Extract thinking blocks (Claude extended thinking)
- Track requests/responses
- Handle errors with retry logic
- Count tokens
- Validate tools
- Compose multiple middleware

**Design Pattern**: Decorator/Middleware pattern - wraps models.

**Key Functions**:
```typescript
createThinkingMiddleware()              // Extract reasoning
createRequestTrackingMiddleware()       // Log requests
createErrorHandlingMiddleware()         // Retry logic
createMiddlewareFromConfig()            // Build pipeline
composeMiddleware()                     // Combine middleware
```

**Middleware Composition**:
```typescript
Model
  ↓
[Thinking Middleware] - Extract thinking blocks
  ↓
[Request Middleware] - Track requests
  ↓
[Error Middleware] - Handle errors with retries
  ↓
[Response Middleware] - Track responses
  ↓
Application
```

### 6. Error Handling (error-handling.ts)

**Purpose**: Classify errors, implement retry logic, provide recovery.

**Responsibilities**:
- Error classification (API, rate limit, auth, validation, timeout)
- Exponential backoff retry logic
- HTTP status code handling
- User-friendly error messages
- Fetch wrapper with automatic retries

**Design Pattern**: Strategy pattern - different error handling per error type.

**Error Hierarchy**:
```
Error
  ├─ AISDKError (base)
  │   ├─ APIError (HTTP errors)
  │   ├─ RateLimitError (429)
  │   ├─ AuthenticationError (401/403)
  │   ├─ ValidationError (400)
  │   └─ TimeoutError
```

**Retry Logic**:
```
1st attempt: immediate
2nd attempt: wait ~1s
3rd attempt: wait ~2s
4th attempt: wait ~4s
Max: 30s
(+ random jitter to prevent thundering herd)
```

## Design Decisions

### 1. Composition over Inheritance

**Decision**: Use composition for features instead of inheritance.

**Rationale**:
- Tools are composed into ToolManager, not inherited
- Middleware wraps models rather than subclassing
- More flexible and testable

### 2. Zod for Tool Validation

**Decision**: Require Zod schemas for tool inputs.

**Rationale**:
- Runtime validation ensures safety
- Type inference from schemas
- Clear schema definition
- Better error messages

### 3. AsyncGenerator for Streaming

**Decision**: Use async generators for streaming events.

**Rationale**:
- Natural representation of streaming data
- Can be converted to ReadableStream for web
- Easy to compose and filter
- Type-safe event handling

### 4. Middleware System

**Decision**: Implement middleware before calling providers.

**Rationale**:
- Separates concerns (thinking, errors, tracking)
- Works across all providers
- Composable and extensible
- Middleware is transparent to user code

### 5. Config Objects over Function Parameters

**Decision**: Use configuration objects instead of many function parameters.

**Rationale**:
- Better readability and documentation
- Easy to add new options without breaking changes
- Type-safe with TypeScript
- Better default values

### 6. React Hooks Not Required

**Decision**: Core SDK is framework-agnostic; hooks are optional.

**Rationale**:
- Can use in Node.js, Express, Next.js, etc
- React hooks are thin wrapper over core
- Easier testing without React dependencies

## Type Safety Strategy

### 1. Strict Input Validation

```typescript
// Tool inputs must pass Zod validation
execute: async (input) => {
  // input is guaranteed to match schema
}
```

### 2. Exhaustive Event Handling

```typescript
for await (const event of streamText()) {
  switch (event.type) {
    case 'text': // TypeScript knows event.content exists
    case 'thinking': // TypeScript knows event.content exists
    case 'tool-call': // TypeScript knows event.toolName exists
    case 'finish': // TypeScript knows event.usage might exist
    case 'error': // TypeScript knows event.error exists
  }
}
```

### 3. Provider Capability Types

```typescript
const caps = wrapper.getModelCapabilities()
if (caps.supportsReasoning) {
  // Only available for capable models
}
```

## Error Handling Strategy

### 1. Provider-Agnostic Errors

All errors wrapped in AISDKError subclasses regardless of provider.

```typescript
try {
  // Works with any provider
} catch (error) {
  if (error instanceof RateLimitError) {
    // Same handling for all providers
  }
}
```

### 2. Automatic Retries

Retryable errors automatically retried with exponential backoff.

```typescript
errors: {
  handleAPIErrors: true,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffFactor: 2,
  }
}
```

### 3. User-Friendly Messages

```typescript
console.log(getErrorMessage(error))
// "Rate limited. Retry after 5000ms"
// "Authentication failed. Check your API key."
```

## Performance Considerations

### 1. Lazy Initialization

Models only created when accessed, not upfront.

### 2. Tool Statistics

Track execution for optimization:

```typescript
const stats = wrapper.getToolStats()
// Identify slow or frequently-used tools
```

### 3. Streaming for UX

Stream responses for perceived faster results:

```typescript
for await (const event of wrapper.streamText()) {
  // Update UI incrementally
}
```

### 4. Token Counting

Monitor token usage and costs:

```typescript
middleware: {
  onResponse: (response) => {
    trackTokenUsage(response.usage)
  }
}
```

## Extensibility Points

### 1. Custom Providers

```typescript
models: [{
  provider: 'custom',
  baseURL: 'http://localhost:8000',
  apiKey: 'local-key',
}]
```

### 2. Custom Middleware

```typescript
experimental_wrapLanguageModelMiddleware({
  wrapGenerate: async (generateFn) => {
    // Custom logic
    return await generateFn(params)
  }
})
```

### 3. Custom Tools

```typescript
const tool: AITool = {
  name: 'my_tool',
  // ... implementation
}
```

### 4. Custom Fetch

```typescript
models: [{
  provider: 'anthropic',
  customFetch: async (input, init) => {
    // OAuth, caching, logging, etc
    return fetch(input, init)
  }
}]
```

## Testing Strategy

### 1. Mock Providers

```typescript
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => mockModel
}))
```

### 2. Test Each Component Independently

- Provider factory creation
- Tool validation and execution
- Streaming event generation
- Error classification and retry

### 3. Integration Tests

- Multi-turn conversations
- Tool calling flows
- Streaming with tools
- Error recovery

## Future Enhancement Points

1. **Batch Processing**: Implement batch API support
2. **Model Routing**: Intelligent model selection based on task
3. **Context Management**: Automatic context window management
4. **Cache Layer**: Response caching for repeated queries
5. **Cost Tracking**: Detailed cost analysis per request
6. **Tracing**: OpenTelemetry integration for observability
7. **Rate Limiting**: Client-side rate limiting
8. **Tool Discovery**: Automatic tool discovery from services

## Comparison with Alternatives

### vs LangChain

- **Pros**: Simpler, more focused, less opinionated
- **Cons**: Fewer abstractions, not as feature-rich

### vs plain AI SDK

- **Pros**: Provider abstraction, tool management, error handling
- **Cons**: Additional abstraction layer

### vs LlamaIndex

- **Pros**: Lighter weight, focused on AI layer
- **Cons**: Less data loading support

## Security Considerations

1. **API Keys**: Never log or expose API keys
2. **Tool Execution**: Validate all tool inputs with Zod
3. **Tool Access**: Filter tools available per request
4. **Error Messages**: Don't leak sensitive info in errors
5. **Custom Fetch**: Use for OAuth, CORS proxying, etc

## Summary

This architecture provides:

✅ **Simplicity**: Single unified API for all operations
✅ **Type Safety**: Full TypeScript support and validation
✅ **Flexibility**: Works with multiple providers and custom implementations
✅ **Reliability**: Comprehensive error handling and retries
✅ **Performance**: Streaming, statistics, and monitoring
✅ **Extensibility**: Hooks for customization at all levels
✅ **Testability**: Clear component boundaries and dependencies
