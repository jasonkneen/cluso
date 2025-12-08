#!/usr/bin/env node
/**
 * mgrep-local CLI entry point
 *
 * Commands:
 *   mgrep-local index [directory]    - Index a directory (default: current dir)
 *   mgrep-local watch [directory]    - Watch and index changes (default: current dir)
 *   mgrep-local search <query>       - Search the index
 *   mgrep-local serve                - Start MCP server for Claude Code
 *   mgrep-local status               - Show index status
 *   mgrep-local benchmark [directory] - Compare single vs sharded performance
 *
 * Options:
 *   --mlx                Use MLX GPU acceleration (requires qwen3-embeddings-mlx server)
 *   --mlx-server <url>   MLX server URL (default: http://localhost:8000)
 *   --shards <n>         Number of shards (enables sharded mode)
 *   --db-path <path>     Path to the database directory
 *   --model-cache <path> Directory to cache embedding models
 *   --verbose, -v        Enable verbose logging
 *   --help, -h           Show this help message
 *
 * Environment:
 *   MGREP_MLX            Use MLX (1 or true)
 *   MGREP_MLX_SERVER     MLX server URL
 *   MGREP_SHARDS         Number of shards (same as --shards)
 *   MGREP_DB_PATH        Database path (same as --db-path)
 *   MGREP_VERBOSE        Enable verbose logging (1 or true)
 */

import { resolve, join, extname, relative } from 'path'
import { readFileSync, statSync, watch, readdirSync } from 'fs'
import { homedir } from 'os'

import { MgrepMcpServer } from './server.js'
import { Embedder } from '../core/Embedder.js'
import { createEmbedder } from '../core/embedder-factory.js'
import { checkMlxServer } from '../core/MlxEmbedder.js'
import { VectorStore } from '../core/VectorStore.js'
import { Chunker } from '../core/Chunker.js'
import { Indexer } from '../core/Indexer.js'
import { Searcher } from '../core/Searcher.js'
import { ShardedVectorStore } from '../core/ShardedVectorStore.js'
import { ShardedIndexer } from '../core/ShardedIndexer.js'
import { ShardedSearcher } from '../core/ShardedSearcher.js'
import type { MlxEmbedderOptions } from '../core/MlxEmbedder.js'
import type { ShardedIndexProgress } from '../core/ShardedIndexer.js'

// =============================================================================
// Configuration
// =============================================================================

interface CliConfig {
  command: 'index' | 'watch' | 'search' | 'serve' | 'status' | 'benchmark' | 'help'
  directory: string
  query?: string
  dbPath?: string
  modelCacheDir?: string
  verbose: boolean
  force: boolean  // Force reindexing even if files haven't changed
  shards?: number  // undefined = single mode, number = sharded mode
  gpu: boolean  // Use GPU acceleration (auto-detect best backend)
  mlx: boolean  // Use MLX GPU acceleration (Python server)
  mlxServer: string  // MLX server URL
  // OpenAI options
  openai: boolean  // Use OpenAI embeddings API
  openaiModel: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
  openaiConcurrency: number  // Parallel API calls
}

// Default paths
const DEFAULT_DB_DIR = join(homedir(), '.cache', 'mgrep-local', 'vectors')
const DEFAULT_MODEL_CACHE = join(homedir(), '.cache', 'mgrep-local', 'models')

