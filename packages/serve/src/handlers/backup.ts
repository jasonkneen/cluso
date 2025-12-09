// @ts-nocheck
/**
 * Backup and restore handlers for Cluso server
 * Manages project backup snapshots with timestamped naming
 */

import { homedir } from 'os'
import { promises as fs } from 'fs'
import { join, normalize, relative, sep } from 'path'
import { createHash } from 'crypto'

import type { Result, Backup } from '../types/api.js'

/**
 * Get the backup directory for a project
 * Uses md5 hash of project path for folder name
 */
function getBackupDir(cwd: string): string {
  const hash = createHash('md5').update(cwd).digest('hex')
  return join(process.env.HOME || homedir(), '.cluso', 'backups', hash)
}

/**
 * Generate backup ID from timestamp
 * Format: YYYY-MM-DD-HHmmss-{random}
 */
function generateBackupId(): string {
  const now = new Date()
  const timestamp = now
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}`
}

/**
 * Validate backup ID format
 */
function isValidBackupId(id: string): boolean {
  return /^\d{14}-[a-z0-9]{6}$/.test(id)
}

/**
 * Recursively copy directory contents
 */
async function copyRecursiveAsync(src: string, dest: string, relPath: string = ''): Promise<string[]> {
  const files: string[] = []
  const sensitivePatterns = ['.git', 'node_modules', '.env', 'dist', 'build', '.DS_Store']

  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    const newRelPath = relPath ? `${relPath}/${entry.name}` : entry.name

    // Skip sensitive directories
    if (sensitivePatterns.some(p => entry.name.includes(p) || newRelPath.includes(p))) {
      continue
    }

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      const subFiles = await copyRecursiveAsync(srcPath, destPath, newRelPath)
      files.push(...subFiles)
    } else {
      await fs.copyFile(srcPath, destPath)
      files.push(newRelPath)
    }
  }

  return files
}

/**
 * Recursively restore directory contents
 */
async function restoreRecursiveAsync(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    // Skip metadata files
    if (entry.name === '.backup-meta.json') {
      continue
    }

    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      await restoreRecursiveAsync(srcPath, destPath)
    } else {
      // Create directory if needed
      await fs.mkdir(sep + destPath.split(sep).slice(1, -1).join(sep), { recursive: true })
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Recursively delete directory contents
 */
async function deleteRecursiveAsync(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await deleteRecursiveAsync(entryPath)
    } else {
      await fs.unlink(entryPath)
    }
  }

  // Delete the directory itself
  await fs.rm(dir, { recursive: true, force: true })
}

/**
 * Create a timestamped backup of the project
 * Stores all project files in ~/.cluso/backups/{projectHash}/{backupId}/
 *
 * @param cwd - Project working directory
 * @param description - Backup description
 * @returns Backup metadata with ID
 */
export async function createBackup(
  cwd: string,
  description: string
): Promise<Result<Backup>> {
  try {
    if (!description || typeof description !== 'string') {
      return { success: false, error: 'Description is required' }
    }

    const backupId = generateBackupId()
    const backupDir = join(getBackupDir(cwd), backupId)

    // Create backup directory structure
    await fs.mkdir(backupDir, { recursive: true })

    // Copy all project files to backup (excluding sensitive dirs)
    const files = await copyRecursiveAsync(cwd, backupDir)

    // Write metadata
    const metadata = {
      id: backupId,
      description,
      createdAt: new Date().toISOString(),
      files: files.sort(),
      projectPath: cwd,
    }

    await fs.writeFile(join(backupDir, '.backup-meta.json'), JSON.stringify(metadata, null, 2))

    return {
      success: true,
      data: {
        id: backupId,
        description,
        createdAt: metadata.createdAt,
        files,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to create backup: ${message}` }
  }
}

/**
 * Restore a project from backup
 * Overwrites current project files with backed-up versions
 *
 * @param cwd - Project working directory (restore destination)
 * @param backupId - ID of backup to restore
 * @returns Success message
 */
