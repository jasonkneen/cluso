// @ts-nocheck
/**
 * File system handlers for Cluso server
 *
 * Provides safe file operations with path validation and security checks.
 * All operations are scoped to the working directory to prevent directory traversal attacks.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { Readable } from 'stream'
import { promisify } from 'util'

import type { Result, FileInfo, SearchResult } from '../types/api.js'

/**
 * Sensitive directories that should never be accessed
 */
const SENSITIVE_DIRS = [
  '.ssh',
  '.aws',
  '.gnupg',
  '.kube',
  '.docker',
  '.env',
  '.git',
  'node_modules',
]

/**
 * Validate that a path is safe to access
 *
 * - Resolves to absolute path
 * - Ensures path is within cwd (prevents directory traversal)
 * - Blocks access to sensitive directories
 *
 * @throws Error if path is invalid or insecure
 */
function validatePath(cwd: string, filePath: string): string {
  const absWorkingDir = path.resolve(cwd)
  const targetPath = path.resolve(absWorkingDir, filePath)

  // Ensure path is within working directory
  if (!targetPath.startsWith(absWorkingDir + path.sep) && targetPath !== absWorkingDir) {
    throw new Error(`Path traversal detected: ${filePath}`)
  }

  // Check for sensitive directories
  const relativePath = path.relative(absWorkingDir, targetPath)
  const pathParts = relativePath.split(path.sep)

  for (const part of pathParts) {
    if (SENSITIVE_DIRS.includes(part)) {
      throw new Error(`Access to sensitive directory blocked: ${part}`)
    }
  }

  return targetPath
}

/**
 * Read file content
 */
