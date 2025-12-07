#!/usr/bin/env node
/**
 * mgrep-local CLI entry point
 *
 * Commands:
 *   mgrep-local index [directory]  - Index a directory (default: current dir)
 *   mgrep-local watch [directory]  - Watch and index changes (default: current dir)
 *   mgrep-local serve              - Start MCP server for Claude Code
 *   mgrep-local status             - Show index status
 *
 * Options:
 *   --db-path <path>     Path to the database directory
 *   --model-cache <path> Directory to cache embedding models
 *   --verbose, -v        Enable verbose logging
 *   --help, -h           Show this help message
 */

import { resolve, join, extname, relative } from 'path'
import { readFileSync, statSync, watch, readdirSync } from 'fs'
import { homedir } from 'os'

import { MgrepMcpServer } from './server'
import { Embedder } from '../core/Embedder'
import { VectorStore } from '../core/VectorStore'
import { Chunker } from '../core/Chunker'
import { Indexer } from '../core/Indexer'

// =============================================================================
// Configuration
// =============================================================================

interface CliConfig {
  command: 'index' | 'watch' | 'serve' | 'status' | 'help'
  directory: string
  dbPath?: string
  modelCacheDir?: string
  verbose: boolean
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
  const config: CliConfig = {
    command: 'serve',
    directory: process.cwd(),
    verbose: false,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case 'index':
        config.command = 'index'
        // Next arg might be directory
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.directory = resolve(args[++i])
        }
        break

      case 'watch':
        config.command = 'watch'
        // Next arg might be directory
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          config.directory = resolve(args[++i])
        }
        break

      case 'serve':
        config.command = 'serve'
        break

      case 'status':
        config.command = 'status'
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
        // If no command yet and doesn't start with -, treat as directory
        if (!arg.startsWith('-') && config.command === 'serve') {
          // Assume they want to index if they just pass a path
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
// Commands
// =============================================================================

async function runIndex(config: CliConfig): Promise<void> {
  log('Starting indexer...')
  log(`Directory: ${config.directory}`)
  log(`Database: ${config.dbPath ?? DEFAULT_DB_DIR}`)

  // Discover files
  const files = discoverFiles(config.directory, config.verbose)
  if (files.length === 0) {
    log('No files found to index')
    return
  }

  log(`Found ${files.length} files to index`)

  // Initialize components
  log('Loading embedding model (first run may download ~30MB)...')

  const embedder = new Embedder({
    cacheDir: config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
    verbose: config.verbose,
  })
  await embedder.initialize()

  const vectorStore = new VectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
  })
  await vectorStore.initialize()

  const chunker = new Chunker()
  const indexer = new Indexer({
    embedder,
    vectorStore,
    chunker,
  })

  log('Indexing files...')

  let indexed = 0
  let chunks = 0
  let errors = 0

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
      errors++
      if (config.verbose) {
        log(`Error indexing ${file}:`, error)
      }
    }
  }

  // Clear progress line
  process.stderr.write('\n')

  // Print summary
  log('Indexing complete!')
  log(`  Files indexed: ${indexed}`)
  log(`  Total chunks: ${chunks}`)
  if (errors > 0) {
    log(`  Errors: ${errors}`)
  }

  // Cleanup
  await embedder.dispose()
  await vectorStore.dispose()
}

