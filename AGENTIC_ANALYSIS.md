# Agentic Coding Processing Analysis

## Executive Summary

The project has **two separate agentic systems** that don't integrate well:
1. **Gemini Live Voice Agent** (real-time multimodal, limited tool set)
2. **AI Chat Agent** (text-based with full file system access via Electron)

Both have **tool handling issues, missing turn management, and incomplete state tracking**. This creates confusion when switching between voice and text, and makes multi-turn reasoning difficult.

---

## Current Architecture Issues

### 1. **Duplicate Tool Ecosystems (CRITICAL)**

| Aspect | Gemini Live | AI Chat |
|--------|------------|---------|
| **Tools Available** | 16 tools (UI focused) | 14 tools (file focused) |
| **Tool Format** | `FunctionDeclaration[]` | Zod schemas |
| **Async Handling** | Via callbacks | Via promises |
| **State Tracking** | Per-call in router | Per-hook |
| **Error Handling** | String responses | Structured results |

**Problem**: A user starts with voice ("fix the button"), then switches to chat ("update the file"). The two agents have:
- No shared tool implementations
- No unified error responses
- No cross-system context passing

### 2. **No Turn Management (CRITICAL)**

Current implementation:
```tsx
// App.tsx - messages just appended
messages.push({
  id: generateId(),
  role: 'user',
  content: userInput,
  timestamp: new Date()
})
```

**Missing**:
- No turn ID linking related operations
- No parent/child relationships between user request → tool calls → tool results
- No execution context (which tool succeeded/failed in which turn)
- No multi-step reasoning visibility

### 3. **Tool State Tracking Problems**

Current tool response flow:
```typescript
// toolRouter.ts - sends response immediately
sendResponse(call.id, call.name, { result: 'UI Updated Successfully' })

// But in App.tsx - doesn't know if operation succeeded
<Tool name={tool.name} args={tool.args} />  // No error state!
```

**Missing**:
- Tool execution status tracking (pending → success/error)
- Result visibility for chained tools
- Failure recovery mechanism
- Tool result validation

### 4. **Broken Tool Integration Pattern**

Gemini Live example:
```typescript
// useLiveGemini.ts line 577-613
onmessage: async (message: LiveServerMessage) => {
  if (message.toolCall) {
    const call = functionCalls[0] as ToolCall;  // Only first call!
    const handlers: ToolHandlers = { /* 14 handler functions */ };
    dispatchToolCall(call, handlers, sendResponse);
  }
}
```

**Issues**:
- Only processes first tool call (multiple calls ignored)
- 14 separate handler props makes testing impossible
- No validation of handler existence before dispatch
- Error responses get swallowed in async handlers

---

## Turn Management - What's Missing

### Current Flow (Broken)
```
User speaks/types
  ↓
processPrompt() → sets isProcessing = true
  ↓
Message added to state
  ↓
Tool calls occur (async, fire-and-forget)
  ↓
Results appear in separate tool usage array
  ↓
Response built without knowing tool status
```

### What Should Happen
```
User input
  ├─ Generate Turn ID (e.g., "turn-1234")
  ├─ Add to message history with parentTurnId: null
  ├─ Request to agent with Turn ID context
  │
  └─ Agent Turn (stores turnId: "turn-1234")
      ├─ Text deltas → collected
      ├─ Tool call → wrapped in (toolCallId, turnId, name, args)
      │  ├─ Execute tool
      │  ├─ Track result: (toolCallId, status, result)
      │  └─ Send back to model for continuation
      ├─ Reasoning → collected under reasoning buffer
      ├─ Final text assembled
      └─ Store complete turn with all tool results
          └─ Link back to user turn via parentTurnId
```

---

## Specific Code Problems

### 1. **Tool Router Missing Async Support**

**File**: `utils/toolRouter.ts` lines 78-426

```typescript
// PROBLEM: Mixes sync and async handlers
const toolHandlerRegistry: Record<string, ToolHandler> = {
  update_ui: (call, handlers, sendResponse) => {
    // Sync - fires immediately
    handlers.onCodeUpdate?.(html)
    sendResponse(call.id, call.name, { result: 'Updated' })
  },

  get_page_elements: async (call, handlers, sendResponse) => {  // ← async but no await!
    const result = await handlers.onGetPageElements?.(category)  // ← might be undefined
    sendResponse(call.id, call.name, { result })
  },
}
```

**Risks**:
- `sendResponse` can fire before async completes
- No handler existence checks → undefined error
- No timeout protection (tool hangs forever)

### 2. **Tool Definition Mismatch**