// File extensions to index
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.rs',
  '.go',
  '.java', '.kt', '.kts',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.scala',
  '.clj', '.cljs', '.cljc',
  '.ex', '.exs',
  '.hs',
  '.ml', '.mli',
  '.lua',
  '.r', '.R',
  '.jl',
  '.sh', '.bash', '.zsh',
  '.sql',
  '.graphql', '.gql',
  '.vue', '.svelte',
  '.md', '.mdx',
  '.json', '.yaml', '.yml', '.toml',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm',
])

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'target',
  'vendor',
  '.cache',
  'coverage',
  '.nyc_output',
])

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(): CliConfig {
  const args = process.argv.slice(2)

  // Check environment variables first
  const envShards = process.env.MGREP_SHARDS
  const envDbPath = process.env.MGREP_DB_PATH
  const envVerbose = process.env.MGREP_VERBOSE
  const envGpu = process.env.MGREP_GPU
  const envMlx = process.env.MGREP_MLX
  const envMlxServer = process.env.MGREP_MLX_SERVER
  const envOpenai = process.env.MGREP_OPENAI
  const envOpenaiModel = process.env.MGREP_OPENAI_MODEL as CliConfig['openaiModel'] | undefined
  const envOpenaiConcurrency = process.env.MGREP_OPENAI_CONCURRENCY

  const config: CliConfig = {
    command: 'serve',
    directory: process.cwd(),
    verbose: envVerbose === '1' || envVerbose === 'true',
    force: false,
    dbPath: envDbPath,
    shards: envShards ? parseInt(envShards, 10) : undefined,
    gpu: envGpu === '1' || envGpu === 'true',
    mlx: envMlx === '1' || envMlx === 'true',
    mlxServer: envMlxServer ?? 'http://localhost:8000',
    openai: envOpenai === '1' || envOpenai === 'true',
    openaiModel: envOpenaiModel ?? 'text-embedding-3-small',
    openaiConcurrency: envOpenaiConcurrency ? parseInt(envOpenaiConcurrency, 10) : 4,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case 'index':
        config.command = 'index'
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.directory = resolve(args[++i])
        }
        break

      case 'watch':
        config.command = 'watch'
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.directory = resolve(args[++i])
        }
        break

      case 'search':
        config.command = 'search'
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.query = args[++i]
        }
        break

      case 'serve':
        config.command = 'serve'
        break

      case 'status':
        config.command = 'status'
        break

      case 'benchmark':
        config.command = 'benchmark'
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.directory = resolve(args[++i])
        }
        break

      case '--gpu':
        config.gpu = true
        break

      case '--mlx':
        config.mlx = true
        break

      case '--mlx-server':
        config.mlxServer = args[++i]
        config.mlx = true  // Implicitly enable MLX when server is specified
        break

      case '--openai':
        config.openai = true
        break

      case '--openai-model':
        config.openaiModel = args[++i] as CliConfig['openaiModel']
        config.openai = true  // Implicitly enable OpenAI when model is specified
        break

      case '--openai-concurrency':
        config.openaiConcurrency = parseInt(args[++i], 10)
        config.openai = true  // Implicitly enable OpenAI when concurrency is specified
        break

      case '--shards':
        config.shards = parseInt(args[++i], 10)
        break

      case '--force':
      case '-f':
        config.force = true
        break

      case '--db-path':
        config.dbPath = args[++i]
        break

      case '--model-cache':
        config.modelCacheDir = args[++i]
        break

      case '--verbose':
      case '-v':
        config.verbose = true
        break

      case '--help':
      case '-h':
        config.command = 'help'
        break

      default:
        if (!arg.startsWith('-') && config.command === 'serve') {
          config.command = 'index'
          config.directory = resolve(arg)
        } else if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`)
          config.command = 'help'
        }
    }
    i++
  }

  return config
}

// =============================================================================
// Embedder Helper
// =============================================================================

/**
 * Create embedder based on config
 * Priority: --openai > --gpu (auto) > --mlx (Python server) > CPU
 */
async function getEmbedder(config: CliConfig): Promise<Embedder> {
  // OpenAI mode: use OpenAI API (highest priority when enabled)
  if (config.openai) {
    if (!process.env.OPENAI_API_KEY) {
      log('Error: OPENAI_API_KEY environment variable not set')
      log('Set it with: export OPENAI_API_KEY=sk-...')
      process.exit(1)
    }
    log(`OpenAI mode: ${config.openaiModel} (concurrency: ${config.openaiConcurrency})`)
    const embedder = await createEmbedder({
      backend: 'openai',
      openaiModel: config.openaiModel,
      openaiConcurrency: config.openaiConcurrency,
      verbose: config.verbose,
    })
    return embedder as unknown as Embedder
  }

  // GPU mode: auto-detect best backend (LlamaCpp > MLX > CPU)
  if (config.gpu) {
    log('GPU mode requested, auto-detecting best backend...')
    const embedder = await createEmbedder({
      backend: 'auto',
      cacheDir: config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
      verbose: config.verbose,
    })
    return embedder as unknown as Embedder
  }

  // MLX mode: use Python server
  if (config.mlx) {
    log('MLX mode requested, checking server...')
    const mlxAvailable = await checkMlxServer(config.mlxServer)

    if (mlxAvailable) {
      log(`MLX server found at ${config.mlxServer}`)
      const embedder = await createEmbedder({
        backend: 'mlx',
        mlxServerUrl: config.mlxServer,
        verbose: config.verbose,
      })
      return embedder as unknown as Embedder
    } else {
      log(`MLX server not available at ${config.mlxServer}`)
      log('Start it with: git clone https://github.com/jakedahn/qwen3-embeddings-mlx.git')
      log('  cd qwen3-embeddings-mlx && pip install -r requirements.txt && python server.py')
      log('Falling back to CPU embeddings...')
    }
  }

  // CPU mode
  const embedder = await createEmbedder({
    backend: 'cpu',
    cacheDir: config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
    verbose: config.verbose,
  })
  return embedder as unknown as Embedder
}

// =============================================================================
// File Discovery
// =============================================================================

function discoverFiles(directory: string, verbose: boolean): string[] {
  const files: string[] = []

  function walk(dir: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) {
          walk(fullPath)
        }
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (CODE_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(directory)

  if (verbose) {
    log(`Discovered ${files.length} files to index`)
  }

  return files
}

// =============================================================================
// Logging
// =============================================================================

function log(...args: unknown[]): void {
  const timestamp = new Date().toISOString().substring(11, 19)
  console.error(`[${timestamp}] [mgrep]`, ...args)
}

function logProgress(current: number, total: number, file?: string): void {
  const pct = ((current / total) * 100).toFixed(1)
  const shortFile = file ? ` ${relative(process.cwd(), file)}` : ''
  process.stderr.write(`\r[mgrep] Indexing: ${current}/${total} (${pct}%)${shortFile.padEnd(60)}`)
}

// =============================================================================
// Commands - Standard (Single DB)
// =============================================================================

async function runIndexSingle(config: CliConfig): Promise<{ chunks: number; files: number; durationMs: number }> {
  const startTime = Date.now()

  const files = discoverFiles(config.directory, config.verbose)
  if (files.length === 0) {
    return { chunks: 0, files: 0, durationMs: Date.now() - startTime }
  }

  const embedder = await getEmbedder(config)

  const vectorStore = new VectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
  })
  await vectorStore.initialize()

  // Force reindex: clear the database first
  if (config.force) {
    log('Force mode: clearing existing index...')
    await vectorStore.clear()
  }

  const chunker = new Chunker()
  const indexer = new Indexer({ embedder, vectorStore, chunker })

  let indexed = 0
  let chunks = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const content = readFileSync(file, 'utf-8')
      const fileChunks = await indexer.indexFile(file, content)
      if (fileChunks > 0) {
        indexed++
        chunks += fileChunks
      }
      logProgress(i + 1, files.length, file)
    } catch (error) {
      if (config.verbose) {
        log(`Error indexing ${file}:`, error)
      }
    }
  }

  process.stderr.write('\n')

  await embedder.dispose()
  await vectorStore.dispose()

  return { chunks, files: indexed, durationMs: Date.now() - startTime }
}

// =============================================================================
// Commands - Sharded (Multi DB)
// =============================================================================

async function runIndexSharded(config: CliConfig): Promise<{ chunks: number; files: number; durationMs: number }> {
  const startTime = Date.now()
  const shardCount = config.shards ?? 8

  log(`Sharded mode: ${shardCount} shards`)

  const files = discoverFiles(config.directory, config.verbose)
  if (files.length === 0) {
    return { chunks: 0, files: 0, durationMs: Date.now() - startTime }
  }

  const embedder = await getEmbedder(config)

  const shardedStore = new ShardedVectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'sharded'),
    shardCount,
  })
  await shardedStore.initialize()

  // Force reindex: clear the database first
  if (config.force) {
    log('Force mode: clearing existing index...')
    await shardedStore.clear()
  }

  const chunker = new Chunker()

  // Build embedder config for parallel workers
  // Determine backend type
  const getBackend = () => {
    if (config.openai) return 'openai' as const
    if (config.gpu) return 'auto' as const
    if (config.mlx) return 'mlx' as const
    return 'cpu' as const
  }

  const embedderConfig = {
    backend: getBackend(),
    cacheDir: config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
    verbose: config.verbose,
    // OpenAI-specific config
    openaiModel: config.openaiModel,
    openaiConcurrency: config.openaiConcurrency,
  }

  // Determine worker count based on backend
  // OpenAI: Can use many workers since it's API-based (no local GPU contention)
  // GPU (Metal): Limit to 2 workers to avoid trace trap crashes
  // CPU/MLX: Use up to 4 workers
  const getWorkerCount = () => {
    if (config.openai) return Math.min(shardCount, 8)  // OpenAI can handle many parallel workers
    if (config.gpu) return Math.min(shardCount, 2)  // Metal GPU limitation
    return Math.max(1, Math.min(shardCount, 4))  // CPU/MLX default
  }

  // Track progress for sharded mode
  let lastProgress = 0
  const indexer = new ShardedIndexer({
    shardedStore,
    embedder,
    chunker,
    embedderConfig,  // Enable parallel workers
    parallel: true,
    workerCount: getWorkerCount(),
    progressCallback: (progress: ShardedIndexProgress) => {
      if (progress.phase === 'chunking' && progress.currentFile) {
        const shardLabel = progress.shardId !== undefined
          ? ` [shard ${progress.shardId}/${shardCount}]`
          : ''
        const pct = ((progress.current / progress.total) * 100).toFixed(1)
        const shortFile = relative(config.directory, progress.currentFile)
        process.stderr.write(`\r[mgrep]${shardLabel} Indexing: ${progress.current}/${progress.total} (${pct}%) ${shortFile.padEnd(50)}`)
        lastProgress = progress.current
      }
    },
  })

  // Prepare files with content
  const filesToIndex = files.map(filePath => ({
    filePath,
    content: readFileSync(filePath, 'utf-8'),
  }))

  log(`Indexing ${files.length} files across ${shardCount} shards...`)

  const result = await indexer.indexFilesParallel(filesToIndex)
  process.stderr.write('\n')

  await embedder.dispose()
  await shardedStore.dispose()

  return {
    chunks: result.totalChunks,
    files: result.filesProcessed,
    durationMs: result.durationMs,
  }
}

// =============================================================================
// Commands
// =============================================================================

async function runIndex(config: CliConfig): Promise<void> {
  log('Starting indexer...')
  log(`Directory: ${config.directory}`)
  log(`Mode: ${config.shards ? `sharded (${config.shards} shards)` : 'single database'}`)
  const embeddingMode = config.openai
    ? `OpenAI ${config.openaiModel} (concurrency: ${config.openaiConcurrency})`
    : config.gpu ? 'GPU (auto-detect)' : config.mlx ? 'MLX GPU' : 'CPU'
  log(`Embeddings: ${embeddingMode}`)

  const result = config.shards
    ? await runIndexSharded(config)
    : await runIndexSingle(config)

  log('Indexing complete!')
  log(`  Files indexed: ${result.files}`)
  log(`  Total chunks: ${result.chunks}`)
  log(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`)
}

