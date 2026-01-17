/**
 * File Handlers Hook
 *
 * Centralizes file operation handlers extracted from App.tsx.
 * Handles file browser operations, file reading/writing, and edited files management.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/FileService'
import type { FileBrowserPanel, FileBrowserItem } from '../file-browser'
import type { EditedFile, DirectoryFile } from './useFileBrowserState'

/**
 * Selected file info for @ command
 */
export interface SelectedFileInfo {
  path: string
  content: string
  lineStart?: number
  lineEnd?: number
  elementType?: string
}

/**
 * Dependencies required by file handlers
 */
export interface UseFileHandlersDeps {
  // Electron
  isElectron: boolean

  // Project state
  activeTabProjectPath?: string

  // Tab state
  activeTabId: string

  // Editor state setters
  setEditorFilePath: (path: string) => void
  setEditorFileContent: (content: string) => void
  setHasUnsavedEdits: (hasUnsaved: boolean) => void
  setIsEditorMode: (isEditor: boolean) => void

  // File browser panel state
  fileBrowserBasePath: string
  setFileBrowserBasePath: (path: string) => void
  fileBrowserStackRef: React.MutableRefObject<FileBrowserPanel[]>
  fileBrowserVisibleRef: React.MutableRefObject<boolean>
  setFileBrowserStack: React.Dispatch<React.SetStateAction<FileBrowserPanel[]>>
  setFileBrowserVisible: React.Dispatch<React.SetStateAction<boolean>>

  // Directory state for @ command
  directoryStack: string[]
  setDirectoryStack: React.Dispatch<React.SetStateAction<string[]>>
  currentDirectory: string
  setDirectoryFiles: React.Dispatch<React.SetStateAction<DirectoryFile[]>>
  setCurrentDirectory: (dir: string) => void
  setFileSearchQuery: (query: string) => void
  setAutocompleteIndex: (idx: number) => void
  setShowFileAutocomplete: (show: boolean) => void

  // Selected files for @ command
  selectedFiles: SelectedFileInfo[]
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFileInfo[]>>
  setInput: React.Dispatch<React.SetStateAction<string>>

  // Edited files state
  editedFiles: EditedFile[]
  setEditedFiles: React.Dispatch<React.SetStateAction<EditedFile[]>>
  setIsEditedFilesDrawerOpen: (open: boolean) => void

  // Webview refs for undo
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>
}

/**
 * Return type for useFileHandlers hook
 */
export interface UseFileHandlersReturn {
  // File tree handlers
  handleFileTreeSelect: (filePath: string) => Promise<void>

  // Read file tool handler
  handleReadFile: (filePath: string) => Promise<string>

  // File browser overlay handlers
  showFileBrowser: (path?: string) => Promise<string>
  openFileBrowserItem: (itemNumber: number) => Promise<string>
  fileBrowserBack: () => string
  closeFileBrowser: () => string
  openFolder: (name?: string, itemNumber?: number) => Promise<string>
  openFile: (name?: string, path?: string) => Promise<string>
  handleListFilesWithOverlay: (path?: string) => Promise<string>

  // Directory navigation for @ command
  loadDirectoryFiles: (dirPath?: string) => Promise<void>
  navigateToDirectory: (dirPath: string) => void
  navigateBack: () => void

  // @ command file selection
  handleFileSelect: (filePath: string) => Promise<void>

  // Display formatting
  formatFileDisplay: (file: SelectedFileInfo) => string

  // Edited files management
  addEditedFile: (file: {
    path: string
    additions?: number
    deletions?: number
    undoCode?: string
    originalContent?: string
    isFileModification?: boolean
  }) => void
  undoFileEdit: (path: string) => Promise<void>
  undoAllEdits: () => Promise<void>
  keepAllEdits: () => void
}

/**
 * Hook for file operation handlers
 *
 * Extracts and centralizes file operation handlers from App.tsx.
 * Handles file browser operations, file reading, and edited files management.
 */