export async function readFile(
  cwd: string,
  filePath: string
): Promise<Result<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>> {
  try {
    const validPath = validatePath(cwd, filePath)
    const content = await fs.readFile(validPath, 'utf-8')

    return {
      success: true,
      data: {
        path: filePath,
        content,
        encoding: 'utf-8',
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to read file: ${message}`,
      code: 'READ_ERROR',
    }
  }
}

/**
 * Write file content (overwrites if exists)
 */
export async function writeFile(
  cwd: string,
  filePath: string,
  content: string
): Promise<Result<{ path: string; bytesWritten: number }>> {
  try {
    const validPath = validatePath(cwd, filePath)

    // Ensure directory exists
    const dir = path.dirname(validPath)
    await fs.mkdir(dir, { recursive: true })

    await fs.writeFile(validPath, content, 'utf-8')

    return {
      success: true,
      data: {
        path: filePath,
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to write file: ${message}`,
      code: 'WRITE_ERROR',
    }
  }
}

/**
 * Create new file (fails if already exists)
 */
export async function createFile(
  cwd: string,
  filePath: string,
  content: string = ''
): Promise<Result<{ path: string }>> {
  try {
    const validPath = validatePath(cwd, filePath)

    // Check if file already exists
    try {
      await fs.access(validPath)
      return {
        success: false,
        error: `File already exists: ${filePath}`,
        code: 'FILE_EXISTS',
      }
    } catch {
      // File doesn't exist, which is what we want
    }

    // Ensure directory exists
    const dir = path.dirname(validPath)
    await fs.mkdir(dir, { recursive: true })

    await fs.writeFile(validPath, content, 'utf-8')

    return {
      success: true,
      data: { path: filePath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to create file: ${message}`,
      code: 'CREATE_ERROR',
    }
  }
}

/**
 * Delete file
 */
export async function deleteFile(cwd: string, filePath: string): Promise<Result<{ path: string }>> {
  try {
    const validPath = validatePath(cwd, filePath)

    // Check if path is a directory
    const stats = await fs.stat(validPath)
    if (stats.isDirectory()) {
      return {
        success: false,
        error: `Cannot delete directory with deleteFile: ${filePath}`,
        code: 'IS_DIRECTORY',
      }
    }

    await fs.unlink(validPath)

    return {
      success: true,
      data: { path: filePath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to delete file: ${message}`,
      code: 'DELETE_ERROR',
    }
  }
}

/**
 * Rename or move file
 */
export async function renameFile(
  cwd: string,
  oldPath: string,
  newPath: string
): Promise<Result<{ oldPath: string; newPath: string }>> {
  try {
    const validOldPath = validatePath(cwd, oldPath)
    const validNewPath = validatePath(cwd, newPath)

    // Check if new path already exists
    try {
      await fs.access(validNewPath)
      return {
        success: false,
        error: `Destination already exists: ${newPath}`,
        code: 'FILE_EXISTS',
      }
    } catch {
      // Destination doesn't exist, which is what we want
    }

    // Ensure destination directory exists
    const destDir = path.dirname(validNewPath)
    await fs.mkdir(destDir, { recursive: true })

    await fs.rename(validOldPath, validNewPath)

    return {
      success: true,
      data: { oldPath, newPath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to rename file: ${message}`,
      code: 'RENAME_ERROR',
    }
  }
}

/**
 * Copy file
 */
export async function copyFile(
  cwd: string,
  srcPath: string,
  destPath: string
): Promise<Result<{ srcPath: string; destPath: string }>> {
  try {
    const validSrcPath = validatePath(cwd, srcPath)
    const validDestPath = validatePath(cwd, destPath)

    // Check if source exists and is not a directory
    const stats = await fs.stat(validSrcPath)
    if (stats.isDirectory()) {
      return {
        success: false,
        error: `Cannot copy directory with copyFile: ${srcPath}`,
        code: 'IS_DIRECTORY',
      }
    }

    // Check if destination already exists
    try {
      await fs.access(validDestPath)
      return {
        success: false,
        error: `Destination already exists: ${destPath}`,
        code: 'FILE_EXISTS',
      }
    } catch {
      // Destination doesn't exist, which is what we want
    }

    // Ensure destination directory exists
    const destDir = path.dirname(validDestPath)
    await fs.mkdir(destDir, { recursive: true })

    await fs.copyFile(validSrcPath, validDestPath)

    return {
      success: true,
      data: { srcPath, destPath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to copy file: ${message}`,
      code: 'COPY_ERROR',
    }
  }
}

/**
 * List directory contents with metadata
 */
export async function listDirectory(
  cwd: string,
  dirPath: string = '.'
): Promise<Result<FileInfo[]>> {
  try {
    const validPath = validatePath(cwd, dirPath)

    const entries = await fs.readdir(validPath, { withFileTypes: true })
    const files: FileInfo[] = []

    for (const entry of entries) {
      try {
        const entryPath = path.join(validPath, entry.name)
        const stats = await fs.stat(entryPath)

        files.push({
          name: entry.name,
          path: path.join(dirPath, entry.name),
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        })
      } catch {
        // Skip files that can't be stat'd
      }
    }

    return {
      success: true,
      data: files,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to list directory: ${message}`,
      code: 'LIST_ERROR',
    }
  }
}

/**
 * Create directory recursively
 */
export async function createDirectory(cwd: string, dirPath: string): Promise<Result<{ path: string }>> {
  try {
    const validPath = validatePath(cwd, dirPath)

    await fs.mkdir(validPath, { recursive: true })

    return {
      success: true,
      data: { path: dirPath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to create directory: ${message}`,
      code: 'MKDIR_ERROR',
    }
  }
}

/**
 * Delete directory recursively
 */
export async function deleteDirectory(cwd: string, dirPath: string): Promise<Result<{ path: string }>> {
  try {
    const validPath = validatePath(cwd, dirPath)

    await fs.rm(validPath, { recursive: true, force: false })

    return {
      success: true,
      data: { path: dirPath },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to delete directory: ${message}`,
      code: 'RMDIR_ERROR',
    }
  }
}

/**
 * Check if path exists
 */
export async function exists(cwd: string, filePath: string): Promise<Result<boolean>> {
  try {
    const validPath = validatePath(cwd, filePath)

    await fs.access(validPath)
    return {
      success: true,
      data: true,
    }
  } catch {
    return {
      success: true,
      data: false,
    }
  }
}

/**
 * Get file statistics
 */
export async function stat(
  cwd: string,
  filePath: string
): Promise<
  Result<{
    path: string
    isDirectory: boolean
    isFile: boolean
    size: number
    created: string
    modified: string
    accessed: string
    mode: number
  }>
> {
  try {
    const validPath = validatePath(cwd, filePath)

    const stats = await fs.stat(validPath)

    return {
      success: true,
      data: {
        path: filePath,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        mode: stats.mode,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to stat file: ${message}`,
      code: 'STAT_ERROR',
    }
  }
}

/**
 * Glob pattern matching
 *
 * Simple glob implementation supporting:
 * - * (matches any sequence of characters except /)
 * - ? (matches single character)
 * - ** (matches any number of directories)
 * - [...] (character ranges)
 */
export async function glob(cwd: string, pattern: string): Promise<Result<string[]>> {
  try {
    const validCwd = validatePath(cwd, '.')
    const results: string[] = []

    /**
     * Recursively glob through directory
     */
    async function globDir(dir: string, currentPattern: string): Promise<void> {
      const parts = currentPattern.split('/')
      const [currentPart, ...remainingParts] = parts

      if (!currentPart) {
        return
      }

      const isGlob = currentPart.includes('*') || currentPart.includes('?')

      if (currentPart === '**') {
        // Match any number of directories
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue // Skip hidden

          const entryPath = path.join(dir, entry.name)
          const relativePath = path.relative(validCwd, entryPath)

          if (entry.isDirectory()) {
            // Continue glob at current level
            await globDir(entryPath, currentPattern)
            // Also try matching remaining parts
            if (remainingParts.length > 0) {
              await globDir(entryPath, remainingParts.join('/'))
            }
          }
        }
      } else if (isGlob) {
        // Match files/dirs at current level
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const regex = globToRegex(currentPart)

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue // Skip hidden

          if (regex.test(entry.name)) {
            const entryPath = path.join(dir, entry.name)
            const relativePath = path.relative(validCwd, entryPath)

            if (remainingParts.length === 0) {
              results.push(relativePath)
            } else if (entry.isDirectory()) {
              await globDir(entryPath, remainingParts.join('/'))
            }
          }
        }
      } else {
        // Exact match
        const entryPath = path.join(dir, currentPart)

        try {
          const stats = await fs.stat(entryPath)

          if (remainingParts.length === 0) {
            results.push(path.relative(validCwd, entryPath))
          } else if (stats.isDirectory()) {
            await globDir(entryPath, remainingParts.join('/'))
          }
        } catch {
          // Path doesn't exist
        }
      }
    }

    await globDir(validCwd, pattern)

    return {
      success: true,
      data: results.sort(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to glob: ${message}`,
      code: 'GLOB_ERROR',
    }
  }
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  let regex = ''
  let i = 0

  while (i < pattern.length) {
    const char = pattern[i]

    switch (char) {
      case '*':
        regex += '[^/]*'
        break
      case '?':
        regex += '[^/]'
        break
      case '[': {
        const closeBracket = pattern.indexOf(']', i)
        if (closeBracket === -1) {
          regex += '\\\\'
        } else {
          const range = pattern.substring(i + 1, closeBracket)
          regex += `[${range}]`
          i = closeBracket
        }
        break
      }
      default:
        regex += char.replace(/[.+^${}()|\\]/g, '\\$&')
    }

    i++
  }

  return new RegExp(`^${regex}$`)
}

/**
 * Search files with regex pattern
 */
export async function searchInFiles(
  cwd: string,
  pattern: string,
  options?: {
    glob?: string
    limit?: number
    contextLines?: number
  }
): Promise<Result<SearchResult[]>> {
  try {
    const validCwd = validatePath(cwd, '.')
    const regex = new RegExp(pattern, 'gm')
    const results: SearchResult[] = []
    const limit = options?.limit ?? 1000
    const contextLines = options?.contextLines ?? 2
    const globPattern = options?.glob ?? '**/*.{ts,tsx,js,jsx,json,md,txt}'

    // Get files matching glob
    const globResult = await glob(cwd, globPattern)
    if (!globResult.success) {
      return globResult
    }

    const files = globResult.data

    for (const file of files) {
      if (results.length >= limit) break

      try {
        const validPath = validatePath(cwd, file)
        const content = await fs.readFile(validPath, 'utf-8')
        const lines = content.split('\n')

        let match
        while ((match = regex.exec(content)) !== null && results.length < limit) {
          // Find line number
          const lineNum = content.substring(0, match.index).split('\n').length - 1
          const line = lines[lineNum] || ''
          const column = match.index - (content.lastIndexOf('\n', match.index - 1) + 1)

          // Build context
          const startLine = Math.max(0, lineNum - contextLines)
          const endLine = Math.min(lines.length, lineNum + contextLines + 1)
          const context = lines.slice(startLine, endLine).join('\n')

          results.push({
            file,
            line: lineNum,
            column,
            match: match[0],
            context,
          })
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      success: true,
      data: results,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to search files: ${message}`,
      code: 'SEARCH_ERROR',
    }
  }
}

/**
 * Get recursive directory tree
 */
export async function getTree(
  cwd: string,
  options?: {
    dirPath?: string
    maxDepth?: number
    ignore?: string[]
  }
): Promise<
  Result<{
    name: string
    path: string
    isDirectory: boolean
    children?: any[]
    size?: number
  }>
> {
  try {
    const basePath = options?.dirPath ?? '.'
    const maxDepth = options?.maxDepth ?? 10
    const ignore = new Set(options?.ignore ?? ['.git', 'node_modules', '.next', 'dist'])

    const validPath = validatePath(cwd, basePath)

    /**
     * Recursively build tree
     */
    async function buildTree(dirPath: string, depth: number): Promise<any> {
      if (depth > maxDepth) {
        return null
      }

      try {
        const stats = await fs.stat(dirPath)
        const relativePath = path.relative(validatePath(cwd, '.'), dirPath)
        const name = path.basename(dirPath) || path.basename(cwd)

        const node = {
          name,
          path: relativePath || '.',
          isDirectory: stats.isDirectory(),
          size: stats.size,
        }

        if (stats.isDirectory()) {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })
          const children: any[] = []

          for (const entry of entries) {
            if (entry.name.startsWith('.') || ignore.has(entry.name)) {
              continue
            }

            const childPath = path.join(dirPath, entry.name)
            const childTree = await buildTree(childPath, depth + 1)

            if (childTree) {
              children.push(childTree)
            }
          }

          node.children = children.sort((a, b) => {
            // Directories first, then alphabetically
            if (a.isDirectory !== b.isDirectory) {
              return b.isDirectory ? 1 : -1
            }
            return a.name.localeCompare(b.name)
          })
        }

        return node
      } catch {
        return null
      }
    }

    const tree = await buildTree(validPath, 0)

    if (!tree) {
      return {
        success: false,
        error: `Failed to build tree for path: ${basePath}`,
        code: 'TREE_ERROR',
      }
    }

    return {
      success: true,
      data: tree,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to get tree: ${message}`,
      code: 'TREE_ERROR',
    }
  }
}

/**
 * Export validatePath for testing and other modules
 */
export { validatePath }
