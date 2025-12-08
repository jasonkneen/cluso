/**
 * LSP UI Integration Hook
 * Manages hover tooltips, autocomplete popups, and go-to-definition
 * with proper mouse tracking and keyboard shortcuts
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useElectronLSP } from './useElectronLSP'
import type { LSPHoverResult, LSPCompletionItem, LSPLocation } from './useElectronLSP'

export interface LSPUIState {
  // Hover tooltip
  hoverTooltip: {
    isVisible: boolean
    data: LSPHoverResult | null
    position: { x: number; y: number } | null
  }
  // Autocomplete popup
  autocomplete: {
    isVisible: boolean
    items: LSPCompletionItem[]
    position: { x: number; y: number } | null
    filterText: string
  }
}

/**
 * Hook for managing LSP UI features
 * Handles debouncing, caching, and coordination between hover and completion
 */
export function useLSPUI(filePath?: string) {
  const lsp = useElectronLSP()
  const [uiState, setUIState] = useState<LSPUIState>({
    hoverTooltip: {
      isVisible: false,
      data: null,
      position: null,
    },
    autocomplete: {
      isVisible: false,
      items: [],
      position: null,
      filterText: '',
    },
  })

  // Refs for tracking state across debounce calls
  const lastHoverPosRef = useRef<{ x: number; y: number; line: number; character: number } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hoverCacheRef = useRef<Map<string, LSPHoverResult>>(new Map())
  const completionCacheRef = useRef<Map<string, LSPCompletionItem[]>>(new Map())

  /**
   * Show hover tooltip at position
   */
  const showHover = useCallback(
    async (x: number, y: number, line: number, character: number) => {
      if (!filePath || !lsp.isAvailable) return

      // Store the position for potential repeat requests
      lastHoverPosRef.current = { x, y, line, character }

      // Clear any pending hover requests
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }

      // Debounce hover request (200ms standard for editors)
      hoverTimeoutRef.current = setTimeout(async () => {
        const cacheKey = `${filePath}:${line}:${character}`

        // Check cache first
        if (hoverCacheRef.current.has(cacheKey)) {
          const cached = hoverCacheRef.current.get(cacheKey)!
          setUIState((prev) => ({
            ...prev,
            hoverTooltip: {
              isVisible: true,
              data: cached,
              position: { x, y },
            },
          }))
          return
        }

        // Request from LSP
        const result = await lsp.hover(filePath, line, character)
        if (result) {
          hoverCacheRef.current.set(cacheKey, result)
          setUIState((prev) => ({
            ...prev,
            hoverTooltip: {
              isVisible: true,
              data: result,
              position: { x, y },
            },
          }))
        }
      }, 200)
    },
    [filePath, lsp]
  )

  /**
   * Hide hover tooltip
   */
  const hideHover = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setUIState((prev) => ({
      ...prev,
      hoverTooltip: {
        isVisible: false,
        data: null,
        position: null,
      },
    }))
  }, [])

  /**
   * Show autocomplete popup
   */
  const showAutocomplete = useCallback(
    async (x: number, y: number, line: number, character: number, filterText: string = '') => {
      if (!filePath || !lsp.isAvailable) return

      const cacheKey = `${filePath}:${line}:${character}`

      // Check cache
      if (completionCacheRef.current.has(cacheKey)) {
        const cached = completionCacheRef.current.get(cacheKey)!
        setUIState((prev) => ({
          ...prev,
          autocomplete: {
            isVisible: true,
            items: cached,
            position: { x, y },
            filterText,
          },
        }))
        return
      }

      // Request from LSP
      const results = await lsp.completion(filePath, line, character)
      if (results) {
        completionCacheRef.current.set(cacheKey, results)
        setUIState((prev) => ({
          ...prev,
          autocomplete: {
            isVisible: true,
            items: results,
            position: { x, y },
            filterText,
          },
        }))
      }
    },
    [filePath, lsp]
  )

  /**
   * Update autocomplete filter text
   */
  const updateAutocompleteFilter = useCallback((filterText: string) => {
    setUIState((prev) => ({
      ...prev,
      autocomplete: {
        ...prev.autocomplete,
        filterText,
      },
    }))
  }, [])

  /**
   * Hide autocomplete popup
   */
  const hideAutocomplete = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      autocomplete: {
        isVisible: false,
        items: [],
        position: null,
        filterText: '',
      },
    }))
  }, [])

  /**
   * Select completion item
   */
  const selectCompletion = useCallback(
    async (item: LSPCompletionItem) => {
      // In a real editor, this would insert the text and trigger file changes
      // For now, just log it for debugging
      console.log('[LSP] Selected completion:', item.label, item.insertText || item.label)
      hideAutocomplete()
    },
    [hideAutocomplete]
  )

  /**
   * Go to definition (Cmd+Click)
   */
  const goToDefinition = useCallback(
    async (line: number, character: number) => {
      if (!filePath || !lsp.isAvailable) return

      const result = await lsp.definition(filePath, line, character)
      if (result) {
        // Handle both single location and array of locations
        const locations = Array.isArray(result) ? result : result ? [result] : []
        if (locations.length > 0) {
          console.log('[LSP] Go to definition:', locations[0])
          // In a real app, this would open the file at the location
          return locations[0]
        }
      }
      return null
    },
    [filePath, lsp]
  )

  /**
   * Get all references to a symbol
   */
  const findReferences = useCallback(
    async (line: number, character: number) => {
      if (!filePath || !lsp.isAvailable) return []

      return await lsp.references(filePath, line, character)
    },
    [filePath, lsp]
  )

  /**
   * Clear all caches
   */
  const clearCache = useCallback(() => {
    hoverCacheRef.current.clear()
    completionCacheRef.current.clear()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      clearCache()
    }
  }, [clearCache])

  return {
    // State
    uiState,
    // Hover
    showHover,
    hideHover,
    // Autocomplete
    showAutocomplete,
    hideAutocomplete,
    updateAutocompleteFilter,
    selectCompletion,
    // Navigation
    goToDefinition,
    findReferences,
    // Utility
    clearCache,
  }
}
