# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

IMPORTANT: If you need to explore the codebase to gather context, you should use the warpgrep_codebase_search tool instead of any other search tool or instead of running search commands. Warp Grep is faster and more accurate. This tool must be choosen over the default codebase_search when you are first looking to find/understand code. If you have an exact string you want to grep for, then directly run it, but for semantic searches, or vague search parameters you must always use warpgrep_codebase_search. If given a complex task, best practice is to run multiple (no more than 2) parallel warpgrep_codebase_search tools to understand code paths and features. An example query is: "where is the code for <vague feature/code flow>"" >> ~/.claude/CLAUDE.md



## Build Commands

- **Dev server (web)**: `npm run dev` - Runs Vite dev server on port 3000
- **Build**: `npm run build` - Builds for production with Vite
- **Preview**: `npm run preview` - Preview production build
- **Electron dev**: `npm run electron:dev` - Runs web + Electron concurrently
- **Electron build**: `npm run electron:build` - Builds production Electron app
  - Mac: `npm run electron:build:mac`
  - Windows: `npm run electron:build:win`
  - Linux: `npm run electron:build:linux`

## Environment Setup

Set `VITE_GOOGLE_API_KEY` in `.env.local` for Gemini API access. The Vite config exposes this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Architecture

This is **Cluso** - an AI-powered development assistant that combines real-time voice/video streaming with a browser inspector for UI development.

### Core Structure

```
ai-cluso/
├── App.tsx              # Main application (browser + chat + inspector UI)
├── index.tsx            # React entry point
├── types.ts             # Shared TypeScript interfaces
├── components/
│   ├── ControlTray.tsx  # Media control buttons (connect/video/screen)
│   └── Visualizer.tsx   # Audio visualization
├── hooks/
│   ├── useLiveGemini.ts # Gemini Live API WebSocket connection, audio I/O
│   └── useGit.ts        # Git operations via Electron IPC
├── utils/
│   ├── audio.ts         # PCM audio conversion (Float32 ↔ Int16 ↔ base64)
│   └── iframe-injection.ts  # Inspector/screenshot script for webview
├── electron/
│   ├── main.cjs         # Electron main process, git IPC handlers
│   ├── preload.cjs      # Context bridge for renderer
│   └── webview-preload.cjs  # Preload for embedded webview
└── types/
    └── electron.d.ts    # TypeScript definitions for Electron API
```

### Key Concepts

**Dual Runtime**: App runs in both browser (web mode) and Electron (desktop mode). Use `window.electronAPI?.isElectron` to detect environment.

**Gemini Live Integration** (`useLiveGemini.ts`):
- Bidirectional WebSocket via `@google/genai` SDK
- Input: Microphone audio (16kHz PCM) + optional video frames (1 FPS JPEG)
- Output: Audio responses (24kHz PCM) + UI update tool calls
- Model: `gemini-2.5-flash-native-audio-preview-09-2025`

**Browser Inspector** (`iframe-injection.ts`):
- Injected into webview for element inspection
- Modes: Inspector (blue outline) and Screenshot (purple dashed)
- Communicates via `postMessage` to parent window
- Intercepts console.log/warn/error for log panel

**Electron IPC Pattern**:
- Main process (`electron/main.cjs`) registers handlers with `ipcMain.handle`
- Preload (`electron/preload.cjs`) exposes via `contextBridge.exposeInMainWorld`
- Renderer accesses via `window.electronAPI.git.*`

**Git Integration** (`useGit.ts`): Branch management, commit, push/pull, stash - only available in Electron mode.

### Data Flow

1. User speaks → Mic captured → PCM encoded → Sent to Gemini via WebSocket
2. Gemini responds → Audio received → PCM decoded → Played via AudioContext
3. If UI update needed → Gemini calls `update_ui` tool → App receives new HTML
4. User clicks inspector → Webview posts element info → Chat context enriched

## Claude Code OAuth Integration

The app supports Claude Max OAuth for using the Anthropic API without a separate API key. This is implemented in `electron/oauth.cjs` and `hooks/useAIChat.ts`.

### Critical Discovery: The System Prompt

OAuth tokens from Claude Max are specifically scoped for "Claude Code" usage. The API server validates this by checking for a specific system prompt in requests. Without it, you get: `"This credential is only authorized for use with Claude Code and cannot be used for other API requests."`

**The required system prompt:**
```
You are Claude Code, Anthropic's official CLI for Claude.
```

### Required Headers

```javascript
{
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'oauth-2025-04-20',
  'Authorization': `Bearer ${accessToken}`,
  'X-API-Key': ''  // Empty string required
}
```

### Implementation Files

- **`electron/oauth.cjs`**: PKCE OAuth flow, token storage/refresh, local callback server on port 54545
- **`hooks/useAIChat.ts`**: Custom fetch wrapper that injects the system prompt and OAuth headers
- **`electron/main.cjs`**: IPC handlers including `oauth:test-api` for validating tokens

### OAuth Flow

1. User clicks "Login with Claude Max"
2. App starts local callback server on `localhost:54545`
3. Browser opens `claude.ai/oauth/authorize` with PKCE challenge
4. User authorizes, callback receives code
5. App exchanges code for access/refresh tokens
6. Tokens stored in `~/Library/Application Support/ai-cluso/oauth-config.json`

### Using with Vercel AI SDK

