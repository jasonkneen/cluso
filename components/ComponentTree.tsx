import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { ChevronDown, ChevronRight, Frame, FileText, Box, Type, MousePointer, Link2, FormInput, Image, List } from 'lucide-react'

// Utility function for class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export interface TreeNode {
  id: string
  name: string
  type: 'frame' | 'page' | 'component' | 'text' | 'group' | 'button' | 'link' | 'input' | 'image' | 'list'
  elementNumber?: number
  tagName?: string
  // Source mapping from data-cluso-id
  sourceFile?: string | null
  sourceLine?: number | null
  sourceColumn?: number | null
  children?: TreeNode[]
}

interface ComponentTreeProps {
  data?: TreeNode | null
  selectedId?: string | null
  onSelect?: (node: TreeNode) => void
  isDarkMode?: boolean
}

const getIcon = (type: string, tagName?: string) => {
  // First check tagName for more specific icons
  if (tagName) {
    const tag = tagName.toLowerCase()
    if (tag === 'button') return <MousePointer className="w-4 h-4" />
    if (tag === 'a') return <Link2 className="w-4 h-4" />
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return <FormInput className="w-4 h-4" />
    if (tag === 'img') return <Image className="w-4 h-4" />
    if (tag === 'ul' || tag === 'ol' || tag === 'li') return <List className="w-4 h-4" />
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'p' || tag === 'span') return <Type className="w-4 h-4" />
  }

  // Fall back to type-based icons
  switch (type) {
    case 'frame':
      return <Frame className="w-4 h-4" />
    case 'page':
      return <FileText className="w-4 h-4" />
    case 'component':
      return <Box className="w-4 h-4" />
    case 'text':
      return <Type className="w-4 h-4" />
    case 'button':
      return <MousePointer className="w-4 h-4" />
    case 'link':
      return <Link2 className="w-4 h-4" />
    case 'input':
      return <FormInput className="w-4 h-4" />
    case 'image':
      return <Image className="w-4 h-4" />
    case 'list':
      return <List className="w-4 h-4" />
    case 'group':
    default:
      return <Box className="w-4 h-4" />
  }
}

interface TreeItemProps {
  node: TreeNode
  level: number
  onSelect: (node: TreeNode) => void
  selectedId: string | null
  isDarkMode: boolean
  getIsExpanded: (id: string, level: number) => boolean
  onToggleExpand: (id: string) => void
}

const TreeItem = memo(function TreeItem({ node, level, onSelect, selectedId, isDarkMode, getIsExpanded, onToggleExpand }: TreeItemProps) {
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id
  const isExpanded = getIsExpanded(node.id, level)

  return (
    <>
      <div
        data-tree-node-id={node.id}
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
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
            className="flex items-center justify-center w-4 h-4 flex-shrink-0 opacity-60 hover:opacity-100"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center',
            isDarkMode ? 'text-neutral-400' : 'text-stone-500'
          )}>
            {getIcon(node.type, node.tagName)}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate">{node.name}</span>
            {node.sourceFile && node.sourceLine && (
              <span className={cn(
                'text-[10px] truncate',
                isDarkMode ? 'text-neutral-500' : 'text-stone-400'
              )}>
                {node.sourceFile}:{node.sourceLine}
              </span>
            )}
          </div>
          {node.elementNumber && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
              isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'
            )}>
              #{node.elementNumber}
            </span>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              isDarkMode={isDarkMode}
              getIsExpanded={getIsExpanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </>
  )
}, (prev, next) =>
  prev.node.id === next.node.id &&
  prev.node.name === next.node.name &&
  prev.level === next.level &&
  prev.selectedId === next.selectedId &&
  prev.isDarkMode === next.isDarkMode
)

export const ComponentTree = ({ data, selectedId, onSelect, isDarkMode = false }: ComponentTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const seededRootIdRef = useRef<string | null>(null)

  const autoExpandedIds = useMemo(() => {
    if (!data) return new Set<string>()
    const set = new Set<string>()
    const visit = (node: TreeNode, level: number) => {
      if (level < 2) set.add(node.id)
      if (node.children) node.children.forEach(child => visit(child, level + 1))
    }
    visit(data, 0)
    return set
  }, [data])

  const findPathToId = useMemo(() => {
    if (!data) return null
    const dfs = (node: TreeNode, targetId: string): string[] | null => {
      if (node.id === targetId) return [node.id]
      if (!node.children) return null
      for (const child of node.children) {
        const childPath = dfs(child, targetId)
        if (childPath) return [node.id, ...childPath]
      }
      return null
    }
    return (targetId: string) => dfs(data, targetId)
  }, [data])

  useEffect(() => {
    if (!data) return
    if (seededRootIdRef.current === data.id) return
    seededRootIdRef.current = data.id
    setExpandedIds(new Set(autoExpandedIds))
  }, [data, autoExpandedIds])

  useEffect(() => {
    if (!data) return
    if (!selectedId) return
    if (!findPathToId) return
    const path = findPathToId(selectedId)
    if (!path || path.length === 0) return

    // Expand all ancestors so the selected node becomes visible.
    setExpandedIds(prev => {
      const next = new Set(prev)
      // include root + all ancestors
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })

    // Scroll selected node into view (best-effort).
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-tree-node-id="${CSS.escape(selectedId)}"]`)
      if (el && 'scrollIntoView' in el) {
        try {
          ;(el as HTMLElement).scrollIntoView({ block: 'nearest' })
        } catch {
          // Best-effort scroll - OK to fail silently
        }
      }
    })
  }, [data, selectedId, findPathToId])

  const handleSelect = (node: TreeNode) => {
    onSelect?.(node)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isNodeExpanded = (node: TreeNode, level: number) => {
    if (expandedIds.has(node.id)) return true
    if (level < 2 && autoExpandedIds.has(node.id)) return true
    return false
  }

  if (!data) {
    return (
      <div className={cn(
        'flex items-center justify-center h-32 text-sm',
        isDarkMode ? 'text-neutral-500' : 'text-stone-400'
      )}>
        No elements found
      </div>
    )
  }

  return (
    <div className="py-1">
      <TreeItem
        node={data}
        level={0}
        onSelect={handleSelect}
        selectedId={selectedId ?? null}
        isDarkMode={isDarkMode}
        getIsExpanded={(id, level) => {
          if (expandedIds.has(id)) return true
          if (level < 2 && autoExpandedIds.has(id)) return true
          return false
        }}
        onToggleExpand={handleToggleExpand}
      />
    </div>
  )
}

export default ComponentTree
