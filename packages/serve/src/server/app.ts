/**
 * Cluso Server - Main Hono Application Factory
 *
 * Creates and manages the HTTP server with:
 * - Middleware stack (CORS, auth, error handling)
 * - API routes (git, files)
 * - WebSocket server for real-time communication
 * - Static file serving (SPA mode)
 */

import { Hono, type Context } from 'hono'
import { serve, type ServerType } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { WebSocketServer, type WebSocket } from 'ws'
import { fileURLToPath } from 'url'
import type { Server } from 'http'

import { corsMiddleware, authMiddleware, errorHandler } from './middleware/index.js'
import { createGitRoutes } from './routes/git.js'
import { createFilesRoutes } from './routes/files.js'
import { createBackupRoutes } from './routes/backup.js'
import { createOAuthRoutes } from './routes/oauth.js'
import { WebSocketManager } from '../websocket/manager.js'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Define context variables type
type Variables = {
  cwd: string
}

// ==========================================
// Server Configuration Types
// ==========================================

export interface ServerOptions {
  port: number
  host: string
  cwd: string
  apiOnly: boolean
  apiKey?: string
}

export interface ClusoServer {
  close: (callback?: () => void) => void
}

// ==========================================
// App Factory
// ==========================================

/**
 * Creates a new Hono application with all middleware and routes configured
 *
 * @param options Server configuration options
 * @returns Configured Hono app instance
 */
export function createApp(options: ServerOptions): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>()

  // ==========================================
  // Middleware
  // ==========================================

  // 1. Error handler (outermost to catch all errors)
  app.use(errorHandler())

  // 2. CORS middleware
  app.use(corsMiddleware())

  // 3. Authentication middleware (optional)
  app.use(authMiddleware(options.apiKey))

  // 4. Set working directory in context for all routes
  app.use(async (c, next) => {
    c.set('cwd', options.cwd)
    await next()
  })

  // ==========================================
  // API Routes
  // ==========================================

  // Mount API routes under /api
  const gitRoutes = createGitRoutes()
  const filesRoutes = createFilesRoutes()
  const backupRoutes = createBackupRoutes()
  const oauthRoutes = createOAuthRoutes()

  app.route('/api/git', gitRoutes)
  app.route('/api/files', filesRoutes)
  app.route('/api/backup', backupRoutes)
  app.route('/api/oauth', oauthRoutes)

  // ==========================================
  // Static File Serving & SPA Fallback
  // ==========================================

  if (!options.apiOnly) {
    // Serve static files from the 'public' directory
    const publicDir = path.join(__dirname, '../../public')

    if (existsSync(publicDir)) {
      // Serve static assets
      app.use('/assets/*', serveStatic({ root: publicDir }))
      app.use('/favicon.ico', serveStatic({ path: 'favicon.ico', root: publicDir }))

      // SPA fallback: serve index.html for non-API GET requests
      app.get('*', async (c) => {
        // Don't serve index.html for API routes or non-GET requests
        if (c.req.path.startsWith('/api/')) {
          return c.notFound()
        }

        const indexPath = path.join(publicDir, 'index.html')
        if (existsSync(indexPath)) {
          c.header('Content-Type', 'text/html; charset=UTF-8')
          const content = readFileSync(indexPath, 'utf-8')
          return c.html(content)
        }

        return c.notFound()
      })
    } else {
      // Public directory doesn't exist - log warning
      console.warn(`[WARN] Public directory not found at ${publicDir}. Static files will not be served.`)

      // Still provide SPA fallback message
      app.get('*', (c) => {
        if (!c.req.path.startsWith('/api/')) {
          return c.json(
            {
              success: false,
              data: null,
              error: 'UI files not found. Run build to generate public assets.',
              timestamp: new Date().toISOString(),
            },
            404
          )
        }
        return c.notFound()
      })
    }
  }

  return app
}

// ==========================================
// Server Start
// ==========================================

/**
 * Starts the Cluso server with HTTP and WebSocket support
 *
 * @param options Server configuration options
 * @returns Promise that resolves to server instance with close method
 */
export async function startServer(options: ServerOptions): Promise<ClusoServer> {
  const app = createApp(options)

  // Create HTTP server using Hono's Node.js adapter
  const server = serve({
    fetch: app.fetch,
    port: options.port,
    hostname: options.host,
  })

  // Create WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server: server as Server })

  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(wss)

  // Set up WebSocket connection handling
  wss.on('connection', (ws) => {
    wsManager.handleConnection(ws, options.cwd)
  })

  // Return server interface
  return {
    close: (callback) => {
      // Close WebSocket server first
      wss.close(() => {
        // Then close HTTP server
        server.close(callback)
      })
    },
  }
}