**Gemini Tools** (`useLiveGemini.ts` line 41-375):
```typescript
const updateUiTool: FunctionDeclaration = {
  name: 'update_ui',
  parameters: {
    type: Type.OBJECT,
    properties: { html: { type: Type.STRING } },
    required: ['html'],
  },
}
```

**AI Chat Tools** (`useCodingAgent.ts` line 396-771):
```typescript
write_file: {
  description: 'Write content to a file',
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async (args) => { /* async execution */ }
}
```

**Problem**: 
- Different schemas (Google Type vs Zod)
- Different execution models (callback vs promise)
- No shared interface

### 3. **Missing Tool Result Context**

**File**: `App.tsx` line 959-984

```typescript
{msg.toolUsage && msg.toolUsage.length > 0 && (
  <div>
    {msg.toolUsage.map((tool, idx) => (
      <div key={tool.id || idx}>
        <span>{tool.name}</span>
        {tool.isError ? '❌' : '✓'}  // ← Only shows success/error!
      </div>
    ))}
  </div>
)}
```

**Missing**:
- What arguments were passed to the tool
- What the tool returned
- Whether the result was used
- Chained tool dependencies

### 4. **No Agent Loop / Continuation Logic**

Current text chat with `useAIChatV2`:
- Sends message + tools
- Waits for complete response
- **Never sends tool results back to model for continuation**

This breaks multi-step reasoning:
```
User: "Create a file and commit it"
Agent: Calls create_file() → succeeds
       Calls git_commit() → ???
       (No result from create_file to guide next step)
```

### 5. **Voice Agent Missing Tool Result Feedback**

**File**: `useLiveGemini.ts` line 617-645

```typescript
onmessage: async (message: LiveServerMessage) => {
  // Handle tool calls
  if (message.toolCall) {
    const call = functionCalls[0];
    const handlers: ToolHandlers = { /* handlers */ };
    dispatchToolCall(call, handlers, sendResponse);  // ← Fire and forget
  }

  // Handle audio (separate)
  const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
  if (base64Audio) { /* play audio */ }
}
```

**Problem**: 
- Tool results sent back to model in `sendResponse()`
- But audio plays immediately without waiting for tool completion
- User hears response before tool actually runs

---

## Concrete Examples of Failure Modes

### Example 1: File Edit Workflow (Currently Broken)

**User Command**: "Edit the footer to say 'Copyright 2025'"

**Current Flow**:
```
1. User speaks/types
2. Gemini Live tool call: select_element("footer")
3. toolRouter sends: { result: 'Element selection requested' }
4. (No tracking of what was selected)
5. User doesn't know if selection succeeded
6. Gemini might hallucinate next step
```

**What Should Happen**:
```
Turn-1: User request
  - Create Turn ID: "turn-abc123"
  
Agent Turn-1:
  - Tool call: select_element("footer")
    - Tool ID: "tool-1"
    - Execute and capture result with sourceLocation
    - Send tool result back: "Selected <footer> at App.tsx:45-50"
    - Model re-processes with result context
  
  - Tool call: patch_source_file()
    - Tool ID: "tool-2"
    - Use previousToolResult from tool-1
    - Execute patch
    - Return: "File updated"
  
  - Final response built WITH all tool context visible
```

### Example 2: Multi-File Code Review (Currently Broken)

**User Command**: "Review the hooks folder and suggest improvements"

**Current Flow**:
```
1. useAIChatV2 gets list_directory call
2. Agent reads /hooks → 5 files returned
3. Agent wants to read them all
4. Calls read_multiple_files([...5 paths...])
5. But useAIChatV2 doesn't support multi-file reads
6. Agent calls read_file() 5 times separately
7. Each call is independent, no batching
8. No way to correlate results
```

**What Should Happen**:
```
Turn-1: User request
  - Tool: list_directory("/hooks")
  
Agent Turn-1 (processing result):
  - Tool: read_multiple_files([...5 paths...])  ← Batched!
  - Results linked by file path
  - Agent sees: [{ path, content }, ...]
  - Can reason about relationships
  
  - Tool: search_in_files("todo", "/hooks")  ← Uses result from previous tool
  
  - Final response correlates all findings
```

---

## Recommendations (Priority Order)

### P0: Add Turn Management System

