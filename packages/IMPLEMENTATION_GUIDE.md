# AI Code Assistant Packages - Implementation Guide

This document provides comprehensive instructions for implementing three packages that provide AI-powered code assistance capabilities. These packages are designed to be used together or independently in AI code assistants, IDE extensions, or development tools.

**IMPORTANT: These are local development packages, not published to npm.**

---

## Installation (Local Development)

These packages are located at:
```
/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/
├── fast-apply/
├── lsp/
└── mgrep-local/
```

### Option 1: Install from local path (recommended)

```bash
# From your project directory, install each package by path
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local
```

### Option 2: npm link (for active development)

```bash
# First, link each package globally
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply && npm link
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp && npm link
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local && npm link

# Then, link them into your project
cd /path/to/your-project
npm link @ai-cluso/fast-apply
npm link @ai-cluso/lsp-client
npm link @ai-cluso/mgrep-local
```

### Option 3: Workspace configuration

Add to your project's `package.json`:

```json
{
  "dependencies": {
    "@ai-cluso/fast-apply": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply",
    "@ai-cluso/lsp-client": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp",
    "@ai-cluso/mgrep-local": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local"
  }
}
```

Then run `npm install`.

### Build Before Using

Each package must be built before use:

```bash
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply && npm install && npm run build
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp && npm install && npm run build
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local && npm install && npm run build
```

---

## Overview

| Package | Purpose | Key Dependencies |
|---------|---------|------------------|
| `@ai-cluso/fast-apply` | Local LLM for instant code merging | `node-llama-cpp` |
| `@ai-cluso/lsp-client` | LSP server management | None (pure Node.js) |
| `@ai-cluso/mgrep-local` | Semantic code search | `@xenova/transformers`, `@lancedb/lancedb` |

---

## Package 1: @ai-cluso/fast-apply

### Purpose
Local AI model for instant code merging using the Kortix FastApply 1.5B model. Applies code changes/patches to existing code without sending data to external APIs.

### Installation (Local)
```bash
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply

# Or add to package.json
# "@ai-cluso/fast-apply": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply"
```

### Core Concepts

1. **Model Variants**: Four quantization levels available:
   - `Q4_K_M` (986MB, ~1.5GB RAM) - Default, fastest
   - `Q5_K_M` (1.1GB, ~1.7GB RAM) - Better quality
   - `Q8_0` (1.6GB, ~2.2GB RAM) - High quality
   - `F16` (3GB, ~4GB RAM) - Maximum quality

2. **Auto-download**: Models are downloaded from HuggingFace on first use

3. **Event-driven**: Emits progress events during download and inference

### Implementation

```typescript
import { FastApply } from '@ai-cluso/fast-apply'

// 1. Create instance with options
const fastApply = new FastApply({
  storageDir: '~/.myapp/models',  // Where to store downloaded models
  defaultModel: 'Q4_K_M',         // Which variant to use
  autoDownload: true,             // Auto-download if not present
})

// 2. Listen for download progress (important for UX)
fastApply.on('download:progress', (progress) => {
  console.log(`Downloading: ${progress.percent.toFixed(1)}%`)
  console.log(`Speed: ${(progress.speed / 1024 / 1024).toFixed(2)} MB/s`)
  console.log(`ETA: ${progress.eta}s`)
})

fastApply.on('download:complete', (path) => {
  console.log('Model downloaded to:', path)
})

fastApply.on('model:loaded', () => {
  console.log('Model loaded into memory')
})

// 3. Apply code changes
const result = await fastApply.apply(
  originalCode,
  `FIND:
function greet(name) {
  return "Hello, " + name
}

REPLACE WITH:
function greet(name: string): string {
  return \`Hello, \${name}!\`
}`
)

if (result.success) {
  console.log('Merged code:', result.code)
  console.log('Tokens used:', result.tokensUsed)
  console.log('Duration:', result.durationMs, 'ms')
} else {
  console.error('Failed:', result.error)
}

// 4. Lifecycle management
await fastApply.load()    // Pre-warm model (optional)
await fastApply.unload()  // Free memory
await fastApply.dispose() // Full cleanup
```

### Key Types

```typescript
interface FastApplyOptions {
  storageDir?: string      // Model storage directory
  defaultModel?: ModelVariant
  autoDownload?: boolean
}

