/**
 * DOM Approval Types
 *
 * Type definitions for DOM approval functionality.
 */

export interface PendingDOMApproval {
  id: string
  userApproved?: boolean
  patchStatus: 'preparing' | 'ready' | 'error'
  patch?: unknown
}

export interface UseDOMApprovalAutoApplyOptions {
  pendingDOMApproval: PendingDOMApproval | null
  handleAcceptDOMApproval: () => void
}

export interface UsePrepareDomPatchRefOptions {
  prepareDomPatchRef: React.MutableRefObject<((approval: unknown) => void) | null>
  prepareDomPatch: (approval: unknown) => void
}