async function runWatch(config: CliConfig): Promise<void> {
  log('Starting watcher...')
  log(`Directory: ${config.directory}`)
  log(`Mode: ${config.shards ? `sharded (${config.shards} shards)` : 'single database'}`)
  const embeddingMode = config.openai
    ? `OpenAI ${config.openaiModel} (concurrency: ${config.openaiConcurrency})`
    : config.gpu ? 'GPU (auto-detect)' : config.mlx ? 'MLX GPU' : 'CPU'
  log(`Embeddings: ${embeddingMode}`)

  const embedder = await getEmbedder(config)

  // Initialize store based on mode
  let indexer: Indexer | ShardedIndexer
  let disposeStore: () => Promise<void>

  if (config.shards) {
    const shardedStore = new ShardedVectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'sharded'),
      shardCount: config.shards,
    })
    await shardedStore.initialize()
    indexer = new ShardedIndexer({ shardedStore, embedder, chunker: new Chunker() })
    disposeStore = () => shardedStore.dispose()
  } else {
    const vectorStore = new VectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
    })
    await vectorStore.initialize()
    indexer = new Indexer({ embedder, vectorStore, chunker: new Chunker() })
    disposeStore = () => vectorStore.dispose()
  }

  // Initial index
  log('Running initial index...')
  const files = discoverFiles(config.directory, config.verbose)

  let indexed = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const content = readFileSync(file, 'utf-8')
      const chunks = await indexer.indexFile(file, content)
      if (chunks > 0) indexed++
      logProgress(i + 1, files.length, file)
    } catch {
      // Skip errors
    }
  }
  process.stderr.write('\n')
  log(`Initial index complete: ${indexed} files`)

  // Watch for changes
  const pending = new Map<string, NodeJS.Timeout>()
  const DEBOUNCE_MS = 500

  log('Watching for changes... (Ctrl+C to stop)')

  const watcher = watch(config.directory, { recursive: true }, (event, filename) => {
    if (!filename) return

    const fullPath = join(config.directory, filename)
    const ext = extname(filename).toLowerCase()

    if (!CODE_EXTENSIONS.has(ext)) return

    const parts = filename.split('/')
    if (parts.some((p) => SKIP_DIRS.has(p))) return

    const existing = pending.get(fullPath)
    if (existing) clearTimeout(existing)

    pending.set(
      fullPath,
      setTimeout(async () => {
        pending.delete(fullPath)
        try {
          const stat = statSync(fullPath)
          if (stat.isFile()) {
            const content = readFileSync(fullPath, 'utf-8')
            const chunks = await indexer.indexFile(fullPath, content)
            if (chunks > 0) {
              log(`Indexed: ${relative(config.directory, fullPath)} (${chunks} chunks)`)
            }
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            await indexer.deleteFile(fullPath)
            log(`Removed: ${relative(config.directory, fullPath)}`)
          }
        }
      }, DEBOUNCE_MS)
    )
  })

  const shutdown = async () => {
    log('Shutting down...')
    watcher.close()
    await embedder.dispose()
    await disposeStore()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await new Promise(() => {})
}