async function runWatch(config: CliConfig): Promise<void> {
  log('Starting watcher...')
  log(`Directory: ${config.directory}`)
  log(`Database: ${config.dbPath ?? DEFAULT_DB_DIR}`)

  // Initialize components
  log('Loading embedding model...')

  const embedder = new Embedder({
    cacheDir: config.modelCacheDir ?? DEFAULT_MODEL_CACHE,
    verbose: config.verbose,
  })
  await embedder.initialize()

  const vectorStore = new VectorStore({
    dbPath: config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance'),
  })
  await vectorStore.initialize()

  const chunker = new Chunker()
  const indexer = new Indexer({
    embedder,
    vectorStore,
    chunker,
  })

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
      // Skip errors during initial index
    }
  }
  process.stderr.write('\n')
  log(`Initial index complete: ${indexed} files`)

  // Debounce map for file changes
  const pending = new Map<string, NodeJS.Timeout>()
  const DEBOUNCE_MS = 500

  // Watch for changes
  log('Watching for changes... (Ctrl+C to stop)')

  const watcher = watch(config.directory, { recursive: true }, (event, filename) => {
    if (!filename) return

    const fullPath = join(config.directory, filename)
    const ext = extname(filename).toLowerCase()

    // Skip non-code files
    if (!CODE_EXTENSIONS.has(ext)) return

    // Skip directories in SKIP_DIRS
    const parts = filename.split('/')
    if (parts.some((p) => SKIP_DIRS.has(p))) return

    // Debounce rapid changes
    const existing = pending.get(fullPath)
    if (existing) {
      clearTimeout(existing)
    }

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
          // File might have been deleted
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            await indexer.deleteFile(fullPath)
            log(`Removed: ${relative(config.directory, fullPath)}`)
          } else if (config.verbose) {
            log(`Error: ${fullPath}`, error)
          }
        }
      }, DEBOUNCE_MS)
    )
  })

  // Handle shutdown
  const shutdown = async () => {
    log('Shutting down...')
    watcher.close()
    await embedder.dispose()
    await vectorStore.dispose()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive
  await new Promise(() => {})
}

async function runServe(config: CliConfig): Promise<void> {
  if (config.verbose) {
    log('Starting MCP server...')
  }

  const server = new MgrepMcpServer({
    workspaceDir: config.directory,
    dbPath: config.dbPath,
    modelCacheDir: config.modelCacheDir,
    verbose: config.verbose,
  })

  process.on('SIGINT', async () => {
    if (config.verbose) {
      log('Received SIGINT, shutting down...')
    }
    await server.dispose()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    if (config.verbose) {
      log('Received SIGTERM, shutting down...')
    }
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
  const dbPath = config.dbPath ?? join(DEFAULT_DB_DIR, 'index.lance')

  log('Checking index status...')
  log(`Database: ${dbPath}`)

  try {
    const vectorStore = new VectorStore({ dbPath })
    await vectorStore.initialize()

    const stats = await vectorStore.getStats()

    console.log('\n=== Index Status ===')
    console.log(`Files indexed: ${stats.totalFiles}`)
    console.log(`Total chunks: ${stats.totalChunks}`)
    console.log(`Database size: ${formatBytes(stats.databaseSize)}`)
    console.log(`Last indexed: ${stats.lastIndexedAt?.toISOString() ?? 'Never'}`)

    await vectorStore.dispose()
  } catch (error) {
    log('Error reading index:', error)
    process.exit(1)
  }
}

function printHelp(): void {
  console.log(`
mgrep-local - Local semantic code search

Usage:
  mgrep-local <command> [directory] [options]

Commands:
  index [dir]     Index a directory (default: current directory)
  watch [dir]     Watch directory and index changes (default: .)
  serve           Start MCP server for Claude Code
  status          Show index status

Options:
  --db-path <path>      Path to database directory
                        Default: ~/.cache/mgrep-local/vectors

  --model-cache <path>  Directory to cache embedding models
                        Default: ~/.cache/mgrep-local/models

  --verbose, -v         Enable verbose logging

  --help, -h            Show this help message

Examples:
  # Index current directory
  mgrep-local index

  # Index a specific project
  mgrep-local index /path/to/project -v

  # Watch current directory for changes
  mgrep-local watch

  # Watch with verbose output
  mgrep-local watch . -v

  # Start MCP server for Claude Code
  mgrep-local serve

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

    case 'serve':
      await runServe(config)
      break

    case 'status':
      await runStatus(config)
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
