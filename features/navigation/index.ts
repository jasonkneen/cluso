/**
 * Navigation Feature Module
 *
 * Exports navigation state management, browser navigation operations, and types.
 */

export { useNavigationState } from './useNavigationState'
export type { UseNavigationStateReturn } from './useNavigationState'
export { useBrowserNavigation } from './useBrowserNavigation'
export type {
  UseBrowserNavigationOptions,
  UseBrowserNavigationReturn,
} from './useBrowserNavigation'
export type {
  NavigationState,
  NavigationStateActions,
} from './types'
