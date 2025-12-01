# Prevention Strategies for Slow AI Editing Performance

## Executive Summary

The slow AI editing performance issue was caused by two compounding factors:
1. **High maxSteps value (15)** - Forcing the model to execute up to 15 agentic loops for simple edits
2. **System prompt forcing unnecessary tool calls** - Instructions that encouraged the model to use tools even when direct responses would be better

This document provides prevention strategies, best practices, and test cases to catch similar issues in the future.

---

## Part 1: maxSteps Configuration Best Practices

### The Problem

`maxSteps` controls how many times an agentic loop can execute. Each step means:
1. Model generates a response + tool calls
2. Tools are executed
3. Results are fed back to the model
4. Loop repeats (if more steps available)

With `maxSteps: 15`, the model could perform up to 15 round-trips for a single user request. For simple edits that should complete in 1-2 steps, this creates massive latency.

### Recommended maxSteps Values

| Task Type | Recommended Value | Reasoning |
|-----------|------------------|-----------|
| **Simple edits** | 1-2 | Single file write or UI change |
| **File reads + edits** | 2-3 | Read context, then modify |
| **Multi-file operations** | 3-4 | Read multiple, write multiple |
| **Complex debugging** | 4-5 | Investigate, identify, fix pattern |
| **Full project refactors** | 5-6 | Multiple analysis → planning → execution loops |
| **Never exceed** | 8 | Absolute maximum for Electron/browser environments |

### Implementation Guidelines

**Current Good Practice (in App.tsx):**
```typescript
maxSteps: 6, // Reduced for faster responses
```

**Improvement: Intent-Aware maxSteps**

Adjust `maxSteps` based on detected user intent:

```typescript
function getMaxStepsForIntent(intent: ClassifiedIntent): number {
  switch (intent.type) {
    case 'code_explain':
    case 'question':
      return 1  // No tool calls needed

    case 'ui_inspect':
      return 1  // Single inspection

    case 'code_edit':
    case 'code_refactor':
      return 3  // Read → analyze → write

    case 'code_create':
      return 2  // Template → write

    case 'debug':
    case 'file_operation':
      return 4  // Multiple read/search cycles

    default:
      return 5  // Conservative default
  }
}

// Usage in stream call
const dynamicMaxSteps = getMaxStepsForIntent(intent)
await streamAI({
  // ... other options
  maxSteps: dynamicMaxSteps,
})
```

### maxSteps Anti-Patterns to Avoid

**❌ DO NOT:**
- Set maxSteps > 8 without explicit reasoning
- Use the same maxSteps for all request types
- Increase maxSteps to "be safe"
- Ignore feedback that "AI is doing too many steps"

**✅ DO:**
- Start with maxSteps: 3 and increase only if needed
- Document why your specific value was chosen
- Monitor actual step usage metrics
- Reduce the value when you notice wasted loops

---

## Part 2: System Prompt Design Guidelines

### The Problem

System prompts that aggressively encourage tool usage can force unnecessary tool calls:

**Anti-Pattern Example:**
```
ALWAYS use tools for any file operations.
MUST call a tool before responding.
Use tools for EVERY request.
```

These instructions override the model's judgment about whether tools are actually needed.

### Best Practices for System Prompt Design

#### 1. **Tool Instructions Should Be Permissive, Not Prescriptive**

**❌ BAD:**
```
You MUST call the write_file tool to save all changes.
ALWAYS execute tools before responding.
For any code modification, CALL A TOOL IMMEDIATELY.
```

**✅ GOOD:**
```
You have access to write_file when you need to save changes.
You can respond directly for questions without using tools.
Use write_file when the user asks to modify files. Skip it if
you're just explaining concepts.
```

#### 2. **Separate Tool Documentation from Tool Usage Rules**

Structure your system prompt with clear sections:

