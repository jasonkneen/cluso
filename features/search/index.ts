/**
 * Search Feature Module
 *
 * Exports search state management, search operations, and types.
 */

export { useSearchState } from './useSearchState'
export type { UseSearchStateReturn } from './useSearchState'
export { useSearchOperations } from './useSearchOperations'
export type {
  UseSearchOperationsOptions,
  UseSearchOperationsReturn,
  SearchResultItem,
} from './useSearchOperations'
export type {
  SearchResult,
  SearchState,
  SearchStateActions,
} from './types'