export function useFileHandlers(deps: UseFileHandlersDeps): UseFileHandlersReturn {
  const {
    isElectron,
    activeTabProjectPath,
    activeTabId,
    setEditorFilePath,
    setEditorFileContent,
    setHasUnsavedEdits,
    setIsEditorMode,
    fileBrowserBasePath,
    setFileBrowserBasePath,
    fileBrowserStackRef,
    fileBrowserVisibleRef,
    setFileBrowserStack,
    setFileBrowserVisible,
    directoryStack,
    setDirectoryStack,
    currentDirectory,
    setDirectoryFiles,
    setCurrentDirectory,
    setFileSearchQuery,
    setAutocompleteIndex,
    setShowFileAutocomplete,
    setSelectedFiles,
    setInput,
    editedFiles,
    setEditedFiles,
    setIsEditedFilesDrawerOpen,
    webviewRefs,
  } = deps

  // Helper to format file display: "LandingPage.tsx / Button (1426-31)"
  const formatFileDisplay = useCallback((file: SelectedFileInfo): string => {
    // Get clean filename (remove query params like ?t=...)
    const rawName = file.path.split('/').pop() || file.path
    const cleanName = rawName.split('?')[0]

    // Build display parts
    let display = cleanName

    // Add element type if available
    if (file.elementType) {
      display += ` / ${file.elementType}`
    }

    // Add line range if available (compact format: 1426-31 instead of 1426-1431)
    if (file.lineStart !== undefined) {
      if (file.lineEnd !== undefined && file.lineEnd !== file.lineStart) {
        // Compact line range: if same prefix, show shortened end
        const startStr = file.lineStart.toString()
        const endStr = file.lineEnd.toString()
        // Find common prefix length
        let commonLen = 0
        while (
          commonLen < startStr.length &&
          commonLen < endStr.length &&
          startStr[commonLen] === endStr[commonLen]
        ) {
          commonLen++
        }
        // Show shortened end if they share a prefix
        const shortEnd = commonLen > 0 ? endStr.slice(commonLen) : endStr
        display += ` (${startStr}-${shortEnd})`
      } else {
        display += ` (${file.lineStart})`
      }
    }

    return display
  }, [])

  // Handle file selection from file tree
  const handleFileTreeSelect = useCallback(
    async (filePath: string) => {
      console.log('[App] File selected from tree:', filePath)
      setEditorFilePath(filePath)
      setHasUnsavedEdits(false)

      // Load file content
      try {
        let result = await window.electronAPI.files.readFile(filePath)

        // If file not found, try searching for it by filename
        if (!result.success && result.error?.includes('ENOENT') && activeTabProjectPath) {
          const filename = filePath.split('/').pop()
          console.log('[App] File not found at', filePath, '- searching for:', filename)

          const searchResult = await window.electronAPI.files.findFiles(
            activeTabProjectPath,
            filename!
          )
          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            const foundPath = searchResult.data[0]
            console.log('[App] Found file at:', foundPath)
            setEditorFilePath(foundPath)
            result = await window.electronAPI.files.readFile(foundPath)
          }
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to read file')
        }
        const content = result.data || ''
        console.log('[App] File loaded:', content.length, 'bytes')
        setEditorFileContent(content)
        setIsEditorMode(true) // Switch center pane to editor
      } catch (error) {
        console.error('[App] Failed to load file:', error)
        setEditorFileContent(
          `// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        setIsEditorMode(true)
      }
    },
    [
      activeTabProjectPath,
      setEditorFilePath,
      setHasUnsavedEdits,
      setEditorFileContent,
      setIsEditorMode,
    ]
  )

  // Handle read_file tool - read a file's contents
  const handleReadFile = useCallback(async (filePath: string): Promise<string> => {
    console.log('[AI] Reading file:', filePath)
    try {
      const result = await fileService.readFile(filePath, { truncateAt: 10000 })
      if (result.success && result.data) return result.data
      return 'Error: ' + (result.error || 'Could not read file')
    } catch (err) {
      return 'Error: ' + (err as Error).message
    }
  }, [])

  // File Browser Overlay: Show browser
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

          // Update refs immediately (before React re-renders) so subsequent tool calls see the update
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
      fileBrowserStackRef,
      fileBrowserVisibleRef,
      setFileBrowserStack,
      setFileBrowserVisible,
    ]
  )

  // File Browser Overlay: Open item by number
  const openFileBrowserItem = useCallback(
    async (itemNumber: number): Promise<string> => {
      console.log('[FileBrowser] Opening item:', itemNumber)
      console.log(
        '[FileBrowser] State check - visible:',
        fileBrowserVisibleRef.current,
        'stack length:',
        fileBrowserStackRef.current.length
      )

      // Use refs to get the latest state (avoids stale closure in Gemini session)
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
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')

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
    [isElectron, fileBrowserStackRef, fileBrowserVisibleRef, setFileBrowserStack]
  )

  // File Browser Overlay: Go back
  const fileBrowserBack = useCallback((): string => {
    // Use refs to get the latest state (avoids stale closure in Gemini session)
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
  }, [fileBrowserStackRef, fileBrowserVisibleRef, setFileBrowserVisible, setFileBrowserStack])

  // File Browser Overlay: Close
  const closeFileBrowser = useCallback((): string => {
    // Update refs immediately
    fileBrowserVisibleRef.current = false
    fileBrowserStackRef.current = []
    setFileBrowserVisible(false)
    setFileBrowserStack([])
    return 'Closed file browser'
  }, [fileBrowserStackRef, fileBrowserVisibleRef, setFileBrowserVisible, setFileBrowserStack])

  // File Browser Overlay: Open folder by name or number
  const openFolder = useCallback(
    async (name?: string, itemNumber?: number): Promise<string> => {
      console.log('[FileBrowser] Opening folder:', name || `#${itemNumber}`)
      console.log(
        '[FileBrowser] State check - visible:',
        fileBrowserVisibleRef.current,
        'stack length:',
        fileBrowserStackRef.current.length
      )

      // Use refs to get the latest state (avoids stale closure in Gemini session)
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

  // File Browser Overlay: Open file by name or path
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
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')

          if (isImage) {
            const panel: FileBrowserPanel = {
              type: 'image',
              path: path,
              title: fileName,
            }
            fileBrowserStackRef.current = [panel]
            fileBrowserVisibleRef.current = true
            setFileBrowserStack([panel])
            setFileBrowserVisible(true)
            return `Showing image "${fileName}"`
          } else {
            const panel: FileBrowserPanel = {
              type: 'file',
              path: path,
              title: fileName,
              content: result.data,
            }
            fileBrowserStackRef.current = [panel]
            fileBrowserVisibleRef.current = true
            setFileBrowserStack([panel])
            setFileBrowserVisible(true)
            return `Opened file "${fileName}"`
          }
        }
        return `Error: ${result.error || `Could not read file at ${path}`}`
      }

      // Search by name
      if (!name) {
        return 'Error: Please provide either a file name or path'
      }

      // First check the current file browser directory
      const currentStack = fileBrowserStackRef.current
      let searchPath = fileBrowserBasePath || '.'

      if (currentStack.length > 0 && currentStack[currentStack.length - 1].type === 'directory') {
        searchPath = currentStack[currentStack.length - 1].path
      }

      // List directory and search for file
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

          if (fileResult.success && fileResult.data) {
            const ext = found.name.split('.').pop()?.toLowerCase()
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')

            // If browser not visible, show it first with the directory
            if (!fileBrowserVisibleRef.current) {
              const dirItems: FileBrowserItem[] = result.data.map((f) => ({
                name: f.name,
                isDirectory: f.isDirectory,
                path: `${searchPath}/${f.name}`.replace(/\/\//g, '/'),
              }))

              const dirPanel: FileBrowserPanel = {
                type: 'directory',
                path: searchPath,
                title: searchPath.split('/').pop() || searchPath,
                items: dirItems,
              }

              if (isImage) {
                const filePanel: FileBrowserPanel = {
                  type: 'image',
                  path: filePath,
                  title: found.name,
                }
                fileBrowserStackRef.current = [dirPanel, filePanel]
                fileBrowserVisibleRef.current = true
                setFileBrowserStack([dirPanel, filePanel])
                setFileBrowserVisible(true)
                return `Showing image "${found.name}"`
              } else {
                const filePanel: FileBrowserPanel = {
                  type: 'file',
                  path: filePath,
                  title: found.name,
                  content: fileResult.data,
                }
                fileBrowserStackRef.current = [dirPanel, filePanel]
                fileBrowserVisibleRef.current = true
                setFileBrowserStack([dirPanel, filePanel])
                setFileBrowserVisible(true)
                return `Opened file "${found.name}"`
              }
            } else {
              // Browser already visible, just add the file panel
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

  // Update handleListFiles to show overlay
  const handleListFilesWithOverlay = useCallback(
    async (path?: string): Promise<string> => {
      return showFileBrowser(path)
    },
    [showFileBrowser]
  )

  // Load directory listing for @ command
  const loadDirectoryFiles = useCallback(
    async (dirPath?: string) => {
      if (!isElectron) return
      console.log('[@ Files] Loading directory:', dirPath || '(default)')
      const result = await fileService.listDirectory(dirPath)
      if (result.success && result.data) {
        console.log('[@ Files] Loaded', result.data.length, 'files from:', dirPath || '(default)')
        setDirectoryFiles(result.data)
        if (dirPath) {
          setCurrentDirectory(dirPath)
        }
      }
    },
    [isElectron, setDirectoryFiles, setCurrentDirectory]
  )

  // Navigate into a subdirectory
  const navigateToDirectory = useCallback(
    (dirPath: string) => {
      setDirectoryStack((prev) => [...prev, currentDirectory])
      loadDirectoryFiles(dirPath)
      setFileSearchQuery('')
      setAutocompleteIndex(0)
    },
    [
      currentDirectory,
      loadDirectoryFiles,
      setDirectoryStack,
      setFileSearchQuery,
      setAutocompleteIndex,
    ]
  )

  // Navigate back to parent directory - use project path as root
  const navigateBack = useCallback(() => {
    const newStack = [...directoryStack]
    const parentDir = newStack.pop()
    setDirectoryStack(newStack)
    // If no parent in stack, go back to project root (or system root if no project)
    loadDirectoryFiles(parentDir || activeTabProjectPath || undefined)
    setFileSearchQuery('')
    setAutocompleteIndex(0)
  }, [
    directoryStack,
    loadDirectoryFiles,
    activeTabProjectPath,
    setDirectoryStack,
    setFileSearchQuery,
    setAutocompleteIndex,
  ])

  // Handle @ command - select a file from the list
  const handleFileSelect = useCallback(
    async (filePath: string) => {
      if (!isElectron) return

      const result = await fileService.selectFile(filePath)
      if (result.success && result.data) {
        const { path, content } = result.data

        // Parse line range from path if present: "file.tsx (1426-1431)" or "file.tsx?t=123 (1426-1431)"
        let lineStart: number | undefined
        let lineEnd: number | undefined
        let elementType: string | undefined

        const lineMatch = path.match(/\((\d+)-(\d+)\)$/)
        if (lineMatch) {
          lineStart = parseInt(lineMatch[1], 10)
          lineEnd = parseInt(lineMatch[2], 10)
        } else {
          // Try single line format: "(1426)"
          const singleLineMatch = path.match(/\((\d+)\)$/)
          if (singleLineMatch) {
            lineStart = parseInt(singleLineMatch[1], 10)
          }
        }

        // Try to detect element type from content (look for function/component names near start)
        if (content && lineStart) {
          const lines = content.split('\n')
          const startLine = lines[0] || ''
          // Look for common patterns: function X, const X, export function X, etc.
          const funcMatch = startLine.match(
            /(?:function|const|export\s+(?:default\s+)?(?:function|const)?)\s+(\w+)/
          )
          if (funcMatch) {
            elementType = funcMatch[1]
          }
        }

        setSelectedFiles((prev) => [...prev, { path, content, lineStart, lineEnd, elementType }])

        // Replace the @query with the file reference in the input
        // Find the last @ and replace from there to the end (or to the next space)
        setInput((prevInput) => {
          const lastAtIndex = prevInput.lastIndexOf('@')
          if (lastAtIndex === -1) return '' // Fallback: clear input

          // Get everything before the @
          const beforeAt = prevInput.substring(0, lastAtIndex)

          // Create a short display name for the file reference
          const fileName = path.split('/').pop() || path

          // Return the text before @ + a reference marker (file is now in selectedFiles)
          // Add a space after so user can continue typing
          return `${beforeAt}[${fileName}] `
        })

        setShowFileAutocomplete(false)
        setFileSearchQuery('')
        setAutocompleteIndex(0)
      }
    },
    [
      isElectron,
      setSelectedFiles,
      setInput,
      setShowFileAutocomplete,
      setFileSearchQuery,
      setAutocompleteIndex,
    ]
  )

  // Edited files management
  const addEditedFile = useCallback(
    (file: {
      path: string
      additions?: number
      deletions?: number
      undoCode?: string
      originalContent?: string
      isFileModification?: boolean
    }) => {
      // Extract filename without query strings (e.g., "?t=123456")
      const rawFileName = file.path.split('/').pop() || file.path
      const fileName = rawFileName.split('?')[0]
      setEditedFiles((prev) => {
        // Check if file already exists, update it
        const existing = prev.findIndex((f) => f.path === file.path)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = {
            ...updated[existing],
            additions: updated[existing].additions + (file.additions || 0),
            deletions: updated[existing].deletions + (file.deletions || 0),
            undoCode: file.undoCode || updated[existing].undoCode,
            // Keep original content from first modification for undo
            originalContent: updated[existing].originalContent || file.originalContent,
            isFileModification: file.isFileModification || updated[existing].isFileModification,
            timestamp: new Date(),
          }
          return updated
        }
        return [
          ...prev,
          {
            path: file.path,
            fileName,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            undoCode: file.undoCode,
            originalContent: file.originalContent,
            isFileModification: file.isFileModification,
            timestamp: new Date(),
          },
        ]
      })
    },
    [setEditedFiles]
  )

  const undoFileEdit = useCallback(
    async (path: string) => {
      const file = editedFiles.find((f) => f.path === path)
      if (!file) return

      // Handle file-based undo (restore original content)
      if (file.isFileModification && file.originalContent !== undefined) {
        console.log('[Undo] Restoring file:', path)
        const result = await fileService.writeFile(path, file.originalContent)
        if (result.success) {
          console.log('[Undo] File restored successfully')
          setEditedFiles((prev) => prev.filter((f) => f.path !== path))
        } else {
          console.error('[Undo] Failed to restore file:', result.error)
        }
        return
      }

      // Handle DOM-based undo (execute JavaScript in webview)
      if (file.undoCode) {
        const webview = webviewRefs.current.get(activeTabId)
        if (webview) {
          webview
            .executeJavaScript(file.undoCode)
            .then(() => {
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            })
            .catch((err: Error) => console.error('[Undo] Error:', err))
        }
      } else if (file.isFileModification) {
        // File was modified but we don't have originalContent - use git to restore
        console.log('[Undo] Using git checkoutFile to restore:', path)
        const { api: electronAPI } = await import('../../hooks/useElectronAPI').then((m) =>
          m.getElectronAPI()
        )
        if (electronAPI?.git?.checkoutFile) {
          try {
            const result = await electronAPI.git.checkoutFile(path)
            if (result.success) {
              console.log('[Undo] File restored via git checkoutFile')
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            } else {
              console.error('[Undo] Git checkoutFile failed:', result.error)
              // Still remove from list - user will need to manually revert
              setEditedFiles((prev) => prev.filter((f) => f.path !== path))
            }
          } catch (err) {
            console.error('[Undo] Git checkoutFile error:', err)
            setEditedFiles((prev) => prev.filter((f) => f.path !== path))
          }
        } else {
          console.warn('[Undo] Git checkoutFile not available, cannot restore file')
          setEditedFiles((prev) => prev.filter((f) => f.path !== path))
        }
      } else {
        // No undo mechanism, just remove from list
        setEditedFiles((prev) => prev.filter((f) => f.path !== path))
      }
    },
    [editedFiles, activeTabId, setEditedFiles, webviewRefs]
  )

  const undoAllEdits = useCallback(async () => {
    const webview = webviewRefs.current.get(activeTabId)
    const { api: electronAPI } = await import('../../hooks/useElectronAPI').then((m) =>
      m.getElectronAPI()
    )

    // Undo in reverse order
    const filesToUndo = [...editedFiles].reverse()

    for (const file of filesToUndo) {
      // Handle file-based undo with original content
      if (file.isFileModification && file.originalContent !== undefined) {
        await fileService.writeFile(file.path, file.originalContent).catch((err) => {
          console.warn(`[Undo] Failed to restore file ${file.path}:`, err)
        })
      } else if (file.isFileModification) {
        // No original content - use git to restore
        if (electronAPI?.git?.checkoutFile) {
          await electronAPI.git.checkoutFile(file.path).catch((err) => {
            console.warn(`[Undo] Failed to git checkout ${file.path}:`, err)
          })
        }
      } else if (file.undoCode && webview) {
        // Handle DOM-based undo
        await webview.executeJavaScript(file.undoCode).catch((err) => {
          console.warn(`[Undo] Failed to execute undo script for ${file.path}:`, err)
        })
      }
    }

    setEditedFiles([])
    setIsEditedFilesDrawerOpen(false)
  }, [editedFiles, activeTabId, setEditedFiles, setIsEditedFilesDrawerOpen, webviewRefs])

  const keepAllEdits = useCallback(() => {
    setEditedFiles([])
    setIsEditedFilesDrawerOpen(false)
  }, [setEditedFiles, setIsEditedFilesDrawerOpen])

  return {
    // File tree handlers
    handleFileTreeSelect,

    // Read file tool handler
    handleReadFile,

    // File browser overlay handlers
    showFileBrowser,
    openFileBrowserItem,
    fileBrowserBack,
    closeFileBrowser,
    openFolder,
    openFile,
    handleListFilesWithOverlay,

    // Directory navigation for @ command
    loadDirectoryFiles,
    navigateToDirectory,
    navigateBack,

    // @ command file selection
    handleFileSelect,

    // Display formatting
    formatFileDisplay,

    // Edited files management
    addEditedFile,
    undoFileEdit,
    undoAllEdits,
    keepAllEdits,
  }
}
