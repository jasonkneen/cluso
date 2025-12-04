# @ai-cluso/mgrep-local

Local semantic code search using transformer embeddings and vector similarity. Fast, offline-first code search powered by LanceDB and @xenova/transformers.

## Installation

```bash
npm install @ai-cluso/mgrep-local
# or
pnpm add @ai-cluso/mgrep-local
```

## Usage

### Basic Usage

```typescript
import { Embedder, VectorStore, Chunker, Indexer, Searcher } from '@ai-cluso/mgrep-local'

// Initialize components
const embedder = new Embedder()
const vectorStore = new VectorStore({ dbPath: './index.db' })
const chunker = new Chunker()

await embedder.initialize()
await vectorStore.initialize()

// Create indexer and searcher
const indexer = new Indexer({ embedder, vectorStore, chunker })
const searcher = new Searcher(embedder, vectorStore)

// Index a file
await indexer.indexFile('src/main.ts', fileContent)

// Search
const results = await searcher.search('authentication handler')
```

### As MCP Server

The package includes an MCP (Model Context Protocol) server for use with AI assistants:

```bash
# Run the MCP server
npx mgrep-local
```

### With Electron

```typescript
import { ElectronMgrepBridge } from '@ai-cluso/mgrep-local/electron'

const bridge = new ElectronMgrepBridge({
  projectPath: '/path/to/project',
  dbPath: '/path/to/index.db'
})

await bridge.initialize()
const results = await bridge.search('find user validation')
```

## Features

- **Semantic search**: Find code by meaning, not just keywords
- **Local-first**: All processing happens on your machine
- **Fast indexing**: Efficient chunking and embedding pipeline
- **Multiple entry points**: Core library, Electron bridge, or MCP server
- **Code-aware chunking**: Understands code structure for better results

## Architecture

```
@ai-cluso/mgrep-local
├── core/           # Core search and indexing logic
│   ├── Embedder    # Transformer-based embedding generation
│   ├── VectorStore # LanceDB-powered vector storage
│   ├── Chunker     # Code-aware text chunking
│   ├── Indexer     # File indexing pipeline
│   └── Searcher    # Semantic search interface
├── electron/       # Electron IPC bridge
└── mcp/            # MCP server for AI assistants
```

## Exports

```typescript
// Main entry
import { Embedder, VectorStore, Chunker, Indexer, Searcher } from '@ai-cluso/mgrep-local'

// Subpath exports
import { /* ... */ } from '@ai-cluso/mgrep-local/core'
import { ElectronMgrepBridge } from '@ai-cluso/mgrep-local/electron'
import { createServer } from '@ai-cluso/mgrep-local/mcp'
```

## CLI

```bash
# Index a directory
mgrep-local index /path/to/project

# Search
mgrep-local search "authentication middleware"

# Start MCP server
mgrep-local serve
```

## Dependencies

- `@xenova/transformers` - Local transformer models for embeddings
- `@lancedb/lancedb` - High-performance vector database
- `apache-arrow` - Efficient data interchange
- `@modelcontextprotocol/sdk` - MCP server implementation

## License

MIT
