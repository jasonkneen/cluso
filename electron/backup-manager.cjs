const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const os = require('os')

// Configuration
const MAX_BACKUPS_PER_FILE = 50
const BACKUP_DIR = path.join(os.homedir(), '.cache', 'ai-cluso', 'backups')

// Initialize backup directory
async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  } catch (error) {
    console.error('[BackupManager] Failed to create backup directory:', error)
    throw error
  }
}

// Generate a unique backup ID
function generateBackupId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

// Get the hash of a file for deduplication
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch (error) {
    console.error('[BackupManager] Failed to hash file:', error)
    throw error
  }
}

// Get metadata for a file (used for display)
async function getFileMetadata(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return {
      size: stat.size,
      mtime: stat.mtime.getTime(),
    }
  } catch (error) {
    return {
      size: 0,
      mtime: Date.now(),
    }
  }
}

// Create a backup of a file
async function createBackup(filePath, description = '') {
  try {
    await ensureBackupDir()

    // Read the file content
    let content
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      // File doesn't exist yet, create empty backup
      content = ''
    }

    // Calculate hash to avoid duplicate backups
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    // Create a safe filename from the original file path
    const fileName = path.basename(filePath)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileBackupDir = path.join(BACKUP_DIR, safeFileName)

    // Ensure file-specific backup directory exists
    await fs.mkdir(fileBackupDir, { recursive: true })

    // Create backup metadata
    const backupId = generateBackupId()
    const backupPath = path.join(fileBackupDir, `${backupId}.json`)

    const metadata = await getFileMetadata(filePath)
    const backupData = {
      id: backupId,
      filePath,
      fileName,
      timestamp: Date.now(),
      description: description || `Auto-backup of ${fileName}`,
      hash,
      size: content.length,
      metadata,
    }

    // Write backup metadata and content
    const fullBackupData = {
      ...backupData,
      content,
    }

    await fs.writeFile(backupPath, JSON.stringify(fullBackupData, null, 2))

    // Clean up old backups
    await cleanupOldBackups(fileBackupDir)

    console.log('[BackupManager] Backup created:', backupId, 'for', fileName)
    return {
      success: true,
      backupId,
      timestamp: backupData.timestamp,
      description: backupData.description,
    }
  } catch (error) {
    console.error('[BackupManager] Failed to create backup:', error)
    throw error
  }
}

// Restore a file from backup
async function restoreBackup(filePath, backupId) {
  try {
    const fileName = path.basename(filePath)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileBackupDir = path.join(BACKUP_DIR, safeFileName)
    const backupPath = path.join(fileBackupDir, `${backupId}.json`)

    // Read backup data
    const backupDataStr = await fs.readFile(backupPath, 'utf-8')
    const backupData = JSON.parse(backupDataStr)

    // Create backup of current file before restoring (if it exists)
    try {
      await createBackup(filePath, `Pre-restore backup before restoring ${backupId}`)
    } catch (error) {
      console.warn('[BackupManager] Failed to create pre-restore backup:', error)
    }

    // Restore the file
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, backupData.content, 'utf-8')

    console.log('[BackupManager] File restored from backup:', backupId)
    return {
      success: true,
      filePath,
      timestamp: backupData.timestamp,
      description: backupData.description,
    }
  } catch (error) {
    console.error('[BackupManager] Failed to restore backup:', error)
    throw error
  }
}

// List all backups for a file
async function listBackups(filePath) {
  try {
    const fileName = path.basename(filePath)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileBackupDir = path.join(BACKUP_DIR, safeFileName)

    // Check if backup directory exists
    let files = []
    try {
      files = await fs.readdir(fileBackupDir)
    } catch (error) {
      // Directory doesn't exist yet
      return {
        success: true,
        backups: [],
        filePath,
      }
    }

    // Read and sort backups by timestamp (newest first)
    const backups = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const backupPath = path.join(fileBackupDir, file)
        const backupDataStr = await fs.readFile(backupPath, 'utf-8')
        const backupData = JSON.parse(backupDataStr)

        // Don't include the full content in the list
        backups.push({
          id: backupData.id,
          timestamp: backupData.timestamp,
          description: backupData.description,
          size: backupData.size,
          hash: backupData.hash,
        })
      } catch (error) {
        console.warn('[BackupManager] Failed to read backup metadata:', file, error)
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp)

    return {
      success: true,
      backups,
      filePath,
    }
  } catch (error) {
    console.error('[BackupManager] Failed to list backups:', error)
    throw error
  }
}

// Get a specific backup for diffing
async function getBackupContent(filePath, backupId) {
  try {
    const fileName = path.basename(filePath)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileBackupDir = path.join(BACKUP_DIR, safeFileName)
    const backupPath = path.join(fileBackupDir, `${backupId}.json`)

    const backupDataStr = await fs.readFile(backupPath, 'utf-8')
    const backupData = JSON.parse(backupDataStr)

    return {
      success: true,
      content: backupData.content,
      timestamp: backupData.timestamp,
      description: backupData.description,
    }
  } catch (error) {
    console.error('[BackupManager] Failed to get backup content:', error)
    throw error
  }
}

// Clean up old backups for a file
async function cleanupOldBackups(fileBackupDir) {
  try {
    let files = []
    try {
      files = await fs.readdir(fileBackupDir)
    } catch (error) {
      return
    }

    // Read all backups and sort by timestamp
    const backups = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const backupPath = path.join(fileBackupDir, file)
        const backupDataStr = await fs.readFile(backupPath, 'utf-8')
        const backupData = JSON.parse(backupDataStr)
        backups.push({
          id: backupData.id,
          timestamp: backupData.timestamp,
          path: backupPath,
        })
      } catch (error) {
        console.warn('[BackupManager] Failed to read backup for cleanup:', file)
      }
    }

    // Sort by timestamp (oldest first)
    backups.sort((a, b) => a.timestamp - b.timestamp)

    // Delete old backups if we exceed the limit
    if (backups.length > MAX_BACKUPS_PER_FILE) {
      const toDelete = backups.slice(0, backups.length - MAX_BACKUPS_PER_FILE)
      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path)
          console.log('[BackupManager] Deleted old backup:', backup.id)
        } catch (error) {
          console.warn('[BackupManager] Failed to delete old backup:', backup.id, error)
        }
      }
    }
  } catch (error) {
    console.error('[BackupManager] Failed to cleanup old backups:', error)
  }
}

// Manual cleanup of all backups (can be called periodically)
async function cleanupAllBackups() {
  try {
    await ensureBackupDir()

    const files = await fs.readdir(BACKUP_DIR)
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file)
      const stat = await fs.stat(filePath)

      if (stat.isDirectory()) {
        await cleanupOldBackups(filePath)
      }
    }

    console.log('[BackupManager] Cleanup completed')
    return { success: true }
  } catch (error) {
    console.error('[BackupManager] Failed to cleanup backups:', error)
    throw error
  }
}

// Delete a specific backup
async function deleteBackup(filePath, backupId) {
  try {
    const fileName = path.basename(filePath)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileBackupDir = path.join(BACKUP_DIR, safeFileName)
    const backupPath = path.join(fileBackupDir, `${backupId}.json`)

    await fs.unlink(backupPath)

    console.log('[BackupManager] Backup deleted:', backupId)
    return { success: true }
  } catch (error) {
    console.error('[BackupManager] Failed to delete backup:', error)
    throw error
  }
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  getBackupContent,
  deleteBackup,
  cleanupAllBackups,
}
