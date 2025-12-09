#!/usr/bin/env node
import { Command } from 'commander'
import pc from 'picocolors'
import open from 'open'
import { resolve } from 'path'
import { existsSync } from 'fs'

const program = new Command()

program
  .name('cluso')
  .description('AI-powered development assistant - run anywhere with npx')
  .version('0.1.0')
  .option('-p, --port <number>', 'Server port', '3000')
  .option('--api-only', 'Start API server only (no UI)')
  .option('--cwd <path>', 'Working directory for project operations', process.cwd())
  .option('--host <host>', 'Host to bind to', 'localhost')
  .option('--no-open', "Don't open browser automatically")
  .option('--api-key <key>', 'Require API key for all requests')
  .action(async (options) => {
    const { port, apiOnly, cwd, host, open: shouldOpen, apiKey } = options
    const portNum = parseInt(port, 10)
    const projectPath = resolve(cwd)

    // Validate project path exists
    if (!existsSync(projectPath)) {
      console.error(pc.red(`Error: Directory does not exist: ${projectPath}`))
      process.exit(1)
    }

    console.log(pc.cyan('\n  🚀 Starting Cluso...\n'))
    console.log(pc.dim(`  Project: ${projectPath}`))
    console.log(pc.dim(`  Mode:    ${apiOnly ? 'API only' : 'Full UI + API'}`))

    try {
      // Dynamic import to avoid loading heavy deps until needed
      const { startServer } = await import('./server/app.js')

      const server = await startServer({
        port: portNum,
        host,
        apiOnly,
        cwd: projectPath,
        apiKey,
      })

      const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${portNum}`

      console.log('')
      console.log(pc.green(`  ✓ Server running at ${pc.bold(url)}`))
      console.log('')

      if (!apiOnly) {
        console.log(pc.dim('  API endpoints:'))
        console.log(pc.dim(`    GET  ${url}/api/git/current-branch`))
        console.log(pc.dim(`    GET  ${url}/api/git/status`))
        console.log(pc.dim(`    POST ${url}/api/files/read`))
        console.log(pc.dim(`    ...and 40+ more`))
        console.log('')
      }

      if (shouldOpen && !apiOnly) {
        console.log(pc.dim('  Opening browser...'))
        await open(url)
      }

      console.log(pc.dim('  Press Ctrl+C to stop\n'))

      // Handle graceful shutdown
      const shutdown = () => {
        console.log(pc.yellow('\n  Shutting down...'))
        server.close(() => {
          console.log(pc.green('  ✓ Server stopped\n'))
          process.exit(0)
        })
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    } catch (error) {
      console.error(pc.red(`\n  Error starting server: ${error}`))
      process.exit(1)
    }
  })

program.parse()
