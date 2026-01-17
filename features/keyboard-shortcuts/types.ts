/**
 * Keyboard Shortcuts Types
 *
 * Type definitions for keyboard shortcut functionality.
 */

export interface ConsoleLog {
  type: string
  message: string
}

export interface UseConsoleKeyboardShortcutsOptions {
  isConsolePanelOpen: boolean
  selectedLogIndices: Set<number>
  setSelectedLogIndices: (indices: Set<number>) => void
  consoleLogs: ConsoleLog[]
  performInstantSearch: (query: string) => void
}

export interface UseApprovalKeyboardShortcutsOptions {
  pendingChange: unknown
  pendingDOMApproval: unknown
  handleAcceptDOMApproval: () => void
  handleRejectDOMApproval: () => void
  handleApproveChange: () => void
  handleRejectChange: () => void
}

export interface UseThinkingPopoverOptions {
  showThinkingPopover: boolean
  setShowThinkingPopover: (show: boolean) => void
}
