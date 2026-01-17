/**
 * Tab Data Loader Hook
 *
 * Handles loading existing tab data (kanban, todos, notes) from disk on startup.
 * Extracted from App.tsx lines 354-415.
 */

import { useEffect } from 'react'
import type { TabState, KanbanColumn } from '../../types/tab'
import { createNewTab } from '../../types/tab'

interface UseTabDataLoaderOptions {
  setTabs: React.Dispatch<React.SetStateAction<TabState[]>>
  /** Ref to track if tab data has been loaded (from useTabState) */
  tabDataLoadedRef: React.MutableRefObject<boolean>
}

interface KanbanBoard {
  boardId: string
  boardTitle?: string
  columns?: KanbanColumn[]
}

/**
 * Hook for loading tab data from disk on startup
 *
 * Loads kanban boards, todos, and notes from disk and creates tabs for them.
 * Uses a ref guard to prevent double-loading in React StrictMode.
 */
export function useTabDataLoader({ setTabs, tabDataLoadedRef }: UseTabDataLoaderOptions): void {

  useEffect(() => {
    async function loadTabData() {
      // Guard against double-loading in React StrictMode
      if (tabDataLoadedRef.current) return
      tabDataLoadedRef.current = true

      if (!window.electronAPI?.tabdata) return

      try {
        // Load kanban, todos, and notes data from disk
        const [kanbanResult, todosResult, notesResult] = await Promise.all([
          window.electronAPI.tabdata.loadKanban(undefined),
          window.electronAPI.tabdata.loadTodos(undefined),
          window.electronAPI.tabdata.loadNotes(undefined)
        ])

        // If any data exists, create tabs for them
        const tabsToAdd: TabState[] = []

        // Load all kanban boards (data is now an array)
        if (kanbanResult.success && Array.isArray(kanbanResult.data) && kanbanResult.data.length > 0) {
          for (const board of kanbanResult.data as KanbanBoard[]) {
            console.log('[TabData] Loaded kanban board:', board.boardId, board.boardTitle)
            tabsToAdd.push({
              ...createNewTab(undefined, 'kanban'),
              title: board.boardTitle || 'Kanban',
              kanbanData: {
                boardId: board.boardId,
                boardTitle: board.boardTitle || 'Kanban',
                columns: board.columns || []
              }
            })
          }
        }

        if (todosResult.success && todosResult.data) {
          console.log('[TabData] Loaded todos data')
          tabsToAdd.push({
            ...createNewTab(undefined, 'todos'),
            todosData: { items: todosResult.data.items }
          })
        }

        if (notesResult.success && notesResult.data) {
          console.log('[TabData] Loaded notes data')
          tabsToAdd.push({
            ...createNewTab(undefined, 'notes'),
            notesData: { content: notesResult.data.content }
          })
        }

        // Add loaded tabs to the existing tabs
        if (tabsToAdd.length > 0) {
          setTabs(prev => [...prev, ...tabsToAdd])
        }
      } catch (error) {
        console.error('[TabData] Error loading tab data:', error)
      }
    }

    loadTabData()
  }, [setTabs, tabDataLoadedRef])
}