export async function restoreBackup(cwd: string, backupId: string): Promise<Result<string>> {
  try {
    if (!isValidBackupId(backupId)) {
      return { success: false, error: 'Invalid backup ID format' }
    }

    const backupSourceDir = join(getBackupDir(cwd), backupId)

    // Verify backup exists
    try {
      await fs.access(backupSourceDir)
    } catch {
      return { success: false, error: `Backup not found: ${backupId}` }
    }

    // Restore backup files back to project directory
    await restoreRecursiveAsync(backupSourceDir, cwd)

    return { success: true, data: `Restored from backup: ${backupId}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to restore backup: ${message}` }
  }
}

/**
 * List all backups for a project
 *
 * @param cwd - Project working directory
 * @returns Array of backup metadata
 */
export async function listBackups(cwd: string): Promise<Result<Backup[]>> {
  try {
    const backupDir = getBackupDir(cwd)

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(backupDir, { recursive: true })
    } catch {
      // Directory may already exist
    }

    const entries = await fs.readdir(backupDir, { withFileTypes: true })
    const backups: Backup[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() || !isValidBackupId(entry.name)) {
        continue
      }

      try {
        const metaPath = join(backupDir, entry.name, '.backup-meta.json')
        const metaContent = await fs.readFile(metaPath, 'utf-8')
        const meta = JSON.parse(metaContent)

        backups.push({
          id: meta.id,
          description: meta.description,
          createdAt: meta.createdAt,
          files: meta.files,
        })
      } catch {
        // Skip backups without valid metadata
        continue
      }
    }

    // Sort by creation time (newest first)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, data: backups }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to list backups: ${message}` }
  }
}

/**
 * Get content of a specific file from a backup
 *
 * @param cwd - Project working directory
 * @param backupId - ID of backup
 * @param filePath - Path to file within backup
 * @returns File content
 */
export async function getBackupContent(
  cwd: string,
  backupId: string,
  filePath: string
): Promise<Result<string>> {
  try {
    if (!isValidBackupId(backupId)) {
      return { success: false, error: 'Invalid backup ID format' }
    }

    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'File path is required' }
    }

    // Prevent directory traversal
    const normalizedPath = normalize(filePath)
    if (normalizedPath.startsWith('..') || normalizedPath.startsWith('/')) {
      return { success: false, error: 'Invalid file path' }
    }

    const backupDir = getBackupDir(cwd)
    const filePath_ = join(backupDir, backupId, normalizedPath)

    // Verify path is within backup directory
    const backupBase = join(backupDir, backupId)
    if (!filePath_.startsWith(backupBase + sep)) {
      return { success: false, error: 'Path traversal detected' }
    }

    const content = await fs.readFile(filePath_, 'utf-8')

    return { success: true, data: content }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to read backup file: ${message}` }
  }
}

/**
 * Delete a specific backup
 *
 * @param cwd - Project working directory
 * @param backupId - ID of backup to delete
 * @returns Success message
 */
export async function deleteBackup(cwd: string, backupId: string): Promise<Result<string>> {
  try {
    if (!isValidBackupId(backupId)) {
      return { success: false, error: 'Invalid backup ID format' }
    }

    const backupDir = join(getBackupDir(cwd), backupId)

    // Verify backup exists
    try {
      await fs.access(backupDir)
    } catch {
      return { success: false, error: `Backup not found: ${backupId}` }
    }

    // Delete backup directory recursively
    await deleteRecursiveAsync(backupDir)

    return { success: true, data: `Deleted backup: ${backupId}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to delete backup: ${message}` }
  }
}

/**
 * Delete all backups for a project
 *
 * @param cwd - Project working directory
 * @returns Success message with count
 */
export async function cleanupBackups(cwd: string): Promise<Result<{ count: number }>> {
  try {
    const backupDir = getBackupDir(cwd)

    // Verify backup directory exists
    try {
      await fs.access(backupDir)
    } catch {
      return { success: true, data: { count: 0 } }
    }

    const entries = await fs.readdir(backupDir, { withFileTypes: true })
    let count = 0

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      try {
        await deleteRecursiveAsync(join(backupDir, entry.name))
        count++
      } catch {
        // Continue with other backups
        continue
      }
    }

    return { success: true, data: { count } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to cleanup backups: ${message}` }
  }
}
