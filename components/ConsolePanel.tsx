import React, { useRef, useEffect } from 'react'
import { Terminal, X, Copy, Search, Check, Ghost } from 'lucide-react'
import { XTerm } from '@nicholasyan/xterm-react'

export interface ConsoleLog {
  type: 'log' | 'warn' | 'error' | 'info'
  message: string
  timestamp: Date
}

interface ConsolePanelProps {
  isDarkMode: boolean
  consoleLogs: ConsoleLog[]
  filteredConsoleLogs: ConsoleLog[]
  consoleFilters: Set<string>
  consolePanelTab: 'console' | 'terminal'
  selectedLogIndices: Set<number>
  selectedLogs: ConsoleLog[] | null
  consoleHeight: number
  isConsoleResizing: boolean
  terminalContainerRef: React.RefObject<HTMLDivElement>
  onClose: () => void
  onClearConsole: () => void
  onToggleFilter: (filter: string) => void
  onSetConsolePanelTab: (tab: 'console' | 'terminal') => void
  onLogRowClick: (index: number, e: React.MouseEvent) => void
  onSetSelectedLogIndices: (indices: Set<number>) => void
  onResizeStart: (e: React.MouseEvent) => void
  onSearchSolutions: (logsText: string) => void
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  isDarkMode,
  consoleLogs,
  filteredConsoleLogs,
  consoleFilters,
  consolePanelTab,
  selectedLogIndices,
  selectedLogs,
  consoleHeight,
  isConsoleResizing,
  terminalContainerRef,
  onClose,
  onClearConsole,
  onToggleFilter,
  onSetConsolePanelTab,
  onLogRowClick,
  onSetSelectedLogIndices,
  onResizeStart,
  onSearchSolutions
}) => {
  const consoleEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredConsoleLogs])

  return (
    <div className={`flex flex-col overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} style={{ height: consoleHeight }}>
      {/* Resize Handle */}
      <div
        className={`h-2 cursor-ns-resize flex-shrink-0 flex items-center justify-center group ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`}
        onMouseDown={onResizeStart}
      >
        <div className={`w-8 h-0.5 rounded-full transition-colors ${isConsoleResizing ? (isDarkMode ? 'bg-neutral-400' : 'bg-stone-500') : (isDarkMode ? 'bg-neutral-600 group-hover:bg-neutral-500' : 'bg-stone-300 group-hover:bg-stone-400')}`} />
      </div>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
        {/* Left side: Tab buttons */}
        <div className="flex items-center gap-1.5" style={{ position: 'relative', top: '-3px' }}>
          {/* Console tab */}
          <button
            onClick={() => onSetConsolePanelTab('console')}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors ${
              consolePanelTab === 'console'
                ? (isDarkMode ? 'bg-neutral-600 text-neutral-200' : 'bg-stone-300 text-stone-700')
                : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
            }`}
            title="Console logs"
          >
            <Terminal size={14} />
            <span className="text-xs font-medium">Console</span>
            <span className="text-xs opacity-70">{filteredConsoleLogs.length}</span>
          </button>

          {/* Terminal tab */}
          <button
            onClick={() => onSetConsolePanelTab('terminal')}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors ${
              consolePanelTab === 'terminal'
                ? (isDarkMode ? 'bg-neutral-600 text-neutral-200' : 'bg-stone-300 text-stone-700')
                : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
            }`}
            title="Terminal"
          >
            <Ghost size={14} />
            <span className="text-xs font-medium">Terminal</span>
          </button>
        </div>

        {/* Right side: Filter chips (only for console) + actions */}
        <div className="flex items-center gap-1">
          {/* Filter chips - only show when console tab is active */}
          {consolePanelTab === 'console' && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => onToggleFilter('log')}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  consoleFilters.has('log')
                    ? (isDarkMode ? 'bg-neutral-500 text-white' : 'bg-stone-500 text-white')
                    : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
                }`}
                title="Filter by log"
              >
                log
              </button>
              <button
                onClick={() => onToggleFilter('info')}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  consoleFilters.has('info')
                    ? 'bg-blue-500 text-white'
                    : (isDarkMode ? 'bg-neutral-800 text-blue-400 hover:bg-neutral-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                }`}
                title="Filter by info"
              >
                info
              </button>
              <button
                onClick={() => onToggleFilter('warn')}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  consoleFilters.has('warn')
                    ? 'bg-yellow-500 text-white'
                    : (isDarkMode ? 'bg-neutral-800 text-yellow-400 hover:bg-neutral-700' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100')
                }`}
                title="Filter by warn"
              >
                warn
              </button>
              <button
                onClick={() => onToggleFilter('error')}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  consoleFilters.has('error')
                    ? 'bg-red-500 text-white'
                    : (isDarkMode ? 'bg-neutral-800 text-red-400 hover:bg-neutral-700' : 'bg-red-50 text-red-600 hover:bg-red-100')
                }`}
                title="Filter by error"
              >
                error
              </button>
            </div>
          )}

          {/* Selection actions - only for console */}
          {consolePanelTab === 'console' && selectedLogIndices.size > 0 && (
            <>
              <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                {selectedLogIndices.size} selected
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => {
                    const logsText = selectedLogs?.map(l => l.message).join('\n') || ''
                    onSearchSolutions(logsText)
                  }}
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                  title="Search for solutions (Cmd+G)"
                >
                  <Search size={14} />
                </button>
                <button
                  onClick={() => {
                    const logsText = selectedLogs?.map(l => `[${l.type}] ${l.message}`).join('\n') || ''
                    navigator.clipboard.writeText(logsText)
                  }}
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                  title="Copy (Cmd+C)"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => onSetSelectedLogIndices(new Set())}
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                  title="Clear selection (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}

          {/* Clear console button - only for console tab */}
          {consolePanelTab === 'console' && (
            <button
              onClick={onClearConsole}
              className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
              title="Clear console"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
            </button>
          )}

          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
            title="Close console"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {/* Content area - switches between console and terminal */}
      {consolePanelTab === 'console' ? (
        <div className={`flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5 ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
          {filteredConsoleLogs.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              {consoleLogs.length === 0 ? 'No console messages yet' : 'No logs match current filters'}
            </div>
          ) : (
            filteredConsoleLogs.map((log, index) => (
              <div
                key={index}
                onClick={(e) => onLogRowClick(index, e)}
                className={`flex items-start gap-2 px-2 py-0.5 rounded cursor-pointer select-none transition-colors ${
                  selectedLogIndices.has(index)
                    ? (isDarkMode ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : 'bg-blue-100 ring-1 ring-blue-300')
                    : log.type === 'error' ? (isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100')
                    : log.type === 'warn' ? (isDarkMode ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100')
                    : log.type === 'info' ? (isDarkMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                    : (isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-100')
                }`}
                title="Click to select, Shift+click for range"
              >
                <span className={`flex-shrink-0 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="flex-shrink-0 w-12 text-center">
                  [{log.type}]
                </span>
                <span className="break-all flex-1">{log.message}</span>
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selectedLogIndices.has(index)
                      ? (isDarkMode ? 'bg-blue-500 border-blue-500' : 'bg-blue-500 border-blue-500')
                      : (isDarkMode ? 'border-neutral-500 hover:border-neutral-400' : 'border-stone-300 hover:border-stone-400')
                  }`}
                >
                  {selectedLogIndices.has(index) && (
                    <Check size={10} className="text-white" />
                  )}
                </span>
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      ) : (
        /* Terminal view */
        <div
          ref={terminalContainerRef}
          className={`flex-1 overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-stone-50'}`}
          style={{ minHeight: 100 }}
        />
      )}
    </div>
  )
}
