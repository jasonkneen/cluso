/**
 * Git Handlers Hook
 *
 * Extracts git operation handlers from App.tsx.
 * Works with useGit (operations) and useGitPanelState (UI state).
 */

import { useCallback } from 'react'
import type { UseGitPanelStateReturn } from './useGitPanelState'

interface GitOperations {
  stash: () => Promise<{ success: boolean; error?: string }>
  stashWithMessage: (message: string) => Promise<{ success: boolean; error?: string }>
  commit: (message: string) => Promise<{ success: boolean; error?: string }>
  push: () => Promise<{ success: boolean; error?: string }>
  pull: () => Promise<{ success: boolean; error?: string }>
  checkout: (branch: string) => Promise<{ success: boolean; error?: string }>
  createBranch: (name: string) => Promise<{ success: boolean; error?: string }>
  stashPop: () => Promise<{ success: boolean; error?: string }>
}

interface UseGitHandlersParams {
  git: GitOperations
  gitPanel: UseGitPanelStateReturn
}

export interface UseGitHandlersReturn {
  /** Stash changes with optional message */
  handleStash: (message?: string) => Promise<void>
  /** Commit staged changes */
  handleCommit: (message: string) => Promise<void>
  /** Push to remote */
  handlePush: () => Promise<void>
  /** Pull from remote */
  handlePull: () => Promise<void>
  /** Checkout branch */
  handleCheckoutBranch: (branch: string) => Promise<void>
  /** Create new branch */
  handleCreateBranch: (name: string) => Promise<void>
  /** Pop stashed changes */
  handleStashPop: () => Promise<void>
}

/**
 * Hook for git operation handlers
 *
 * Provides wrapped handlers that manage loading state and UI resets.
 */
export function useGitHandlers({
  git,
  gitPanel,
}: UseGitHandlersParams): UseGitHandlersReturn {
  const {
    setGitLoading,
    setIsStashDialogOpen,
    setStashMessage,
    setCommitMessage,
    setIsBranchMenuOpen,
    setNewBranchName,
    setIsCreatingBranch,
  } = gitPanel

  // Stash with optional message
  const handleStash = useCallback(
    async (message?: string) => {
      setGitLoading('stash')
      if (message && message.trim()) {
        await git.stashWithMessage(message.trim())
      } else {
        await git.stash()
      }
      setGitLoading(null)
      setIsStashDialogOpen(false)
      setStashMessage('')
    },
    [git, setGitLoading, setIsStashDialogOpen, setStashMessage],
  )

  // Commit staged changes
  const handleCommit = useCallback(
    async (message: string) => {
      if (!message.trim()) return
      setGitLoading('commit')
      await git.commit(message.trim())
      setCommitMessage('')
      setGitLoading(null)
    },
    [git, setGitLoading, setCommitMessage],
  )

  // Push to remote
  const handlePush = useCallback(async () => {
    setGitLoading('push')
    await git.push()
    setGitLoading(null)
  }, [git, setGitLoading])

  // Pull from remote
  const handlePull = useCallback(async () => {
    setGitLoading('pull')
    await git.pull()
    setGitLoading(null)
  }, [git, setGitLoading])

  // Checkout branch
  const handleCheckoutBranch = useCallback(
    async (branch: string) => {
      await git.checkout(branch)
      setIsBranchMenuOpen(false)
    },
    [git, setIsBranchMenuOpen],
  )

  // Create new branch
  const handleCreateBranch = useCallback(
    async (name: string) => {
      if (!name.trim()) return
      await git.createBranch(name.trim())
      setNewBranchName('')
      setIsCreatingBranch(false)
      setIsBranchMenuOpen(false)
    },
    [git, setNewBranchName, setIsCreatingBranch, setIsBranchMenuOpen],
  )

  // Pop stashed changes
  const handleStashPop = useCallback(async () => {
    setGitLoading('stash-pop')
    await git.stashPop()
    setGitLoading(null)
  }, [git, setGitLoading])

  return {
    handleStash,
    handleCommit,
    handlePush,
    handlePull,
    handleCheckoutBranch,
    handleCreateBranch,
    handleStashPop,
  }
}