```typescript
// types.ts - new core type
export interface Turn {
  id: string
  type: 'user' | 'agent'
  timestamp: Date
  parentTurnId?: string  // Links to user turn
  
  // User turn
  content?: string
  
  // Agent turn  
  model?: string
  reasoning?: string
  textBuffer?: string
  toolCalls?: Array<{
    id: string
    name: string
    args: unknown
    status: 'pending' | 'running' | 'success' | 'error'
    result?: unknown
    error?: string
  }>
  
  metadata?: {
    modelVersion?: string
    promptMode?: string
    tokenUsage?: number
  }
}

// App.tsx state
const [turns, setTurns] = useState<Turn[]>([])
const [currentTurnId, setCurrentTurnId] = useState<string | null>(null)

// When user sends message:
function handleUserMessage(content: string) {
  const userTurn: Turn = {
    id: generateId(),
    type: 'user',
    content,
    timestamp: new Date(),
    parentTurnId: null
  }
  setTurns(prev => [...prev, userTurn])
  
  // Start agent turn
  const agentTurn: Turn = {
    id: generateId(),
    type: 'agent',
    timestamp: new Date(),
    parentTurnId: userTurn.id,
    toolCalls: []
  }
  setCurrentTurnId(agentTurn.id)
  
  // Send to AI with turn context
  sendMessage({ 
    ...request,
    turnId: agentTurn.id,
    contextTurns: turns.slice(-10)  // Last 10 turns for context
  })
}
```

### P1: Unify Tool System

**Create shared interface**:
```typescript
// utils/toolInterface.ts
export interface UnifiedTool {
  // Identification
  name: string
  description: string
  category: 'file' | 'ui' | 'nav' | 'git'
  
  // Schema (use JSON Schema universally)
  inputSchema: JSONSchema
  outputSchema?: JSONSchema
  
  // Execution
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
  
  // Metadata
  timeout?: number
  maxRetries?: number
  requiresConfirmation?: boolean
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    executionTime: number
    retriesUsed: number
  }
}

export interface ToolContext {
  turnId: string
  selectedElement?: SelectedElement
  projectPath?: string
  webviewRef?: React.RefObject<HTMLElement>
}
```

**Convert all tools to this format**:
```typescript
// Deprecate: FunctionDeclaration, Zod-based tools
// Adopt: UnifiedTool interface

const patchSourceFile: UnifiedTool = {
  name: 'patch_source_file',
  category: 'file',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string' },
      searchCode: { type: 'string' },
      replaceCode: { type: 'string' },
      description: { type: 'string' }
    }
  },
  execute: async (args, context) => {
    try {
      const result = await electronAPI.files.patchFile(
        args.filePath as string,
        args.searchCode as string,
        args.replaceCode as string
      )
      return {
        success: result.success,
        data: result,
        error: result.error
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }
}
```

### P2: Add Tool Result Continuation

**Modify useAIChatV2**:
```typescript
export async function* streamText(options: StreamOptions) {
  let toolResults: Array<{ id: string; name: string; result: unknown }> = []
  
  while (true) {
    const response = await client.post('/chat', {
      messages: coreMessages,
      toolResults,  // ← Include previous tool results!
      tools: toolMap
    })
    
    if (response.toolCalls.length > 0) {
      // Execute tools
      const results = await Promise.all(
        response.toolCalls.map(async (call) => {
          const result = await executeTool(call.name, call.args)
          return { id: call.id, name: call.name, result }
        })
      )
      toolResults = results
      // Loop continues with results
    } else {
      // No more tools, return final response
      break
    }
  }
}
```

### P3: Enhance Tool Router

```typescript
// utils/toolRouter.ts - improved version

export class ToolRouter {
  private tools: Map<string, UnifiedTool> = new Map()
  private timeout: number = 30000
  
  registerTool(tool: UnifiedTool) {
    this.tools.set(tool.name, tool)
  }
  
  async dispatch(
    call: ToolCall,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return { success: false, error: `Unknown tool: ${call.name}` }
    }
    
    try {
      // Validate inputs
      const validArgs = this.validateSchema(call.args, tool.inputSchema)
      if (!validArgs.valid) {
        return { success: false, error: validArgs.error }
      }
      
      // Execute with timeout
      const startTime = Date.now()
      const result = await Promise.race([
        tool.execute(validArgs.data, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), tool.timeout || this.timeout)
        )
      ])
      
      return {
        ...result,
        metadata: {
          executionTime: Date.now() - startTime,
          retriesUsed: 0
        }
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTime: Date.now() - startTime, retriesUsed: 0 }
      }
    }
  }
}
```

### P4: Voice Agent Fix (Immediate)

**File**: `useLiveGemini.ts` line 577-613

