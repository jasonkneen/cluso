/**
 * File Browser Operations Hook
 *
 * Handles file browser overlay operations extracted from App.tsx.
 * Provides callbacks for showing, navigating, opening items in the file browser overlay.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/fileService'
import type {
  FileBrowserPanel,
  FileBrowserItem,
} from './types'

export interface UseFileBrowserOperationsOptions {
  /** Whether running in Electron */
  isElectron: boolean
  /** Base path for file browser */
  fileBrowserBasePath: string
  /** Set base path */
  setFileBrowserBasePath: (path: string) => void
  /** Current panel stack */
  fileBrowserStack: FileBrowserPanel[]
  /** Set panel stack */
  setFileBrowserStack: React.Dispatch<React.SetStateAction<FileBrowserPanel[]>>
  /** Whether browser is visible */
  fileBrowserVisible: boolean
  /** Set visibility */
  setFileBrowserVisible: (visible: boolean) => void
  /** Ref to stack (for callbacks) */
  fileBrowserStackRef: React.MutableRefObject<FileBrowserPanel[]>
  /** Ref to visibility (for callbacks) */
  fileBrowserVisibleRef: React.MutableRefObject<boolean>
}

export interface UseFileBrowserOperationsReturn {
  /** Show file browser starting at path */
  showFileBrowser: (path?: string) => Promise<string>
  /** Open item by number in current directory */
  openFileBrowserItem: (itemNumber: number) => Promise<string>
  /** Navigate back in file browser */
  fileBrowserBack: () => string
  /** Close file browser */
  closeFileBrowser: () => string
  /** Open folder by name or number */
  openFolder: (name?: string, itemNumber?: number) => Promise<string>
  /** Open file by name or path */
  openFile: (name?: string, path?: string) => Promise<string>
}

/**
 * Hook for file browser overlay operations
 *
 * Extracts and centralizes file browser operations from App.tsx.
 */
