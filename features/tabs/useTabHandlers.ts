/**
 * Tab Handlers Hook
 *
 * Provides additional tab handlers that depend on useTabState.
 * Specifically handles AI tool operations like handleSwitchTab.
 *
 * Note: handleCloseTab with cleanup is handled via useTabState's
 * onProjectTabClose callback, which allows cleanup functions to be
 * passed in after other hooks have been initialized.
 */

import { useCallback } from 'react'
import type { UseTabStateReturn } from './useTabState'
import type { TabType, TabState } from './types'

/**
 * Dependencies for the tab handlers hook
 */
export interface UseTabHandlersDeps {
  /** Current tabs array */
  tabs: TabState[]
  /** Create a new tab of the specified type */
  handleNewTab: (type?: TabType) => void
  /** Set the active tab ID */
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>
}

/**
 * Return type for useTabHandlers
 */
export interface UseTabHandlersReturn {
  /** Switch to or create a tab of a specific type (for AI tools) */
  handleSwitchTab: (type: 'browser' | 'kanban' | 'todos' | 'notes') => Promise<{ success: boolean }>
}

/**
 * Hook for AI tool-related tab handlers
 *
 * Provides handlers for AI tools that need to switch between tabs.
 * Separate from useTabState to keep concerns separate.
 *
 * @param deps - Tab state dependencies from useTabState
 */
export function useTabHandlers(deps: UseTabHandlersDeps): UseTabHandlersReturn {
  const { tabs, handleNewTab, setActiveTabId } = deps

  // Handle switch_tab tool - switches to or creates different tab types
  const handleSwitchTab = useCallback(async (type: 'browser' | 'kanban' | 'todos' | 'notes'): Promise<{ success: boolean }> => {
    console.log('[AI] Switching to tab type:', type)
    // Check if a tab of this type already exists
    const existingTab = tabs.find(t => t.type === type)
    if (existingTab) {
      setActiveTabId(existingTab.id)
    } else {
      // Create a new tab of the specified type
      handleNewTab(type as TabType)
    }
    return { success: true }
  }, [tabs, handleNewTab, setActiveTabId])

  return {
    handleSwitchTab,
  }
}
