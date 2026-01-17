import React from 'react'
import {
  ChevronLeft, ChevronRight, RefreshCw, Loader2,
  Monitor, Tablet, Smartphone, LayoutGrid,
  MousePointer2, Terminal, Wrench, PanelRight,
  Layers, FileCode
} from 'lucide-react'

interface BrowserToolbarProps {
  isDarkMode: boolean
  panelBorder: string
  isLeftPanelOpen: boolean
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  viewportSize: 'desktop' | 'tablet' | 'mobile'
  isMultiViewportMode: boolean
  urlInput: string
  hasProjectPath: boolean
  projectPath?: string
  isInspectorActive: boolean
  isFloatingToolbarVisible: boolean
  isConsolePanelOpen: boolean
  selectedElementHasSource: boolean
  isSidebarOpen: boolean
  onToggleLeftPanel: () => void
  onGoBack: () => void
  onGoForward: () => void
  onReload: () => void
  onSetViewportSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  onToggleMultiViewport: () => void
  onSetUrlInput: (url: string) => void
  onUrlSubmit: (e: React.FormEvent) => void
  onToggleInspector: () => void
  onToggleFloatingToolbar: () => void
  onToggleConsolePanel: () => void
  onJumpToSource: () => void
  onToggleSidebar: () => void
}

export const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  isDarkMode,
  panelBorder,
  isLeftPanelOpen,
  canGoBack,
  canGoForward,
  isLoading,
  viewportSize,
  isMultiViewportMode,
  urlInput,
  hasProjectPath,
  projectPath,
  isInspectorActive,
  isFloatingToolbarVisible,
  isConsolePanelOpen,
  selectedElementHasSource,
  isSidebarOpen,
  onToggleLeftPanel,
  onGoBack,
  onGoForward,
  onReload,
  onSetViewportSize,
  onToggleMultiViewport,
  onSetUrlInput,
  onUrlSubmit,
  onToggleInspector,
  onToggleFloatingToolbar,
  onToggleConsolePanel,
  onJumpToSource,
  onToggleSidebar
}) => {
  return (
    <div
      className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0"
      style={{ borderColor: panelBorder }}
    >
      {/* Layers Toggle */}
      <button
        onClick={onToggleLeftPanel}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isLeftPanelOpen ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600')}`}
        title={isLeftPanelOpen ? 'Hide layers' : 'Show layers'}
      >
        <Layers size={16} />
      </button>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onGoBack}
          disabled={!canGoBack}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canGoBack ? (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600') : (isDarkMode ? 'text-neutral-600 cursor-not-allowed' : 'text-stone-300 cursor-not-allowed')}`}
          title="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={onGoForward}
          disabled={!canGoForward}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canGoForward ? (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600') : (isDarkMode ? 'text-neutral-600 cursor-not-allowed' : 'text-stone-300 cursor-not-allowed')}`}
          title="Forward"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onReload}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600'}`}
          title="Reload"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
        </button>
      </div>

      {/* Viewport Switcher - Desktop, Tablet, Mobile */}
      <div className={`flex items-center rounded-lg p-0.5 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'}`}>
        <button
          onClick={() => onSetViewportSize('desktop')}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'desktop' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
          title="Desktop view"
        >
          <Monitor size={14} />
        </button>
        <button
          onClick={() => onSetViewportSize('tablet')}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'tablet' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
          title="Tablet view (768px)"
        >
          <Tablet size={14} />
        </button>
        <button
          onClick={() => onSetViewportSize('mobile')}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'mobile' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
          title="Mobile view (375px)"
        >
          <Smartphone size={14} />
        </button>
        {/* Multi-Viewport Toggle */}
        <button
          onClick={onToggleMultiViewport}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${isMultiViewportMode ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
          title="Multi-Viewport Mode"
        >
          <LayoutGrid size={14} />
        </button>
      </div>

      {/* URL Bar */}
      <form onSubmit={onUrlSubmit} className="flex-1">
        <div className="relative">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => !hasProjectPath && onSetUrlInput(e.target.value)}
            readOnly={hasProjectPath}
            data-control-id="url-bar"
            data-control-type="input"
            className={`w-full h-8 px-3 pr-8 text-sm rounded-full focus:outline-none ${
              hasProjectPath
                ? `cursor-default ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-stone-100 border-stone-200 text-stone-500'}`
                : `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-white border border-stone-200'}`
            }`}
            placeholder="Enter URL..."
            title={hasProjectPath ? `Locked to project: ${projectPath}` : 'Enter URL...'}
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </form>

      {/* Inspector Toggle */}
      <button
        onClick={onToggleInspector}
        data-control-id="inspector-button"
        data-control-type="button"
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
        title="Element Inspector"
      >
        <MousePointer2 size={16} />
      </button>

      {/* Floating Toolbar Toggle */}
      <button
        onClick={onToggleFloatingToolbar}
        data-control-id="toolbar-toggle-button"
        data-control-type="button"
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isFloatingToolbarVisible ? (isDarkMode ? 'bg-neutral-700 text-neutral-200' : 'bg-stone-200 text-stone-700') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
        title={isFloatingToolbarVisible ? 'Hide toolbar' : 'Show toolbar'}
      >
        <Wrench size={16} />
      </button>

      {/* Console Toggle */}
      <button
        onClick={onToggleConsolePanel}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isConsolePanelOpen ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
        title="Toggle Console"
      >
        <Terminal size={16} />
      </button>

      {/* Code Editor Toggle - Only visible when element has source location */}
      {hasProjectPath && selectedElementHasSource && (
        <button
          onClick={onJumpToSource}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
          title="Jump to Source"
        >
          <FileCode size={16} />
        </button>
      )}

      {/* Sidebar Toggle */}
      <button
        onClick={onToggleSidebar}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
        title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <PanelRight size={16} />
      </button>
    </div>
  )
}
