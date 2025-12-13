/**
 * Patch History Manager
 * 
 * Tracks all code patches with undo/redo support and checkpoints.
 * Each patch is stored with full before/after content for reliable restoration.
 * 
 * Features:
 * - Automatic backup before every patch
 * - Undo/redo stack per file
 * - Named checkpoints (manual save points)
 * - Session-based history (persisted to disk)
 * - Diff generation for UI display
 */

const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const os = require('os')

// Configuration
const MAX_HISTORY_PER_FILE = 100 // Max undo steps per file
const MAX_CHECKPOINTS_PER_FILE = 20
const HISTORY_DIR = path.join(os.homedir(), '.cache', 'ai-cluso', 'patch-history')

// In-memory state for fast access
const undoStacks = new Map() // filePath -> Array<PatchEntry>
const redoStacks = new Map() // filePath -> Array<PatchEntry>
const checkpoints = new Map() // filePath -> Array<Checkpoint>

/**
 * @typedef {Object} PatchEntry
 * @property {string} id - Unique patch ID
 * @property {string} filePath - Absolute path to file
 * @property {string} beforeContent - Content before patch
 * @property {string} afterContent - Content after patch
 * @property {number} timestamp - Unix timestamp
 * @property {string} description - Human-readable description
 * @property {string} generatedBy - 'fast-path' | 'fast-apply' | 'gemini' | 'manual'
 * @property {number} lineNumber - Target line number
 */

/**
 * @typedef {Object} Checkpoint
 * @property {string} id - Unique checkpoint ID
 * @property {string} name - User-provided name
 * @property {string} filePath - Absolute path to file
 * @property {string} content - File content at checkpoint
 * @property {number} timestamp - Unix timestamp
 */

// Initialize history directory
async function ensureHistoryDir() {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true })
  } catch (error) {
    console.error('[PatchHistory] Failed to create history directory:', error)
    throw error
  }
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

// Get file-specific history path
function getHistoryPath(filePath) {
  const hash = crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16)
  const fileName = path.basename(filePath).replace(/[^a-zA-Z0-9.-]/g, '_')
  return path.join(HISTORY_DIR, `${fileName}-${hash}.json`)
}

// Load history from disk
async function loadHistory(filePath) {
  try {
    const historyPath = getHistoryPath(filePath)
    const data = await fs.readFile(historyPath, 'utf-8')
    const history = JSON.parse(data)
    
    undoStacks.set(filePath, history.undoStack || [])
    redoStacks.set(filePath, history.redoStack || [])
    checkpoints.set(filePath, history.checkpoints || [])
    
    return true
  } catch (error) {
    // No history file yet - initialize empty
    undoStacks.set(filePath, [])
    redoStacks.set(filePath, [])
    checkpoints.set(filePath, [])
    return false
  }
}

// Save history to disk
async function saveHistory(filePath) {
  try {
    await ensureHistoryDir()
    const historyPath = getHistoryPath(filePath)
    const history = {
      filePath,
      undoStack: undoStacks.get(filePath) || [],
      redoStack: redoStacks.get(filePath) || [],
      checkpoints: checkpoints.get(filePath) || [],
      lastModified: Date.now(),
    }
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2))
    return true
  } catch (error) {
    console.error('[PatchHistory] Failed to save history:', error)
    return false
  }
}

/**
 * Record a patch in history (called AFTER successful patch application)
 * This enables undo functionality
 */
