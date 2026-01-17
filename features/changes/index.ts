/**
 * Changes Feature Module
 *
 * Exports pending change state management, approval handlers, and types.
 */

export { usePendingChangeState } from './usePendingChangeState'
export type { UsePendingChangeStateReturn } from './usePendingChangeState'
export { useChangeApprovalHandlers } from './useChangeApprovalHandlers'
export type {
  UseChangeApprovalHandlersOptions,
  UseChangeApprovalHandlersReturn,
} from './useChangeApprovalHandlers'
export type {
  PendingChange,
  PendingChangeState,
  PendingChangeStateActions,
} from './types'