**✅ RECOMMENDED STRUCTURE:**
```markdown
## Available Tools

[List tools with descriptions and parameters]

## When to Use Each Tool

- read_file: Use when you need to see file contents
- write_file: Use when the user asks to modify/save files
- search_in_files: Use when finding relevant code

## When NOT to Use Tools

- Questions about concepts (no file operations needed)
- Asking for explanations (respond directly)
- Requests that don't require file access
- Simple text transformations that can be shown inline

## Important Constraints

- Do not use tools if you can answer directly
- If a request doesn't need tools, respond without calling them
- Optimize for user responsiveness over thoroughness
```

#### 3. **Add Explicit "No Tool" Instructions**

**✅ GOOD:**
```
For requests like "explain how X works" or "what is this code doing?",
respond directly WITHOUT using any tools.

For requests like "edit this file" or "change the background color",
then use the appropriate tool.
```

#### 4. **Distinguish Intent in System Prompt**

Include intent classification results in the system prompt to guide behavior:

```typescript
function buildSystemPrompt(context, intent, mcpTools) {
  const basePrompt = `You are a coding assistant...`

  // Add intent-specific instructions
  const intentGuidance = {
    code_explain: `The user is asking for an explanation. Respond directly
      without using any tools. Focus on clarity and examples.`,

    code_edit: `The user wants to modify code. Use write_file to make
      the changes. Keep explanations brief.`,

    question: `The user has a general question. Respond directly.
      Only use tools if you absolutely need to see file content.`,

    debug: `The user is debugging an issue. You may need multiple
      search/read operations to diagnose. Use tools strategically.`,
  }

  return `${basePrompt}\n\nContext: ${intentGuidance[intent.type]}`
}
```

#### 5. **Avoid Forcing Tool Execution**

**❌ BAD PATTERNS:**
```
CRITICAL RULES:
1. You MUST use tools
2. NEVER respond without using tools
3. Every response must include a tool call
```

**✅ GOOD PATTERNS:**
```
Guidelines for Tool Usage:
1. Use tools when needed for the task
2. Respond directly when it's more efficient
3. Tools are optional; use them to enhance your response
```

---

## Part 3: Performance Monitoring Tips

### Metrics to Track

#### 1. **Step Count Distribution**

Monitor actual step usage in production:

```typescript
const stepMetrics = {
  intent: intent.type,
  requestedMaxSteps: maxSteps,
  actualStepsUsed: 0,  // Provided by AI SDK
  finishReason: 'complete',  // or 'max_steps'
  elapsedTime: 0,
  toolCallCount: 0,
}

// Log after completion
console.log('[Performance] Step metrics:', {
  ...stepMetrics,
  efficiency: stepMetrics.actualStepsUsed / stepMetrics.requestedMaxSteps,
})
```

#### 2. **Response Time by Intent**

```typescript
const startTime = Date.now()
const result = await streamAI({ ... })
const duration = Date.now() - startTime

// Track by intent
performanceMetrics[intent.type] = {
  averageTime: (previous.averageTime * count + duration) / (count + 1),
  medianTime: updateMedian(duration),
  p95Time: updatePercentile(duration, 95),
  toolCallCount: result.toolCalls?.length || 0,
}
```

#### 3. **Tool Call Effectiveness**

Not all tool calls are equal. Track which tools are actually helping:

```typescript
interface ToolCallMetric {
  toolName: string
  callCount: number
  timeSpent: number
  usefulCallsCount: number  // Calls that affected final output
  wasted: number  // Redundant/repeated calls
}
```

### Red Flags to Watch For

| Red Flag | Indicates | Action |
|----------|-----------|--------|
| `actualSteps ≈ maxSteps` | Limit being hit | Reduce maxSteps or improve model instructions |
| `finishReason = 'max_steps'` | Ran out of steps | Increase maxSteps or simplify prompt |
| `toolCalls > 5` for simple edit | Too many tool calls | Simplify system prompt |
| `response time > 5 seconds` | Latency issue | Profile which step is slow |
| `tool_name` called multiple times | Redundant operations | Check if model is confused |

