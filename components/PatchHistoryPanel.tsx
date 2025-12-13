/**
 * Patch History Panel
 * 
 * Displays patch history for a file with undo/redo controls,
 * checkpoint management, and history browsing.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Undo2, 
  Redo2, 
  Flag, 
  History, 
  Trash2, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
  Plus
} from 'lucide-react'
import { usePatchHistory, PatchEntry, Checkpoint } from '../hooks/usePatchHistory'

interface PatchHistoryPanelProps {
  filePath: string
  onClose?: () => void
  onFileChanged?: () => void
  compact?: boolean
}

export const PatchHistoryPanel: React.FC<PatchHistoryPanelProps> = ({
  filePath,
  onClose,
  onFileChanged,
  compact = false,
}) => {
  const {
    status,
    loading,
    error,
    undo,
    redo,
    createCheckpoint,
    restoreCheckpoint,
    listCheckpoints,
    deleteCheckpoint,
    getHistory,
    clearHistory,
    refreshStatus,
  } = usePatchHistory()

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [history, setHistory] = useState<PatchEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [newCheckpointName, setNewCheckpointName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)

  // Load initial data
  useEffect(() => {
    if (filePath) {
      refreshStatus(filePath)
      loadCheckpoints()
      loadHistory()
    }
  }, [filePath])

  const loadCheckpoints = useCallback(async () => {
    if (!filePath) return
    const cps = await listCheckpoints(filePath)
    setCheckpoints(cps)
  }, [filePath, listCheckpoints])

  const loadHistory = useCallback(async () => {
    if (!filePath) return
    const hist = await getHistory(filePath, { limit: 20 })
    setHistory(hist)
  }, [filePath, getHistory])

  const handleUndo = useCallback(async () => {
    if (!filePath) return
    const result = await undo(filePath)
    if (result.success) {
      onFileChanged?.()
      loadHistory()
    }
  }, [filePath, undo, onFileChanged, loadHistory])

  const handleRedo = useCallback(async () => {
    if (!filePath) return
    const result = await redo(filePath)
    if (result.success) {
      onFileChanged?.()
      loadHistory()
    }
  }, [filePath, redo, onFileChanged, loadHistory])

  const handleCreateCheckpoint = useCallback(async () => {
    if (!filePath) return
    const name = newCheckpointName.trim() || undefined
    const result = await createCheckpoint(filePath, name)
    if (result.success) {
      setNewCheckpointName('')
      setShowNameInput(false)
      loadCheckpoints()
    }
  }, [filePath, newCheckpointName, createCheckpoint, loadCheckpoints])

  const handleRestoreCheckpoint = useCallback(async (checkpointId: string) => {
    if (!filePath) return
    const confirmed = window.confirm('Restore to this checkpoint? This action can be undone.')
    if (!confirmed) return
    
    const result = await restoreCheckpoint(filePath, checkpointId)
    if (result.success) {
      onFileChanged?.()
      loadHistory()
    }
  }, [filePath, restoreCheckpoint, onFileChanged, loadHistory])

  const handleDeleteCheckpoint = useCallback(async (checkpointId: string) => {
    if (!filePath) return
    const confirmed = window.confirm('Delete this checkpoint?')
    if (!confirmed) return
    
    await deleteCheckpoint(filePath, checkpointId)
    loadCheckpoints()
  }, [filePath, deleteCheckpoint, loadCheckpoints])

  const handleClearHistory = useCallback(async () => {
    if (!filePath) return
    const confirmed = window.confirm('Clear all undo history? Checkpoints will be preserved.')
    if (!confirmed) return
    
    await clearHistory(filePath)
    loadHistory()
  }, [filePath, clearHistory, loadHistory])

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - ts
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  if (compact) {
    // Compact mode - just undo/redo buttons
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          disabled={!status?.canUndo || loading}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Undo (${status?.undoCount || 0})`}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleRedo}
          disabled={!status?.canRedo || loading}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Redo (${status?.redoCount || 0})`}
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowNameInput(true)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Create checkpoint"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Patch History</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File path */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={filePath}>
          {filePath}
        </p>
      </div>

      {/* Undo/Redo controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={handleUndo}
          disabled={!status?.canUndo || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          <span className="text-sm font-medium">Undo</span>
          {status?.undoCount !== undefined && (
            <span className="text-xs opacity-70">({status.undoCount})</span>
          )}
        </button>
        
        <button
          onClick={handleRedo}
          disabled={!status?.canRedo || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
          <span className="text-sm font-medium">Redo</span>
          {status?.redoCount !== undefined && (
            <span className="text-xs opacity-70">({status.redoCount})</span>
          )}
        </button>

        <div className="flex-1" />

        <button
          onClick={handleClearHistory}
          disabled={!status?.undoCount}
          className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Clear history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Checkpoints section */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowCheckpoints(!showCheckpoints)}
          className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">Checkpoints</span>
            {checkpoints.length > 0 && (
              <span className="text-xs text-slate-400">({checkpoints.length})</span>
            )}
          </div>
          {showCheckpoints ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showCheckpoints && (
          <div className="px-4 pb-3">
            {/* New checkpoint input */}
            <div className="flex items-center gap-2 mb-2">
              {showNameInput ? (
                <>
                  <input
                    type="text"
                    value={newCheckpointName}
                    onChange={(e) => setNewCheckpointName(e.target.value)}
                    placeholder="Checkpoint name..."
                    className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCheckpoint()
                      if (e.key === 'Escape') setShowNameInput(false)
                    }}
                  />
                  <button
                    onClick={handleCreateCheckpoint}
                    className="p-1 rounded bg-green-500 text-white hover:bg-green-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowNameInput(true)}
                  className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  Create checkpoint
                </button>
              )}
            </div>

            {/* Checkpoint list */}
            {checkpoints.length === 0 ? (
              <p className="text-xs text-slate-400">No checkpoints yet</p>
            ) : (
              <div className="space-y-1">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium">{cp.name}</p>
                      <p className="text-xs text-slate-400">{formatTimestamp(cp.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRestoreCheckpoint(cp.id)}
                        className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCheckpoint(cp.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">Recent Changes</span>
            {history.length > 0 && (
              <span className="text-xs text-slate-400">({history.length})</span>
            )}
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showHistory && (
          <div className="flex-1 overflow-auto px-4 pb-3">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400">No changes recorded</p>
            ) : (
              <div className="space-y-1">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate" title={entry.description}>
                        {entry.description}
                      </p>
                      <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500">
                        {entry.generatedBy}
                      </span>
                      {entry.lineNumber > 0 && (
                        <span className="text-xs text-slate-400">
                          Line {entry.lineNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

export default PatchHistoryPanel