async function runSearch(config: CliConfig): Promise<void> {
  if (!config.query) {
    log('Error: No query provided')
    log('Usage: mgrep-local search "your query"')
    process.exit(1)
  }

  const embedder = await getEmbedder(config)

  let results: any[]

  if (config.shards) {
    const shardedStore = new ShardedVectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'sharded'),
      shardCount: config.shards,
    })
    await shardedStore.initialize()
    const searcher = new ShardedSearcher(embedder, shardedStore)
    results = await searcher.search(config.query)
    await shardedStore.dispose()
  } else {
    const vectorStore = new VectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
    })
    await vectorStore.initialize()
    const searcher = new Searcher(embedder, vectorStore)
    results = await searcher.search(config.query)
    await vectorStore.dispose()
  }

  await embedder.dispose()

  if (results.length === 0) {
    console.log('No results found.')
    return
  }

  console.log(`\nFound ${results.length} results:\n`)

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const lines = `L${r.metadata.startLine}-${r.metadata.endLine}`
    const score = (r.similarity * 100).toFixed(1)
    console.log(`[${i + 1}] ${r.filePath}:${lines} (${score}%)`)
    console.log('```' + r.metadata.language)
    console.log(r.content)
    console.log('```\n')
  }
}

async function runBenchmark(config: CliConfig): Promise<void> {
  log('=== BENCHMARK: Single vs Sharded ===')
  log(`Directory: ${config.directory}`)

  const files = discoverFiles(config.directory, config.verbose)
  log(`Files to index: ${files.length}`)

  if (files.length === 0) {
    log('No files found to benchmark')
    return
  }

  // Test queries
  const testQueries = [
    'authentication middleware',
    'error handling',
    'database connection',
    'file reader',
    'export function',
  ]

  // Benchmark single mode
  log('\n--- Single Database Mode ---')

  const singleConfig = { ...config, shards: undefined }
  const singleIndexResult = await runIndexSingle(singleConfig)

  log(`Index time: ${(singleIndexResult.durationMs / 1000).toFixed(2)}s`)
  log(`Files: ${singleIndexResult.files}, Chunks: ${singleIndexResult.chunks}`)

  // Search benchmark for single
  const embedder = await getEmbedder({ ...config, verbose: false })

  const vectorStore = new VectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
  })
  await vectorStore.initialize()
  const singleSearcher = new Searcher(embedder, vectorStore)

  let singleSearchTotal = 0
  for (const query of testQueries) {
    const start = Date.now()
    await singleSearcher.search(query, { limit: 10 })
    singleSearchTotal += Date.now() - start
  }
  const singleSearchAvg = singleSearchTotal / testQueries.length

  log(`Search avg: ${singleSearchAvg.toFixed(1)}ms (${testQueries.length} queries)`)
  await vectorStore.dispose()

  // Benchmark sharded mode (8 shards)
  log('\n--- Sharded Mode (8 shards) ---')

  const shardedConfig = { ...config, shards: 8 }
  const shardedIndexResult = await runIndexSharded(shardedConfig)

  log(`Index time: ${(shardedIndexResult.durationMs / 1000).toFixed(2)}s`)
  log(`Files: ${shardedIndexResult.files}, Chunks: ${shardedIndexResult.chunks}`)

  // Search benchmark for sharded
  const shardedStore = new ShardedVectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'sharded'),
    shardCount: 8,
  })
  await shardedStore.initialize()
  const shardedSearcher = new ShardedSearcher(embedder, shardedStore)

  let shardedSearchTotal = 0
  for (const query of testQueries) {
    const start = Date.now()
    await shardedSearcher.search(query, { limit: 10 })
    shardedSearchTotal += Date.now() - start
  }
  const shardedSearchAvg = shardedSearchTotal / testQueries.length

  log(`Search avg: ${shardedSearchAvg.toFixed(1)}ms (${testQueries.length} queries)`)
  await shardedStore.dispose()
  await embedder.dispose()

  // Summary
  log('\n=== RESULTS ===')
  log(`Index speedup: ${(singleIndexResult.durationMs / shardedIndexResult.durationMs).toFixed(2)}x`)
  log(`Search speedup: ${(singleSearchAvg / shardedSearchAvg).toFixed(2)}x`)

  const recommendation = shardedIndexResult.durationMs < singleIndexResult.durationMs
    ? 'Sharded mode is faster for this codebase'
    : 'Single mode is faster for this codebase'
  log(`\nRecommendation: ${recommendation}`)
}

