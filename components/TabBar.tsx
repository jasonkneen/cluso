import React from 'react'
import { Plus, X, Sun, Moon, Settings } from 'lucide-react'

export interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab: () => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  onOpenSettings: () => void
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  isDarkMode,
  onToggleDarkMode,
  onOpenSettings
}: TabBarProps) {
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
        className="flex-1 flex items-center gap-0.5 h-full overflow-x-auto px-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {tabs.map((tab) => (
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
            {/* Favicon */}
            {tab.favicon ? (
              <img src={tab.favicon} alt="" className="w-4 h-4 flex-shrink-0" />
            ) : (
              <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                isDarkMode ? 'bg-neutral-600 text-neutral-300' : 'bg-stone-300 text-stone-600'
              }`}>
                {tab.title.charAt(0).toUpperCase()}
              </div>
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
        ))}

        {/* New Tab Button */}
        <button
          onClick={onNewTab}
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
      </div>

      {/* Right side - Dark Mode & Settings */}
      <div
        className="flex items-center gap-1 pr-3 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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