async function recordPatch(filePath, beforeContent, afterContent, description, options = {}) {
  try {
    // Load existing history if not in memory
    if (!undoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const entry = {
      id: generateId(),
      filePath,
      beforeContent,
      afterContent,
      timestamp: Date.now(),
      description: description || 'Code patch',
      generatedBy: options.generatedBy || 'unknown',
      lineNumber: options.lineNumber || 0,
    }
    
    // Add to undo stack
    const undoStack = undoStacks.get(filePath) || []
    undoStack.push(entry)
    
    // Trim if exceeds max
    while (undoStack.length > MAX_HISTORY_PER_FILE) {
      undoStack.shift()
    }
    
    undoStacks.set(filePath, undoStack)
    
    // Clear redo stack (new action invalidates redo)
    redoStacks.set(filePath, [])
    
    // Persist to disk
    await saveHistory(filePath)
    
    console.log('[PatchHistory] Recorded patch:', entry.id, 'for', path.basename(filePath))
    
    return {
      success: true,
      patchId: entry.id,
      undoAvailable: undoStack.length > 0,
      historyLength: undoStack.length,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to record patch:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Undo the last patch for a file
 * Returns the previous content to restore
 */
async function undo(filePath) {
  try {
    // Load history if not in memory
    if (!undoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const undoStack = undoStacks.get(filePath) || []
    
    if (undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' }
    }
    
    // Pop from undo stack
    const entry = undoStack.pop()
    undoStacks.set(filePath, undoStack)
    
    // Push to redo stack
    const redoStack = redoStacks.get(filePath) || []
    redoStack.push(entry)
    redoStacks.set(filePath, redoStack)
    
    // Restore the file
    await fs.writeFile(filePath, entry.beforeContent, 'utf-8')
    
    // Persist
    await saveHistory(filePath)
    
    console.log('[PatchHistory] Undo successful:', entry.id, '- restored to before', entry.description)
    
    return {
      success: true,
      restoredContent: entry.beforeContent,
      patchId: entry.id,
      description: entry.description,
      undoAvailable: undoStack.length > 0,
      redoAvailable: true,
    }
  } catch (error) {
    console.error('[PatchHistory] Undo failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Redo the last undone patch for a file
 */
async function redo(filePath) {
  try {
    // Load history if not in memory
    if (!redoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const redoStack = redoStacks.get(filePath) || []
    
    if (redoStack.length === 0) {
      return { success: false, error: 'Nothing to redo' }
    }
    
    // Pop from redo stack
    const entry = redoStack.pop()
    redoStacks.set(filePath, redoStack)
    
    // Push back to undo stack
    const undoStack = undoStacks.get(filePath) || []
    undoStack.push(entry)
    undoStacks.set(filePath, undoStack)
    
    // Apply the patch again
    await fs.writeFile(filePath, entry.afterContent, 'utf-8')
    
    // Persist
    await saveHistory(filePath)
    
    console.log('[PatchHistory] Redo successful:', entry.id, '- reapplied', entry.description)
    
    return {
      success: true,
      restoredContent: entry.afterContent,
      patchId: entry.id,
      description: entry.description,
      undoAvailable: true,
      redoAvailable: redoStack.length > 0,
    }
  } catch (error) {
    console.error('[PatchHistory] Redo failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create a named checkpoint for a file
 * Checkpoints are independent of the undo/redo stack
 */
async function createCheckpoint(filePath, name) {
  try {
    // Load history if not in memory
    if (!checkpoints.has(filePath)) {
      await loadHistory(filePath)
    }
    
    // Read current file content
    const content = await fs.readFile(filePath, 'utf-8')
    
    const checkpoint = {
      id: generateId(),
      name: name || `Checkpoint ${new Date().toLocaleString()}`,
      filePath,
      content,
      timestamp: Date.now(),
    }
    
    // Add to checkpoints
    const fileCheckpoints = checkpoints.get(filePath) || []
    fileCheckpoints.push(checkpoint)
    
    // Trim if exceeds max
    while (fileCheckpoints.length > MAX_CHECKPOINTS_PER_FILE) {
      fileCheckpoints.shift()
    }
    
    checkpoints.set(filePath, fileCheckpoints)
    
    // Persist
    await saveHistory(filePath)
    
    console.log('[PatchHistory] Checkpoint created:', checkpoint.name, 'for', path.basename(filePath))
    
    return {
      success: true,
      checkpointId: checkpoint.id,
      name: checkpoint.name,
      timestamp: checkpoint.timestamp,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to create checkpoint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Restore to a specific checkpoint
 */
async function restoreCheckpoint(filePath, checkpointId) {
  try {
    // Load history if not in memory
    if (!checkpoints.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const fileCheckpoints = checkpoints.get(filePath) || []
    const checkpoint = fileCheckpoints.find(c => c.id === checkpointId)
    
    if (!checkpoint) {
      return { success: false, error: 'Checkpoint not found' }
    }
    
    // Read current content for undo record
    let currentContent = ''
    try {
      currentContent = await fs.readFile(filePath, 'utf-8')
    } catch (e) {
      // File might not exist
    }
    
    // Record this as an undo-able action
    await recordPatch(filePath, currentContent, checkpoint.content, `Restore to checkpoint: ${checkpoint.name}`, {
      generatedBy: 'checkpoint-restore',
    })
    
    // Restore the file
    await fs.writeFile(filePath, checkpoint.content, 'utf-8')
    
    console.log('[PatchHistory] Restored to checkpoint:', checkpoint.name)
    
    return {
      success: true,
      checkpointId: checkpoint.id,
      name: checkpoint.name,
      restoredContent: checkpoint.content,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to restore checkpoint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * List all checkpoints for a file
 */
async function listCheckpoints(filePath) {
  try {
    // Load history if not in memory
    if (!checkpoints.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const fileCheckpoints = checkpoints.get(filePath) || []
    
    // Return without content (just metadata)
    return {
      success: true,
      checkpoints: fileCheckpoints.map(c => ({
        id: c.id,
        name: c.name,
        timestamp: c.timestamp,
      })),
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to list checkpoints:', error)
    return { success: false, checkpoints: [], error: error.message }
  }
}

/**
 * Delete a checkpoint
 */
async function deleteCheckpoint(filePath, checkpointId) {
  try {
    if (!checkpoints.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const fileCheckpoints = checkpoints.get(filePath) || []
    const index = fileCheckpoints.findIndex(c => c.id === checkpointId)
    
    if (index === -1) {
      return { success: false, error: 'Checkpoint not found' }
    }
    
    fileCheckpoints.splice(index, 1)
    checkpoints.set(filePath, fileCheckpoints)
    
    await saveHistory(filePath)
    
    return { success: true }
  } catch (error) {
    console.error('[PatchHistory] Failed to delete checkpoint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get history status for a file (for UI display)
 */
async function getHistoryStatus(filePath) {
  try {
    if (!undoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const undoStack = undoStacks.get(filePath) || []
    const redoStack = redoStacks.get(filePath) || []
    const fileCheckpoints = checkpoints.get(filePath) || []
    
    return {
      success: true,
      filePath,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      checkpointCount: fileCheckpoints.length,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      lastPatch: undoStack.length > 0 ? {
        id: undoStack[undoStack.length - 1].id,
        description: undoStack[undoStack.length - 1].description,
        timestamp: undoStack[undoStack.length - 1].timestamp,
      } : null,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to get history status:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get full patch history for a file (with limited content for UI)
 */
async function getPatchHistory(filePath, options = {}) {
  try {
    if (!undoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const undoStack = undoStacks.get(filePath) || []
    const limit = options.limit || 50
    const includeContent = options.includeContent || false
    
    // Return most recent first
    const history = [...undoStack].reverse().slice(0, limit).map(entry => {
      const item = {
        id: entry.id,
        description: entry.description,
        timestamp: entry.timestamp,
        generatedBy: entry.generatedBy,
        lineNumber: entry.lineNumber,
      }
      
      if (includeContent) {
        item.beforeContent = entry.beforeContent
        item.afterContent = entry.afterContent
      }
      
      return item
    })
    
    return {
      success: true,
      history,
      total: undoStack.length,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to get patch history:', error)
    return { success: false, history: [], error: error.message }
  }
}

/**
 * Clear all history for a file
 */
async function clearHistory(filePath) {
  try {
    undoStacks.set(filePath, [])
    redoStacks.set(filePath, [])
    // Keep checkpoints - those are manual save points
    
    await saveHistory(filePath)
    
    console.log('[PatchHistory] Cleared history for:', path.basename(filePath))
    
    return { success: true }
  } catch (error) {
    console.error('[PatchHistory] Failed to clear history:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get diff between current file and last patch (for preview)
 */
async function getLastPatchDiff(filePath) {
  try {
    if (!undoStacks.has(filePath)) {
      await loadHistory(filePath)
    }
    
    const undoStack = undoStacks.get(filePath) || []
    
    if (undoStack.length === 0) {
      return { success: false, error: 'No patches to diff' }
    }
    
    const lastPatch = undoStack[undoStack.length - 1]
    
    return {
      success: true,
      patchId: lastPatch.id,
      description: lastPatch.description,
      timestamp: lastPatch.timestamp,
      beforeContent: lastPatch.beforeContent,
      afterContent: lastPatch.afterContent,
      lineNumber: lastPatch.lineNumber,
    }
  } catch (error) {
    console.error('[PatchHistory] Failed to get diff:', error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  recordPatch,
  undo,
  redo,
  createCheckpoint,
  restoreCheckpoint,
  listCheckpoints,
  deleteCheckpoint,
  getHistoryStatus,
  getPatchHistory,
  clearHistory,
  getLastPatchDiff,
}
