import React, { useState, useRef, useEffect, memo } from 'react'
import { Plus, X, Sun, Moon, Settings, Globe, LayoutGrid, CheckSquare, FileText, Columns3, Zap, FolderOpen, Eye, Plug2 } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export type TabType = 'browser' | 'kanban' | 'todos' | 'notes'

export interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  type: TabType
  isProject?: boolean // True if this tab is linked to a project folder
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab: (type?: TabType) => void
  onReorderTabs?: (tabs: Tab[]) => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  onOpenSettings: () => void
  fastApplyReady?: boolean
  fastApplyLoading?: boolean
  fileWatcherActive?: boolean
  extensionConnected?: boolean
  indexingStatus?: 'idle' | 'indexing' | 'indexed'
}

const TAB_TYPES = [
  { type: 'browser' as TabType, label: 'Browser', icon: Globe, description: 'Web browser' },
  { type: 'kanban' as TabType, label: 'Kanban', icon: Columns3, description: 'Project board' },
  { type: 'todos' as TabType, label: 'Todos', icon: CheckSquare, description: 'Task list' },
  { type: 'notes' as TabType, label: 'Notes', icon: FileText, description: 'Rich text notes' },
]

function getTabIcon(type: TabType) {
  switch (type) {
    case 'browser': return Globe
    case 'kanban': return Columns3
    case 'todos': return CheckSquare
    case 'notes': return FileText
    default: return Globe
  }
}

interface TabItemProps {
  tab: Tab
  isActive: boolean
  isDragging: boolean
  isDragOver: boolean
  isDarkMode: boolean
  tabCount: number
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onDragStart: (e: React.DragEvent, tabId: string) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent, tabId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, tabId: string) => void
  draggable: boolean
}

