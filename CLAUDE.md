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
