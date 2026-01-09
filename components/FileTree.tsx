import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react'

// Utility for class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileTreeProps {
  rootPath?: string
  selectedPath?: string | null
  onSelectFile?: (path: string) => void
  isDarkMode?: boolean
}

interface TreeItemProps {
  node: FileNode
  level: number
  onSelect: (path: string) => void
  selectedPath: string | null
  isDarkMode: boolean
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
}

const TreeItem = ({
  node,
  level,
  onSelect,
  selectedPath,
  isDarkMode,
  expandedPaths,
  onToggleExpand
}: TreeItemProps) => {
  const isDirectory = node.type === 'directory'
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedPath === node.path
  const isExpanded = expandedPaths.has(node.path)

  const handleClick = () => {
    if (isDirectory) {
      onToggleExpand(node.path)
    } else {
      onSelect(node.path)
    }
  }

  return (
    <>
      <div
        data-path={node.path}
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer text-sm rounded transition-colors',
          isSelected
            ? isDarkMode
              ? 'bg-blue-500/30 text-blue-200'
              : 'bg-blue-100 text-blue-900'
            : isDarkMode
              ? 'hover:bg-white/5 text-neutral-300'
              : 'hover:bg-black/5 text-stone-700'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <div className="flex items-center justify-center w-4 h-4 flex-shrink-0 opacity-60">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center',
            isDarkMode ? 'text-neutral-400' : 'text-stone-500'
          )}>
            {isDirectory ? (
              isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
            ) : (
              <File className="w-4 h-4" />
            )}
          </div>
          <span className="truncate">{node.name}</span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              isDarkMode={isDarkMode}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </>
  )
}

export const FileTree = ({
  rootPath,
  selectedPath,
  onSelectFile,
  isDarkMode = false
}: FileTreeProps) => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (rootPath) {
      loadFileTree(rootPath)
    }
  }, [rootPath])

  const loadFileTree = async (path: string) => {
    setLoading(true)
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.files?.getTree) {
        console.error('[FileTree] File tree API not available')
        return
      }

      console.log('[FileTree] Loading tree for path:', path)

      // Load actual file tree from Electron
      const result = await electronAPI.files.getTree(path, {
        ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '.cache']
      })

      console.log('[FileTree] getTree result:', result)
      console.log('[FileTree] getTree result.data[0]:', result.data?.[0])
      console.log('[FileTree] getTree result.data.length:', result.data?.length)

      if (!result.success) {
        console.error('[FileTree] getTree failed:', result.error)
        throw new Error(result.error || 'Failed to load file tree')
      }

      // Check if data exists (API returns data array, not tree object)
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        console.error('[FileTree] No data in result:', result)
        throw new Error('No tree data returned from API')
      }

      // Convert the tree format to our FileNode format
      const convertNode = (node: any): FileNode | null => {
        if (!node || !node.name || !node.path) {
          console.warn('[FileTree] Skipping invalid node:', node)
          return null
        }
        return {
          name: node.name,
          path: node.path,
          type: node.type,
          children: node.children?.map(convertNode).filter((n: FileNode | null) => n !== null) as FileNode[]
        }
      }

      // result.data is an array, use first element as root
      const tree = convertNode(result.data[0])
      if (!tree) {
        throw new Error('Failed to convert tree structure')
      }
      console.log('[FileTree] Tree loaded successfully:', tree.name, 'children:', tree.children?.length)
      console.log('[FileTree] Tree children:', tree.children)
      setFileTree(tree)
      // Auto-expand root using the actual tree path
      setExpandedPaths(new Set([tree.path])) // Use tree.path not the input path
    } catch (error) {
      console.error('[FileTree] Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (path: string) => {
    onSelectFile?.(path)
  }

  const handleToggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center h-32 text-sm',
        isDarkMode ? 'text-neutral-500' : 'text-stone-400'
      )}>
        Loading files...
      </div>
    )
  }

  if (!fileTree || !rootPath) {
    return (
      <div className={cn(
        'flex items-center justify-center h-32 text-sm',
        isDarkMode ? 'text-neutral-500' : 'text-stone-400'
      )}>
        No project connected
      </div>
    )
  }

  return (
    <div className="py-1">
      <TreeItem
        node={fileTree}
        level={0}
        onSelect={handleSelect}
        selectedPath={selectedPath ?? null}
        isDarkMode={isDarkMode}
        expandedPaths={expandedPaths}
        onToggleExpand={handleToggleExpand}
      />
    </div>
  )
}

export default FileTree
