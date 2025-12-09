// @ts-nocheck
/**
 * File operation routes for Cluso server
 *
 * Maps REST endpoints to file system handlers.
 * All operations are scoped to the working directory for security.
 */

import { Hono } from 'hono'
import {
  readFile,
  writeFile,
  createFile,
  deleteFile,
  renameFile,
  copyFile,
  listDirectory,
  createDirectory,
  deleteDirectory,
  exists,
  stat,
  glob,
  searchInFiles,
  getTree,
} from '../../handlers/files.js'
import { success, error } from '../../types/api.js'

/**
 * Creates file operation routes handler
 */
export function createFilesRoutes(): Hono {
  const router = new Hono()

  /**
   * POST /api/files/read
   * Read file content
   *
   * Body: { path: string }
   */
  router.post('/read', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await readFile(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/write
   * Write file content (overwrites if exists)
   *
   * Body: { path: string; content: string }
   */
  router.post('/write', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string; content?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      if (body.content === undefined) {
        return c.json(error('Missing required field: content'), 400)
      }

      const result = await writeFile(cwd, body.path, body.content)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/create
   * Create new file (fails if already exists)
   *
   * Body: { path: string; content?: string }
   */
  router.post('/create', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string; content?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await createFile(cwd, body.path, body.content)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/delete
   * Delete file
   *
   * Body: { path: string }
   */
  router.post('/delete', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await deleteFile(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/rename
   * Rename or move file
   *
   * Body: { oldPath: string; newPath: string }
   */
  router.post('/rename', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { oldPath?: string; newPath?: string }

      if (!body.oldPath) {
        return c.json(error('Missing required field: oldPath'), 400)
      }

      if (!body.newPath) {
        return c.json(error('Missing required field: newPath'), 400)
      }

      const result = await renameFile(cwd, body.oldPath, body.newPath)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/copy
   * Copy file
   *
   * Body: { srcPath: string; destPath: string }
   */
  router.post('/copy', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { srcPath?: string; destPath?: string }

      if (!body.srcPath) {
        return c.json(error('Missing required field: srcPath'), 400)
      }

      if (!body.destPath) {
        return c.json(error('Missing required field: destPath'), 400)
      }

      const result = await copyFile(cwd, body.srcPath, body.destPath)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/list
   * List directory contents with metadata
   *
   * Body: { path?: string }
   */
  router.post('/list', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }
      const result = await listDirectory(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/mkdir
   * Create directory recursively
   *
   * Body: { path: string }
   */
  router.post('/mkdir', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await createDirectory(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/rmdir
   * Delete directory recursively
   *
   * Body: { path: string }
   */
  router.post('/rmdir', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await deleteDirectory(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/exists
   * Check if path exists
   *
   * Body: { path: string }
   */
  router.post('/exists', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await exists(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/stat
   * Get file statistics
   *
   * Body: { path: string }
   */
  router.post('/stat', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { path?: string }

      if (!body.path) {
        return c.json(error('Missing required field: path'), 400)
      }

      const result = await stat(cwd, body.path)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/glob
   * Glob pattern matching
   *
   * Body: { pattern: string }
   */
  router.post('/glob', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as { pattern?: string }

      if (!body.pattern) {
        return c.json(error('Missing required field: pattern'), 400)
      }

      const result = await glob(cwd, body.pattern)

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/search
   * Search files with regex pattern
   *
   * Body: {
   *   pattern: string
   *   glob?: string
   *   limit?: number
   *   contextLines?: number
   * }
   */
  router.post('/search', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as {
        pattern?: string
        glob?: string
        limit?: number
        contextLines?: number
      }

      if (!body.pattern) {
        return c.json(error('Missing required field: pattern'), 400)
      }

      const result = await searchInFiles(cwd, body.pattern, {
        glob: body.glob,
        limit: body.limit,
        contextLines: body.contextLines,
      })

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  /**
   * POST /api/files/tree
   * Get recursive directory tree
   *
   * Body: {
   *   path?: string
   *   maxDepth?: number
   *   ignore?: string[]
   * }
   */
  router.post('/tree', async (c) => {
    const cwd = c.get('cwd') as string

    try {
      const body = (await c.req.json()) as {
        path?: string
        maxDepth?: number
        ignore?: string[]
      }

      const result = await getTree(cwd, {
        dirPath: body.path,
        maxDepth: body.maxDepth,
        ignore: body.ignore,
      })

      if (result.success) {
        return c.json(success(result.data))
      }

      return c.json(error(result.error, result.code), 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json(error(`Invalid request: ${message}`), 400)
    }
  })

  return router
}
