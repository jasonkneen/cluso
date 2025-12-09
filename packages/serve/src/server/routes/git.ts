// @ts-nocheck
/**
 * Git API Routes for Cluso Server
 *
 * Provides REST endpoints for git operations
 */

import { Hono } from 'hono'

import {
  getCurrentBranch,
  getBranches,
  getStatus,
  checkout,
  checkoutFile,
  createBranch,
  commit,
  push,
  pull,
  stash,
  stashPop,
} from '../../handlers/git.js'
import { success, error } from '../../types/api.js'

/**
 * Creates git routes handler
 */
export function createGitRoutes(): Hono {
  const router = new Hono()

  /**
   * GET /api/git/current-branch
   * Returns the currently checked out branch
   */
  router.get('/current-branch', (c) => {
    const cwd = c.get('cwd') as string
    const result = getCurrentBranch(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success({ branch: result.data }))
  })

  /**
   * GET /api/git/branches
   * Returns list of all local and remote branches
   */
  router.get('/branches', (c) => {
    const cwd = c.get('cwd') as string
    const result = getBranches(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success({ branches: result.data }))
  })

  /**
   * GET /api/git/status
   * Returns git status with file changes
   */
  router.get('/status', (c) => {
    const cwd = c.get('cwd') as string
    const result = getStatus(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success(result.data))
  })

  /**
   * POST /api/git/checkout
   * Switches to a different branch
   *
   * Body: { branch: string }
   */
  router.post('/checkout', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = await c.req.json<{ branch: string }>()
      if (!body.branch) {
        return c.json(error('Branch name is required'), 400)
      }

      const result = checkout(cwd, body.branch)
      if (!result.success) {
        return c.json(error(result.error!), 400)
      }

      return c.json(success({ message: `Switched to branch: ${body.branch}` }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/git/checkout-file
   * Restores a specific file to its last committed state
   *
   * Body: { file: string }
   */
  router.post('/checkout-file', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = await c.req.json<{ file: string }>()
      if (!body.file) {
        return c.json(error('File path is required'), 400)
      }

      const result = checkoutFile(cwd, body.file)
      if (!result.success) {
        return c.json(error(result.error!), 400)
      }

      return c.json(success({ message: `Restored file: ${body.file}` }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/git/create-branch
   * Creates a new branch
   *
   * Body: { name: string }
   */
  router.post('/create-branch', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = await c.req.json<{ name: string }>()
      if (!body.name) {
        return c.json(error('Branch name is required'), 400)
      }

      const result = createBranch(cwd, body.name)
      if (!result.success) {
        return c.json(error(result.error!), 400)
      }

      return c.json(success({ message: `Created and switched to branch: ${body.name}` }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/git/commit
   * Stages all changes and creates a commit
   *
   * Body: { message: string }
   */
  router.post('/commit', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = await c.req.json<{ message: string }>()
      if (!body.message) {
        return c.json(error('Commit message is required'), 400)
      }

      const result = commit(cwd, body.message)
      if (!result.success) {
        return c.json(error(result.error!), 400)
      }

      return c.json(success({ message: `Commit created: ${body.message}` }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/git/push
   * Pushes commits to remote repository
   */
  router.post('/push', (c) => {
    const cwd = c.get('cwd') as string
    const result = push(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success({ message: 'Pushed to remote repository' }))
  })

  /**
   * POST /api/git/pull
   * Pulls changes from remote repository
   */
  router.post('/pull', (c) => {
    const cwd = c.get('cwd') as string
    const result = pull(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success({ message: 'Pulled from remote repository' }))
  })

  /**
   * POST /api/git/stash
   * Stashes changes with optional message
   *
   * Body: { message?: string }
   */
  router.post('/stash', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { message?: string }
      const result = stash(cwd, body.message)

      if (!result.success) {
        return c.json(error(result.error!), 400)
      }

      return c.json(success({ message: 'Changes stashed' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/git/stash-pop
   * Pops stashed changes
   */
  router.post('/stash-pop', (c) => {
    const cwd = c.get('cwd') as string
    const result = stashPop(cwd)

    if (!result.success) {
      return c.json(error(result.error!), 400)
    }

    return c.json(success({ message: 'Stashed changes restored' }))
  })

  return router
}
