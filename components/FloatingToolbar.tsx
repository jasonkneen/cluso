import React from 'react'
import {
  Monitor, MousePointer2, Mic, Loader2, X,
  ScreenShare, Tablet, Smartphone, KanbanSquare,
  ListTodo, StickyNote, Ghost, Maximize, LayoutGrid
} from 'lucide-react'

interface StreamState {
  isStreaming: boolean
  isConnected: boolean
}

interface ViewportControlsRef {
  addDevice: (type: 'desktop' | 'tablet' | 'mobile') => void
  addInternalWindow: (type: 'kanban' | 'todo' | 'notes') => void
  addTerminal: () => void
  autoLayout: (direction: string) => void
  fitView: () => void
}

interface FloatingToolbarProps {
  isDarkMode: boolean
  isMultiViewportMode: boolean
  viewportCount: number
  isScreenSharing: boolean
  isInspectorActive: boolean
  streamState: StreamState
  viewportControlsRef: React.RefObject<ViewportControlsRef>
  onToggleScreenSharing: () => void
  onToggleInspector: () => void
  onToggleVoice: () => void
  onExitMultiViewport: () => void
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  isDarkMode,
  isMultiViewportMode,
  viewportCount,
  isScreenSharing,
  isInspectorActive,
  streamState,
  viewportControlsRef,
  onToggleScreenSharing,
  onToggleInspector,
  onToggleVoice,
  onExitMultiViewport
}) => {
  return (
    <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 backdrop-blur shadow-2xl p-2 rounded-full z-40 ${isDarkMode ? 'bg-neutral-800/90 border border-neutral-700/50' : 'bg-white/90 border border-stone-200/50'}`}>
      {/* Canvas controls - only shown in multi-viewport mode */}
      {isMultiViewportMode && (
        <>
          {/* Viewport count */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'}`}>
            <LayoutGrid size={12} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              {viewportCount}
            </span>
          </div>

          <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

          {/* Add device buttons */}
          <button
            onClick={() => viewportControlsRef.current?.addDevice('desktop')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Desktop"
          >
            <ScreenShare size={16} />
          </button>
          <button
            onClick={() => viewportControlsRef.current?.addDevice('tablet')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Tablet"
          >
            <Tablet size={16} />
          </button>
          <button
            onClick={() => viewportControlsRef.current?.addDevice('mobile')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Mobile"
          >
            <Smartphone size={16} />
          </button>

          <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

          {/* Add internal window buttons */}
          <button
            onClick={() => viewportControlsRef.current?.addInternalWindow('kanban')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Kanban"
          >
            <KanbanSquare size={16} />
          </button>
          <button
            onClick={() => viewportControlsRef.current?.addInternalWindow('todo')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Todo"
          >
            <ListTodo size={16} />
          </button>
          <button
            onClick={() => viewportControlsRef.current?.addInternalWindow('notes')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Notes"
          >
            <StickyNote size={16} />
          </button>
          <button
            onClick={() => viewportControlsRef.current?.addTerminal()}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Add Ghostty Terminal"
          >
            <Ghost size={16} />
          </button>

          <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

          {/* Layout control - auto arrange and fit */}
          <button
            onClick={() => {
              viewportControlsRef.current?.autoLayout('RIGHT')
              setTimeout(() => viewportControlsRef.current?.fitView(), 100)
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
            title="Show All"
          >
            <Maximize size={16} />
          </button>

          <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

          {/* Exit canvas mode */}
          <button
            onClick={onExitMultiViewport}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-red-400' : 'hover:bg-stone-100 text-red-500'}`}
            title="Exit Canvas"
          >
            <X size={16} />
          </button>

          <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>
        </>
      )}

      {/* Screen share - only in single viewport mode */}
      {!isMultiViewportMode && (
        <button
          onClick={onToggleScreenSharing}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
          title="Toggle Screen Share"
        >
          <Monitor size={16} />
        </button>
      )}

      <button
        onClick={onToggleInspector}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
        title="Toggle Element Inspector"
      >
        <MousePointer2 size={16} />
      </button>

      <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

      <button
        onClick={onToggleVoice}
        disabled={streamState.isStreaming && !streamState.isConnected}
        data-control-id="voice-button"
        data-control-type="button"
        className={`flex items-center justify-center w-9 h-9 rounded-full font-medium transition-all ${
          streamState.isStreaming && !streamState.isConnected
            ? 'bg-yellow-100 text-yellow-600 ring-1 ring-yellow-200 cursor-wait'
            : streamState.isConnected
              ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
              : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800')
        }`}
        title={
          streamState.isStreaming && !streamState.isConnected
            ? 'Connecting...'
            : streamState.isConnected
              ? 'End voice session'
              : 'Start voice session'
        }
      >
        {streamState.isStreaming && !streamState.isConnected ? (
          <Loader2 size={16} className="animate-spin" />
        ) : streamState.isConnected ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        ) : (
          <Mic size={16} />
        )}
      </button>
    </div>
  )
}