### Instrumentation Example

```typescript
async function streamAIWithMetrics(options) {
  const startTime = performance.now()
  const metrics = {
    intent: options.intent,
    maxSteps: options.maxSteps,
    modelId: options.modelId,
    toolCalls: [] as ToolMetric[],
    steps: [] as StepMetric[],
  }

  const result = await streamAI({
    ...options,
    onStepFinish: (step) => {
      metrics.steps.push({
        number: metrics.steps.length + 1,
        hasToolCalls: (step.toolCalls?.length || 0) > 0,
        toolCount: step.toolCalls?.length || 0,
        textLength: step.text?.length || 0,
      })
    },
    onToolCall: (toolCall) => {
      metrics.toolCalls.push({
        name: toolCall.toolName,
        timestamp: performance.now() - startTime,
      })
    },
  })

  // Send metrics for analysis
  const totalTime = performance.now() - startTime
  sendMetrics({
    ...metrics,
    totalTime,
    avgStepTime: totalTime / metrics.steps.length,
    finishReason: result.finishReason,
    success: !!result.text,
  })

  return result
}
```

---

## Part 4: Test Cases to Catch Performance Issues

### 4.1 Unit Tests for maxSteps Logic

```typescript
describe('maxSteps Configuration', () => {
  test('simple edits use maxSteps of 2 or less', () => {
    const intent = classifyIntent('edit the color to red', context)
    const maxSteps = getMaxStepsForIntent(intent)
    expect(maxSteps).toBeLessThanOrEqual(2)
    expect(intent.type).toBe('code_edit')
  })

  test('explanations use maxSteps of 1', () => {
    const intent = classifyIntent('what does this function do', context)
    const maxSteps = getMaxStepsForIntent(intent)
    expect(maxSteps).toBe(1)
    expect(intent.type).toBe('code_explain')
  })

  test('multi-file operations stay under maxSteps 5', () => {
    const intent = classifyIntent('refactor all components', context)
    const maxSteps = getMaxStepsForIntent(intent)
    expect(maxSteps).toBeLessThanOrEqual(5)
  })

  test('maxSteps never exceeds 8', () => {
    for (const intentType of ALL_INTENT_TYPES) {
      const maxSteps = getMaxStepsForIntent(intentType)
      expect(maxSteps).toBeLessThanOrEqual(8)
    }
  })

  test('increasing maxSteps is logged with reasoning', () => {
    const spy = jest.spyOn(console, 'warn')
    const intent = { type: 'debug' }
    getMaxStepsForIntent(intent)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('maxSteps'),
      expect.any(String)
    )
  })
})
```

### 4.2 Integration Tests for System Prompt

```typescript
describe('System Prompt Performance', () => {
  test('prompts without forced tool usage', () => {
    const prompt = buildSystemPrompt(context, { type: 'question' })
    expect(prompt).not.toMatch(/MUST call/i)
    expect(prompt).not.toMatch(/ALWAYS use tools/i)
    expect(prompt).not.toMatch(/IMMEDIATELY call/i)
  })

  test('explanation requests should not encourage tool calls', () => {
    const prompt = buildSystemPrompt(context, { type: 'code_explain' })
    expect(prompt).toContain('respond directly')
    expect(prompt).toContain('without using tools')
  })

  test('system prompt has clear tool documentation', () => {
    const prompt = buildSystemPrompt(context, { type: 'code_edit' })
    expect(prompt).toMatch(/## Available Tools/i)
    expect(prompt).toMatch(/## When to Use/i)
  })

  test('tool instructions are permissive not prescriptive', () => {
    const prompt = buildSystemPrompt(context, { type: 'debug' })
    // Should say "can use" or "may use", not "must use"
    const toolSection = prompt.match(/tools.*?(?=##|$)/is)?.[0] || ''
    expect(toolSection).toMatch(/(?:can|may) use/i)
    expect(toolSection).not.toMatch(/must use/i)
  })
})
```

