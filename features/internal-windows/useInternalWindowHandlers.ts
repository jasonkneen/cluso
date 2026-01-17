/**
 * Internal Window Handlers Hook
 *
 * Handles update callbacks for internal windows (kanban, todos, notes).
 * Provides debounced save-to-disk functionality.
 */

import { useCallback, useRef } from 'react'
import type { TabState, KanbanColumn, TodoItem } from '../../types/tab'

export interface InternalWindowHandlersDeps {
  /** Ref to tabs array for accessing current values in callbacks */
  tabsRef: React.MutableRefObject<TabState[]>
  /** Ref to active tab ID for accessing current value in callbacks */
  activeTabIdRef: React.MutableRefObject<string>
  /** Function to update the current active tab */
  updateCurrentTab: (updates: Partial<TabState>) => void
}

export interface InternalWindowHandlers {
  handleUpdateKanbanColumns: (columns: KanbanColumn[]) => void
  handleUpdateKanbanTitle: (title: string) => void
  handleUpdateTodoItems: (items: TodoItem[]) => void
  handleUpdateNotesContent: (content: string) => void
}

/**
 * Hook for managing internal window update handlers
 *
 * Extracts kanban, todos, and notes update handlers from App.tsx.
 * Includes debounced save-to-disk functionality for persistence.
 */
export function useInternalWindowHandlers(
  deps: InternalWindowHandlersDeps
): InternalWindowHandlers {
  const { tabsRef, activeTabIdRef, updateCurrentTab } = deps

  // Debounce timeout refs for saving to disk
  const saveKanbanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const saveTodosTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleUpdateKanbanColumns = useCallback((columns: KanbanColumn[]) => {
    console.log('[TabData] handleUpdateKanbanColumns called, columns:', columns.length)
    const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
    if (!currentActiveTab?.kanbanData) return

    updateCurrentTab({
      kanbanData: {
        ...currentActiveTab.kanbanData,
        columns
      }
    })

    // Debounced save to disk
    if (saveKanbanTimeoutRef.current) {
      clearTimeout(saveKanbanTimeoutRef.current)
    }
    saveKanbanTimeoutRef.current = setTimeout(async () => {
      const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
      console.log('[TabData] Debounce fired, activeTab:', tab?.id, 'type:', tab?.type, 'hasTabdata:', !!window.electronAPI?.tabdata)
      if (window.electronAPI?.tabdata && tab?.kanbanData) {
        try {
          const result = await window.electronAPI.tabdata.saveKanban(tab.projectPath, {
            boardId: tab.kanbanData.boardId,
            boardTitle: tab.kanbanData.boardTitle,
            columns,
            updatedAt: new Date().toISOString()
          })
          console.log('[TabData] Kanban save result:', result)
        } catch (e) {
          console.error('[TabData] Failed to save kanban:', e)
        }
      } else {
        console.warn('[TabData] Cannot save - tabdata API:', !!window.electronAPI?.tabdata, 'activeTab:', !!tab)
      }
    }, 500)
  }, [tabsRef, activeTabIdRef, updateCurrentTab])

  const handleUpdateTodoItems = useCallback((items: TodoItem[]) => {
    updateCurrentTab({ todosData: { items } })

    // Debounced save to disk
    if (saveTodosTimeoutRef.current) {
      clearTimeout(saveTodosTimeoutRef.current)
    }
    saveTodosTimeoutRef.current = setTimeout(async () => {
      const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
      if (window.electronAPI?.tabdata && currentActiveTab) {
        try {
          await window.electronAPI.tabdata.saveTodos(currentActiveTab.projectPath, {
            items,
            updatedAt: new Date().toISOString()
          })
          console.log('[TabData] Todos saved')
        } catch (e) {
          console.error('[TabData] Failed to save todos:', e)
        }
      }
    }, 500)
  }, [tabsRef, activeTabIdRef, updateCurrentTab])

  const handleUpdateNotesContent = useCallback((content: string) => {
    updateCurrentTab({ notesData: { content } })

    // Debounced save to disk
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current)
    }
    saveNotesTimeoutRef.current = setTimeout(async () => {
      const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
      if (window.electronAPI?.tabdata && currentActiveTab) {
        try {
          await window.electronAPI.tabdata.saveNotes(currentActiveTab.projectPath, {
            content,
            updatedAt: new Date().toISOString()
          })
          console.log('[TabData] Notes saved')
        } catch (e) {
          console.error('[TabData] Failed to save notes:', e)
        }
      }
    }, 500)
  }, [tabsRef, activeTabIdRef, updateCurrentTab])

  const handleUpdateKanbanTitle = useCallback((title: string) => {
    const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
    if (!currentActiveTab?.kanbanData) return

    // Update both tab title and kanban boardTitle
    updateCurrentTab({
      title,
      kanbanData: {
        ...currentActiveTab.kanbanData,
        boardTitle: title
      }
    })

    // Trigger save with the updated title
    if (saveKanbanTimeoutRef.current) {
      clearTimeout(saveKanbanTimeoutRef.current)
    }
    saveKanbanTimeoutRef.current = setTimeout(async () => {
      const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current)
      if (window.electronAPI?.tabdata && tab?.kanbanData) {
        try {
          const result = await window.electronAPI.tabdata.saveKanban(tab.projectPath, {
            boardId: tab.kanbanData.boardId,
            boardTitle: title,
            columns: tab.kanbanData.columns,
            updatedAt: new Date().toISOString()
          })
          console.log('[TabData] Kanban title saved:', result)
        } catch (e) {
          console.error('[TabData] Failed to save kanban title:', e)
        }
      }
    }, 500)
  }, [tabsRef, activeTabIdRef, updateCurrentTab])

  return {
    handleUpdateKanbanColumns,
    handleUpdateKanbanTitle,
    handleUpdateTodoItems,
    handleUpdateNotesContent,
  }
}
