/**
 * Patch Applicator
 * 
 * Utility for applying source patches with automatic history recording.
 * This is the ONLY place patches should be written to disk to ensure
 * proper undo/redo support.
 */

import { SourcePatch } from './generateSourcePatch'
import { fileService } from '../services/FileService'

export interface ApplyPatchResult {
  success: boolean
  error?: string
  filePath?: string
  patchId?: string
  canUndo?: boolean
}

/**
 * Apply a source patch to disk with automatic history recording
 * 
 * This function:
 * 1. Writes the patched content to disk
 * 2. Records the change in patch history for undo support
 * 3. Returns status including whether undo is available
 */
export async function applyPatch(
  patch: SourcePatch,
  description?: string
): Promise<ApplyPatchResult> {
  const { filePath, originalContent, patchedContent, lineNumber, generatedBy } = patch

  // Don't apply if no actual changes
  if (originalContent === patchedContent) {
    return { success: false, error: 'No changes to apply' }
  }

  // Build description
  const patchDescription = description || 
    `Code patch (${generatedBy || 'unknown'}) at line ${lineNumber}`

  // Apply with history recording
  const result = await fileService.applyPatchWithHistory(
    filePath,
    originalContent,
    patchedContent,
    patchDescription,
    {
      generatedBy: generatedBy || 'unknown',
      lineNumber,
    }
  )

  if (!result.success) {
    return { success: false, error: result.error, filePath }
  }

  // Get updated status
  const statusResult = await fileService.getPatchHistoryStatus(filePath)
  
  return {
    success: true,
    filePath,
    canUndo: statusResult.success ? statusResult.data?.canUndo : false,
  }
}

/**
 * Undo the last patch for a file
 */
export async function undoLastPatch(filePath: string): Promise<{
  success: boolean
  error?: string
  restoredContent?: string
}> {
  return fileService.undoPatch(filePath)
}

/**
 * Redo the last undone patch for a file
 */
export async function redoLastPatch(filePath: string): Promise<{
  success: boolean
  error?: string
  restoredContent?: string
}> {
  return fileService.redoPatch(filePath)
}

/**
 * Create a named checkpoint before making changes
 * Useful for marking a "known good" state before experimenting
 */
export async function createCheckpoint(
  filePath: string,
  name?: string
): Promise<{
  success: boolean
  error?: string
  checkpointId?: string
  name?: string
}> {
  const result = await fileService.createCheckpoint(filePath, name)
  if (result.success && result.data) {
    return {
      success: true,
      checkpointId: result.data.checkpointId,
      name: result.data.name,
    }
  }
  return { success: false, error: result.error }
}

/**
 * Get the current undo/redo status for a file
 */
export async function getPatchStatus(filePath: string): Promise<{
  success: boolean
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  checkpointCount: number
}> {
  const result = await fileService.getPatchHistoryStatus(filePath)
  if (result.success && result.data) {
    return {
      success: true,
      ...result.data,
    }
  }
  return {
    success: false,
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    checkpointCount: 0,
  }
}