interface ApplyResult {
  success: boolean
  code?: string           // Merged code if success
  error?: string          // Error message if failed
  tokensUsed?: number
  durationMs?: number
}

interface DownloadProgress {
  variant: ModelVariant
  downloaded: number      // Bytes
  total: number
  percent: number         // 0-100
  speed: number           // Bytes/sec
  eta: number             // Seconds
}

type ModelVariant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'F16'
```

### Internal Architecture

```
FastApply (main class)
├── ModelManager
│   ├── Downloader (HuggingFace downloads)
│   └── InferenceEngine (llama.cpp bindings)
└── Config (prompts, model definitions)
```

The `config.ts` file contains:
- `SYSTEM_PROMPT`: Instructions for the model
- `USER_PROMPT_TEMPLATE`: Template with `{original_code}` and `{update_snippet}` placeholders
- `buildPrompt()`: Formats prompts in ChatML format for Qwen models
- `parseOutput()`: Extracts code from model output, rejects prose responses

---

## Package 2: @ai-cluso/lsp-client

### Purpose
Portable LSP (Language Server Protocol) client manager that auto-installs and manages language servers for TypeScript, Python, Go, Rust, and more.

### Installation (Local)
```bash
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp

# Or add to package.json
# "@ai-cluso/lsp-client": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp"
```

### Core Concepts

1. **Auto-installation**: Language servers are downloaded and cached automatically
2. **Multi-server**: Multiple servers can run simultaneously for different file types
3. **Event-based**: Diagnostics are pushed via events, not polled
4. **Project-aware**: Servers are spawned per project root

### Supported Languages

| Language | Server | Install Method |
|----------|--------|----------------|
| TypeScript/JS | typescript-language-server | npm |
| Python | pylsp | pip/system |
| Go | gopls | go install |
| Rust | rust-analyzer | GitHub release |
| CSS/SCSS | vscode-css-languageserver | npm |
| HTML | vscode-html-languageserver | npm |
| JSON | vscode-json-languageserver | npm |

### Implementation

```typescript
import { createLSPManager, formatDiagnostic } from '@ai-cluso/lsp-client'

// 1. Create manager
const manager = createLSPManager({
  appName: 'my-code-assistant',  // For cache directory naming
  // cacheDir: '/custom/path',   // Override cache location
  // bunPath: '/path/to/bun',    // Custom bun binary
})

// 2. Set project path
manager.setProjectPath('/path/to/project')

// 3. Listen for diagnostics (errors, warnings)
manager.on('diagnostics', (event) => {
  console.log(`Diagnostics for ${event.path}:`)
  event.diagnostics.forEach(d => {
    console.log(formatDiagnostic(d))
    // Output: [Error] 42:15 (typescript): Property 'foo' does not exist
  })
})

// 4. Listen for server lifecycle
manager.on('server-started', ({ serverId, root }) => {
  console.log(`${serverId} started for ${root}`)
})

manager.on('server-closed', ({ serverId, root }) => {
  console.log(`${serverId} closed for ${root}`)
})

// 5. Touch files to trigger analysis
await manager.touchFile('/path/to/project/src/index.ts', true) // wait for diagnostics

// 6. Get diagnostics
const diagnostics = manager.getDiagnosticsForFile('/path/to/file.ts')
const allDiagnostics = manager.getAllDiagnostics() // Record<path, Diagnostic[]>

// 7. Code intelligence features
const hover = await manager.hover('/path/to/file.ts', 10, 5)
const completions = await manager.completion('/path/to/file.ts', 10, 5)
const definition = await manager.definition('/path/to/file.ts', 10, 5)
const references = await manager.references('/path/to/file.ts', 10, 5)

// 8. Server management
manager.setServerEnabled('typescript', false) // Disable a server
const status = await manager.getStatus() // Get all server statuses

// 9. Cleanup
await manager.shutdown()
```

### Key Types

```typescript
interface LSPManagerOptions {
  appName?: string     // For cache directory (default: 'lsp-client')
  cacheDir?: string    // Override cache location
  bunPath?: string     // Path to bundled bun binary
}

interface Diagnostic {
  range: Range
  severity?: DiagnosticSeverity  // 1=Error, 2=Warning, 3=Info, 4=Hint
  code?: string | number
  source?: string               // e.g., 'typescript', 'eslint'
  message: string
}

