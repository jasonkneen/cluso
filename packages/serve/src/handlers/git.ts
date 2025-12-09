// @ts-nocheck
/**
 * Git operation handlers for Cluso server
 * Mirrors Electron IPC handlers with server-side implementation
 */

import { spawnSync } from 'child_process'
import type { Result } from '../types/api.js'

// ==========================================
// Git Validation Helpers
// ==========================================

/**
 * Validate git branch/ref names to prevent injection attacks
 * Blocks: spaces, ~, ^, :, ?, *, [, \, ;, &, |, `, $, (), ', ", <, >
 */
function validateGitRef(ref: string): { valid: boolean; ref?: string; error?: string } {
  if (!ref || typeof ref !== 'string') {
    return { valid: false, error: 'Invalid ref name' }
  }

  // Git ref names can't contain: space, ~, ^, :, ?, *, [, \, ..
  // Also block shell metacharacters
  const invalidChars = /[\s~^:?*\[\]\\;&|`$()'"<>]/
  if (invalidChars.test(ref) || ref.includes('..')) {
    return { valid: false, error: 'Invalid characters in ref name' }
  }

  if (ref.startsWith('-')) {
    return { valid: false, error: 'Ref name cannot start with dash' }
  }

  return { valid: true, ref: ref.trim() }
}

/**
 * Safely execute git command with array args (prevents injection)
 * Uses spawnSync with array args instead of shell interpretation
 */
function gitExecSafe(args: string[], cwd: string): Result<string> {
  try {
    const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })

    if (result.status !== 0) {
      return { success: false, error: result.stderr || 'Git command failed' }
    }

    return { success: true, data: (result.stdout || '').trim() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

// ==========================================
// Git Handler Functions
// ==========================================

/**
 * Get the current git branch name
 */
export function getCurrentBranch(cwd: string): Result<string> {
  return gitExecSafe(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
}

/**
 * Get all branches (local and remote)
 * Returns array of branch names without symbols
 */
export function getBranches(cwd: string): Result<string[]> {
  const result = gitExecSafe(['branch', '-a'], cwd)

  if (result.success) {
    const branches = result.data
      .split('\n')
      .map(b => b.trim().replace(/^\* /, ''))
      .filter(b => b && !b.includes('->'))

    return { success: true, data: branches }
  }

  return result
}

/**
 * Get git status with files organized by type
 */
export function getStatus(
  cwd: string
): Result<{
  files: Array<{ status: string; file: string }>
  hasChanges: boolean
}> {
  const result = gitExecSafe(['status', '--porcelain'], cwd)

  if (result.success) {
    const files = result.data
      .split('\n')
      .filter(f => f.trim())
      .map(f => ({
        status: f.substring(0, 2).trim(),
        file: f.substring(3),
      }))

    return {
      success: true,
      data: {
        files,
        hasChanges: files.length > 0,
      },
    }
  }

  return result
}

/**
 * Switch to a different branch
 * Validates branch name to prevent injection
 */
export function checkout(cwd: string, branch: string): Result<string> {
  const validation = validateGitRef(branch)

  if (!validation.valid) {
    return { success: false, error: validation.error! }
  }

  return gitExecSafe(['checkout', validation.ref!], cwd)
}

/**
 * Restore a specific file to its last committed state
 * Uses -- to separate path from command to prevent injection
 */
export function checkoutFile(cwd: string, filePath: string): Result<string> {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' }
  }

  // Note: Server should validate path is within project before calling
  // Using -- to separate path from command prevents path injection
  return gitExecSafe(['checkout', 'HEAD', '--', filePath], cwd)
}

/**
 * Create a new branch
 * Validates branch name to prevent injection
 */
export function createBranch(cwd: string, name: string): Result<string> {
  const validation = validateGitRef(name)

  if (!validation.valid) {
    return { success: false, error: validation.error! }
  }

  return gitExecSafe(['checkout', '-b', validation.ref!], cwd)
}

/**
 * Stage all changes and create a commit
 * Message is passed as array element (safe from injection)
 */
export function commit(cwd: string, message: string): Result<string> {
  // Stage all changes first
  const addResult = gitExecSafe(['add', '-A'], cwd)

  if (!addResult.success) {
    return addResult
  }

  // Message is passed as array element, safe from injection
  return gitExecSafe(['commit', '-m', message], cwd)
}

/**
 * Push commits to remote repository
 */
export function push(cwd: string): Result<string> {
  return gitExecSafe(['push'], cwd)
}

/**
 * Pull changes from remote repository
 */
export function pull(cwd: string): Result<string> {
  return gitExecSafe(['pull'], cwd)
}

/**
 * Stash changes (optionally with a message)
 */
export function stash(cwd: string, message?: string): Result<string> {
  if (message) {
    return gitExecSafe(['stash', 'push', '-m', message], cwd)
  }

  return gitExecSafe(['stash'], cwd)
}

/**
 * Pop stashed changes
 */
export function stashPop(cwd: string): Result<string> {
  return gitExecSafe(['stash', 'pop'], cwd)
}
