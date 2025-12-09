// @ts-nocheck
/**
 * Backup API Routes for Cluso Server
 *
 * Provides REST endpoints for project backup management
 */

import { Hono } from 'hono'

import {
  createBackup,
  restoreBackup,
  listBackups,
  getBackupContent,
  deleteBackup,
  cleanupBackups,
} from '../../handlers/backup.js'
import { success, error } from '../../types/api.js'

/**
 * Creates backup routes handler
 */
export function createBackupRoutes(): Hono {
  const router = new Hono()

  /**
   * POST /api/backup/create
   * Creates a new backup of the project
   *
   * Body: { description: string }
   */
  router.post('/create', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { description: string }
      if (!body.description) {
        return c.json(error('Description is required'), 400)
      }

      const result = await createBackup(cwd, body.description)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success(result.data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * GET /api/backup/list
   * Lists all backups for the project
   */
  router.get('/list', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const result = await listBackups(cwd)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success({ backups: result.data }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to list backups: ${message}`), 500)
    }
  })

  /**
   * POST /api/backup/restore/:backupId
   * Restores project from a backup
   *
   * Params: { backupId: string }
   */
  router.post('/restore/:backupId', async (c) => {
    const cwd = c.get('cwd') as string
    const backupId = c.req.param('backupId')

    if (!backupId) {
      return c.json(error('Backup ID is required'), 400)
    }

    try {
      const result = await restoreBackup(cwd, backupId)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success({ message: result.data }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to restore backup: ${message}`), 500)
    }
  })

  /**
   * GET /api/backup/content/:backupId
   * Gets the content of a file from a backup
   *
   * Params: { backupId: string }
   * Query: { file: string }
   */
  router.get('/content/:backupId', async (c) => {
    const cwd = c.get('cwd') as string
    const backupId = c.req.param('backupId')
    const file = c.req.query('file')

    if (!backupId || !file) {
      return c.json(error('Backup ID and file path are required'), 400)
    }

    try {
      const result = await getBackupContent(cwd, backupId, file)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success({ content: result.data }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to read backup file: ${message}`), 400)
    }
  })

  /**
   * DELETE /api/backup/:backupId
   * Deletes a specific backup
   *
   * Params: { backupId: string }
   */
  router.delete('/:backupId', async (c) => {
    const cwd = c.get('cwd') as string
    const backupId = c.req.param('backupId')

    if (!backupId) {
      return c.json(error('Backup ID is required'), 400)
    }

    try {
      const result = await deleteBackup(cwd, backupId)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success({ message: result.data }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to delete backup: ${message}`), 500)
    }
  })

  /**
   * DELETE /api/backup/cleanup
   * Deletes all backups for the project
   */
  router.delete('/cleanup', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const result = await cleanupBackups(cwd)

      if (!result.success) {
        return c.json(error(result.error), 400)
      }

      return c.json(success({ message: `Deleted ${result.data.count} backups` }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Failed to cleanup backups: ${message}`), 500)
    }
  })

  return router
}
