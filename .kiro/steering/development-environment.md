---
inclusion: fileMatch
fileMatchPattern: 'package.json|vite.config.ts|vitest.config.ts|tsconfig.json|.env*'
---

# Development Environment Setup

## Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **Package Manager**: npm or bun
- **Git**: For version control and project features

## Initial Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-cluso
npm install
# or
bun install
```

### 2. Environment Variables
Create `.env.local` in project root:
```bash
VITE_GOOGLE_API_KEY=your-gemini-api-key
```

Optional for other providers (configured at runtime):
- OpenAI API key
- Anthropic API key
- Claude Max OAuth (handled through app UI)

### 3. Verify Installation
```bash
# Run type check
npm run build

# Start dev server
npm run dev
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run electron:dev` | Run web + Electron concurrently |
| `npm run electron:build` | Build production Electron app |
| `npm run electron:build:mac` | Build macOS app |
| `npm run electron:build:win` | Build Windows app |
| `npm run electron:build:linux` | Build Linux app |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Vite Configuration

### Dev Server
- **Port**: 3000
- **Host**: 0.0.0.0 (accessible from network)
- **Hot Module Replacement**: Enabled

### Build Output
- **Directory**: `dist/`
- **Source Maps**: Enabled
- **Base Path**: Relative (`./`)

### Environment Variables
Variables prefixed with `VITE_` are exposed to the client:
```typescript
// Access in code via
import.meta.env.VITE_GOOGLE_API_KEY

// Or via process.env (defined in vite.config.ts)
process.env.API_KEY
process.env.GEMINI_API_KEY
```

### Path Aliases
```typescript
// tsconfig.json and vite.config.ts define:
'@/*' -> './*'

// Usage
import { Button } from '@/components/ui/button';
import { useLiveGemini } from '@/hooks/useLiveGemini';
```

## TypeScript Configuration

### Compiler Options
- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **JSX**: react-jsx (automatic runtime)
- **Strict Mode**: Not explicitly enabled (consider enabling)

### Key Settings
```json
{
  "experimentalDecorators": true,
  "useDefineForClassFields": false,
  "allowImportingTsExtensions": true,
  "noEmit": true
}
```

### Type Checking
```bash
# Manual type check (included in build)
npx tsc --noEmit
```

## Electron Development

### Dev Mode
```bash
npm run electron:dev
```
This runs:
1. Vite dev server on port 3000
2. Waits for server to be ready
3. Launches Electron with `NODE_ENV=development`

### Debugging Main Process
Add to `package.json` scripts:
```json
"electron:debug": "electron --inspect=5858 ."
```

Then attach VS Code debugger or use Chrome DevTools at `chrome://inspect`.

### Build for Distribution
```bash
# macOS (DMG + ZIP)
npm run electron:build:mac

# Windows (NSIS + ZIP)
npm run electron:build:win

# Linux (AppImage + DEB)
npm run electron:build:linux
```

Output in `release/` directory.

## IDE Setup (VS Code Recommended)

### Extensions
- **ESLint**: Linting
- **Prettier**: Formatting (if configured)
- **TypeScript Vue Plugin (Volar)**: If using Vue
- **Tailwind CSS IntelliSense**: CSS class autocomplete
- **Error Lens**: Inline error display

### Settings
Add to `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Workspace Packages

The project uses npm workspaces for internal packages:

```
packages/
└── fast-apply/     # Local inference engine for code patching
```

### Working with Packages
```bash
# Install package dependencies
npm install

# Build specific package
npm run build -w @ai-cluso/fast-apply

# Run scripts in package
npm run test -w @ai-cluso/fast-apply
```

## Debugging Tips

### React DevTools
Install React DevTools browser extension or use:
```bash
npx react-devtools
```

### Network Debugging
- Use browser DevTools Network tab for web mode
- Use Electron's DevTools for API calls in desktop mode

### Console Logging
Use structured logging with prefixes:
```typescript
import { debugLog } from './utils/debug';

debugLog('ComponentName', 'Action description', { data });
```

### Voice/Audio Debugging
Use `utils/voiceLogger.ts` for audio-specific logging:
```typescript
import { voiceLogger } from './utils/voiceLogger';

voiceLogger.logAudioEvent('input', { sampleRate, length });
```

## Common Issues

### Port 3000 in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Electron Not Starting
- Ensure dev server is running first
- Check for port conflicts
- Verify Node.js version compatibility

### TypeScript Errors
```bash
# Clear build cache
rm -rf node_modules/.vite
npm run build
```

### OAuth Callback Issues
- Ensure port 54545 is available (OAuth callback)
- Check firewall settings

## Production Considerations

### Environment Variables
For production builds, set variables before building:
```bash
VITE_GOOGLE_API_KEY=prod-key npm run build
```

### Code Signing (macOS/Windows)
Configure in `package.json` under `build`:
```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name"
  }
}
```

### Auto-Updates
Not currently configured. Consider `electron-updater` for future implementation.

#[[file:package.json]]
#[[file:vite.config.ts]]
#[[file:tsconfig.json]]
