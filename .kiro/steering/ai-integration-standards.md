---
inclusion: fileMatch
fileMatchPattern: 'hooks/useAI*.ts|hooks/useLiveGemini.ts|hooks/useCodingAgent.ts|utils/toolRouter.ts|electron/ai-sdk-wrapper.cjs'
---

# AI Integration Standards

## Multi-Provider Architecture

This project supports multiple AI providers through a unified interface:

| Provider | Models | Authentication |
|----------|--------|----------------|
| `google` | Gemini 2.0 Flash, Gemini Pro | API Key |
| `anthropic` | Claude 3.5 Sonnet, Claude 3 Opus | API Key |
| `openai` | GPT-4o, GPT-4o-mini | API Key |
| `claude-code` | Claude via Max OAuth | OAuth Token |
| `codex` | Codex models | OAuth Token |

### Provider Configuration
```typescript
interface ProviderConfig {
  id: 'google' | 'openai' | 'anthropic' | 'claude-code' | 'codex';
  apiKey: string;
}

// Determine provider from model name
function getProviderForModel(model: string): ProviderType {
  if (model.includes('gemini')) return 'google';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('claude')) return 'anthropic';
  // etc.
}
```

## Chat Hooks

### useAIChatV2 (Primary Hook)
The main chat hook using Electron IPC for API calls:

```typescript
import { useAIChatV2 } from './hooks/useAIChatV2';

const {
  messages,
  isLoading,
  error,
  sendMessage,
  abort,
} = useAIChatV2({
  onResponse: (text) => console.log('Response:', text),
  onToolCall: (toolCall) => handleToolCall(toolCall),
  onReasoningDelta: (delta) => updateReasoning(delta),
  onError: (error) => console.error('Error:', error),
});
```

### useLiveGemini (Voice/Video)
Real-time streaming with Gemini Live API:

```typescript
import { useLiveGemini } from './hooks/useLiveGemini';

const {
  isConnected,
  isStreaming,
  connect,
  disconnect,
  sendAudio,
} = useLiveGemini({
  videoRef,
  canvasRef,
  onCodeUpdate: (code) => updateUI(code),
  onElementSelect: (selector) => selectElement(selector),
  selectedElement,
});
```

## Tool Calling Pattern

### Tool Definition
```typescript
interface ToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute?: (args: unknown) => Promise<unknown>;
}

// Example tool
const readFileTool: ToolDefinition = {
  description: 'Read contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
  execute: async ({ path }) => {
    return await window.electronAPI.fs.readFile(path);
  },
};
```

### Tool Router
Use `utils/toolRouter.ts` for centralized tool dispatch:

```typescript
import { dispatchToolCall, ToolHandlers } from './utils/toolRouter';

const handlers: ToolHandlers = {
  read_file: async ({ path }) => readFile(path),
  write_file: async ({ path, content }) => writeFile(path, content),
  patch_source: async (args) => patchSource(args),
};

const result = await dispatchToolCall(toolName, args, handlers);
```

### Tool Error Handling
```typescript
import { createToolError, formatErrorForDisplay } from './utils/toolErrorHandler';

try {
  const result = await executeTool(args);
  return { success: true, result };
} catch (error) {
  const toolError = createToolError(error, toolName, args);
  return {
    success: false,
    error: formatErrorForDisplay(toolError),
  };
}
```

## Streaming Response Handling

### Event Types
```typescript
type StreamEventType =
  | 'text-delta'      // Incremental text response
  | 'reasoning-delta' // AI thinking/reasoning
  | 'tool-call'       // Tool invocation
  | 'tool-result'     // Tool execution result
  | 'step-finish'     // Multi-step completion
  | 'finish';         // Stream complete
```

### Stream Subscription
```typescript
// In Electron preload
onTextChunk: (callback) => {
  const handler = (event, requestId, chunk) => callback(requestId, chunk);
  ipcRenderer.on('ai-sdk:text-chunk', handler);
  return () => ipcRenderer.removeListener('ai-sdk:text-chunk', handler);
};

// In React component
useEffect(() => {
  const unsubscribe = window.electronAPI.aiSdk.onTextChunk((id, chunk) => {
    if (id === currentRequestId) {
      appendToResponse(chunk);
    }
  });
  return unsubscribe;
}, [currentRequestId]);
```

