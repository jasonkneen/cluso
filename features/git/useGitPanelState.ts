/**
 * Git Panel State Hook
 *
 * Manages UI state for the git panel (menus, inputs, dialogs).
 * Note: Git operations themselves are in hooks/useGit.ts
 */

import { useState } from 'react'
import type { GitPanelState, GitPanelStateSetters } from './types'

export interface UseGitPanelStateReturn extends GitPanelState, GitPanelStateSetters {
  /** Reset all input fields */
  resetInputs: () => void
  /** Reset commit message */
  resetCommitMessage: () => void
  /** Reset branch creation state */
  resetBranchCreation: () => void
  /** Reset stash dialog state */
  resetStashDialog: () => void
}

/**
 * Hook for managing git panel UI state
 */
export function useGitPanelState(): UseGitPanelStateReturn {
  // Branch menu state
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)

  // Commit state
  const [commitMessage, setCommitMessage] = useState('')

  // Branch creation state
  const [newBranchName, setNewBranchName] = useState('')
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)

  // Loading state
  const [gitLoading, setGitLoading] = useState<string | null>(null)

  // Stash dialog state
  const [isStashDialogOpen, setIsStashDialogOpen] = useState(false)
  const [stashMessage, setStashMessage] = useState('')

  // Action: Reset all input fields
  const resetInputs = () => {
    setCommitMessage('')
    setNewBranchName('')
    setIsCreatingBranch(false)
    setStashMessage('')
  }

  // Action: Reset commit message
  const resetCommitMessage = () => {
    setCommitMessage('')
  }

  // Action: Reset branch creation state
  const resetBranchCreation = () => {
    setNewBranchName('')
    setIsCreatingBranch(false)
  }

  // Action: Reset stash dialog state
  const resetStashDialog = () => {
    setIsStashDialogOpen(false)
    setStashMessage('')
  }

  return {
    // State
    isBranchMenuOpen,
    commitMessage,
    newBranchName,
    isCreatingBranch,
    gitLoading,
    isStashDialogOpen,
    stashMessage,
    // Setters
    setIsBranchMenuOpen,
    setCommitMessage,
    setNewBranchName,
    setIsCreatingBranch,
    setGitLoading,
    setIsStashDialogOpen,
    setStashMessage,
    // Actions
    resetInputs,
    resetCommitMessage,
    resetBranchCreation,
    resetStashDialog,
  }
}
