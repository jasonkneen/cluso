---
inclusion: fileMatch
fileMatchPattern: 'electron/**/*|*.cjs|types/electron.d.ts'
---

# Electron Development Standards

## Architecture Overview

```
electron/
├── main.cjs              # Main process entry, IPC handlers
├── preload.cjs           # Context bridge for renderer
├── webview-preload.cjs   # Preload for embedded webview
├── ai-sdk-wrapper.cjs    # AI SDK operations wrapper
├── oauth.cjs             # Claude Max OAuth flow
├── codex-oauth.cjs       # Codex OAuth flow
├── mcp.cjs               # MCP server management
└── claude-session.cjs    # Claude session management
```

## IPC Communication Pattern

### Main Process (main.cjs)
```javascript
const { ipcMain } = require('electron');

// Use handle for async request/response
ipcMain.handle('channel-name', async (event, arg1, arg2) => {
  try {
    const result = await doSomething(arg1, arg2);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Use on for fire-and-forget or multi-response scenarios
ipcMain.on('start-stream', (event, config) => {
  const stream = createStream(config);
  stream.on('data', (chunk) => {
    event.sender.send('stream-data', chunk);
  });
  stream.on('end', () => {
    event.sender.send('stream-end');
  });
});
```

### Preload Script (preload.cjs)
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Wrap IPC calls with clean API
  doSomething: (arg1, arg2) => ipcRenderer.invoke('channel-name', arg1, arg2),

  // Event subscriptions return cleanup function
  onStreamData: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stream-data', handler);
    return () => ipcRenderer.removeListener('stream-data', handler);
  },

  // Expose environment detection
  isElectron: true,
});
```

### Renderer Access (React)
```typescript
// Type definition in types/electron.d.ts
interface ElectronAPI {
  doSomething: (arg1: string, arg2: number) => Promise<Result>;
  onStreamData: (callback: (data: StreamData) => void) => () => void;
  isElectron: boolean;
}

// Access in component
const api = window.electronAPI;
if (api?.isElectron) {
  const result = await api.doSomething('arg1', 42);
}
```

## Environment Detection

```typescript
// Check if running in Electron
const isElectron = !!window.electronAPI?.isElectron;

// Use helper from hooks/useElectronAPI.ts
import { getElectronAPI } from './hooks/useElectronAPI';

const api = getElectronAPI();
if (api) {
  // Electron-specific code
}
```

## IPC Channel Naming

### Conventions
```
namespace:action          # Standard operations
namespace:action:modifier # Variants

# Examples
ai-sdk:stream            # Start AI streaming
ai-sdk:stream:abort      # Abort stream
oauth:login              # Start OAuth flow
oauth:token:refresh      # Refresh OAuth token
git:status               # Get git status
mcp:tool:execute         # Execute MCP tool
```

### Existing Channels
| Namespace | Channels |
|-----------|----------|
| `ai-sdk` | `initialize`, `stream`, `generate`, `executeMCPTool`, `getModels` |
| `oauth` | `login`, `logout`, `getStatus`, `getAccessToken`, `testApi` |
| `codex` | `login`, `logout`, `getStatus`, `getAccessToken` |
| `git` | `status`, `branches`, `checkout`, `commit`, `push`, `pull`, `stash` |
| `mcp` | `callTool`, `listTools`, `getStatus` |
| `fs` | `readFile`, `writeFile`, `listFiles`, `exists` |

## AI SDK Wrapper Pattern

The `ai-sdk-wrapper.cjs` proxies AI SDK calls from renderer to main process:

```javascript
// Main process wrapper structure
class AISdkWrapper {
  constructor() {
    this.providers = new Map();
    this.activeStreams = new Map();
  }

  async initialize(config) {
    // Initialize providers with API keys
  }

  async stream(options, requestId) {
    // Handle streaming with event emission
    // Store stream reference for potential abort
    this.activeStreams.set(requestId, stream);
  }

  abort(requestId) {
    const stream = this.activeStreams.get(requestId);
    if (stream) {
      stream.abort();
      this.activeStreams.delete(requestId);
    }
  }
}
```

## OAuth Integration

### Claude Max OAuth Flow
```javascript
// electron/oauth.cjs handles:
// 1. PKCE challenge generation
// 2. Local callback server on port 54545
// 3. Token exchange and storage
// 4. Token refresh

// Token storage location
const tokenPath = path.join(
  app.getPath('userData'),
  'oauth-config.json'
);
```

### Critical: System Prompt Requirement
OAuth tokens from Claude Max require a specific system prompt:
```javascript
// REQUIRED for OAuth tokens to work
const systemPrompt = 'You are Claude Code, Anthropic\'s official CLI for Claude.';

// Required headers
const headers = {
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'oauth-2025-04-20',
  'Authorization': `Bearer ${accessToken}`,
  'X-API-Key': '', // Empty string required
};
```

## Webview Preload

The `webview-preload.cjs` injects into embedded webviews for browser inspection:

### Features
- Element inspection (blue highlight)
- Screenshot mode (purple dashed outline)
- Console log interception
- PostMessage communication to parent

### Communication Pattern
```javascript
// In webview-preload.cjs
window.parent.postMessage({
  type: 'element-selected',
  element: {
    tagName: el.tagName,
    className: el.className,
    // ... element details
  }
}, '*');

// In renderer (App.tsx)
window.addEventListener('message', (event) => {
  if (event.data.type === 'element-selected') {
    handleElementSelect(event.data.element);
  }
});
```

## Git Integration

Git operations only available in Electron mode via `hooks/useGit.ts`:

```typescript
// Available operations
interface GitAPI {
  getStatus: () => Promise<GitStatus>;
  getBranches: () => Promise<Branch[]>;
  checkout: (branch: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  stash: (action: 'push' | 'pop') => Promise<void>;
}

// Usage in component
const { status, branches, checkout, commit } = useGit(projectFolder);
```

## MCP Server Integration

MCP servers managed via `electron/mcp.cjs`:

```typescript
// Server configuration
interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
}

// Tool calling
const result = await window.electronAPI.mcp.callTool(
  serverId,
  toolName,
  toolArgs
);
```

## Security Considerations

### Context Isolation
- Always use `contextBridge` - never disable context isolation
- Only expose necessary APIs through preload
- Validate all inputs in main process

### File System Access
```javascript
// Sanitize paths in main process
const safePath = path.resolve(allowedDirectory, userPath);
if (!safePath.startsWith(allowedDirectory)) {
  throw new Error('Path traversal attempt detected');
}
```

### Webview Security
```javascript
// webview settings in main.cjs
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'webview-preload.cjs'),
  sandbox: true,
}
```

## Error Handling

### Main Process
```javascript
// Always return structured responses
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('[IPC Error]', channel, error);
  return {
    success: false,
    error: error.message,
    code: error.code, // If available
  };
}
```

### Renderer Handling
```typescript
const result = await window.electronAPI.someOperation();
if (!result.success) {
  console.error('Operation failed:', result.error);
  // Handle error appropriately
}
```

## Debugging

### Main Process Logs
```javascript
// Use descriptive prefixes for filtering
console.log('[Main] Starting application');
console.log('[IPC] Handling channel:', channel);
console.log('[OAuth] Token refresh initiated');
console.log('[MCP] Server connected:', serverId);
```

### DevTools
- Renderer DevTools: Cmd+Opt+I (or through View menu)
- Main process: Debug in VS Code or use `--inspect` flag

#[[file:electron/main.cjs]]
#[[file:electron/preload.cjs]]
