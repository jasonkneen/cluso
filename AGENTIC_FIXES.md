# Quick Fixes & Implementation Guide

## Quick Win #1: Fix Voice Agent Tool Call Handling (2 hours)

### Problem
Voice agent only processes first tool call. Multiple tools ignored.

**File**: `hooks/useLiveGemini.ts` line 577-613

### Current Code
```typescript
onmessage: async (message: LiveServerMessage) => {
  if (message.toolCall) {
    debugLog.liveGemini.log("Tool call received", message.toolCall);
    const functionCalls = message.toolCall.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0] as ToolCall;  // ← ONLY FIRST CALL!

      const handlers: ToolHandlers = {
        onCodeUpdate,
        onElementSelect,
        // ... 12 more handlers
      };

      const sendResponse = (id: string, name: string, response: Record<string, unknown>) => {
        withSession(session => {
          session.sendToolResponse({
            functionResponses: { id, name, response }
          });
        });
      };

      dispatchToolCall(call, handlers, sendResponse);
    }
  }
}
```

### Fixed Code
```typescript
onmessage: async (message: LiveServerMessage) => {
  if (message.toolCall) {
    debugLog.liveGemini.log("Tool call received", message.toolCall);
    const functionCalls = message.toolCall.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      // ✅ FIXED: Handle ALL calls, not just first
      const handlers: ToolHandlers = {
        onCodeUpdate,
        onElementSelect,
        // ... handlers
      };

      const sendResponse = (id: string, name: string, response: Record<string, unknown>) => {
        withSession(session => {
          session.sendToolResponse({
            functionResponses: { id, name, response }
          });
        });
      };

      // Process all tool calls with proper error handling
      for (const call of functionCalls) {
        try {
          await Promise.resolve()
            .then(() => dispatchToolCall(call, handlers, sendResponse))
            .catch(err => {
              debugLog.liveGemini.error(`Tool ${call.name} error:`, err);
              sendResponse(call.id, call.name, {
                error: err instanceof Error ? err.message : 'Unknown error'
              });
            });
        } catch (err) {
          debugLog.liveGemini.error(`Failed to dispatch ${call.name}:`, err);
        }
      }
    }
  }
}
```

---

## Quick Win #2: Add Tool Execution Tracking (3 hours)

### Problem
No visibility into tool success/failure. Messages show success but tools failed silently.

### Create New Hook
**File**: `hooks/useToolTracker.ts`

```typescript
import { useState, useCallback, useRef } from 'react'

export interface TrackedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: unknown
  error?: string
  startTime: number
  endTime?: number
  duration?: number
}

export function useToolTracker() {
  const [toolCalls, setToolCalls] = useState<Map<string, TrackedToolCall>>(new Map())
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const trackStart = useCallback((call: { id: string; name: string; args: unknown }) => {
    const tracked: TrackedToolCall = {
      id: call.id,
      name: call.name,
      args: call.args as Record<string, unknown>,
      status: 'running',
      startTime: Date.now()
    }
    setToolCalls(prev => new Map(prev).set(call.id, tracked))

    // Timeout protection - 30 second default
    const timeout = setTimeout(() => {
      setToolCalls(prev => {
        const updated = new Map(prev)
        const call = updated.get(tracked.id)
        if (call && call.status === 'running') {
          call.status = 'error'
          call.error = 'Tool execution timeout'
          call.endTime = Date.now()
          call.duration = call.endTime - call.startTime
        }
        return updated
      })
    }, 30000)

    timeoutsRef.current.set(call.id, timeout)
  }, [])

  const trackSuccess = useCallback((toolId: string, result: unknown) => {
    // Clear timeout
    const timeout = timeoutsRef.current.get(toolId)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(toolId)
    }

    setToolCalls(prev => {
      const updated = new Map(prev)
      const call = updated.get(toolId)
      if (call) {
        call.status = 'success'
        call.result = result
        call.endTime = Date.now()
        call.duration = call.endTime - call.startTime
      }
      return updated
    })
  }, [])

  const trackError = useCallback((toolId: string, error: string) => {
    // Clear timeout
    const timeout = timeoutsRef.current.get(toolId)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(toolId)
    }

    setToolCalls(prev => {
      const updated = new Map(prev)
      const call = updated.get(toolId)
      if (call) {
        call.status = 'error'
        call.error = error
        call.endTime = Date.now()
        call.duration = call.endTime - call.startTime
      }
      return updated
    })
  }, [])

  const clear = useCallback(() => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    timeoutsRef.current.clear()
    setToolCalls(new Map())
  }, [])

  return {
    toolCalls: Array.from(toolCalls.values()),
    trackStart,
    trackSuccess,
    trackError,
    clear
  }
}
```

