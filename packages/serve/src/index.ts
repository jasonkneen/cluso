/**
 * Cluso Server - Programmatic API
 *
 * Use this module to start the Cluso server programmatically
 * instead of via the CLI.
 *
 * @example
 * ```typescript
 * import { startServer } from 'cluso'
 *
 * const server = await startServer({
 *   port: 3000,
 *   cwd: '/path/to/project',
 * })
 * ```
 */

export { startServer, createApp } from './server/app.js'
export type { ServerOptions, ClusoServer } from './server/app.js'

// Re-export types for consumers
export type { Result, APIResponse } from './types/api.js'