async function runServe(config: CliConfig): Promise<void> {
  if (config.verbose) {
    log('Starting MCP server...')
    if (config.shards) {
      log(`Sharded mode: ${config.shards} shards`)
    }
  }

  const server = new MgrepMcpServer({
    workspaceDir: config.directory,
    dbPath: config.dbPath,
    modelCacheDir: config.modelCacheDir,
    verbose: config.verbose,
  })

  process.on('SIGINT', async () => {
    if (config.verbose) log('Received SIGINT, shutting down...')
    await server.dispose()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    if (config.verbose) log('Received SIGTERM, shutting down...')
    await server.dispose()
    process.exit(0)
  })

  try {
    await server.run()
  } catch (error) {
    console.error('[mgrep] Fatal error:', error)
    process.exit(1)
  }
}

async function runStatus(config: CliConfig): Promise<void> {
  log('Checking index status...')

  if (config.shards) {
    const shardedStore = new ShardedVectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'sharded'),
      shardCount: config.shards,
    })
    await shardedStore.initialize()
    const stats = await shardedStore.getStats()

    console.log('\n=== Sharded Index Status ===')
    console.log(`Mode: Sharded (${stats.shardCount} shards)`)
    console.log(`Files indexed: ${stats.totalFiles}`)
    console.log(`Total chunks: ${stats.totalChunks}`)
    console.log(`Database size: ${formatBytes(stats.databaseSize)}`)
    console.log(`Last indexed: ${stats.lastIndexedAt?.toISOString() ?? 'Never'}`)

    console.log('\nPer-shard breakdown:')
    for (const shard of stats.shardStats) {
      console.log(`  Shard ${shard.id}: ${shard.fileCount} files, ${shard.chunkCount} chunks`)
    }

    await shardedStore.dispose()
  } else {
    const vectorStore = new VectorStore({
      dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
    })
    await vectorStore.initialize()
    const stats = await vectorStore.getStats()

    console.log('\n=== Index Status ===')
    console.log(`Mode: Single database`)
    console.log(`Files indexed: ${stats.totalFiles}`)
    console.log(`Total chunks: ${stats.totalChunks}`)
    console.log(`Database size: ${formatBytes(stats.databaseSize)}`)
    console.log(`Last indexed: ${stats.lastIndexedAt?.toISOString() ?? 'Never'}`)

    await vectorStore.dispose()
  }
}