export function useFileBrowserOperations({
  isElectron,
  fileBrowserBasePath,
  setFileBrowserBasePath,
  setFileBrowserStack,
  setFileBrowserVisible,
  fileBrowserStackRef,
  fileBrowserVisibleRef,
}: UseFileBrowserOperationsOptions): UseFileBrowserOperationsReturn {
  // Show file browser starting at path
  const showFileBrowser = useCallback(
    async (path?: string): Promise<string> => {
      console.log('[FileBrowser] Opening:', path)
      if (!isElectron) {
        return 'Error: File browser only available in Electron mode'
      }
      try {
        const targetPath = path || fileBrowserBasePath || '.'
        const result = await fileService.listDirectory(targetPath)
        if (result.success && result.data) {
          const items: FileBrowserItem[] = result.data.map((f) => ({
            name: f.name,
            isDirectory: f.isDirectory,
            path: `${targetPath}/${f.name}`.replace(/\/\//g, '/'),
          }))

          // Set base path if not set
          if (!fileBrowserBasePath) {
            setFileBrowserBasePath(targetPath)
          }

          const panel: FileBrowserPanel = {
            type: 'directory',
            path: targetPath,
            title: targetPath.split('/').pop() || targetPath,
            items,
          }

          // Update refs immediately (before React re-renders)
          fileBrowserStackRef.current = [panel]
          fileBrowserVisibleRef.current = true

          setFileBrowserStack([panel])
          setFileBrowserVisible(true)

          console.log(
            '[FileBrowser] Opened - refs updated:',
            fileBrowserVisibleRef.current,
            fileBrowserStackRef.current.length
          )
          return `Showing ${items.length} items. Say "open" followed by a number to open an item.`
        }
        return 'Error: Could not list directory'
      } catch (err) {
        return 'Error: ' + (err as Error).message
      }
    },
    [
      isElectron,
      fileBrowserBasePath,
      setFileBrowserBasePath,
      setFileBrowserStack,
      setFileBrowserVisible,
      fileBrowserStackRef,
      fileBrowserVisibleRef,
    ]
  )

  // Open item by number in current directory
  const openFileBrowserItem = useCallback(
    async (itemNumber: number): Promise<string> => {
      console.log('[FileBrowser] Opening item:', itemNumber)
      console.log(
        '[FileBrowser] State check - visible:',
        fileBrowserVisibleRef.current,
        'stack length:',
        fileBrowserStackRef.current.length
      )

      // Use refs to get the latest state
      const currentStack = fileBrowserStackRef.current
      const isVisible = fileBrowserVisibleRef.current

      if (!isVisible || currentStack.length === 0) {
        return `Error: No file browser open. (visible: ${isVisible}, stack: ${currentStack.length})`
      }

      const currentPanel = currentStack[currentStack.length - 1]
      if (currentPanel.type !== 'directory' || !currentPanel.items) {
        return 'Error: Current panel is not a directory'
      }

      const index = itemNumber - 1
      if (index < 0 || index >= currentPanel.items.length) {
        return `Error: Invalid item number. Choose 1-${currentPanel.items.length}`
      }

      const item = currentPanel.items[index]

      if (item.isDirectory) {
        // Open directory
        const result = await fileService.listDirectory(item.path)
        if (result.success && result.data) {
          const items: FileBrowserItem[] = result.data.map((f) => ({
            name: f.name,
            isDirectory: f.isDirectory,
            path: `${item.path}/${f.name}`.replace(/\/\//g, '/'),
          }))

          const panel: FileBrowserPanel = {
            type: 'directory',
            path: item.path,
            title: item.name,
            items,
          }

          // Update ref immediately
          fileBrowserStackRef.current = [...currentStack, panel]
          setFileBrowserStack((prev) => [...prev, panel])
          return `Opened folder "${item.name}" with ${items.length} items.`
        }
        return 'Error: Could not open folder'
      } else {
        // Open file
        const ext = item.name.split('.').pop()?.toLowerCase()
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(
          ext || ''
        )

        if (isImage) {
          const panel: FileBrowserPanel = {
            type: 'image',
            path: item.path,
            title: item.name,
          }
          // Update ref immediately
          fileBrowserStackRef.current = [...currentStack, panel]
          setFileBrowserStack((prev) => [...prev, panel])
          return `Showing image "${item.name}"`
        } else {
          // Read file content
          const result = await fileService.readFile(item.path, { truncateAt: 50000 })
          if (result.success && result.data) {
            const panel: FileBrowserPanel = {
              type: 'file',
              path: item.path,
              title: item.name,
              content: result.data,
            }
            // Update ref immediately
            fileBrowserStackRef.current = [...currentStack, panel]
            setFileBrowserStack((prev) => [...prev, panel])
            return `Opened file "${item.name}"`
          }
          return 'Error: ' + (result.error || 'Could not read file')
        }
      }
    },
    [fileBrowserStackRef, fileBrowserVisibleRef, setFileBrowserStack]
  )

  // Navigate back in file browser
  const fileBrowserBack = useCallback((): string => {
    // Use refs to get the latest state
    const isVisible = fileBrowserVisibleRef.current
    const currentStack = fileBrowserStackRef.current

    if (!isVisible) {
      return 'No file browser open'
    }
    if (currentStack.length <= 1) {
      // Update refs immediately
      fileBrowserVisibleRef.current = false
      fileBrowserStackRef.current = []
      setFileBrowserVisible(false)
      setFileBrowserStack([])
      return 'Closed file browser'
    }
    // Update ref immediately
    fileBrowserStackRef.current = currentStack.slice(0, -1)
    setFileBrowserStack((prev) => prev.slice(0, -1))
    const prevPanel = currentStack[currentStack.length - 2]
    return `Back to "${prevPanel?.title || 'root'}"`
  }, [
    fileBrowserVisibleRef,
    fileBrowserStackRef,
    setFileBrowserVisible,
    setFileBrowserStack,
  ])

  // Close file browser
  const closeFileBrowser = useCallback((): string => {
    // Update refs immediately
    fileBrowserVisibleRef.current = false
    fileBrowserStackRef.current = []
    setFileBrowserVisible(false)
    setFileBrowserStack([])
    return 'Closed file browser'
  }, [
    fileBrowserVisibleRef,
    fileBrowserStackRef,
    setFileBrowserVisible,
    setFileBrowserStack,
  ])

  // Open folder by name or number
  const openFolder = useCallback(
    async (name?: string, itemNumber?: number): Promise<string> => {
      console.log('[FileBrowser] Opening folder:', name || `#${itemNumber}`)
      console.log(
        '[FileBrowser] State check - visible:',
        fileBrowserVisibleRef.current,
        'stack length:',
        fileBrowserStackRef.current.length
      )

      // Use refs to get the latest state
      const currentStack = fileBrowserStackRef.current
      const isVisible = fileBrowserVisibleRef.current

      if (!isVisible || currentStack.length === 0) {
        return `Error: No file browser open. Use list_files first to show the file browser. (visible: ${isVisible}, stack: ${currentStack.length})`
      }

      const currentPanel = currentStack[currentStack.length - 1]
      if (currentPanel.type !== 'directory' || !currentPanel.items) {
        return 'Error: Current panel is not a directory'
      }

      let targetItem: FileBrowserItem | undefined
      let foundIndex: number = -1

      // Find by name
      if (name) {
        const lowerName = name.toLowerCase()
        foundIndex = currentPanel.items.findIndex(
          (item) => item.isDirectory && item.name.toLowerCase() === lowerName
        )
        if (foundIndex === -1) {
          // Try partial match
          foundIndex = currentPanel.items.findIndex(
            (item) => item.isDirectory && item.name.toLowerCase().includes(lowerName)
          )
        }
        if (foundIndex !== -1) {
          targetItem = currentPanel.items[foundIndex]
        } else {
          const folders = currentPanel.items
            .filter((i) => i.isDirectory)
            .map((i) => i.name)
            .join(', ')
          return `Error: No folder named "${name}" found. Available folders: ${folders || 'none'}`
        }
      }
      // Find by number
      else if (itemNumber !== undefined) {
        const index = itemNumber - 1
        if (index < 0 || index >= currentPanel.items.length) {
          return `Error: Invalid item number. Choose 1-${currentPanel.items.length}`
        }
        const item = currentPanel.items[index]
        if (!item.isDirectory) {
          return `Error: Item ${itemNumber} "${item.name}" is a file, not a folder. Use open_item for files.`
        }
        targetItem = item
        foundIndex = index
      } else {
        return 'Error: Please provide either a folder name or item number'
      }

      // Open the folder
      if (!targetItem) {
        return 'Error: Could not find folder'
      }

      if (!isElectron) {
        return 'Error: File browser only available in Electron mode'
      }

      const result = await fileService.listDirectory(targetItem.path)
      if (result.success && result.data) {
        const items: FileBrowserItem[] = result.data.map((f) => ({
          name: f.name,
          isDirectory: f.isDirectory,
          path: `${targetItem.path}/${f.name}`.replace(/\/\//g, '/'),
        }))

        const panel: FileBrowserPanel = {
          type: 'directory',
          path: targetItem.path,
          title: targetItem.name,
          items,
        }

        // Update ref immediately
        fileBrowserStackRef.current = [...currentStack, panel]
        setFileBrowserStack((prev) => [...prev, panel])
        return `Opened folder "${targetItem.name}" (item ${foundIndex + 1}) with ${items.length} items: ${items
          .slice(0, 5)
          .map((i, idx) => `${idx + 1}. ${i.name}${i.isDirectory ? '/' : ''}`)
          .join(', ')}${items.length > 5 ? '...' : ''}`
      }
      return 'Error: Could not open folder'
    },
    [isElectron, fileBrowserStackRef, fileBrowserVisibleRef, setFileBrowserStack]
  )

  // Open file by name or path
  const openFile = useCallback(
    async (name?: string, path?: string): Promise<string> => {
      console.log('[FileBrowser] Opening file:', name || path)

      if (!isElectron) {
        return 'Error: File browser only available in Electron mode'
      }

      // If path is provided, use it directly
      if (path) {
        const result = await fileService.readFile(path, { truncateAt: 50000 })
        if (result.success && result.data) {
          const fileName = path.split('/').pop() || path
          const ext = fileName.split('.').pop()?.toLowerCase()
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(
            ext || ''
          )

          // Use refs to get the latest state
          const currentStack = fileBrowserStackRef.current
          const isVisible = fileBrowserVisibleRef.current

          if (!isVisible) {
            // Need to show browser first with a directory panel
            const dirPath = path.substring(0, path.lastIndexOf('/')) || '.'
            const dirResult = await fileService.listDirectory(dirPath)
            if (dirResult.success && dirResult.data) {
              const items: FileBrowserItem[] = dirResult.data.map((f) => ({
                name: f.name,
                isDirectory: f.isDirectory,
                path: `${dirPath}/${f.name}`.replace(/\/\//g, '/'),
              }))

              const dirPanel: FileBrowserPanel = {
                type: 'directory',
                path: dirPath,
                title: dirPath.split('/').pop() || dirPath,
                items,
              }

              // Add both directory and file panels
              if (isImage) {
                const panel: FileBrowserPanel = {
                  type: 'image',
                  path: path,
                  title: fileName,
                }
                fileBrowserStackRef.current = [dirPanel, panel]
                setFileBrowserStack([dirPanel, panel])
              } else {
                const panel: FileBrowserPanel = {
                  type: 'file',
                  path: path,
                  title: fileName,
                  content: result.data,
                }
                fileBrowserStackRef.current = [dirPanel, panel]
                setFileBrowserStack([dirPanel, panel])
              }

              fileBrowserVisibleRef.current = true
              setFileBrowserVisible(true)
              return isImage
                ? `Showing image "${fileName}"`
                : `Opened file "${fileName}"`
            }
          } else {
            // Browser already visible, just add the file panel
            if (isImage) {
              const panel: FileBrowserPanel = {
                type: 'image',
                path: path,
                title: fileName,
              }
              fileBrowserStackRef.current = [...currentStack, panel]
              setFileBrowserStack((prev) => [...prev, panel])
              return `Showing image "${fileName}"`
            } else {
              const content =
                result.data.length > 50000
                  ? result.data.substring(0, 50000) + '\n... (truncated)'
                  : result.data

              const panel: FileBrowserPanel = {
                type: 'file',
                path: path,
                title: fileName,
                content,
              }
              fileBrowserStackRef.current = [...currentStack, panel]
              setFileBrowserStack((prev) => [...prev, panel])
              return `Opened file "${fileName}"`
            }
          }
        }
        return `Error: Could not read file at "${path}"`
      }

      // If name provided, search in current directory
      if (name) {
        const currentStack = fileBrowserStackRef.current
        const isVisible = fileBrowserVisibleRef.current

        // Get search path from current panel or base path
        let searchPath = fileBrowserBasePath || '.'
        if (isVisible && currentStack.length > 0) {
          const currentPanel = currentStack[currentStack.length - 1]
          if (currentPanel.type === 'directory') {
            searchPath = currentPanel.path
          }
        }

        // List directory and find file
        const result = await fileService.listDirectory(searchPath)
        if (result.success && result.data) {
          const lowerName = name.toLowerCase()
          // Find exact match first
          let found = result.data.find(
            (f) => !f.isDirectory && f.name.toLowerCase() === lowerName
          )
          // Then try partial match
          if (!found) {
            found = result.data.find(
              (f) => !f.isDirectory && f.name.toLowerCase().includes(lowerName)
            )
          }

          if (found) {
            const filePath = `${searchPath}/${found.name}`.replace(/\/\//g, '/')
            const fileResult = await fileService.readFile(filePath, { truncateAt: 50000 })
            if (fileResult.success && fileResult.data !== undefined) {
              const ext = found.name.split('.').pop()?.toLowerCase()
              const isImage = [
                'png',
                'jpg',
                'jpeg',
                'gif',
                'svg',
                'webp',
                'ico',
              ].includes(ext || '')

              if (!isVisible) {
                // Need to show browser with directory first
                const items: FileBrowserItem[] = result.data.map((f) => ({
                  name: f.name,
                  isDirectory: f.isDirectory,
                  path: `${searchPath}/${f.name}`.replace(/\/\//g, '/'),
                }))

                const dirPanel: FileBrowserPanel = {
                  type: 'directory',
                  path: searchPath,
                  title: searchPath.split('/').pop() || searchPath,
                  items,
                }

                if (isImage) {
                  const panel: FileBrowserPanel = {
                    type: 'image',
                    path: filePath,
                    title: found.name,
                  }
                  fileBrowserStackRef.current = [dirPanel, panel]
                  setFileBrowserStack([dirPanel, panel])
                } else {
                  const panel: FileBrowserPanel = {
                    type: 'file',
                    path: filePath,
                    title: found.name,
                    content: fileResult.data,
                  }
                  fileBrowserStackRef.current = [dirPanel, panel]
                  setFileBrowserStack([dirPanel, panel])
                }

                fileBrowserVisibleRef.current = true
                setFileBrowserVisible(true)
                return isImage
                  ? `Showing image "${found.name}"`
                  : `Opened file "${found.name}"`
              } else {
                // Browser already visible
                if (isImage) {
                  const panel: FileBrowserPanel = {
                    type: 'image',
                    path: filePath,
                    title: found.name,
                  }
                  fileBrowserStackRef.current = [...currentStack, panel]
                  setFileBrowserStack((prev) => [...prev, panel])
                  return `Showing image "${found.name}"`
                } else {
                  const content =
                    fileResult.data.length > 50000
                      ? fileResult.data.substring(0, 50000) + '\n... (truncated)'
                      : fileResult.data

                  const panel: FileBrowserPanel = {
                    type: 'file',
                    path: filePath,
                    title: found.name,
                    content,
                  }
                  fileBrowserStackRef.current = [...currentStack, panel]
                  setFileBrowserStack((prev) => [...prev, panel])
                  return `Opened file "${found.name}"`
                }
              }
            }
            return `Error: Could not read file "${found.name}"`
          }

          // File not found in current directory
          const files = result.data
            .filter((f) => !f.isDirectory)
            .map((f) => f.name)
            .slice(0, 10)
            .join(', ')
          return `Error: File "${name}" not found in ${searchPath}. Available files: ${files || 'none'}${result.data.filter((f) => !f.isDirectory).length > 10 ? '...' : ''}`
        }

        return 'Error: Could not search directory'
      }

      return 'Error: Please provide either a file name or path'
    },
    [
      isElectron,
      fileBrowserBasePath,
      fileBrowserStackRef,
      fileBrowserVisibleRef,
      setFileBrowserStack,
      setFileBrowserVisible,
    ]
  )

  return {
    showFileBrowser,
    openFileBrowserItem,
    fileBrowserBack,
    closeFileBrowser,
    openFolder,
    openFile,
  }
}