const TabItem = memo(function TabItem({
  tab,
  isActive,
  isDragging,
  isDragOver,
  isDarkMode,
  tabCount,
  onSelect,
  onClose,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  draggable
}: TabItemProps) {
  const TabIcon = getTabIcon(tab.type || 'browser')

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, tab.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, tab.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, tab.id)}
      onClick={() => onSelect(tab.id)}
      className={`
        group relative flex items-center gap-2 h-8 px-3 rounded-lg cursor-pointer
        transition-all duration-150 min-w-[120px] max-w-[200px]
        ${isActive
          ? isDarkMode
            ? 'bg-neutral-700/80 text-white'
            : 'bg-white text-stone-900 shadow-sm'
          : isDarkMode
            ? 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-700'
        }
        ${isDragging ? 'opacity-50' : ''}
        ${isDragOver ? (isDarkMode ? 'ring-2 ring-violet-500' : 'ring-2 ring-violet-400') : ''}
      `}
      style={{ position: 'relative', top: '3px' }}
    >
      {/* Tab Type Icon or Favicon - Project tabs get folder icon */}
      {tab.isProject ? (
        <FolderOpen size={14} className="flex-shrink-0 text-amber-500" />
      ) : tab.type === 'browser' && tab.favicon ? (
        <img src={tab.favicon} alt="" className="w-4 h-4 flex-shrink-0" />
      ) : (
        <TabIcon size={14} className="flex-shrink-0" />
      )}

      {/* Title */}
      <span className="text-xs font-medium truncate flex-1">
        {tab.title}
      </span>

      {/* Close button */}
      {tabCount > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose(tab.id)
          }}
          className={`
            w-4 h-4 rounded flex items-center justify-center flex-shrink-0
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isDarkMode
              ? 'hover:bg-neutral-600 text-neutral-400 hover:text-white'
              : 'hover:bg-stone-300 text-stone-400 hover:text-stone-700'
            }
          `}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}, (prev, next) =>
  prev.tab.id === next.tab.id &&
  prev.tab.title === next.tab.title &&
  prev.tab.type === next.tab.type &&
  prev.tab.favicon === next.tab.favicon &&
  prev.tab.isProject === next.tab.isProject &&
  prev.isActive === next.isActive &&
  prev.isDragging === next.isDragging &&
  prev.isDragOver === next.isDragOver &&
  prev.isDarkMode === next.isDarkMode &&
  prev.tabCount === next.tabCount &&
  prev.draggable === next.draggable
)

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onReorderTabs,
  isDarkMode,
  onToggleDarkMode,
  onOpenSettings,
  fastApplyReady,
  fastApplyLoading,
  fileWatcherActive,
  extensionConnected,
  indexingStatus = 'idle'
}: TabBarProps) {
  const { currentTheme } = useTheme()
  const [showMenu, setShowMenu] = useState(false)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Theme colors - use custom theme if available, otherwise use dark/light mode defaults
  // CRITICAL: Light mode default background MUST be #d6d3d1 (stone-300) to match title bar
  const themeColors = currentTheme.colors
  const bgColor = themeColors?.background || (isDarkMode ? '#171717' : '#d6d3d1')
  const fgColor = themeColors?.foreground || (isDarkMode ? '#f5f5f5' : '#171717')
  const borderColor = themeColors?.border || (isDarkMode ? '#404040' : '#a8a29e')

  // Handle mouse enter on button
  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
    setShowMenu(true)
  }

  // Handle mouse leave - delay hiding
  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setShowMenu(false)
    }, 150)
  }

  // Handle menu mouse enter - cancel hide
  const handleMenuMouseEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) {
        clearTimeout(menuTimeoutRef.current)
      }
    }
  }, [])

  // Handle tab type selection
  const handleNewTab = (type: TabType) => {
    setShowMenu(false)
    onNewTab(type)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
    // Add a slight delay to show the drag state
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
    })
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (tabId !== draggedTabId) {
      setDragOverTabId(tabId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTabId(null)
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === targetTabId || !onReorderTabs) return

    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId)
    const targetIndex = tabs.findIndex(t => t.id === targetTabId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Create new array with reordered tabs
    const newTabs = [...tabs]
    const [draggedTab] = newTabs.splice(draggedIndex, 1)
    newTabs.splice(targetIndex, 0, draggedTab)

    onReorderTabs(newTabs)
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  return (
    <div
      className="h-11 flex items-center justify-between select-none"
      style={{ WebkitAppRegion: 'drag', backgroundColor: bgColor } as React.CSSProperties}
    >
      {/* Traffic light spacer - macOS window controls */}
      <div className="w-20 flex-shrink-0" />

      {/* Tabs container */}
      <div
        className="flex-1 flex items-center gap-0.5 h-full overflow-x-auto overflow-y-visible px-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isDragging={draggedTabId === tab.id}
            isDragOver={dragOverTabId === tab.id}
            isDarkMode={isDarkMode}
            tabCount={tabs.length}
            onSelect={onTabSelect}
            onClose={onTabClose}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!onReorderTabs}
          />
        ))}

        {/* New Tab Button */}
        <button
          onClick={() => onNewTab('browser')}
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
            transition-colors
            ${isDarkMode
              ? 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
              : 'text-stone-400 hover:bg-stone-200 hover:text-stone-600'
            }
          `}
          style={{ position: 'relative', top: '3px' }}
          title="New tab"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Right side - Fast Apply Status, Dark Mode & Settings */}
      <div
        className="flex items-center gap-1.5 pr-3 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Indexing Status Chip */}
        {(fileWatcherActive || indexingStatus !== 'idle') && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-md transition-all ${
              indexingStatus === 'indexing'
                ? isDarkMode
                  ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                  : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-300/50 shadow-sm'
                : isDarkMode
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-300/50 shadow-sm'
            }`}
            title={indexingStatus === 'indexing' ? "Indexing project files..." : "Project indexed and watching for changes"}
          >
            <Eye size={10} className={indexingStatus === 'indexing' 
              ? (isDarkMode ? 'text-blue-400 animate-pulse' : 'text-blue-600 animate-pulse') 
              : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')} />
            <span>{indexingStatus === 'indexing' ? 'Indexing' : 'Indexed'}</span>
          </div>
        )}

        {/* Fast Apply Status Chip */}
        {(fastApplyReady || fastApplyLoading) && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-md transition-all ${
              fastApplyLoading
                ? isDarkMode
                  ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                  : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-300/50 shadow-sm'
                : isDarkMode
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                  : 'bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-700 border border-yellow-300/50 shadow-sm'
            }`}
            title={fastApplyLoading ? "Fast Apply is loading..." : "Fast Apply is ready - local AI model loaded"}
          >
            <Zap size={10} className={fastApplyLoading ? (isDarkMode ? 'text-blue-400 animate-pulse' : 'text-blue-600 animate-pulse') : (isDarkMode ? 'text-yellow-400' : 'text-yellow-600')} />
            <span>{fastApplyLoading ? 'Loading...' : 'Fast Edit'}</span>
          </div>
        )}

        {/* Extension Connected Status Chip */}
        {extensionConnected && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-md transition-all ${
              isDarkMode
                ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                : 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-300/50 shadow-sm'
            }`}
            title="Chrome extension connected - browser inspector available"
          >
            <Plug2 size={10} className={isDarkMode ? 'text-violet-400' : 'text-violet-600'} />
            <span>Extension</span>
          </div>
        )}

        {/* Dark Mode Toggle - only show when using system-default theme */}
        {currentTheme.id === 'system-default' && (
          <button
            onClick={onToggleDarkMode}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-yellow-400'
                : 'hover:bg-stone-200 text-stone-500'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isDarkMode
              ? 'hover:bg-neutral-700 text-neutral-400'
              : 'hover:bg-stone-200 text-stone-500'
          }`}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  )
}
