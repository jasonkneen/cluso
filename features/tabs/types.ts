/**
 * Tab Feature Types
 *
 * Type definitions for the tab management system.
 * Re-exports core types from types/tab.ts and adds hook-specific types.
 */

// Re-export core tab types from the central types module
export { type TabState, type TabType, createNewTab } from '../../types/tab'

// Also re-export the TabBar's Tab interface for convenience
export type { Tab } from '../../components/TabBar'

/**
 * Tab state managed by useTabState hook
 */
export interface TabStateHook {
  tabs: import('../../types/tab').TabState[]
  activeTabId: string
  activeTab: import('../../types/tab').TabState
}

/**
 * Actions returned by useTabState hook
 */
export interface TabStateActions {
  setTabs: React.Dispatch<React.SetStateAction<import('../../types/tab').TabState[]>>
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>
  handleNewTab: (type?: import('../../types/tab').TabType) => void
  handleCloseTab: (tabId: string) => void
  handleSelectTab: (tabId: string) => void
  handleReorderTabs: (reorderedTabs: import('../../components/TabBar').Tab[]) => void
  updateCurrentTab: (updates: Partial<import('../../types/tab').TabState>) => void
  updateTab: (tabId: string, updates: Partial<import('../../types/tab').TabState>) => void
}
