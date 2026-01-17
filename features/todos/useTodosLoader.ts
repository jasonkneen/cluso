/**
 * Todos Loader Hook
 *
 * Handles loading todos from disk when project path changes.
 * Extracted from App.tsx lines 5321-5325.
 */

import { useEffect } from 'react'
import { fileService } from '../../services/FileService'

interface TabState {
  id: string
  todosData?: {
    items: unknown[]
  }
}

interface UseTodosLoaderOptions {
  projectPath: string | undefined
  activeTabId: string
  setTabs: React.Dispatch<React.SetStateAction<TabState[]>>
}

/**
 * Hook for loading todos when project changes
 *
 * Loads todos from the file system and updates the active tab's todosData.
 */
export function useTodosLoader({
  projectPath,
  activeTabId,
  setTabs,
}: UseTodosLoaderOptions): void {
  useEffect(() => {
    if (!projectPath) return

    const loadTodosFromDisk = async () => {
      const result = await fileService.listTodos(projectPath)
      if (result.success && result.data) {
        setTabs(prev => prev.map(tab =>
          tab.id === activeTabId
            ? {
                ...tab,
                todosData: {
                  items: result.data || []
                }
              }
            : tab
        ))
      }
    }

    loadTodosFromDisk()
  }, [projectPath, activeTabId, setTabs])
}
