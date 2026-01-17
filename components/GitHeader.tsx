import React, { useState } from 'react'
import { GitBranch, Plus, Check, Archive, ArrowDown, ArrowUp, Coins } from 'lucide-react'

interface GitState {
  currentBranch: string
  branches: string[]
  hasChanges: boolean
  commit: (message: string) => Promise<void>
  checkout: (branch: string) => Promise<void>
  createBranch: (name: string) => Promise<void>
  pull: () => Promise<void>
  push: () => Promise<void>
}

interface GitHeaderProps {
  isDarkMode: boolean
  panelBorder: string
  git: GitState
  commitMessage: string
  onCommitMessageChange: (message: string) => void
  onStashDialogOpen: () => void
}

export const GitHeader: React.FC<GitHeaderProps> = ({
  isDarkMode,
  panelBorder,
  git,
  commitMessage,
  onCommitMessageChange,
  onStashDialogOpen
}) => {
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [gitLoading, setGitLoading] = useState<string | null>(null)

  return (
    <div className="h-12 border-b flex items-center justify-between px-3 flex-shrink-0" style={{ borderColor: panelBorder }}>
      <div className="flex items-center gap-2">
        {/* Branch Selector */}
        <div className="relative">
          <button
            onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded transition ${isDarkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            <GitBranch size={14} />
            <span>{git.currentBranch}</span>
          </button>

          {isBranchMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setIsBranchMenuOpen(false); setIsCreatingBranch(false); }}></div>
              <div className={`absolute top-full left-0 mt-1 w-56 rounded-xl shadow-xl py-1 z-50 max-h-64 overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                {isCreatingBranch ? (
                  <div className="p-2">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="New branch name..."
                      className={`w-full text-sm px-2 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? 'bg-neutral-600 border border-neutral-500 text-neutral-100 placeholder-neutral-400' : 'border border-stone-200'}`}
                      autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newBranchName.trim()) {
                          await git.createBranch(newBranchName.trim())
                          setNewBranchName('')
                          setIsCreatingBranch(false)
                          setIsBranchMenuOpen(false)
                        }
                        if (e.key === 'Escape') {
                          setIsCreatingBranch(false)
                        }
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {git.branches.filter(b => !b.startsWith('remotes/')).map(branch => (
                      <button
                        key={branch}
                        onClick={async () => {
                          await git.checkout(branch)
                          setIsBranchMenuOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                      >
                        {branch === git.currentBranch && (
                          <Check size={12} className="text-green-600" />
                        )}
                        <span className={branch === git.currentBranch ? 'font-medium' : ''}>{branch}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* New Branch */}
        <button
          onClick={() => { setIsBranchMenuOpen(true); setIsCreatingBranch(true); }}
          className={`p-1 rounded transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
          title="New branch"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Center: Address with coin icon */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-green-500" />
          <span className="text-sm font-medium text-green-500">96zMCM9nALK2cDv5p2CiDkGrgbJX9McCnQkxyBaoBAGS</span>
        </div>
      </div>

      {/* Commit Message */}
      <div className="flex-1 mx-3">
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => onCommitMessageChange(e.target.value)}
          placeholder="Message (Cmd+Enter to commit)"
          className={`w-full text-xs px-3 py-1.5 rounded-3xl focus:outline-none ${isDarkMode ? 'bg-neutral-800/60 text-neutral-300 placeholder-neutral-600 focus:bg-neutral-800' : 'bg-stone-50 border border-stone-200 text-stone-600 placeholder-stone-400 focus:ring-1 focus:ring-stone-300'}`}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commitMessage.trim()) {
              setGitLoading('commit')
              await git.commit(commitMessage.trim())
              onCommitMessageChange('')
              setGitLoading(null)
            }
          }}
        />
      </div>

      {/* Git Actions */}
      <div className="flex items-center gap-1">
        {/* Stash */}
        <button
          onClick={onStashDialogOpen}
          className={`p-1.5 rounded transition ${gitLoading === 'stash' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
          title="Stash changes"
          disabled={!git.hasChanges}
        >
          <Archive size={14} />
        </button>

        {/* Pull */}
        <button
          onClick={async () => {
            setGitLoading('pull')
            await git.pull()
            setGitLoading(null)
          }}
          className={`p-1.5 rounded transition ${gitLoading === 'pull' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
          title="Pull"
        >
          <ArrowDown size={14} />
        </button>

        {/* Push */}
        <button
          onClick={async () => {
            setGitLoading('push')
            await git.push()
            setGitLoading(null)
          }}
          className={`p-1.5 rounded transition ${gitLoading === 'push' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
          title="Push"
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  )
}
