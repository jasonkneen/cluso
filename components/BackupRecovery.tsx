import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Trash2, Eye, EyeOff } from 'lucide-react'

export interface BackupEntry {
  id: string
  timestamp: number
  description: string
  size: number
  hash: string
}

export interface BackupRecoveryProps {
  filePath: string
  onRestore?: (filePath: string, backupId: string) => Promise<void>
  onClose?: () => void
}

/**
 * BackupRecovery Component
 *
 * Provides UI for managing file backups:
 * - List recent backups with timestamps and descriptions
 * - Preview/diff backup content
 * - Restore to specific version
 * - Delete old backups
 * - Manual cleanup trigger
 */
export const BackupRecovery: React.FC<BackupRecoveryProps> = ({
  filePath,
  onRestore,
  onClose,
}) => {
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBackupId, setExpandedBackupId] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // Load backups on mount
  useEffect(() => {
    loadBackups()
  }, [filePath])

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.backup?.list) {
        throw new Error('Backup API not available')
      }

      const result = await electronAPI.backup.list(filePath)

      if (!result.success) {
        throw new Error(result.error || 'Failed to load backups')
      }

      setBackups(result.backups || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load backups'
      setError(message)
      console.error('[BackupRecovery] Load error:', message)
    } finally {
      setLoading(false)
    }
  }, [filePath])

  const handleExpandBackup = useCallback(async (backupId: string) => {
    if (expandedBackupId === backupId) {
      setExpandedBackupId(null)
      setPreviewContent('')
      return
    }

    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.backup?.getContent) {
        throw new Error('Backup API not available')
      }

      const result = await electronAPI.backup.getContent(filePath, backupId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to load backup content')
      }

      setExpandedBackupId(backupId)
      setPreviewContent(result.content || '')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load backup'
      console.error('[BackupRecovery] Preview error:', message)
      alert(`Failed to load backup: ${message}`)
    }
  }, [filePath, expandedBackupId])

  const handleRestore = useCallback(async (backupId: string) => {
    const confirmed = window.confirm(
      'Restore to this version? Current file will be backed up before restoring.'
    )
    if (!confirmed) return

    try {
      setRestoring(backupId)

      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.backup?.restore) {
        throw new Error('Backup API not available')
      }

      const result = await electronAPI.backup.restore(filePath, backupId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to restore backup')
      }

      alert('File restored successfully')

      // Reload backups to show new pre-restore backup
      await loadBackups()

      // Notify parent component
      if (onRestore) {
        await onRestore(filePath, backupId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore'
      console.error('[BackupRecovery] Restore error:', message)
      alert(`Failed to restore: ${message}`)
    } finally {
      setRestoring(null)
    }
  }, [filePath, loadBackups, onRestore])

  const handleDeleteBackup = useCallback(async (backupId: string) => {
    const confirmed = window.confirm('Delete this backup? This cannot be undone.')
    if (!confirmed) return

    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.backup?.delete) {
        throw new Error('Backup API not available')
      }

      const result = await electronAPI.backup.delete(filePath, backupId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete backup')
      }

      // Reload backups
      await loadBackups()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      console.error('[BackupRecovery] Delete error:', message)
      alert(`Failed to delete: ${message}`)
    }
  }, [filePath, loadBackups])

  const handleCleanup = useCallback(async () => {
    const confirmed = window.confirm(
      'Clean up old backups? This will keep only the 50 most recent versions per file.'
    )
    if (!confirmed) return

    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.backup?.cleanup) {
        throw new Error('Backup API not available')
      }

      const result = await electronAPI.backup.cleanup()

      if (!result.success) {
        throw new Error(result.error || 'Failed to cleanup')
      }

      alert('Cleanup completed')

      // Reload backups
      await loadBackups()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cleanup'
      console.error('[BackupRecovery] Cleanup error:', message)
      alert(`Failed to cleanup: ${message}`)
    }
  }, [loadBackups])

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts)
    return date.toLocaleString()
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const truncateHash = (hash: string): string => {
    return hash.substring(0, 8) + '...'
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Backup History
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 truncate">
          {filePath}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-600 dark:text-slate-400">Loading backups...</div>
          </div>
        )}

        {error && (
          <div className="m-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && backups.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 dark:text-slate-400">No backups found</div>
          </div>
        )}

        {!loading && backups.length > 0 && (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {/* Backup item header */}
                <div className="px-4 py-3">
                  <button
                    onClick={() => handleExpandBackup(backup.id)}
                    className="w-full flex items-center justify-between hover:opacity-75 transition-opacity"
                  >
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {backup.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {formatTimestamp(backup.timestamp)} • {formatSize(backup.size)}
                      </p>
                    </div>
                    {expandedBackupId === backup.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
                    )}
                  </button>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRestore(backup.id)}
                      disabled={restoring === backup.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {restoring === backup.id ? 'Restoring...' : 'Restore'}
                    </button>

                    <button
                      onClick={() => setShowDiff(!showDiff)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm transition-colors"
                    >
                      {showDiff ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded preview */}
                {expandedBackupId === backup.id && (
                  <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Hash: {truncateHash(backup.hash)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded p-3 max-h-60 overflow-auto font-mono text-xs">
                      {previewContent ? (
                        <pre className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                          {previewContent}
                        </pre>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">(Empty file)</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with cleanup button */}
      {!loading && backups.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <button
            onClick={handleCleanup}
            className="w-full px-4 py-2 rounded text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Clean up old backups
          </button>
        </div>
      )}
    </div>
  )
}

export default BackupRecovery