interface DiagnosticsEvent {
  path: string
  diagnostics: Diagnostic[]
}

interface ServerStatus {
  id: string
  name: string
  extensions: string[]
  enabled: boolean
  installed: boolean
  installable: boolean
  running: boolean
  instances: ServerInstance[]
}
```

### Internal Architecture

```
LSPManager
├── LSPClient (per server instance)
│   ├── JSON-RPC over stdio
│   ├── Document sync
│   └── Request/response handling
├── Installer
│   ├── npm packages
│   ├── Go packages
│   └── GitHub releases
└── Servers (definitions)
    ├── typescript-language-server
    ├── pylsp
    ├── gopls
    └── rust-analyzer
```

### Cache Structure

```
~/.cache/lsp-client/  (or appName)
├── bin/              # Binary executables
├── node_modules/     # npm packages
└── VERSION           # Cache version for invalidation
```

---

## Package 3: @ai-cluso/mgrep-local

### Purpose
Local semantic code search using transformer embeddings and vector similarity. Enables "search by meaning" rather than just keywords.

### Installation (Local)
```bash
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local

# Or add to package.json
# "@ai-cluso/mgrep-local": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local"
```

### Core Concepts

1. **Embedding Model**: Uses `all-MiniLM-L6-v2` (384-dimensional, ~90MB)
2. **Vector Database**: LanceDB for efficient similarity search
3. **Code-aware Chunking**: Splits code on function/class boundaries
4. **Hybrid Search**: Combines semantic + keyword matching

### Three Entry Points

1. **Core Library** - For custom integrations
2. **Electron Bridge** - For Electron apps
3. **MCP Server** - For Claude Code / MCP-compatible tools

### Implementation: Core Library

```typescript
import {
  Embedder,
  VectorStore,
  Chunker,
  Indexer,
  Searcher
} from '@ai-cluso/mgrep-local'

// 1. Initialize components
const embedder = new Embedder({
  modelName: 'Xenova/all-MiniLM-L6-v2',  // Default
  cacheDir: '~/.cache/mgrep-local/models',
  verbose: true,
  onProgress: (progress) => {
    if (progress.status === 'downloading') {
      console.log(`Downloading model: ${progress.progress}%`)
    }
  }
})

const vectorStore = new VectorStore({
  dbPath: '~/.cache/mgrep-local/vectors'  // LanceDB directory
})

const chunker = new Chunker({
  maxChunkSize: 500,      // Characters per chunk
  overlapSize: 50,        // Overlap between chunks
  respectBoundaries: true // Split on function/class boundaries
})

// 2. Initialize (downloads model on first run)
await embedder.initialize()
await vectorStore.initialize()

// 3. Create indexer and searcher
const indexer = new Indexer({
  embedder,
  vectorStore,
  chunker,
  batchSize: 32,
  progressCallback: (progress) => {
    console.log(`${progress.phase}: ${progress.current}/${progress.total}`)
  }
})

const searcher = new Searcher(embedder, vectorStore)

// 4. Index files
const chunksIndexed = await indexer.indexFile('src/main.ts', fileContent)
console.log(`Indexed ${chunksIndexed} chunks`)

// Batch indexing
const result = await indexer.indexFiles([
  { filePath: 'src/a.ts', content: '...' },
  { filePath: 'src/b.ts', content: '...' },
])
console.log(`Indexed ${result.totalChunks} chunks from ${result.filesProcessed} files`)

// 5. Search
const results = await searcher.search('authentication handler', {
  limit: 10,
  threshold: 0.3,      // Minimum similarity (0-1)
  returnContext: true,
  contextLines: 3
})

// Or hybrid search (semantic + keyword)
const hybridResults = await searcher.hybridSearch('user validation')

results.forEach(r => {
  console.log(`${r.filePath}:${r.metadata.startLine}-${r.metadata.endLine}`)
  console.log(`Similarity: ${(r.similarity * 100).toFixed(1)}%`)
  console.log(`Function: ${r.metadata.functionName || 'N/A'}`)
  console.log(r.content)
})

// 6. Manage index
const stats = await vectorStore.getStats()
console.log(`Files: ${stats.totalFiles}, Chunks: ${stats.totalChunks}`)

