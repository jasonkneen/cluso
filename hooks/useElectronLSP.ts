/**
 * Hook for LSP (Language Server Protocol) integration
 * Provides access to hover, completion, definition, and diagnostic features
 */

import { useCallback, useMemo, useRef } from 'react'
import { useElectronAPI } from './useElectronAPI'

// Re-export types from electron.d.ts for convenience
export type { LSPHoverResult, LSPCompletionItem, LSPLocation, LSPDiagnostic } from '../types/electron.d'

/**
 * LSP feature hook for editor-like functionality
 * Only available in Electron environment
 */
export function useElectronLSP() {
  const { isElectron, api } = useElectronAPI()
  const lspAPI = useMemo(() => (isElectron ? api?.lsp : null), [isElectron, api])

  // Cache debounce timers to prevent memory leaks
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  /**
   * Debounce a function call to avoid excessive LSP requests
   * Default delay is 200ms (standard for editor hover)
   */
  const debounce = useCallback(
    <T extends (...args: unknown[]) => Promise<unknown>>(
      key: string,
      fn: T,
      delayMs: number = 200
    ) => {
      return (...args: Parameters<T>) => {
        const timers = debounceTimersRef.current

        // Clear existing timer
        if (timers.has(key)) {
          clearTimeout(timers.get(key)!)
        }

        // Set new timer
        const timer = setTimeout(() => {
          fn(...args)
          timers.delete(key)
        }, delayMs)

        timers.set(key, timer)
      }
    },
    []
  )

  /**
   * Get hover information at a specific position
   * Returns type info, documentation, and optional range
   */
  const hover = useCallback(
    async (filePath: string, line: number, character: number) => {
      if (!lspAPI) return null
      try {
        const result = await lspAPI.hover(filePath, line, character)
        if (result.success && result.data) {
          return result.data
        }
        return null
      } catch (error) {
        console.error('[useElectronLSP] Hover failed:', error)
        return null
      }
    },
    [lspAPI]
  )

  /**
   * Get completion items at a specific position
   * Useful for autocomplete popups
   */
  const completion = useCallback(
    async (filePath: string, line: number, character: number) => {
      if (!lspAPI) return []
      try {
        const result = await lspAPI.completion(filePath, line, character)
        if (result.success && result.data) {
          return result.data
        }
        return []
      } catch (error) {
        console.error('[useElectronLSP] Completion failed:', error)
        return []
      }
    },
    [lspAPI]
  )

  /**
   * Go to definition for a symbol
   * Returns file location(s) where the symbol is defined
   */
  const definition = useCallback(
    async (filePath: string, line: number, character: number) => {
      if (!lspAPI) return null
      try {
        const result = await lspAPI.definition(filePath, line, character)
        if (result.success && result.data) {
          return result.data
        }
        return null
      } catch (error) {
        console.error('[useElectronLSP] Definition failed:', error)
        return null
      }
    },
    [lspAPI]
  )

  /**
   * Find all references to a symbol
   * Returns all locations where the symbol is referenced
   */
  const references = useCallback(
    async (filePath: string, line: number, character: number) => {
      if (!lspAPI) return []
      try {
        const result = await lspAPI.references(filePath, line, character)
        if (result.success && result.data) {
          return result.data
        }
        return []
      } catch (error) {
        console.error('[useElectronLSP] References failed:', error)
        return []
      }
    },
    [lspAPI]
  )

  /**
   * Get diagnostics (errors, warnings) for a file
   */
  const getDiagnostics = useCallback(
    async (filePath: string) => {
      if (!lspAPI) return []
      try {
        const result = await lspAPI.getDiagnosticsForFile(filePath)
        if (result.success && result.data) {
          return result.data
        }
        return []
      } catch (error) {
        console.error('[useElectronLSP] Get diagnostics failed:', error)
        return []
      }
    },
    [lspAPI]
  )

  /**
   * Notify LSP that a file has been saved
   * Triggers diagnostics update
   */
  const fileSaved = useCallback(
    async (filePath: string) => {
      if (!lspAPI) return false
      try {
        const result = await lspAPI.fileSaved(filePath)
        return result.success
      } catch (error) {
        console.error('[useElectronLSP] File saved failed:', error)
        return false
      }
    },
    [lspAPI]
  )

  /**
   * Notify LSP that file content has changed
   * Used for real-time diagnostics
   */
  const fileChanged = useCallback(
    async (filePath: string, content?: string) => {
      if (!lspAPI) return false
      try {
        const result = await lspAPI.fileChanged(filePath, content)
        return result.success
      } catch (error) {
        console.error('[useElectronLSP] File changed failed:', error)
        return false
      }
    },
    [lspAPI]
  )

  /**
   * Initialize LSP for a project
   */
  const init = useCallback(
    async (projectPath: string) => {
      if (!lspAPI) return false
      try {
        const result = await lspAPI.init(projectPath)
        return result.success
      } catch (error) {
        console.error('[useElectronLSP] Init failed:', error)
        return false
      }
    },
    [lspAPI]
  )

  /**
   * Shutdown LSP
   */
  const shutdown = useCallback(
    async () => {
      if (!lspAPI) return false
      try {
        const result = await lspAPI.shutdown()
        return result.success
      } catch (error) {
        console.error('[useElectronLSP] Shutdown failed:', error)
        return false
      }
    },
    [lspAPI]
  )

  /**
   * Subscribe to LSP events (diagnostics, server started/closed, etc.)
   * Returns cleanup function
   */
  const onEvent = useCallback(
    (callback: (event: { type: string; [key: string]: unknown }) => void) => {
      if (!lspAPI) return () => {}
      try {
        return lspAPI.onEvent(callback)
      } catch (error) {
        console.error('[useElectronLSP] Event subscription failed:', error)
        return () => {}
      }
    },
    [lspAPI]
  )

  return {
    isAvailable: !!lspAPI,
    hover,
    completion,
    definition,
    references,
    getDiagnostics,
    fileSaved,
    fileChanged,
    init,
    shutdown,
    onEvent,
    debounce,
  }
}
