/**
 * Git Feature Types
 *
 * Type definitions for the git panel UI state.
 */

/**
 * Git panel UI state
 */
export interface GitPanelState {
  /** Whether branch dropdown menu is open */
  isBranchMenuOpen: boolean
  /** Commit message input value */
  commitMessage: string
  /** New branch name input value */
  newBranchName: string
  /** Whether in branch creation mode */
  isCreatingBranch: boolean
  /** Current loading operation (null if not loading) */
  gitLoading: string | null
  /** Whether stash dialog is open */
  isStashDialogOpen: boolean
  /** Stash message input value */
  stashMessage: string
}

/**
 * Git panel UI state setters
 */
export interface GitPanelStateSetters {
  setIsBranchMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setCommitMessage: React.Dispatch<React.SetStateAction<string>>
  setNewBranchName: React.Dispatch<React.SetStateAction<string>>
  setIsCreatingBranch: React.Dispatch<React.SetStateAction<boolean>>
  setGitLoading: React.Dispatch<React.SetStateAction<string | null>>
  setIsStashDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  setStashMessage: React.Dispatch<React.SetStateAction<string>>
}
