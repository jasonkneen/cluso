import React from 'react'
import {
  MousePointer2, Terminal, Camera, Square, Check, ArrowUp,
  ChevronDown, Brain, X, Lightbulb, Flame, Rocket
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ThinkingLevel = 'off' | 'low' | 'med' | 'high' | 'ultrathink'
type ConnectionState = 'idle' | 'streaming' | 'disconnected'

interface ModelOption {
  id: string
  name: string
  Icon: LucideIcon
  provider: string
  isEnabled: boolean
  isAvailable: boolean
  isProviderConfigured: boolean
}

interface SelectedModel {
  id: string
  name: string
  Icon: LucideIcon
  provider: string
}

interface ChatInputToolbarProps {
  isDarkMode: boolean
  selectedModel: SelectedModel
  displayModels: ModelOption[]
  isModelMenuOpen: boolean
  isInspectorActive: boolean
  isScreenshotActive: boolean
  attachLogs: boolean
  capturedScreenshot: string | null
  thinkingLevel: ThinkingLevel
  showThinkingPopover: boolean
  connectionState: ConnectionState
  input: string
  onSetSelectedModel: (model: SelectedModel) => void
  onSetIsModelMenuOpen: (open: boolean) => void
  onToggleInspector: () => void
  onToggleScreenshot: () => void
  onToggleLogs: () => void
  onShowScreenshotPreview: () => void
  onSetThinkingLevel: (level: ThinkingLevel) => void
  onSetShowThinkingPopover: (show: boolean) => void
  onCancelAI: () => void
  onSetIsStreaming: (streaming: boolean) => void
  onSetConnectionState: (state: ConnectionState) => void
  onSetStreamingMessage: (message: null) => void
  onProcessPrompt: (input: string) => void
  getShortModelName: (name: string) => string
}

export const ChatInputToolbar: React.FC<ChatInputToolbarProps> = ({
  isDarkMode,
  selectedModel,
  displayModels,
  isModelMenuOpen,
  isInspectorActive,
  isScreenshotActive,
  attachLogs,
  capturedScreenshot,
  thinkingLevel,
  showThinkingPopover,
  connectionState,
  input,
  onSetSelectedModel,
  onSetIsModelMenuOpen,
  onToggleInspector,
  onToggleScreenshot,
  onToggleLogs,
  onShowScreenshotPreview,
  onSetThinkingLevel,
  onSetShowThinkingPopover,
  onCancelAI,
  onSetIsStreaming,
  onSetConnectionState,
  onSetStreamingMessage,
  onProcessPrompt,
  getShortModelName
}) => {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 border-t ${isDarkMode ? 'border-neutral-600' : 'border-stone-100'}`}>
      <div className="flex items-center gap-0.5">
        {/* Agent Selector */}
        <div className="relative">
          <button
            onClick={() => !isInspectorActive && onSetIsModelMenuOpen(!isModelMenuOpen)}
            className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded-full border transition ${
              isInspectorActive
                ? isDarkMode
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300 cursor-not-allowed'
                  : 'border-blue-300 bg-blue-50 text-blue-600 cursor-not-allowed'
                : isDarkMode
                  ? 'border-neutral-600 hover:bg-neutral-600 text-neutral-200 bg-neutral-700'
                  : 'border-stone-200 hover:bg-stone-50 text-stone-700 bg-white'
            }`}
            title={isInspectorActive ? 'Model locked while inspector is active' : selectedModel.name}
          >
            <selectedModel.Icon size={14} className="flex-shrink-0" />
            <span className="truncate max-w-[100px]">{getShortModelName(selectedModel.name)}</span>
            {isInspectorActive ? (
              <MousePointer2 size={10} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
            ) : (
              <ChevronDown size={10} className={isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
            )}
          </button>

          {isModelMenuOpen && (
            <>
              <div className="fixed inset-0 z-[99]" onClick={() => onSetIsModelMenuOpen(false)}></div>
              <div className={`absolute bottom-full left-0 mb-2 w-56 rounded-xl shadow-xl py-1 z-[100] max-h-80 overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                {/* Show only enabled models from settings */}
                {displayModels.filter(m => m.isEnabled).map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (model.isAvailable) {
                        onSetSelectedModel({ id: model.id, name: model.name, Icon: model.Icon, provider: model.provider })
                        onSetIsModelMenuOpen(false)
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                      !model.isAvailable
                        ? 'opacity-40 cursor-not-allowed'
                        : isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'
                    }`}
                    disabled={!model.isAvailable}
                    title={!model.isProviderConfigured ? 'Configure provider API key in Settings' : model.name}
                  >
                    <model.Icon size={14} className={model.isAvailable ? (isDarkMode ? 'text-neutral-400' : 'text-stone-500') : 'text-stone-300'} />
                    <span className={`flex-1 ${selectedModel.id === model.id ? 'font-medium' : ''}`}>{getShortModelName(model.name)}</span>
                    {selectedModel.id === model.id && (
                      <Check size={12} className="text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thinking Level Button with Popover */}
        <div className="relative" data-thinking-popover>
          <button
            onClick={() => !isInspectorActive && onSetShowThinkingPopover(!showThinkingPopover)}
            className={`p-2 rounded-lg transition-colors ${
              isInspectorActive
                ? isDarkMode
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-stone-300 cursor-not-allowed'
                : thinkingLevel !== 'off'
                  ? isDarkMode
                    ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                  : isDarkMode
                    ? 'hover:bg-neutral-600 text-neutral-400'
                    : 'hover:bg-stone-100 text-stone-400'
            }`}
            title={isInspectorActive ? 'Thinking disabled while inspector is active' : `Thinking: ${thinkingLevel}`}
          >
            <Brain size={18} />
          </button>

          {/* Thinking Level Popover */}
          {showThinkingPopover && !isInspectorActive && (
            <div className={`absolute bottom-full right-0 mb-2 p-2 rounded-lg shadow-lg border min-w-[200px] z-50 ${
              isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
            }`}>
              <div className={`text-xs font-medium mb-2 px-2 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                Extended Thinking
              </div>
              {/* Model support note */}
              <div className={`text-xs px-2 py-1.5 mb-2 rounded ${
                isDarkMode ? 'bg-neutral-700/50 text-neutral-400' : 'bg-stone-50 text-stone-500'
              }`}>
                <span className="font-medium">{selectedModel.name}</span>
                {selectedModel.id.includes('claude') || selectedModel.id.includes('opus') || selectedModel.id.includes('sonnet') || selectedModel.id.includes('haiku')
                  ? <span className="ml-1 text-emerald-500">(native)</span>
                  : <span className="ml-1 text-amber-500">(prompted)</span>
                }
              </div>
              {(['off', 'low', 'med', 'high', 'ultrathink'] as ThinkingLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    onSetThinkingLevel(level)
                    onSetShowThinkingPopover(false)
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition ${
                    thinkingLevel === level
                      ? isDarkMode
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-violet-50 text-violet-700'
                      : isDarkMode
                        ? 'hover:bg-neutral-700 text-neutral-300'
                        : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  {level === 'off' && <X size={14} />}
                  {level === 'low' && <Lightbulb size={14} />}
                  {level === 'med' && <Brain size={14} />}
                  {level === 'high' && <Flame size={14} />}
                  {level === 'ultrathink' && <Rocket size={14} />}
                  <span className="capitalize">{level === 'ultrathink' ? 'Ultra' : level}</span>
                  {thinkingLevel === level && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Cursor/Inspector */}
        <button
          onClick={onToggleInspector}
          className={`p-2 rounded-lg transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
          title="Select Element"
        >
          <MousePointer2 size={18} />
        </button>

        {/* Console Logs */}
        <button
          onClick={onToggleLogs}
          className={`p-2 rounded-lg transition-colors ${attachLogs ? 'bg-yellow-100 text-yellow-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
          title="Attach Console Logs"
        >
          <Terminal size={18} />
        </button>

        {/* Screenshot thumbnail preview */}
        {capturedScreenshot && (
          <button
            onClick={onShowScreenshotPreview}
            className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-purple-500 hover:border-purple-600 transition-colors"
            title="View captured screenshot"
          >
            <img src={capturedScreenshot} alt="Screenshot preview" className="w-full h-full object-cover" />
          </button>
        )}

        {/* Screenshot/Camera */}
        <button
          onClick={onToggleScreenshot}
          className={`p-2 rounded-lg transition-colors ${isScreenshotActive ? 'bg-purple-100 text-purple-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
          title="Screenshot Element"
        >
          <Camera size={18} />
        </button>

        {/* Stop button (visible only during active streaming, not idle connection) */}
        {connectionState === 'streaming' && (
          <button
            onClick={() => {
              onCancelAI()
              onSetIsStreaming(false)
              onSetConnectionState('idle')
              onSetStreamingMessage(null)
            }}
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-red-500 text-white hover:bg-red-600'}`}
            title="Stop generating"
          >
            <Square size={12} fill="currentColor" />
          </button>
        )}

        {/* Connection state indicator (shows idle = connected but not streaming) */}
        {connectionState === 'idle' && (
          <div
            className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}
            title="Connected (idle)"
          >
            <Check size={12} />
          </div>
        )}

        {/* Send button (always visible - queues messages during streaming) */}
        <button
          onClick={() => onProcessPrompt(input)}
          disabled={!input.trim()}
          data-control-id="send-button"
          data-control-type="button"
          className={`p-1.5 rounded-lg transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
          title={connectionState === 'streaming' ? "Queue message" : "Send message"}
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  )
}
