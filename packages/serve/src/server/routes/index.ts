/**
 * Central export for all server routes
 *
 * Provides route factory functions that can be used to create
 * configured Hono sub-routers for mounting in the main app.
 */

export { createGitRoutes } from './git.js'
export { createFilesRoutes } from './files.js'
export { createBackupRoutes } from './backup.js'
export { createOAuthRoutes } from './oauth.js'
export { createAIRoutes } from './ai.js'
