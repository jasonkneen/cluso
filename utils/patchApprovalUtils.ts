/**
 * Patch Approval Utilities
 *
 * Handles diff generation, adaptive learning for patch decisions,
 * and patch approval tracking per project.
 */

import DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch()

export interface PatchDiff {
  before: string
  after: string
  diffs: Array<[number, string]> // [type, text] - type: -1=delete, 0=equal, 1=add
}

export interface PatchApprovalDecision {
  filePath: string
  timestamp: number
  decision: 'accept' | 'reject' | 'edit'
  changeType?: string // e.g., 'style', 'text', 'src', 'structure'
}

export interface ProjectApprovalPatterns {
  projectPath: string
  decisions: PatchApprovalDecision[]
  acceptRatio: number // 0-1, how often patches are accepted
  recentDecisions: PatchApprovalDecision[] // Last 10 decisions
}

/**
 * Generate a diff between before and after content
 */
export function generateDiff(before: string, after: string): PatchDiff {
  const diffs = dmp.diff_main(before, after)
  dmp.diff_cleanupSemantic(diffs)

  return {
    before,
    after,
    diffs
  }
}

/**
 * Get lines with context around changed sections
 */
export function getContextLines(
  content: string,
  startLine: number,
  endLine: number,
  contextSize: number = 3
): string[] {
  const lines = content.split('\n')
  const contextStart = Math.max(0, startLine - contextSize)
  const contextEnd = Math.min(lines.length, endLine + contextSize + 1)

  return lines.slice(contextStart, contextEnd)
}

/**
 * Highlight changed lines in a diff
 */
export function getHighlightedLines(
  diffs: Array<[number, string]>
): { added: string[]; removed: string[]; context: string[] } {
  const added: string[] = []
  const removed: string[] = []
  const context: string[] = []

  for (const [type, text] of diffs) {
    const lines = text.split('\n').filter(line => line !== '')

    if (type === 1) {
      // Addition
      added.push(...lines)
    } else if (type === -1) {
      // Deletion
      removed.push(...lines)
    } else {
      // Context
      context.push(...lines)
    }
  }

  return { added, removed, context }
}

/**
 * Format a diff for display with line numbers
 */
export function formatDiffForDisplay(diffs: Array<[number, string]>): string {
  let result = ''
  let lineNum = 1

  for (const [type, text] of diffs) {
    const lines = text.split('\n')

    for (const line of lines) {
      if (!line) continue

      const prefix =
        type === 1 ? '+ ' : type === -1 ? '- ' : '  '
      result += `${lineNum} ${prefix}${line}\n`
      lineNum++
    }
  }

  return result
}

/**
 * Record a user decision for adaptive learning
 */
export function recordApprovalDecision(
  projectPath: string,
  filePath: string,
  decision: 'accept' | 'reject' | 'edit',
  changeType?: string
): void {
  const storageKey = `patch-decisions-${projectPath}`
  const decisions: PatchApprovalDecision[] = JSON.parse(
    localStorage.getItem(storageKey) || '[]'
  )

  decisions.push({
    filePath,
    timestamp: Date.now(),
    decision,
    changeType
  })

  // Keep last 100 decisions per project
  if (decisions.length > 100) {
    decisions.shift()
  }

  localStorage.setItem(storageKey, JSON.stringify(decisions))
}

/**
 * Get approval patterns for a project
 */
export function getApprovalPatterns(projectPath: string): ProjectApprovalPatterns {
  const storageKey = `patch-decisions-${projectPath}`
  const decisions: PatchApprovalDecision[] = JSON.parse(
    localStorage.getItem(storageKey) || '[]'
  )

  const acceptCount = decisions.filter(d => d.decision === 'accept').length
  const acceptRatio = decisions.length > 0 ? acceptCount / decisions.length : 0.5

  const recentDecisions = decisions.slice(-10)

  return {
    projectPath,
    decisions,
    acceptRatio,
    recentDecisions
  }
}

/**
 * Suggest an action based on learning patterns
 * Returns confidence 0-1 and suggested action
 */
export function suggestApprovalAction(
  projectPath: string,
  changeType?: string
): { action: 'accept' | 'reject' | 'manual'; confidence: number } {
  const patterns = getApprovalPatterns(projectPath)

  if (patterns.decisions.length < 3) {
    // Not enough data
    return { action: 'manual', confidence: 0 }
  }

  // If no specific change type, use overall accept ratio
  if (!changeType) {
    if (patterns.acceptRatio > 0.7) {
      return { action: 'accept', confidence: patterns.acceptRatio }
    } else if (patterns.acceptRatio < 0.3) {
      return { action: 'reject', confidence: 1 - patterns.acceptRatio }
    }
    return { action: 'manual', confidence: 0.5 }
  }

  // Analyze decisions by change type
  const changeTypeDecisions = patterns.decisions.filter(
    d => d.changeType === changeType
  )

  if (changeTypeDecisions.length < 2) {
    // Not enough data for this change type
    return { action: 'manual', confidence: 0 }
  }

  const typeAcceptCount = changeTypeDecisions.filter(
    d => d.decision === 'accept'
  ).length
  const typeAcceptRatio = typeAcceptCount / changeTypeDecisions.length

  if (typeAcceptRatio > 0.75) {
    return { action: 'accept', confidence: typeAcceptRatio }
  } else if (typeAcceptRatio < 0.25) {
    return { action: 'reject', confidence: 1 - typeAcceptRatio }
  }

  return { action: 'manual', confidence: 0.5 }
}

/**
 * Clear all approval history for a project
 */
export function clearApprovalHistory(projectPath: string): void {
  const storageKey = `patch-decisions-${projectPath}`
  localStorage.removeItem(storageKey)
}

/**
 * Get statistics about approval decisions
 */
export function getApprovalStats(projectPath: string) {
  const patterns = getApprovalPatterns(projectPath)

  const acceptCount = patterns.decisions.filter(d => d.decision === 'accept').length
  const rejectCount = patterns.decisions.filter(d => d.decision === 'reject').length
  const editCount = patterns.decisions.filter(d => d.decision === 'edit').length

  // Group by change type
  const changeTypeStats: Record<string, { accept: number; reject: number; edit: number }> = {}
  for (const decision of patterns.decisions) {
    const type = decision.changeType || 'unknown'
    if (!changeTypeStats[type]) {
      changeTypeStats[type] = { accept: 0, reject: 0, edit: 0 }
    }
    changeTypeStats[type][decision.decision]++
  }

  return {
    totalDecisions: patterns.decisions.length,
    accepted: acceptCount,
    rejected: rejectCount,
    edited: editCount,
    acceptRatio: patterns.acceptRatio,
    changeTypeStats
  }
}
