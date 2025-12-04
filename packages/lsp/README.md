# @ai-cluso/lsp-client

Portable LSP client manager for AI code assistants. Auto-installs and manages language servers for TypeScript, Python, Go, Rust, and more.

## Installation

```bash
npm install @ai-cluso/lsp-client
# or
pnpm add @ai-cluso/lsp-client
```

## Usage

```typescript
import { createLSPManager, formatDiagnostic } from '@ai-cluso/lsp-client'

// Create manager with custom app name (for cache directory)
const manager = createLSPManager({ appName: 'my-app' })

// Set project path
manager.setProjectPath('/path/to/project')

// Listen for diagnostics
manager.on('diagnostics', (event) => {
  console.log(`Diagnostics for ${event.path}:`)
  event.diagnostics.forEach(d => console.log(formatDiagnostic(d)))
})

// Touch a file to trigger LSP analysis
await manager.touchFile('/path/to/project/src/index.ts', true)

// Get diagnostics
const diags = manager.getDiagnosticsForFile('/path/to/project/src/index.ts')

// Cleanup
await manager.shutdown()
```

## Features

- **Auto-installation**: Language servers are downloaded and cached automatically
- **Multi-language support**: TypeScript, Python, Go, Rust, and more
- **Event-based diagnostics**: Get real-time error/warning notifications
- **Portable**: Works across platforms with self-contained binaries

## Supported Languages

| Language | Server | Auto-install |
|----------|--------|--------------|
| TypeScript/JavaScript | typescript-language-server | Yes |
| Python | pylsp | Yes |
| Go | gopls | Yes |
| Rust | rust-analyzer | Yes |
| CSS/SCSS | vscode-css-languageserver | Yes |
| HTML | vscode-html-languageserver | Yes |
| JSON | vscode-json-languageserver | Yes |

## API

### `createLSPManager(options?)`

Create a new LSP manager instance.

```typescript
const manager = createLSPManager({
  appName: 'my-app',  // Used for cache directory naming
})
```

### `manager.setProjectPath(path)`

Set the project root path for LSP analysis.

### `manager.touchFile(path, waitForDiagnostics?)`

Notify the LSP that a file has been opened/changed.

### `manager.getDiagnosticsForFile(path)`

Get current diagnostics for a specific file.

### `manager.shutdown()`

Cleanup and shutdown all LSP servers.

## License

MIT