await indexer.deleteFile('src/old.ts')  // Remove file from index
await vectorStore.clear()               // Clear entire index

// 7. Cleanup
await embedder.dispose()
await vectorStore.dispose()
```

### Implementation: Electron Bridge

```typescript
import { MgrepLocalService } from '@ai-cluso/mgrep-local/electron'

// 1. Get or create service instance (singleton per dbPath)
const service = MgrepLocalService.getInstance({
  workspaceDir: '/path/to/project',
  dbPath: '/path/to/project/.mgrep-local/vectors',
  modelCacheDir: '~/.cache/mgrep-local/models',
  autoIndex: true,
  verbose: true
})

// 2. Initialize
await service.initialize()

// 3. Listen for events
service.onEvent((event) => {
  switch (event.type) {
    case 'ready':
      console.log('Service ready')
      break
    case 'indexing-progress':
      console.log(`Indexing: ${event.current}/${event.total}`)
      break
    case 'indexing-complete':
      console.log(`Indexed ${event.totalChunks} chunks`)
      break
    case 'file-indexed':
      console.log(`Indexed ${event.filePath} (${event.chunks} chunks)`)
      break
    case 'error':
      console.error('Error:', event.error)
      break
  }
})

// 4. Index files (event-driven API)
await service.onFileChange({
  filePath: '/path/to/file.ts',
  eventType: 'added',  // 'added' | 'modified' | 'deleted'
  timestamp: Date.now(),
  content: '...'       // Optional: include content to avoid re-reading
})

// Or direct indexing
await service.indexFile('/path/to/file.ts', content)
await service.indexFiles([
  { filePath: 'a.ts', content: '...' },
  { filePath: 'b.ts', content: '...' }
])

// 5. Search
const results = await service.search('find authentication logic', {
  limit: 10,
  threshold: 0.3
})

// 6. Status
const status = await service.getStatus()
console.log(`Ready: ${status.ready}, Indexing: ${status.indexing}`)
console.log(`Files: ${status.stats?.totalFiles}`)

// 7. Multi-project support
const service2 = MgrepLocalService.getInstance({
  workspaceDir: '/another/project',
  dbPath: '/another/project/.mgrep-local/vectors'
})

// 8. Cleanup
await service.dispose()
MgrepLocalService.removeInstance('/path/to/project/.mgrep-local/vectors')
```

### Implementation: MCP Server

```typescript
import { MgrepMcpServer } from '@ai-cluso/mgrep-local/mcp'

// 1. Create server
const server = new MgrepMcpServer({
  dbPath: '/path/to/vectors',
  modelCacheDir: '~/.cache/mgrep-local/models',
  verbose: true
})

// 2. Run (connects via stdio)
await server.run()

// For Claude Code, add to .mcp.json:
// {
//   "mcpServers": {
//     "mgrep-local": {
//       "command": "npx",
//       "args": ["mgrep-local"]
//     }
//   }
// }
```

**MCP Tools Provided:**

1. `semantic_search` - Search code by meaning
   - Input: `{ query: string, limit?: number, threshold?: number }`
   - Output: Formatted search results with code snippets

2. `index_status` - Get index statistics
   - Output: File count, chunk count, database size

### Key Types

```typescript
interface SearchResult {
  filePath: string
  chunkIndex: number
  content: string
  similarity: number    // 0-1 cosine similarity
  metadata: ChunkMetadata
  highlight?: string
}

interface ChunkMetadata {
  startLine: number
  endLine: number
  language: string
  functionName?: string
  classScope?: string
  isDocstring?: boolean
}

interface SearchOptions {
  limit?: number        // Max results (default: 10)
  threshold?: number    // Min similarity (default: 0.3)
  returnContext?: boolean
  contextLines?: number // Lines of context (default: 3)
}

interface IndexStats {
  totalFiles: number
  totalChunks: number
  totalEmbeddings: number
  databaseSize: number  // Bytes
  lastIndexedAt: Date | null
}
```

### Internal Architecture

```
mgrep-local
├── core/
│   ├── Embedder       - @xenova/transformers wrapper
│   ├── VectorStore    - LanceDB wrapper
│   ├── Chunker        - Code-aware text splitting
│   ├── Indexer        - File → chunks → embeddings → store
│   └── Searcher       - Query → embedding → similarity search
├── electron/
│   ├── MgrepLocalService  - Main process singleton
│   └── worker.ts          - Worker thread (future)
└── mcp/
    ├── server.ts      - MCP protocol handler
    ├── tools.ts       - Tool definitions
    └── cli.ts         - CLI entry point
