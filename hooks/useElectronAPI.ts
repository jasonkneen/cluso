/**
 * Centralized hook for accessing Electron APIs
 * Provides type-safe access with automatic null checks and web fallbacks
 */

import { useMemo } from 'react'

// Re-export ElectronAPI type for convenience
export type { ElectronAPI } from '../types/electron.d'

/**
 * Hook to access Electron APIs with centralized null checking
 * Returns typed API accessors and an isElectron flag
 */
export function useElectronAPI() {
  const isElectron = useMemo(() => {
    return typeof window !== 'undefined' && !!window.electronAPI?.isElectron
  }, [])

  const api = useMemo(() => {
    if (!isElectron || !window.electronAPI) {
      return null
    }
    return window.electronAPI
  }, [isElectron])

  return {
    isElectron,
    api,
    // Individual API accessors for convenience
    git: api?.git ?? null,
    files: api?.files ?? null,
    aiSdk: api?.aiSdk ?? null,
    agentSdk: api?.agentSdk ?? null,
    oauth: api?.oauth ?? null,
    codex: api?.codex ?? null,
    claudeCode: api?.claudeCode ?? null,
    selectorAgent: api?.selectorAgent ?? null,
    mcp: api?.mcp ?? null,
    voice: api?.voice ?? null,
    tabdata: api?.tabdata ?? null,
    fastApply: api?.fastApply ?? null,
    fileWatcher: api?.fileWatcher ?? null,
    validator: api?.validator ?? null,
    agentTodos: api?.agentTodos ?? null,
    lsp: api?.lsp ?? null,
    mgrep: api?.mgrep ?? null,
    projectRunner: api?.projectRunner ?? null,
    window: api?.window ?? null,
    extensionBridge: api?.extensionBridge ?? null,
    pty: api?.pty ?? null,
    clipboard: api?.clipboard ?? null,
    dialog: api?.dialog ?? null,
  }
}

/**
 * Non-hook version for use outside React components
 * Use sparingly - prefer the hook version
 */
export function getElectronAPI() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron
  const api = isElectron ? window.electronAPI : null

  return {
    isElectron,
    api,
    git: api?.git ?? null,
    files: api?.files ?? null,
    aiSdk: api?.aiSdk ?? null,
    agentSdk: api?.agentSdk ?? null,
    oauth: api?.oauth ?? null,
    codex: api?.codex ?? null,
    claudeCode: api?.claudeCode ?? null,
    selectorAgent: api?.selectorAgent ?? null,
    mcp: api?.mcp ?? null,
    voice: api?.voice ?? null,
    tabdata: api?.tabdata ?? null,
    fastApply: api?.fastApply ?? null,
    fileWatcher: api?.fileWatcher ?? null,
    validator: api?.validator ?? null,
    agentTodos: api?.agentTodos ?? null,
    lsp: api?.lsp ?? null,
    mgrep: api?.mgrep ?? null,
    projectRunner: api?.projectRunner ?? null,
    window: api?.window ?? null,
    extensionBridge: api?.extensionBridge ?? null,
    pty: api?.pty ?? null,
    clipboard: api?.clipboard ?? null,
    dialog: api?.dialog ?? null,
  }
}

/**
 * Type guard to check if we're in Electron environment
 */
export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron
}

/**
 * Utility to run an Electron-only operation with error handling
 * Returns null if not in Electron or if operation fails
 */
export async function withElectron<T>(
  operation: (api: NonNullable<typeof window.electronAPI>) => Promise<T>
): Promise<T | null> {
  if (!isElectronEnvironment() || !window.electronAPI) {
    return null
  }
  try {
    return await operation(window.electronAPI)
  } catch (error) {
    console.error('[useElectronAPI] Operation failed:', error)
    return null
  }
}
