/**
 * Hook for accessing patch history, undo/redo, and checkpoints
 * 
 * Provides easy access to:
 * - Undo/redo patches (CMD+Z / CMD+SHIFT+Z)
 * - Creating/restoring named checkpoints
 * - Viewing patch history
 */

import { useState, useCallback, useEffect } from 'react'
import { getElectronAPI } from './useElectronAPI'

export interface PatchHistoryStatus {
  filePath: string
  undoCount: number
  redoCount: number
  checkpointCount: number
  canUndo: boolean
  canRedo: boolean
  lastPatch: {
    id: string
    description: string
    timestamp: number
  } | null
}

export interface PatchEntry {
  id: string
  description: string
  timestamp: number
  generatedBy: string
  lineNumber: number
  beforeContent?: string
  afterContent?: string
}

export interface Checkpoint {
  id: string
  name: string
  timestamp: number
}

interface UsePatchHistoryReturn {
  // Status
  status: PatchHistoryStatus | null
  loading: boolean
  error: string | null
  
  // Actions
  recordPatch: (
    filePath: string,
    beforeContent: string,
    afterContent: string,
    description: string,
    options?: { generatedBy?: string; lineNumber?: number }
  ) => Promise<{ success: boolean; patchId?: string; error?: string }>
  
  undo: (filePath: string) => Promise<{ success: boolean; restoredContent?: string; error?: string }>
  redo: (filePath: string) => Promise<{ success: boolean; restoredContent?: string; error?: string }>
  
  createCheckpoint: (filePath: string, name?: string) => Promise<{ success: boolean; checkpointId?: string; error?: string }>
  restoreCheckpoint: (filePath: string, checkpointId: string) => Promise<{ success: boolean; error?: string }>
  listCheckpoints: (filePath: string) => Promise<Checkpoint[]>
  deleteCheckpoint: (filePath: string, checkpointId: string) => Promise<{ success: boolean; error?: string }>
  
  getHistory: (filePath: string, options?: { limit?: number; includeContent?: boolean }) => Promise<PatchEntry[]>
  clearHistory: (filePath: string) => Promise<{ success: boolean; error?: string }>
  
  refreshStatus: (filePath: string) => Promise<void>
}

export function usePatchHistory(): UsePatchHistoryReturn {
  const [status, setStatus] = useState<PatchHistoryStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getPatchHistoryApi = useCallback(() => {
    const { api } = getElectronAPI()
    return api?.patchHistory ?? null
  }, [])

  const refreshStatus = useCallback(async (filePath: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      setError('Patch history not available')
      return
    }

    try {
      setLoading(true)
      const result = await api.getStatus(filePath)
      if (result.success) {
        setStatus(result as PatchHistoryStatus)
        setError(null)
      } else {
        setError(result.error || 'Failed to get status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [getPatchHistoryApi])

  const recordPatch = useCallback(async (
    filePath: string,
    beforeContent: string,
    afterContent: string,
    description: string,
    options?: { generatedBy?: string; lineNumber?: number }
  ) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      const result = await api.record(filePath, beforeContent, afterContent, description, options)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }, [getPatchHistoryApi, refreshStatus])

  const undo = useCallback(async (filePath: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      setLoading(true)
      const result = await api.undo(filePath)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      setLoading(false)
    }
  }, [getPatchHistoryApi, refreshStatus])

  const redo = useCallback(async (filePath: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      setLoading(true)
      const result = await api.redo(filePath)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      setLoading(false)
    }
  }, [getPatchHistoryApi, refreshStatus])

  const createCheckpoint = useCallback(async (filePath: string, name?: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      const result = await api.createCheckpoint(filePath, name)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }, [getPatchHistoryApi, refreshStatus])

  const restoreCheckpoint = useCallback(async (filePath: string, checkpointId: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      setLoading(true)
      const result = await api.restoreCheckpoint(filePath, checkpointId)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      setLoading(false)
    }
  }, [getPatchHistoryApi, refreshStatus])

  const listCheckpoints = useCallback(async (filePath: string): Promise<Checkpoint[]> => {
    const api = getPatchHistoryApi()
    if (!api) {
      return []
    }

    try {
      const result = await api.listCheckpoints(filePath)
      return result.checkpoints || []
    } catch (err) {
      console.error('[usePatchHistory] List checkpoints error:', err)
      return []
    }
  }, [getPatchHistoryApi])

  const deleteCheckpoint = useCallback(async (filePath: string, checkpointId: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      const result = await api.deleteCheckpoint(filePath, checkpointId)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }, [getPatchHistoryApi, refreshStatus])

  const getHistory = useCallback(async (
    filePath: string,
    options?: { limit?: number; includeContent?: boolean }
  ): Promise<PatchEntry[]> => {
    const api = getPatchHistoryApi()
    if (!api) {
      return []
    }

    try {
      const result = await api.getHistory(filePath, options)
      return result.history || []
    } catch (err) {
      console.error('[usePatchHistory] Get history error:', err)
      return []
    }
  }, [getPatchHistoryApi])

  const clearHistory = useCallback(async (filePath: string) => {
    const api = getPatchHistoryApi()
    if (!api) {
      return { success: false, error: 'Patch history not available' }
    }

    try {
      const result = await api.clear(filePath)
      if (result.success) {
        await refreshStatus(filePath)
      }
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }, [getPatchHistoryApi, refreshStatus])

  return {
    status,
    loading,
    error,
    recordPatch,
    undo,
    redo,
    createCheckpoint,
    restoreCheckpoint,
    listCheckpoints,
    deleteCheckpoint,
    getHistory,
    clearHistory,
    refreshStatus,
  }
}

/**
 * Hook for global undo/redo keyboard shortcuts (CMD+Z / CMD+SHIFT+Z)
 * Requires a currentFilePath to know which file to operate on
 */
export function usePatchHistoryShortcuts(currentFilePath: string | null, onUndoRedo?: (success: boolean, action: 'undo' | 'redo') => void) {
  const { undo, redo } = usePatchHistory()

  useEffect(() => {
    if (!currentFilePath) return

    const handleKeyDown = async (e: KeyboardEvent) => {
      // CMD+Z (Mac) or CTRL+Z (Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey
      
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        console.log('[PatchHistory] Undo shortcut triggered for:', currentFilePath)
        const result = await undo(currentFilePath)
        onUndoRedo?.(result.success, 'undo')
      }
      
      // CMD+SHIFT+Z (Mac) or CTRL+Y (Windows/Linux) for redo
      if ((isMod && e.key === 'z' && e.shiftKey) || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        console.log('[PatchHistory] Redo shortcut triggered for:', currentFilePath)
        const result = await redo(currentFilePath)
        onUndoRedo?.(result.success, 'redo')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentFilePath, undo, redo, onUndoRedo])
}

export default usePatchHistory