function printHelp(): void {
  console.log(`
mgrep-local - Local semantic code search

Usage:
  mgrep-local <command> [directory] [options]

Commands:
  index [dir]      Index a directory (default: current directory)
  watch [dir]      Watch directory and index changes (default: .)
  search <query>   Search the index
  serve            Start MCP server for Claude Code
  status           Show index status
  benchmark [dir]  Compare single vs sharded performance

Options:
  --openai              Use OpenAI embeddings API (requires OPENAI_API_KEY)
                        Models: text-embedding-3-small (1536d), text-embedding-3-large (3072d)
                        Great for high-quality embeddings with parallel API calls
                        Can also use MGREP_OPENAI=1

  --openai-model <name> OpenAI model to use
                        Options: text-embedding-3-small, text-embedding-3-large
                        Default: text-embedding-3-small
                        Can also use MGREP_OPENAI_MODEL

  --openai-concurrency <n>  Parallel API calls for OpenAI (default: 4)
                        Higher = faster but may hit rate limits
                        Can also use MGREP_OPENAI_CONCURRENCY

  --gpu                 Use GPU acceleration (auto-detect best backend)
                        On Apple Silicon: uses Metal via node-llama-cpp
                        No external dependencies - pure TypeScript!
                        Can also use MGREP_GPU=1

  --mlx                 Use MLX GPU acceleration (requires Python server)
                        Requires: pip install qwen3-embeddings-mlx
                        Then run: python server.py
                        Can also use MGREP_MLX=1

  --mlx-server <url>    MLX embedding server URL
                        Default: http://localhost:8000
                        Can also use MGREP_MLX_SERVER

  --shards <n>          Enable sharded mode with n shards (default: single DB)
                        Enables parallel processing across shards
                        Can also use MGREP_SHARDS environment variable

  --force, -f           Force reindexing even if files haven't changed
                        Use when switching embedding backends (GPU → OpenAI)
                        Clears existing index before reindexing

  --db-path <path>      Path to database directory
                        Default: ~/.cache/mgrep-local/vectors
                        Can also use MGREP_DB_PATH environment variable

  --model-cache <path>  Directory to cache embedding models
                        Default: ~/.cache/mgrep-local/models

  --verbose, -v         Enable verbose logging
                        Can also use MGREP_VERBOSE=1

  --help, -h            Show this help message

Examples:
  # Index with OpenAI (high quality, parallel API calls)
  OPENAI_API_KEY=sk-... mgrep-local index --openai

  # Index with OpenAI + shards for maximum parallelism
  OPENAI_API_KEY=sk-... mgrep-local index --openai --shards 8 --openai-concurrency 8

  # Use large model for better quality
  mgrep-local index --openai --openai-model text-embedding-3-large

  # Index with GPU (recommended for local - no API costs!)
  mgrep-local index --gpu

  # Index with shards + GPU for maximum performance
  mgrep-local index --gpu --shards 8

  # Index current directory (CPU mode)
  mgrep-local index

  # Watch with OpenAI mode
  mgrep-local watch --openai -v

  # Search the index
  mgrep-local search "authentication handler"

  # Benchmark single vs sharded
  mgrep-local benchmark .

OpenAI Embeddings:
  Requires OPENAI_API_KEY environment variable
  Supports parallel API calls for fast indexing
  Costs: ~$0.02 per 1M tokens (text-embedding-3-small)
  With --shards, each shard gets its own parallel worker

GPU Acceleration:
  --gpu uses node-llama-cpp with Metal (Apple Silicon) or Vulkan (others)
  First run downloads embedding model (~130MB for bge-small)
  No Python or external servers required!

For Claude Code integration, add to your .mcp.json:
  {
    "mcpServers": {
      "mgrep-local": {
        "command": "npx",
        "args": ["@ai-cluso/mgrep-local", "serve"]
      }
    }
  }
`)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const config = parseArgs()

  switch (config.command) {
    case 'index':
      await runIndex(config)
      break

    case 'watch':
      await runWatch(config)
      break

    case 'search':
      await runSearch(config)
      break

    case 'serve':
      await runServe(config)
      break

    case 'status':
      await runStatus(config)
      break

    case 'benchmark':
      await runBenchmark(config)
      break

    case 'help':
      printHelp()
      break
  }
}

main().catch((error) => {
  console.error('[mgrep] Fatal error:', error)
  process.exit(1)
})
