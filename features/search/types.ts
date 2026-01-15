/**
 * Search Feature Types
 *
 * Type definitions for file/web search functionality.
 */

/**
 * Search result item returned from file or web search
 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Search state managed by useSearchState hook
 */
export interface SearchState {
  searchResults: SearchResult[] | null
  searchQuery: string
  isFileSearching: boolean
  showSearchPopover: boolean
  attachedSearchResults: SearchResult[] | null
}

/**
 * Actions returned by useSearchState hook
 */
export interface SearchStateActions {
  setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[] | null>>
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setIsFileSearching: React.Dispatch<React.SetStateAction<boolean>>
  setShowSearchPopover: React.Dispatch<React.SetStateAction<boolean>>
  setAttachedSearchResults: React.Dispatch<React.SetStateAction<SearchResult[] | null>>
  clearSearch: () => void
  startSearch: (query: string) => void
  finishSearch: (results: SearchResult[]) => void
  attachResults: (results: SearchResult[]) => void
  clearAttachedResults: () => void
}
