#!/usr/bin/env node
/**
 * mgrep-local CLI entry point
 *
 * Starts the MCP server for use with Claude Code or other MCP clients.
 *
 * Usage:
 *   mgrep-local [options]
 *
 * Options:
 *   --db-path <path>     Path to the SQLite database
 *   --model-cache <path> Directory to cache embedding models
 *   --verbose            Enable verbose logging
 *   --help               Show this help message
 */

import { MgrepMcpServer } from './server'
import type { McpServerConfig } from './types'

function parseArgs(): McpServerConfig {
  const args = process.argv.slice(2)
  const config: McpServerConfig = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--db-path':
        config.dbPath = args[++i]
        break

      case '--model-cache':
        config.modelCacheDir = args[++i]
        break

      case '--workspace':
        config.workspaceDir = args[++i]
        break

      case '--verbose':
      case '-v':
        config.verbose = true
        break

      case '--help':
      case '-h':
        printHelp()
        process.exit(0)

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`)
          printHelp()
          process.exit(1)
        }
    }
  }

  return config
}

function printHelp(): void {
  console.log(`
mgrep-local - Local semantic code search via MCP

Usage:
  mgrep-local [options]

Options:
  --db-path <path>      Path to the SQLite database
                        Default: ~/.cache/mgrep-local/index.db

  --model-cache <path>  Directory to cache embedding models
                        Default: ~/.cache/mgrep-local/models

  --workspace <path>    Working directory for indexing
                        Default: current directory

  --verbose, -v         Enable verbose logging

  --help, -h            Show this help message

Examples:
  # Start MCP server with defaults
  mgrep-local

  # Start with custom database path
  mgrep-local --db-path ./my-index.db

  # Start with verbose logging
  mgrep-local --verbose

For Claude Code integration, add to your .mcp.json:
  {
    "mcpServers": {
      "mgrep-local": {
        "command": "npx",
        "args": ["@ai-cluso/mgrep-local"]
      }
    }
  }
`)
}

async function main(): Promise<void> {
  const config = parseArgs()

  if (config.verbose) {
    console.error('[mgrep-local] Starting MCP server...')
    console.error('[mgrep-local] Config:', JSON.stringify(config, null, 2))
  }

  const server = new MgrepMcpServer(config)

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    if (config.verbose) {
      console.error('[mgrep-local] Received SIGINT, shutting down...')
    }
    await server.dispose()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    if (config.verbose) {
      console.error('[mgrep-local] Received SIGTERM, shutting down...')
    }
    await server.dispose()
    process.exit(0)
  })

  try {
    await server.run()
  } catch (error) {
    console.error('[mgrep-local] Fatal error:', error)
    process.exit(1)
  }
}

main()