## Gemini Live Integration

### WebSocket Connection
```typescript
// Connection setup
const client = new GoogleGenAI({ apiKey });
const session = await client.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  config: {
    generationConfig: {
      responseModalities: [Modality.AUDIO],
    },
    tools: [/* tool definitions */],
  },
});
```

### Audio Format
- **Input**: 16kHz mono PCM (Int16)
- **Output**: 24kHz mono PCM (Int16)
- **Encoding**: Base64 for WebSocket transport

```typescript
// Audio utilities in utils/audio.ts
import { pcmToBase64, base64ToPCM, pcmToAudioBuffer } from './utils/audio';

// Convert mic input for Gemini
const base64Audio = pcmToBase64(int16Array);

// Convert Gemini response for playback
const audioBuffer = pcmToAudioBuffer(base64Response, audioContext, 24000);
```

### Video Frame Capture
```typescript
// Capture video frame for Gemini vision
const captureFrame = () => {
  const canvas = canvasRef.current;
  const video = videoRef.current;

  canvas.width = 640;
  canvas.height = 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.8);
};
```

## MCP Integration

### MCP Tool Definition
```typescript
interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
}
```

### MCP Tool Execution
```typescript
// Via useMCP hook
const { callTool, listTools } = useMCP();

// Execute tool
const result = await callTool(
  serverId,
  toolName,
  toolArgs
);
```

### Combining MCP with AI SDK
```typescript
// Merge MCP tools with local tools for AI
const allTools = {
  ...localTools,
  ...mcpTools.reduce((acc, tool) => ({
    ...acc,
    [tool.name]: {
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args) => callMCPTool(tool.serverId, tool.name, args),
    },
  }), {}),
};
```

## System Prompts

System prompts are managed in `utils/systemPrompts.ts`:

```typescript
// Base system prompt for coding assistant
export const CODING_ASSISTANT_PROMPT = `You are an AI coding assistant...`;

// Claude Max OAuth requires specific system prompt
export const CLAUDE_CODE_SYSTEM_PROMPT =
  `You are Claude Code, Anthropic's official CLI for Claude.`;
```

## Turn Management

Track conversation turns for proper context:

```typescript
import { generateTurnId } from './utils/turnUtils';

// Generate unique turn ID
const turnId = generateTurnId();

// Associate messages with turns
const message: Message = {
  id: crypto.randomUUID(),
  role: 'user',
  content: userInput,
  timestamp: new Date(),
  turnId,
  sequenceNumber: 0,
};

// Tool calls inherit parent turn
const toolUsage: ToolUsage = {
  id: toolCallId,
  name: toolName,
  args: toolArgs,
  turnId,
};
```

## Source Patching

For code modifications, use structured patches:

```typescript
import { generateSourcePatch, SourcePatch } from './utils/generateSourcePatch';

const patch: SourcePatch = await generateSourcePatch(
  filePath,
  userRequest,
  selectedElement,
  apiKey
);

// Apply patch
await window.electronAPI.fs.applyPatch(
  patch.filePath,
  patch.searchCode,
  patch.replaceCode
);
```

## Best Practices

### API Key Management
- Store API keys in environment variables
- Never log or expose API keys
- Use OAuth tokens where available

### Rate Limiting
- Implement client-side rate limiting for rapid requests
- Handle 429 responses gracefully with backoff

### Context Management
- Keep conversation context within token limits
- Summarize long conversations when needed
- Clear context appropriately on topic changes

### Error Recovery
- Retry transient failures with exponential backoff
- Provide fallback responses for API outages
- Log errors with sufficient context for debugging

#[[file:hooks/useAIChatV2.ts]]
#[[file:hooks/useLiveGemini.ts]]
#[[file:utils/toolRouter.ts]]
