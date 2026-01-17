/**
 * Tab State Management Hook
 *
 * Centralizes tab-related state management extracted from App.tsx.
 * Handles tab creation, selection, closing, and reordering.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { TabState, createNewTab, TabType } from '../../types/tab'
import type { Tab } from '../../components/TabBar'
import type { TabStateHook, TabStateActions } from './types'

// Default URL for new browser tabs - empty string shows NewTabPage/project selection
const DEFAULT_URL = ''

export interface UseTabStateReturn extends TabStateHook, TabStateActions {
  /** Ref to tabs array for use in callbacks that need current value */
  tabsRef: React.MutableRefObject<TabState[]>
  /** Ref to activeTabId for use in callbacks that need current value */
  activeTabIdRef: React.MutableRefObject<string>
  /** Ref to track if tab data has been loaded from disk */
  tabDataLoadedRef: React.MutableRefObject<boolean>
  /** Ref to set project tab close callback after hook is initialized (for circular dependency resolution) */
  onProjectTabCloseRef: React.MutableRefObject<((projectPath: string) => void) | null>
}

/**
 * Hook for managing tab state
 *
 * Extracts and centralizes tab state management from App.tsx.
 * Provides state and actions for tab CRUD operations.
 */
export function useTabState(options?: {
  /** Callback when tab is closed with a project path */
  onProjectTabClose?: (projectPath: string) => void
}): UseTabStateReturn {
  // Tab state - manages multiple browser tabs
  // First tab starts with the default URL so browser loads immediately
  const [tabs, setTabs] = useState<TabState[]>(() => [{
    ...createNewTab('tab-1', 'browser'),
    url: DEFAULT_URL,
    title: 'New Tab'
  }])
  const [activeTabId, setActiveTabId] = useState('tab-1')

  // Get current active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // Refs for use in callbacks that need current values without re-creating
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  const tabDataLoadedRef = useRef(false) // Prevent double-loading in StrictMode
  // Ref-based callback for circular dependency resolution - can be set after hook initialization
  const onProjectTabCloseRef = useRef<((projectPath: string) => void) | null>(null)

  // Keep refs in sync
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  // Tab management functions
  const handleNewTab = useCallback((type: TabType = 'browser') => {
    const newTab = createNewTab(undefined, type)
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    // Find the tab to check if it's a project tab
    const tabToClose = tabsRef.current.find(t => t.id === tabId)

    // If it's a project tab, show confirmation
    if (tabToClose?.projectPath) {
      const confirmed = window.confirm(
        `Close project "${tabToClose.title || 'Untitled'}"?\n\nThis will close the project and clear its chat history.`
      )
      if (!confirmed) return
    }

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (filtered.length === 0) {
        // Don't allow closing last tab
        return prev
      }
      // If closing active tab, switch to adjacent one
      if (tabId === activeTabIdRef.current) {
        const closedIndex = prev.findIndex(t => t.id === tabId)
        const newActiveIndex = Math.min(closedIndex, filtered.length - 1)
        setActiveTabId(filtered[newActiveIndex].id)
      }
      return filtered
    })

    // Notify parent if closing a project tab (via options or ref-based callback)
    if (tabToClose?.projectPath) {
      if (options?.onProjectTabClose) {
        options.onProjectTabClose(tabToClose.projectPath)
      } else if (onProjectTabCloseRef.current) {
        onProjectTabCloseRef.current(tabToClose.projectPath)
      }
    }
  }, [options])

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  const handleReorderTabs = useCallback((reorderedTabs: Tab[]) => {
    // Map the reordered Tab[] back to TabState[] preserving all properties
    setTabs(prev => {
      const tabMap = new Map(prev.map(t => [t.id, t]))
      return reorderedTabs.map(t => tabMap.get(t.id)!).filter(Boolean)
    })
  }, [])

  // Update current tab state helper
  const updateCurrentTab = useCallback((updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabIdRef.current ? { ...tab, ...updates } : tab
    ))
  }, [])

  // Update any tab by ID (for webview event handlers)
  const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ))
  }, [])

  return {
    // State
    tabs,
    activeTabId,
    activeTab,
    // Setters
    setTabs,
    setActiveTabId,
    // Actions
    handleNewTab,
    handleCloseTab,
    handleSelectTab,
    handleReorderTabs,
    updateCurrentTab,
    updateTab,
    // Refs
    tabsRef,
    activeTabIdRef,
    tabDataLoadedRef,
    onProjectTabCloseRef,
  }
}
