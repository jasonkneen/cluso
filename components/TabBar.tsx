import React, { useState, useRef, useEffect } from 'react'
import { Plus, X, Sun, Moon, Settings, Globe, LayoutGrid, CheckSquare, FileText, Columns3, Zap, FolderOpen } from 'lucide-react'

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
  isDarkMode: boolean
  onToggleDarkMode: () => void
  onOpenSettings: () => void
  fastApplyReady?: boolean
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

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  isDarkMode,
  onToggleDarkMode,
  onOpenSettings,
  fastApplyReady
}: TabBarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      className={`h-11 flex items-center justify-between select-none ${
        isDarkMode
          ? 'bg-neutral-900'
          : 'bg-stone-300'
      }`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Traffic light spacer - macOS window controls */}
      <div className="w-20 flex-shrink-0" />

      {/* Tabs container */}
      <div
        className="flex-1 flex items-center gap-0.5 h-full overflow-x-auto overflow-y-visible px-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {tabs.map((tab) => {
          const TabIcon = getTabIcon(tab.type || 'browser')
          return (
            <div
              key={tab.id}
              onClick={() => onTabSelect(tab.id)}
              className={`
                group relative flex items-center gap-2 h-8 px-3 rounded-lg cursor-pointer
                transition-all duration-150 min-w-[120px] max-w-[200px]
                ${tab.id === activeTabId
                  ? isDarkMode
                    ? 'bg-neutral-700/80 text-white'
                    : 'bg-white text-stone-900 shadow-sm'
                  : isDarkMode
                    ? 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                    : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-700'
                }
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
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
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
        })}

        {/* New Tab Button with Hover Menu */}
        <div className="relative" style={{ top: '3px' }}>
          <button
            ref={buttonRef}
            onClick={() => onNewTab('browser')}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
              transition-colors
              ${isDarkMode
                ? 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                : 'text-stone-400 hover:bg-stone-200 hover:text-stone-600'
              }
            `}
            title="New tab"
          >
            <Plus size={16} />
          </button>

          {/* Popout Menu */}
          {showMenu && buttonRef.current && (
            <div
              ref={menuRef}
              onMouseEnter={handleMenuMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={`fixed py-1 rounded-lg shadow-xl border z-[9999] min-w-[160px] ${
                isDarkMode
                  ? 'bg-neutral-800 border-neutral-700'
                  : 'bg-white border-stone-200'
              }`}
              style={{
                top: buttonRef.current.getBoundingClientRect().bottom + 4,
                left: buttonRef.current.getBoundingClientRect().left,
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties}
            >
              {TAB_TYPES.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => handleNewTab(type)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    isDarkMode
                      ? 'hover:bg-neutral-700 text-neutral-200'
                      : 'hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <Icon size={16} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                      {description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Fast Apply Status, Dark Mode & Settings */}
      <div
        className="flex items-center gap-1.5 pr-3 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Fast Apply Status Chip */}
        {fastApplyReady && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-md transition-all ${
              isDarkMode
                ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                : 'bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-700 border border-yellow-300/50 shadow-sm'
            }`}
            title="Fast Apply is ready - local AI model loaded"
          >
            <Zap size={10} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} />
            <span>Fast</span>
          </div>
        )}

        {/* Dark Mode Toggle */}
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