### 4.3 Performance Regression Tests

```typescript
describe('Performance Regression', () => {
  test('simple edit completes in < 3 seconds', async () => {
    const startTime = performance.now()
    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [{
        role: 'user',
        content: 'Change the button color to blue'
      }],
      system: buildSystemPrompt(context, { type: 'ui_modify' }),
      maxSteps: 2,
    })
    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(3000)
    expect(result.text).toBeTruthy()
  })

  test('step count stays within expected range for intent', async () => {
    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [/* explanation question */],
      maxSteps: 1,
    })
    expect(result.stepCount).toBeLessThanOrEqual(1)
  })

  test('finish reason is complete not max_steps for simple requests', async () => {
    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [/* simple edit */],
      maxSteps: 3,
    })
    expect(result.finishReason).toBe('end_turn')
    expect(result.finishReason).not.toBe('max_steps')
  })

  test('tool call count is reasonable', async () => {
    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [/* simple edit */],
      tools: createCodingAgentTools(),
      maxSteps: 3,
    })
    // Simple edits should use 0-1 tool calls typically
    expect(result.toolCalls?.length || 0).toBeLessThanOrEqual(2)
  })
})
```

### 4.4 Behavioral Tests (E2E)

```typescript
describe('User Workflows Performance', () => {
  test('quick code explanation should not trigger tool calls', async () => {
    const messages = [{
      role: 'user',
      content: 'Explain what useCallback does'
    }]

    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages,
      tools: createCodingAgentTools(),
      maxSteps: 1,
    })

    expect(result.toolCalls).toBeUndefined()
    expect(result.text).toMatch(/useCallback|memoization|performance/i)
  })

  test('file edit should complete without unnecessary reads', async () => {
    const context = {
      selectedFiles: [{
        path: '/path/to/file.ts',
        content: 'old content'
      }]
    }

    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [{
        role: 'user',
        content: 'Change the function name to getData'
      }],
      tools: createCodingAgentTools(),
      maxSteps: 2,
    })

    // Should only call write_file, not read_file (context provided)
    const readCalls = result.toolCalls?.filter(t => t.toolName === 'read_file') || []
    expect(readCalls).toHaveLength(0)
  })

  test('debugging complex issue allows multi-step workflow', async () => {
    const result = await streamAI({
      modelId: 'claude-3-5-sonnet',
      messages: [{
        role: 'user',
        content: 'Why is the button not showing up?'
      }],
      tools: createCodingAgentTools(),
      maxSteps: 4,
      intent: { type: 'debug' }
    })

    // Debugging is allowed to use multiple steps
    expect(result.stepCount || 1).toBeLessThanOrEqual(4)
    expect(result.text).toBeTruthy()
  })
})
```

### 4.5 Monitoring & Alerting Tests

```typescript
describe('Performance Monitoring', () => {
  test('alerts on excessive tool calls', () => {
    const metrics = {
      toolCalls: 10,  // More than 5
      intent: 'code_edit',  // Simple edit
    }

    const alert = checkPerformanceAlert(metrics)
    expect(alert).toBeDefined()
    expect(alert.severity).toBe('warning')
    expect(alert.message).toContain('excessive tool calls')
  })

  test('alerts when maxSteps is reached', () => {
    const metrics = {
      requestedMaxSteps: 5,
      actualStepsUsed: 5,
      finishReason: 'max_steps',
      intent: 'code_edit',
    }

    const alert = checkPerformanceAlert(metrics)
    expect(alert).toBeDefined()
    expect(alert.message).toContain('maxSteps limit')
  })

  test('tracks response time baseline', () => {
    const metric = {
      intent: 'code_edit',
      duration: 2500,
      toolCalls: 1,
    }

    recordMetric(metric)
    const baseline = getBaselineForIntent('code_edit')
    expect(baseline.p50).toBeLessThan(3000)
    expect(baseline.p95).toBeLessThan(5000)
  })

  test('detects regression when response time increases', () => {
    const baseline = { p50: 1500, p95: 3000 }
    const newMetric = {
      intent: 'code_edit',
      duration: 8000,
      toolCalls: 1,
    }

    const regression = detectRegression(baseline, newMetric)
    expect(regression.detected).toBe(true)
    expect(regression.message).toContain('5.3x slower')
  })
})
```

