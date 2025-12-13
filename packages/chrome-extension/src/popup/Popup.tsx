import { useState, useEffect, useCallback } from 'react'
import type { SelectedElement } from '@ai-cluso/shared-types'
import { Toolbar } from './Toolbar'
import { ElementPreview } from './ElementPreview'
import { ChatPanel } from './ChatPanel'

type InspectorMode = 'screen' | 'select' | 'move' | 'none'

export function Popup() {
  const [mode, setMode] = useState<InspectorMode>('none')
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)

  // Get initial state from background
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'get-selected-element' }, (response) => {
      if (response?.element) {
        setSelectedElement(response.element as SelectedElement)
      }
    })

    chrome.runtime.sendMessage({ type: 'get-connection-status' }, (response) => {
      setIsConnected(response?.connected ?? false)
    })
  }, [])

  // Listen for selection updates
  useEffect(() => {
    const listener = (message: { type: string; element?: SelectedElement }) => {
      if (message.type === 'selection-updated' && message.element) {
        setSelectedElement(message.element)
        setMode('none')
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Handle mode changes
  const handleModeChange = useCallback((newMode: InspectorMode) => {
    if (newMode === mode) {
      // Toggle off
      setMode('none')
      chrome.runtime.sendMessage({ type: 'deactivate-inspector' })
    } else {
      setMode(newMode)
      if (newMode === 'select') {
        chrome.runtime.sendMessage({ type: 'activate-inspector' })
      } else {
        chrome.runtime.sendMessage({ type: 'deactivate-inspector' })
      }
    }
  }, [mode])

  // Handle mic toggle
  const handleMicToggle = useCallback(() => {
    setIsMicActive((prev) => !prev)
    // TODO: Implement voice capture
  }, [])

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedElement(null)
    chrome.runtime.sendMessage({ type: 'clear-selection' })
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-xs font-bold">C</span>
          </div>
          <span className="font-semibold text-sm">Cluso</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
            title={isConnected ? 'Connected to Cluso' : 'Standalone mode'}
          />
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar
        mode={mode}
        isMicActive={isMicActive}
        onModeChange={handleModeChange}
        onMicToggle={handleMicToggle}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {selectedElement ? (
          <ElementPreview
            element={selectedElement}
            onClear={handleClearSelection}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white/90 mb-1">
              No element selected
            </h3>
            <p className="text-xs text-white/50">
              Click the cursor icon to start selecting elements
            </p>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <ChatPanel />
    </div>
  )
}
