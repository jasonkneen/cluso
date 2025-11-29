import { useState, useEffect, useCallback } from 'react'

interface GitState {
  currentBranch: string
  branches: string[]
  hasChanges: boolean
  changedFiles: { status: string; file: string }[]
  isLoading: boolean
  error: string | null
}

export function useGit() {
  const [state, setState] = useState<GitState>({
    currentBranch: 'main',
    branches: [],
    hasChanges: false,
    changedFiles: [],
    isLoading: true,
    error: null,
  })

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.git

  const refresh = useCallback(async () => {
    if (!isElectron) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }

    try {
      const [branchResult, branchesResult, statusResult] = await Promise.all([
        window.electronAPI!.git.getCurrentBranch(),
        window.electronAPI!.git.getBranches(),
        window.electronAPI!.git.getStatus(),
      ])

      setState(prev => ({
        ...prev,
        currentBranch: branchResult.success ? branchResult.data! : prev.currentBranch,
        branches: branchesResult.success ? branchesResult.data! : prev.branches,
        hasChanges: statusResult.success ? statusResult.data!.hasChanges : false,
        changedFiles: statusResult.success ? statusResult.data!.files : [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Git error',
      }))
    }
  }, [isElectron])

  useEffect(() => {
    refresh()
    // Poll for changes every 5 seconds
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const checkout = useCallback(async (branch: string) => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.checkout(branch)
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const createBranch = useCallback(async (name: string) => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.createBranch(name)
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const commit = useCallback(async (message: string) => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.commit(message)
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const push = useCallback(async () => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    return await window.electronAPI!.git.push()
  }, [isElectron])

  const pull = useCallback(async () => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.pull()
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const stash = useCallback(async () => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.stash()
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const stashWithMessage = useCallback(async (message: string) => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.stashWithMessage(message)
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  const stashPop = useCallback(async () => {
    if (!isElectron) return { success: false, error: 'Not in Electron' }
    const result = await window.electronAPI!.git.stashPop()
    if (result.success) await refresh()
    return result
  }, [isElectron, refresh])

  return {
    ...state,
    isElectron,
    refresh,
    checkout,
    createBranch,
    commit,
    push,
    pull,
    stash,
    stashWithMessage,
    stashPop,
  }
}