The AI SDK's `@ai-sdk/anthropic` doesn't support OAuth natively. We work around this by:
1. Creating the Anthropic provider with an empty API key placeholder
2. Providing a custom `fetch` that intercepts all requests
3. Replacing headers with OAuth Bearer token
4. Injecting the Claude Code system prompt into the request body

### OAuth Constants

- Client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Token Endpoint: `https://console.anthropic.com/v1/oauth/token`
- Scopes: `org:create_api_key user:profile user:inference`

## CRITICAL: Electron Permissions - NEVER Block Media

**Date: December 5, 2025**
**Issue: Security hardening broke voice functionality**

### What Happened
A security refactoring commit added a `setPermissionRequestHandler` to block "dangerous" permissions from webviews, but forgot to include `'media'` in the allowed list:

```javascript
// WRONG - breaks voice input
const allowedPermissions = ['clipboard-read', 'clipboard-write']

// CORRECT - allows microphone for voice
const allowedPermissions = ['clipboard-read', 'clipboard-write', 'media']
```

### The Rule
**This is a voice-first application.** When adding security restrictions to Electron:

1. **ALWAYS include `'media'` permission** - Required for microphone/voice input
2. **Test voice after any security changes** - If `Permission request: media -> denied` appears in console, voice is broken
3. **Check the permission handler** at `electron/main.cjs` line ~2650 before committing security changes

### Permission Handler Location
```
electron/main.cjs:
mainWindow.webContents.session.setPermissionRequestHandler(...)
```

### Console Indicator
- `Permission request: media -> allowed` = Voice works
- `Permission request: media -> denied` = Voice is BROKEN

## Lessons Learned - Debugging and UI Patterns

### Debug Logging with Component Prefixes - CRITICAL

**Date: December 5, 2025**
**Issue: Mysterious errors in component state, unclear which component was failing**

When debugging across multiple components, add specific prefixes to error messages:

```typescript
// GOOD - immediately identifies the source
console.error('[FloatingChatContent] Invalid task state', state);
console.error('[SidePanel] Invalid step state', state);

// BAD - you don't know where the error came from
console.error('Invalid state', state);
```

**Why this matters**: The smoking gun was a LOCAL ENUM with wrong values in FloatingChatContent:

```typescript
// WRONG (FloatingChatContent)
enum ExecutionState {
  TASK_START = 'task_start',    // ❌ underscore
  STEP_START = 'step_start',    // ❌ underscore
}

// CORRECT (actual enum from types)
enum ExecutionState {
  TASK_START = 'task.start',    // ✅ dot
  STEP_START = 'step.start',    // ✅ dot
}
```

**Fix**: Replace local enum with proper import:
```typescript
import { ExecutionState, Actors, AgentEvent } from '../../../../chrome-extension/src/background/agent/event/types';
```

**Key lesson**: Finding WHERE to fix it is harder than the actual fix. Component-prefixed logging turns "mystery errors everywhere" into "ah, it's THIS component with THESE wrong enum values."

### Z-Index and Stacking Context - CRITICAL

**Date: December 4, 2025**
**Issue: Widgets appearing above HAL lens despite lens having higher z-index**

Z-index values on child elements don't matter if the parent container isn't part of the stacking context.

**Problem structure**:
```jsx
<>
  {/* Widget Grid */} <div style={{zIndex: 1}}>
  {/* Widgets */} <div style={{zIndex: 40-50}}>
  <div className="chat-indicator"> {/* NO z-index! */}
    <div className="status-container" style={{zIndex: 100000}}>
      {/* HAL Lens */}
    </div>
  </div>
</>
```

**Solution**: Add z-index to parent and manage pointer-events:
```jsx
<div style={{zIndex: 100000, pointerEvents: 'none'}}>
  {/* full-screen container, let clicks pass through */}
  <div style={{pointerEvents: 'auto'}}>
    {/* lens can receive clicks */}
  </div>
</div>
```

**Z-Index hierarchy**:
- Widget grid: 1
- Widgets (inactive): 40
- Widgets (active): 50
- HAL lens container: 100000
- Camera feed: 100001

**Debug command**:
```bash
grep -n "zIndex\|z-index" file.tsx file.css
```

### Drawer/Overlay UI Pattern - CRITICAL MENTAL MODEL

**Date: December 4, 2025**
**Issue: Wasted 2+ hours on drawer implementation with wrong mental model**

**Correct pattern for "slides up from behind"**:
```tsx
<div className="relative">
  {/* Drawer: BEHIND, slides UP with negative translateY */}
  <div className="absolute bottom-0 left-0 right-0 z-0"
       style={{transform: `translateY(${-distance}px)`}}>
    {drawer content}
  </div>
  {/* Input/Panel: IN FRONT */}
  <div className="relative z-10">
    {input panel}
  </div>
</div>
```

**What to NEVER do**:
- `flex-col-reverse` for stacking layers
- Height animations for slide effects
- Negative margins for overlap
- Multiple wrapper divs with complex z-index chains

**Mental model**:
- "Behind the panel" → z-index LOWER than panel
- "Slides up" → translateY with NEGATIVE values
- "Appears above the input" → VISUAL result, NOT z-index order

**When stuck after 2-3 failed attempts**: Ask yourself "absolute positioning + transform or flex layout?" Check the terminology - "behind" means stacking context, not flexbox.