```

---

## Integration Example: Full AI Code Assistant

```typescript
import { FastApply } from '@ai-cluso/fast-apply'
import { createLSPManager, formatDiagnostic } from '@ai-cluso/lsp-client'
import { MgrepLocalService } from '@ai-cluso/mgrep-local/electron'

class CodeAssistant {
  private fastApply: FastApply
  private lspManager: ReturnType<typeof createLSPManager>
  private searchService: MgrepLocalService

  async initialize(projectPath: string) {
    // 1. Fast Apply for code merging
    this.fastApply = new FastApply({ autoDownload: true })

    // 2. LSP for diagnostics
    this.lspManager = createLSPManager({ appName: 'my-assistant' })
    this.lspManager.setProjectPath(projectPath)
    this.lspManager.on('diagnostics', this.handleDiagnostics)

    // 3. Semantic search
    this.searchService = MgrepLocalService.getInstance({
      workspaceDir: projectPath,
      dbPath: `${projectPath}/.assistant/vectors`
    })
    await this.searchService.initialize()
  }

  // Find relevant code for a task
  async findRelevantCode(query: string) {
    return this.searchService.search(query, { limit: 5 })
  }

  // Apply a code change
  async applyChange(originalCode: string, change: string) {
    return this.fastApply.apply(originalCode, change)
  }

  // Get errors in a file
  async getErrors(filePath: string) {
    await this.lspManager.touchFile(filePath, true)
    return this.lspManager.getDiagnosticsForFile(filePath)
  }

  // Index a file after it changes
  async onFileChanged(filePath: string, content: string) {
    await this.searchService.indexFile(filePath, content)
  }

  private handleDiagnostics = (event: DiagnosticsEvent) => {
    const errors = event.diagnostics.filter(d => d.severity === 1)
    if (errors.length > 0) {
      console.log(`${errors.length} errors in ${event.path}`)
    }
  }
}
```

---

## Build & Development

Each package follows the same structure:

```
package/
├── src/           # TypeScript source
├── dist/          # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

### Build Commands

```bash
# Build single package
cd packages/fast-apply && npm run build

# Watch mode
npm run watch

# Clean build
npm run clean && npm run build
```

### TypeScript Configuration

All packages use:
- `target: ES2020` or `ES2022`
- `module: commonjs`
- `declaration: true` (generates `.d.ts`)
- `declarationMap: true` (source maps for types)
- `strict: true`

### Using in Other Projects

Since these are local packages (not published to npm), use one of these methods:

```bash
# Method 1: Install from local path
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp
npm install /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local

# Method 2: Link for active development
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply && npm link
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp && npm link
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local && npm link

cd /path/to/your-project
npm link @ai-cluso/fast-apply
npm link @ai-cluso/lsp-client
npm link @ai-cluso/mgrep-local

# Method 3: package.json with file: protocol
{
  "dependencies": {
    "@ai-cluso/fast-apply": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply",
    "@ai-cluso/lsp-client": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp",
    "@ai-cluso/mgrep-local": "file:/Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local"
  }
}
```

**Important:** Always rebuild packages after making changes:
```bash
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/fast-apply && npm run build
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/lsp && npm run build
cd /Users/jkneen/Documents/GitHub/flows/ai-cluso/packages/mgrep-local && npm run build
```

---

## Best Practices

### Memory Management
- Call `dispose()` when done with FastApply and mgrep services
- Call `shutdown()` when done with LSP manager
- FastApply models use 1.5-4GB RAM when loaded

### Error Handling
- FastApply returns `{ success: false, error: string }` on failure
- LSP manager emits errors via events
- mgrep service emits `error` events

### Performance
- Pre-warm FastApply model with `load()` before first use
- Index files incrementally with mgrep, not all at once
- Use `waitForDiagnostics: true` only when you need to block

### Caching
- All packages cache to `~/.cache/{appName}/`
- FastApply: model files (~1-3GB)
- LSP: server binaries and npm packages
- mgrep: embedding model (~90MB) and vector database
