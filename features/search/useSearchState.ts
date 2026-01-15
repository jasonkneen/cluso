/**
 * Search State Management Hook
 *
 * Centralizes search-related state management extracted from App.tsx.
 * Handles file search results, query tracking, and attached results for chips.
 */

import { useState, useCallback } from 'react'
import type { SearchResult, SearchState, SearchStateActions } from './types'

export interface UseSearchStateReturn extends SearchState, SearchStateActions {}

/**
 * Hook for managing search state
 *
 * Extracts and centralizes search state management from App.tsx.
 * Provides state and actions for file/web search functionality.
 */
export function useSearchState(): UseSearchStateReturn {
  // Search results from file or web search
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)

  // Current search query
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Loading state for file search
  const [isFileSearching, setIsFileSearching] = useState(false)

  // Visibility state for search popover
  const [showSearchPopover, setShowSearchPopover] = useState(false)

  // Attached search results displayed as chips
  const [attachedSearchResults, setAttachedSearchResults] = useState<SearchResult[] | null>(null)

  // Action: Clear all search state
  const clearSearch = useCallback(() => {
    setSearchResults(null)
    setSearchQuery('')
    setIsFileSearching(false)
    setShowSearchPopover(false)
  }, [])

  // Action: Start a new search
  const startSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setIsFileSearching(true)
    setShowSearchPopover(true)
    setSearchResults(null)
  }, [])

  // Action: Complete search with results
  const finishSearch = useCallback((results: SearchResult[]) => {
    setSearchResults(results)
    setIsFileSearching(false)
  }, [])

  // Action: Attach results to message (for chip display)
  const attachResults = useCallback((results: SearchResult[]) => {
    setAttachedSearchResults(results)
    setShowSearchPopover(false)
  }, [])

  // Action: Clear attached results
  const clearAttachedResults = useCallback(() => {
    setAttachedSearchResults(null)
  }, [])

  return {
    // State
    searchResults,
    searchQuery,
    isFileSearching,
    showSearchPopover,
    attachedSearchResults,
    // Setters
    setSearchResults,
    setSearchQuery,
    setIsFileSearching,
    setShowSearchPopover,
    setAttachedSearchResults,
    // Actions
    clearSearch,
    startSearch,
    finishSearch,
    attachResults,
    clearAttachedResults,
  }
}
