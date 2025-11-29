# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

This is a **Gemini Live Interface** - an AI-powered development assistant that combines real-time voice/video streaming with a browser inspector for UI development.

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
