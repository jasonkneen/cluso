# Project Standards and Guidelines

## Application Overview

AI-Cluso is a **Cluso** - an AI-powered development assistant combining:
- Real-time voice/video streaming with Gemini Live API
- Browser inspector for UI development
- Claude Code OAuth integration for Anthropic API access
- Multi-provider AI chat (Google, OpenAI, Anthropic, Claude Code, Codex)
- MCP (Model Context Protocol) server integration

**Runtime Modes:**
- **Web Mode**: Standard browser application via Vite dev server
- **Electron Mode**: Desktop application with full filesystem access and Git integration

## Code Quality Standards

### TypeScript Guidelines
- Use strict TypeScript with explicit function return types
- Organize imports by type groups with newlines between sections
- Use `camelCase` for variables/functions, `PascalCase` for types/components
- Prefer explicit error types over suppressing with `any`
- Use `@/*` path alias for imports from project root

### File Organization
```
ai-cluso/
├── App.tsx              # Main application component
├── index.tsx            # React entry point
├── types.ts             # Shared TypeScript interfaces
├── components/          # React components
│   ├── ui/              # Reusable UI primitives (shadcn/ui)
│   ├── ai-elements/     # AI-specific UI components
│   └── tabs/            # Tab panel components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── electron/            # Electron main process (CommonJS)
├── types/               # Additional TypeScript definitions
└── packages/            # Workspace packages (fast-apply)
```

### Naming Conventions
- **Components**: `PascalCase.tsx` (e.g., `ControlTray.tsx`, `SettingsDialog.tsx`)
- **Hooks**: `useCamelCase.ts` (e.g., `useLiveGemini.ts`, `useAIChat.ts`)
- **Utils**: `camelCase.ts` (e.g., `audio.ts`, `toolRouter.ts`)
- **Types**: `camelCase.ts` or `kebab-case.d.ts` for declaration files

## Error Handling Patterns

### Tool Error Handling
Use the standardized error handler from `utils/toolErrorHandler.ts`:
```typescript
import { createToolError, formatErrorForDisplay } from './utils/toolErrorHandler';

// Create standardized tool errors
const error = createToolError(err, 'read_file', { path: filePath });

// Format for user display
const displayMessage = formatErrorForDisplay(error);
```

### Async Error Handling
- Always wrap async operations in try/catch
- Log errors with context using `debugLog` from `utils/debug.ts`
- Return structured error objects rather than throwing in API boundaries

## Component Architecture

### React Patterns
- Use functional components with hooks exclusively
- Prefer `useState` for local state, avoid class components
- Use `useCallback` for event handlers passed to child components
- Use `useMemo` for expensive computations
- Use `useRef` for DOM references and mutable values that don't trigger re-renders

### Component Structure
```typescript
// Good component structure
interface ComponentProps {
  requiredProp: string;
  optionalProp?: number;
  onEvent?: (value: string) => void;
}

export function Component({ requiredProp, optionalProp = 0, onEvent }: ComponentProps) {
  // 1. Hooks first
  const [state, setState] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  // 2. Derived state
  const derivedValue = useMemo(() => compute(state), [state]);

  // 3. Event handlers
  const handleClick = useCallback(() => {
    onEvent?.(state);
  }, [state, onEvent]);

  // 4. Effects
  useEffect(() => {
    // Side effects
  }, [dependency]);

  // 5. Render
  return <div ref={ref} onClick={handleClick}>{derivedValue}</div>;
}
```

## Security Practices

### API Key Management
- **NEVER** commit API keys, secrets, or credentials
- Use environment variables via `.env.local` file
- Electron stores OAuth tokens in `~/Library/Application Support/ai-cluso/oauth-config.json`
- Access environment variables through Vite's `import.meta.env` or `process.env.*` (defined in vite.config.ts)

### Input Validation
- Validate all user inputs before processing
- Sanitize HTML content before rendering in webviews
- Use CSS selectors carefully - avoid jQuery-style pseudo-selectors that can crash

### Webview Security
- Webview content is sandboxed with preload scripts
- Use `postMessage` for parent-webview communication
- Never execute arbitrary code from webview content without validation

## Performance Guidelines

### React Performance
- Use React 19's automatic batching for state updates
- Implement virtualization for long lists (if needed)
- Avoid unnecessary re-renders by memoizing callbacks and values
- Profile performance with React DevTools

### Audio/Video Performance
- Audio processing uses 16kHz PCM for input, 24kHz for output
- Video frames captured at 1 FPS to reduce bandwidth
- Use `AudioContext` for efficient audio playback
- Clean up media streams and connections on unmount

### Bundle Optimization
- Code splitting happens automatically via Vite
- Lazy load heavy components when possible
- Monitor bundle size during builds

## Documentation Requirements

### Code Comments
- Add comments for complex business logic only
- Document non-obvious design decisions
- Use JSDoc for public API functions in hooks
- Keep comments up-to-date with code changes

### Type Definitions
- Export types that are used across multiple files
- Keep related types together in dedicated type files
- Document complex type parameters with JSDoc

#[[file:CLAUDE.md]]
