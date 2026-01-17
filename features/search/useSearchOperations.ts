/**
 * Search Operations Hook
 *
 * Handles instant web search operations extracted from App.tsx.
 * Provides callbacks for performing searches and attaching results to chat.
 */

import { useCallback } from 'react'

/** Search result type */
export interface SearchResultItem {
  title: string
  url: string
  snippet: string
}

export interface UseSearchOperationsOptions {
  /** Set loading state */
  setIsFileSearching: (loading: boolean) => void
  /** Set search query */
  setSearchQuery: (query: string) => void
  /** Show search popover */
  setShowSearchPopover: (show: boolean) => void
  /** Set search results */
  setSearchResults: (results: SearchResultItem[] | null) => void
  /** Current search results */
  searchResults: SearchResultItem[] | null
  /** Set attached search results (for chat) */
  setAttachedSearchResults: (results: SearchResultItem[] | null) => void
}

export interface UseSearchOperationsReturn {
  /** Perform instant web search for console errors */
  performInstantSearch: (query: string) => Promise<void>
  /** Attach search results to chat (creates chip) */
  attachSearchResults: () => void
}

/**
 * Hook for search operations
 *
 * Extracts and centralizes search logic from App.tsx.
 */
export function useSearchOperations({
  setIsFileSearching,
  setSearchQuery,
  setShowSearchPopover,
  setSearchResults,
  searchResults,
  setAttachedSearchResults,
}: UseSearchOperationsOptions): UseSearchOperationsReturn {
  // Instant web search for console errors
  const performInstantSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !window.electronAPI?.aiSdk?.webSearch) {
        console.warn('[Search] No query or webSearch not available')
        return
      }

      setIsFileSearching(true)
      setSearchQuery(query)
      setShowSearchPopover(true)
      setSearchResults(null)

      try {
        // Format query for error searching
        const searchQuery = `${query.slice(0, 500)} solution fix`
        console.log('[Search] Searching for:', searchQuery)

        const result = await window.electronAPI.aiSdk.webSearch(searchQuery, 5)

        if (result.success && result.results) {
          setSearchResults(result.results)
          console.log('[Search] Found', result.results.length, 'results')
        } else {
          console.error('[Search] Failed:', result.error)
          setSearchResults([])
        }
      } catch (error) {
        console.error('[Search] Error:', error)
        setSearchResults([])
      } finally {
        setIsFileSearching(false)
      }
    },
    [setIsFileSearching, setSearchQuery, setShowSearchPopover, setSearchResults]
  )

  // Attach search results to chat (creates chip)
  const attachSearchResults = useCallback(() => {
    if (searchResults && searchResults.length > 0) {
      setAttachedSearchResults(searchResults)
      setShowSearchPopover(false)
    }
  }, [searchResults, setAttachedSearchResults, setShowSearchPopover])

  return {
    performInstantSearch,
    attachSearchResults,
  }
}
