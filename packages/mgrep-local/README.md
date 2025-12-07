# @ai-cluso/mgrep-local

Local semantic code search using transformer embeddings and vector similarity. Fast, offline-first code search powered by LanceDB and @xenova/transformers.

## Installation

```bash
npm install @ai-cluso/mgrep-local
# or
pnpm add @ai-cluso/mgrep-local
```

## CLI Usage

### Index a directory

```bash
# Index current directory (single database mode)
mgrep-local index

# Index with 8 shards (parallel mode - faster for large codebases)
mgrep-local index --shards 8

# Using environment variable
MGREP_SHARDS=8 mgrep-local index

# Index with verbose output
mgrep-local index -v
```

### Watch mode (index on file changes)

```bash
# Watch current directory
mgrep-local watch

# Watch a specific path
mgrep-local watch /path/to/project

# Watch with verbose output
mgrep-local watch . -v
```

### Search the index

```bash
mgrep-local search "authentication middleware"
```

### Check index status

```bash
mgrep-local status

# Check sharded index status
mgrep-local status --shards 8
```

### Benchmark single vs sharded

```bash
mgrep-local benchmark .
```

### Start MCP server (for Claude Code)

```bash
mgrep-local serve
```

### Options

```
--db-path <path>      Path to database directory
                      Default: ~/.cache/mgrep-local/vectors

--model-cache <path>  Directory to cache embedding models
                      Default: ~/.cache/mgrep-local/models

--verbose, -v         Enable verbose logging

--help, -h            Show help message
```

## Claude Code Integration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "mgrep-local": {
      "command": "npx",
      "args": ["@ai-cluso/mgrep-local", "serve"]
    }
  }
}
```

This exposes the following MCP tools:

| Tool | Description |
|------|-------------|
| `semantic_search` | Search code by meaning (natural language queries) |
| `index_directory` | Index all code files in a directory |
| `index_file` | Index a single file (with optional content) |
| `index_status` | Get indexing statistics |
| `clear_index` | Clear all indexed data |

## Programmatic Usage

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

### With Electron

```typescript
import { MgrepLocalService } from '@ai-cluso/mgrep-local/electron'

const service = new MgrepLocalService({
  dbPath: '/path/to/index.db',
  verbose: true
})

await service.initialize()
const results = await service.search('find user validation')
```

## Features

- **Semantic search**: Find code by meaning, not just keywords
- **Local-first**: All processing happens on your machine
- **MLX GPU acceleration**: 44K tok/s on Apple Silicon (vs ~1K on CPU)
- **Watch mode**: Automatically index file changes
- **Fast indexing**: Incremental updates, only re-indexes changed files
- **Code-aware chunking**: Understands code structure for better results
- **Sharded mode**: Parallel indexing and progressive search for large codebases

## MLX GPU Acceleration (Apple Silicon)

For maximum performance on Apple Silicon Macs, use MLX GPU acceleration:

### Setup

```bash
# Clone and install the MLX embedding server
git clone https://github.com/jakedahn/qwen3-embeddings-mlx.git
cd qwen3-embeddings-mlx
pip install -r requirements.txt

# Start the server (downloads ~900MB model on first run)
python server.py
# Server runs at http://localhost:8000
```

### Usage

```bash
# Index with GPU acceleration
mgrep-local index --mlx

# Combine with sharded mode for maximum performance
mgrep-local index --mlx --shards 8

# Watch mode with MLX
mgrep-local watch --mlx

# Environment variable
MGREP_MLX=1 mgrep-local index
```

### Performance Comparison

| Mode | Speed | Model |
|------|-------|-------|
| CPU (default) | ~1K tok/s | all-MiniLM-L6-v2 (22M params) |
| MLX GPU | ~44K tok/s | Qwen3-Embedding-0.6B (600M params) |

MLX mode uses Qwen3-Embedding-0.6B-4bit-DWQ, which provides state-of-the-art code retrieval quality with 44x faster embeddings on M2 Max.

## Sharded Mode

For large codebases, sharded mode distributes files across multiple databases:

```
                    ┌─────────────────────┐
                    │   Meta-Index (L0)   │
                    │   Shard routing     │
                    └──────────┬──────────┘
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
    ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
    │Shard 0│  │Shard 1│  │Shard 2│  │  ...  │  │Shard N│
    └───────┘  └───────┘  └───────┘  └───────┘  └───────┘
```

**Benefits:**
- Parallel indexing across shards
- Progressive search ("image coming into focus")
- Only relevant shards are queried
- Better memory efficiency for large codebases

**When to use sharded mode:**
- Codebases with 1000+ files
- When indexing takes too long
- Run `mgrep-local benchmark` to compare

## Indexed File Types

The CLI indexes common code files:
- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`)
- Python (`.py`)
- Rust (`.rs`)
- Go (`.go`)
- Java/Kotlin (`.java`, `.kt`)
- C/C++ (`.c`, `.h`, `.cpp`, `.hpp`)
- Ruby (`.rb`)
- And many more...

Skipped directories: `node_modules`, `.git`, `dist`, `build`, `__pycache__`, etc.

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
└── mcp/            # MCP server + CLI
```

## Dependencies

- `@xenova/transformers` - Local transformer models for embeddings
- `@lancedb/lancedb` - High-performance vector database
- `apache-arrow` - Efficient data interchange
- `@modelcontextprotocol/sdk` - MCP server implementation

## License

MIT