### Use in Tool Router
**File**: `utils/toolRouter.ts` - Update dispatchToolCall signature

```typescript
// NEW: Accept tracker as optional parameter
export function dispatchToolCall(
  call: ToolCall,
  handlers: ToolHandlers,
  sendResponse: SendResponse,
  tracker?: ReturnType<typeof useToolTracker>
): void {
  // Track start
  tracker?.trackStart({ id: call.id, name: call.name, args: call.args })

  const handler = toolHandlerRegistry[call.name]
  if (handler) {
    Promise.resolve()
      .then(() => handler(call, handlers, sendResponse))
      .then(() => {
        // Track success
        tracker?.trackSuccess(call.id, { handlerCalled: true })
      })
      .catch(err => {
        // Track error
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        tracker?.trackError(call.id, errorMsg)
        sendResponse(call.id, call.name, { error: errorMsg })
      })
  } else {
    const error = `Unknown tool: ${call.name}`
    tracker?.trackError(call.id, error)
    sendResponse(call.id, call.name, { error })
  }
}
```

### Display in UI
**File**: `App.tsx` - Add near message display

```typescript
{/* Tool Execution Status */}
{toolCalls.length > 0 && (
  <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-stone-100'}`}>
    <div className="text-xs font-medium mb-2">Tool Execution</div>
    <div className="space-y-1">
      {toolCalls.map(tool => (
        <div key={tool.id} className="flex items-center gap-2 text-xs">
          {tool.status === 'running' && <Loader2 size={12} className="animate-spin" />}
          {tool.status === 'success' && <Check size={12} className="text-green-500" />}
          {tool.status === 'error' && <X size={12} className="text-red-500" />}
          
          <span className="font-mono">{tool.name}</span>
          
          {tool.duration && (
            <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'}>
              {tool.duration}ms
            </span>
          )}
          
          {tool.error && (
            <span className="text-red-500 text-[11px]">{tool.error}</span>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Quick Win #3: Add Turn ID Context (2 hours)

### Problem
No way to correlate user requests with agent responses and tool calls.

### Update Types
**File**: `types.ts` - Add to Message interface

```typescript
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  selectedElement?: SelectedElement
  model?: string
  intent?: string
  toolUsage?: ToolUsage[]
  reasoning?: string
  
  // ✅ NEW: Turn tracking
  turnId?: string        // Unique ID for this turn
  parentTurnId?: string  // Links to user message this responds to
  sequenceNumber?: number // 0 for user, 1+ for agent tool calls
}

export interface ToolUsage {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  isError?: boolean
  
  // ✅ NEW: Execution context
  turnId?: string      // Which turn this tool belongs to
  startTime?: number
  endTime?: number
  duration?: number
}
```

### Update Message Creation
**File**: `App.tsx` - processPrompt function

```typescript
const processPrompt = useCallback(async (input: string, intent?: string) => {
  // ... existing setup ...

  // ✅ NEW: Create turn ID
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  // Add user message with turn ID
  const userMessage: Message = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: input,
    timestamp: new Date(),
    turnId,
    parentTurnId: null,
    sequenceNumber: 0,
    selectedElement: selectedElement || undefined,
  }
  setMessages(prev => [...prev, userMessage])

  // Call agent with turn context
  const response = await chatWithAgent({
    message: input,
    model: selectedModel,
    turnId,  // ← Pass turn ID
    previousMessages: messages.map(m => ({
      role: m.role,
      content: m.content,
      turnId: m.turnId
    }))
  })

  // Store response with same turn ID
  const assistantMessage: Message = {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: response.text,
    timestamp: new Date(),
    model: selectedModel,
    turnId,         // ← Same turn ID!
    parentTurnId: userMessage.id,  // Links back
    sequenceNumber: 1,
    toolUsage: response.toolCalls?.map((call, idx) => ({
      id: call.id,
      name: call.name,
      args: call.args,
      result: call.result,
      isError: call.error,
      turnId,  // ← Tag with turn
      sequenceNumber: 2 + idx
    }))
  }
  setMessages(prev => [...prev, assistantMessage])
}, [])
```

### Query Related Messages
**File**: `hooks/useMessageHistory.ts` - New utility

```typescript
export function useMessageHistory(messages: Message[]) {
  const getMessagesByTurn = useCallback((turnId: string) => {
    return messages.filter(m => m.turnId === turnId)
  }, [messages])

  const getTurnChain = useCallback((turnId: string) => {
    const chain: Message[] = []
    let currentTurnId: string | undefined = turnId

    while (currentTurnId) {
      const msgs = getMessagesByTurn(currentTurnId)
      chain.unshift(...msgs)

      // Find parent turn
      const lastMsg = msgs[msgs.length - 1]
      currentTurnId = lastMsg.parentTurnId
        ? messages.find(m => m.id === lastMsg.parentTurnId)?.turnId
        : undefined
    }

    return chain
  }, [getMessagesByTurn, messages])

  const getRelatedToolCalls = useCallback((turnId: string) => {
    const msgs = getMessagesByTurn(turnId)
    const toolCalls: ToolUsage[] = []
    msgs.forEach(m => {
      if (m.toolUsage) toolCalls.push(...m.toolUsage)
    })
    return toolCalls.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
  }, [getMessagesByTurn])

  return {
    getMessagesByTurn,
    getTurnChain,
    getRelatedToolCalls
  }
}
```

---

## Fix #4: Better Error Tracking (4 hours)

### Create Error Boundary for Tools
**File**: `utils/toolErrorHandler.ts`

```typescript
export interface ToolError {
  id: string
  toolName: string
  code: 'VALIDATION' | 'EXECUTION' | 'TIMEOUT' | 'NOT_FOUND' | 'UNKNOWN'
  message: string
  context?: Record<string, unknown>
  recoveryActions?: string[]
}

export function createToolError(
  id: string,
  toolName: string,
  error: unknown
): ToolError {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      return {
        id,
        toolName,
        code: 'TIMEOUT',
        message: `Tool ${toolName} timed out after 30 seconds`,
        recoveryActions: ['Retry', 'Simplify request', 'Check system resources']
      }
    }
    if (error.message.includes('not found')) {
      return {
        id,
        toolName,
        code: 'NOT_FOUND',
        message: `Tool ${toolName} not available`,
        recoveryActions: ['Check tool configuration', 'Restart application']
      }
    }
  }

  return {
    id,
    toolName,
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : String(error),
    recoveryActions: ['Retry', 'Try alternative approach']
  }
}

// Log errors with full context for debugging
export function logToolError(error: ToolError, context: { turnId: string; args?: unknown }) {
  console.error('[ToolError]', {
    id: error.id,
    tool: error.toolName,
    code: error.code,
    message: error.message,
    turnId: context.turnId,
    args: context.args
  })

  // Could send to analytics/logging service
  // Sentry.captureException(error, { tags: { tool: error.toolName } })
}
```

### Use in Router
**File**: `utils/toolRouter.ts`

```typescript
import { createToolError, logToolError } from './toolErrorHandler'

export function dispatchToolCall(
  call: ToolCall,
  handlers: ToolHandlers,
  sendResponse: SendResponse,
  tracker?: ReturnType<typeof useToolTracker>
): void {
  tracker?.trackStart({ id: call.id, name: call.name, args: call.args })

  const handler = toolHandlerRegistry[call.name]
  if (!handler) {
    const error = createToolError(call.id, call.name, new Error('Unknown tool'))
    logToolError(error, { turnId: call.id, args: call.args })
    tracker?.trackError(call.id, error.message)
    sendResponse(call.id, call.name, { error: error.message })
    return
  }

  Promise.resolve()
    .then(() => handler(call, handlers, sendResponse))
    .catch(err => {
      const toolError = createToolError(call.id, call.name, err)
      logToolError(toolError, { turnId: call.id, args: call.args })
      tracker?.trackError(call.id, toolError.message)
      sendResponse(call.id, call.name, { 
        error: toolError.message,
        recovery: toolError.recoveryActions
      })
    })
}
```

---

## Complete Integrated Example

### Before: Current Broken Flow
```typescript
// User clicks button to edit footer
await generateUIUpdate(selectedElement, "Make it say Copyright 2025", apiKey)
// ↓ Returns UIUpdateResult but never executes
// ↓ No tracking of what happened
// ↓ Next operation has no context
```

### After: Fixed Flow with All Improvements
```typescript
// User request
const turnId = generateTurnId()
const userMsg = createMessage('Edit the footer', turnId)
setMessages(prev => [...prev, userMsg])

// Start tracking
const toolTracker = useToolTracker()

// Send to agent
const response = await chatWithAgent({
  message: 'Edit the footer to say Copyright 2025',
  turnId,
  model: selectedModel
})

// Handle tool calls with tracking
for (const toolCall of response.toolCalls) {
  toolTracker.trackStart({
    id: toolCall.id,
    name: toolCall.name,
    args: toolCall.args
  })

  try {
    // Execute tool with timeout
    const result = await executeToolWithTimeout(toolCall, 30000)
    
    toolTracker.trackSuccess(toolCall.id, result)
    
    // Send result back to agent for continuation
    const nextResponse = await chatWithAgent({
      message: 'Previous operation succeeded, continue',
      turnId,  // Same turn!
      toolResults: [{ id: toolCall.id, result }]
    })
  } catch (err) {
    const toolError = createToolError(toolCall.id, toolCall.name, err)
    toolTracker.trackError(toolCall.id, toolError.message)
    logToolError(toolError, { turnId, args: toolCall.args })
  }
}

// Display with full context
<MessageWithTurnContext
  message={assistantMsg}
  toolCalls={toolTracker.toolCalls}
  turnId={turnId}
  onRetry={() => retryTurn(turnId)}
/>
```

---

## Testing the Fixes

### Test Fix #1 (Multiple Tool Calls)
```typescript
describe('Voice agent tool handling', () => {
  it('should execute all tool calls, not just first', async () => {
    const tools = [
      { id: '1', name: 'select_element', args: { selector: 'button' } },
      { id: '2', name: 'execute_code', args: { code: 'alert("hi")' } }
    ]

    const responses: Array<{ id: string; name: string }> = []
    const mockSendResponse = (id: string, name: string) => {
      responses.push({ id, name })
    }

    // Simulate message with multiple tool calls
    const message = {
      toolCall: {
        functionCalls: tools
      }
    }

    // Call handler
    await handleMultipleToolCalls(message.toolCall.functionCalls, mockSendResponse)

    expect(responses).toHaveLength(2)
    expect(responses[0].id).toBe('1')
    expect(responses[1].id).toBe('2')
  })
})
```

### Test Fix #2 (Tool Tracking)
```typescript
describe('Tool execution tracking', () => {
  it('should timeout tools after 30 seconds', async () => {
    const tracker = useToolTracker()
    
    tracker.trackStart({ id: 'tool-1', name: 'slow_operation', args: {} })
    
    await new Promise(resolve => setTimeout(resolve, 31000))
    
    const toolCall = tracker.toolCalls.find(t => t.id === 'tool-1')
    expect(toolCall?.status).toBe('error')
    expect(toolCall?.error).toContain('timeout')
  })

  it('should track successful execution time', async () => {
    const tracker = useToolTracker()
    
    tracker.trackStart({ id: 'tool-2', name: 'fast_op', args: {} })
    await sleep(100)
    tracker.trackSuccess('tool-2', { result: 'ok' })
    
    const toolCall = tracker.toolCalls[0]
    expect(toolCall.duration).toBeGreaterThanOrEqual(100)
    expect(toolCall.status).toBe('success')
  })
})
```

### Test Fix #3 (Turn ID Context)
```typescript
describe('Turn ID tracking', () => {
  it('should link user message to agent response', async () => {
    const turnId = 'turn-123'
    const userMsg = createMessage('hello', turnId)
    const agentMsg = createMessage('hi', turnId, userMsg.id)
    
    expect(userMsg.turnId).toBe(turnId)
    expect(agentMsg.parentTurnId).toBe(userMsg.id)
    expect(agentMsg.turnId).toBe(turnId)
  })

  it('should isolate tool calls by turn', () => {
    const turn1 = 'turn-1'
    const turn2 = 'turn-2'
    
    const messages = [
      createMessage('cmd1', turn1),
      createToolUsageMessage('tool_a', turn1),
      createMessage('cmd2', turn2),
      createToolUsageMessage('tool_b', turn2)
    ]
    
    const { getRelatedToolCalls } = useMessageHistory(messages)
    
    const turn1Tools = getRelatedToolCalls(turn1)
    expect(turn1Tools).toHaveLength(1)
    expect(turn1Tools[0].name).toBe('tool_a')
  })
})
```

---

## Priority Checklist

- [ ] Fix voice agent multiple tool calls (2 hours) - **START HERE**
- [ ] Add useToolTracker hook (3 hours)
- [ ] Add turn IDs to messages (2 hours)  
- [ ] Create tool error handler (2 hours)
- [ ] Update message UI to show turn context (3 hours)
- [ ] Write tests (4 hours)
- [ ] Document tool interface (2 hours)

**Total Quick Wins: 18 hours (~2-3 days)**

This gets you:
- ✅ Working multiple tool calls
- ✅ Execution visibility
- ✅ Turn correlation
- ✅ Better error messages
- ✅ Foundation for full agent loop (Phase 2)