---

## Part 5: Root Cause Analysis Checklist

When investigating slow AI editing performance, use this checklist:

### Before Blaming the Model

- [ ] Check `maxSteps` value - is it reasonable for the intent?
- [ ] Check system prompt - does it force unnecessary tool calls?
- [ ] Check which step is slow - is it the model or tool execution?
- [ ] Check tool implementations - are they making slow API calls?
- [ ] Check network latency - are API calls taking longer than expected?

### Investigation Commands

```bash
# Check maxSteps across codebase
grep -n "maxSteps" src/hooks/*.ts src/App.tsx

# Find all system prompt constructions
grep -n "buildSystemPrompt\|systemPrompt" src/**/*.tsx

# Check for forced tool usage patterns
grep -i "MUST call\|ALWAYS use\|IMMEDIATELY" src/hooks/*.ts

# Monitor actual performance
grep -n "console.log.*step\|console.log.*duration" src/**/*.tsx
```

### Performance Profile Questions

1. **Is maxSteps the bottleneck?**
   - Check if `finishReason === 'max_steps'`
   - If yes, either reduce maxSteps or improve prompt

2. **Are unnecessary tool calls happening?**
   - Count tool_call events in sequence
   - Compare tool count to expected minimum for task

3. **Is the system prompt encouraging tools?**
   - Search for "MUST", "ALWAYS", "IMMEDIATELY" in prompt text
   - Look for "use tools" vs "can use tools"

4. **Are individual steps slow?**
   - Measure time per step, not just total
   - Identify which steps take longest
   - Profile tool execution separately from model

---

## Part 6: Implementation Checklist

Use this checklist when implementing performance improvements:

- [ ] Add `getMaxStepsForIntent()` function that adapts maxSteps based on intent
- [ ] Update system prompt generation to use permissive language
- [ ] Add performance instrumentation (step metrics, timing, tool counts)
- [ ] Create unit tests for maxSteps values
- [ ] Create integration tests for prompt quality
- [ ] Add performance regression tests
- [ ] Implement monitoring/alerting for slow responses
- [ ] Document maxSteps values and reasoning in comments
- [ ] Add code review checklist item: "Is maxSteps appropriate for intent?"
- [ ] Set up performance dashboard or logging

---

## Summary

### Key Takeaways

1. **maxSteps is powerful and dangerous** - Start low (3-4), increase only when profiling shows it's needed
2. **System prompts should guide, not force** - Use permissive language ("can use") not prescriptive ("must use")
3. **Measure, don't guess** - Add instrumentation to detect performance issues early
4. **Intent matters** - Different tasks need different configurations
5. **Prevent regression** - Include performance tests in CI/CD pipeline

### Quick Reference

| Issue | Fix |
|-------|-----|
| Slow edits | Reduce `maxSteps` to 2-3, check prompt |
| Wasted tool calls | Remove forcing language from prompt |
| High latency | Profile each step, not just total |
| Hitting max_steps | Either reduce maxSteps or improve instructions |
| Too many steps | Simplify system prompt, reduce maxSteps |

### Files to Update

- `/hooks/useCodingAgent.ts` - Add intent-aware maxSteps logic
- `/hooks/useAIChatV2.ts` - Pass dynamic maxSteps parameter
- `/App.tsx` - Use dynamic maxSteps instead of hardcoded value
- `tests/performance.test.ts` - Add regression tests (new file)
- `/CLAUDE.md` - Document maxSteps best practices