```typescript
// BEFORE: Only handles first call
if (functionCalls && functionCalls.length > 0) {
  const call = functionCalls[0] as ToolCall;  // ← WRONG!
  dispatchToolCall(call, handlers, sendResponse);
}

// AFTER: Handle all calls
if (functionCalls && functionCalls.length > 0) {
  for (const call of functionCalls) {  // ← FIXED!
    // Queue for parallel execution
    Promise.resolve()
      .then(() => dispatchToolCall(call, handlers, sendResponse))
      .catch(err => {
        console.error(`[Tool] ${call.name} failed:`, err)
        sendResponse(call.id, call.name, { error: err.message })
      })
  }
}
```

### P5: Message/Turn UI Redesign

**Current**:
```
Message (text)
ToolUsage[] (separate)
  - name: "select_element"
  - isError?: boolean
```

**Proposed**:
```
Message
├─ Text content
├─ Reasoning (collapsible)
└─ Turn execution details
   ├─ Tool 1 (select_element)
   │  ├─ Input: { selector: "footer" }
   │  ├─ Output: { success: true, element: {...} }
   │  └─ Duration: 45ms
   ├─ Tool 2 (patch_source_file)
   │  ├─ Input: { filePath: "...", searchCode: "..." }
   │  ├─ Status: error
   │  └─ Error: "Patch conflict on line 42"
   └─ Follow-up (if needed)
```

---

## Implementation Phases

### Phase 1 (Week 1): Turn Management Foundation
- [ ] Add `Turn` interface to types.ts
- [ ] Create `TurnManager` hook for turn lifecycle
- [ ] Update App.tsx to track turns
- [ ] Wire in turn IDs to all AI calls

### Phase 2 (Week 2): Tool Unification
- [ ] Create `UnifiedTool` interface
- [ ] Migrate Gemini tools to interface
- [ ] Migrate AI Chat tools to interface
- [ ] Create tool registry/factory

### Phase 3 (Week 3): Tool Router Enhancement
- [ ] Rewrite toolRouter with proper async/await
- [ ] Add validation layer
- [ ] Add timeout protection
- [ ] Add error tracking per turn

### Phase 4 (Week 4): Agent Loop Fix
- [ ] Implement tool result continuation in useAIChatV2
- [ ] Add tool result buffering
- [ ] Test multi-step workflows (file + commit)
- [ ] Update Gemini Live for proper continuation

### Phase 5 (Week 5): UI/UX
- [ ] Redesign message display for turn info
- [ ] Add tool execution timeline
- [ ] Add failure recovery UI
- [ ] Test voice + text switching

---

## Test Scenarios to Add

```typescript
describe('Agentic Tool System', () => {
  // Scenario 1: Multi-step file edit
  it('should execute chained tools with result context', async () => {
    const turn = await agent.request({
      userInput: 'Create a file and commit it',
      turnId: 'test-1'
    })
    
    expect(turn.toolCalls).toHaveLength(2)
    expect(turn.toolCalls[1].inputArgs).toContain(
      turn.toolCalls[0].result  // Second tool uses first tool's result
    )
  })
  
  // Scenario 2: Tool failure recovery
  it('should handle tool failure and recover', async () => {
    const turn = await agent.request({
      userInput: 'Edit the file footer.tsx and commit',
      turnId: 'test-2'
    })
    
    const patchTool = turn.toolCalls.find(t => t.name === 'patch_source_file')
    if (!patchTool.success) {
      expect(turn.text).toContain('could not patch')
      expect(turn.toolCalls.some(t => t.name === 'read_file')).toBe(true)  // Agent re-read to diagnose
    }
  })
  
  // Scenario 3: Turn isolation
  it('should isolate turns and not leak state', async () => {
    const turn1 = await agent.request({ userInput: 'Read file A' })
    const turn2 = await agent.request({ userInput: 'Read file B' })
    
    expect(turn1.toolCalls[0].result).not.toEqual(turn2.toolCalls[0].result)
    expect(turn2.context.previousTurnResults).toEqual([])  // No leakage
  })
})
```

---

## Summary of Critical Gaps

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| No turn management | Can't track multi-step operations | Medium | P0 |
| Duplicate tool ecosystems | Maintenance nightmare, inconsistent behavior | High | P1 |
| No tool result continuation | Multi-step tasks fail silently | Medium | P2 |
| Voice agent ignores multiple tools | Feature broken on common use case | Low | P4 |
| No error context in UI | Users don't know why tasks fail | Low | P5 |

**Estimated Total Effort**: 6-8 weeks for full implementation

**Quick Win** (2 hours): Fix voice agent to handle all tool calls (P4)
