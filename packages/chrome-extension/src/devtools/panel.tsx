import { StrictMode, useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactComponentInfo } from '@ai-cluso/shared-types'
import '../popup/styles.css'

interface ComponentStackItem extends ReactComponentInfo {
  depth: number
}

function Panel() {
  const [components, setComponents] = useState<ComponentStackItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Inspect currently selected element
  const inspectElement = useCallback(async () => {
    const tabId = chrome.devtools.inspectedWindow.tabId
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Get $0 (currently selected element in Elements panel)
        const element = (window as unknown as { $0?: Element }).$0
        if (!element) return null

        // Try to get React context
        const win = window as Window & {
          extractReactContext?: (el: Element) => {
            hasFiber: boolean
            componentStack?: Array<{
              componentName: string
              fileName?: string
              lineNumber?: number
              columnNumber?: number
            }>
          }
        }

        if (win.extractReactContext) {
          const context = win.extractReactContext(element)
          return context.componentStack || []
        }

        return []
      },
    })

    if (results?.[0]?.result) {
      const stack = results[0].result as ReactComponentInfo[]
      setComponents(
        stack.map((comp, index) => ({
          ...comp,
          depth: index,
        }))
      )
    }
  }, [])

  // Re-inspect when Elements panel selection changes
  useEffect(() => {
    // Poll for $0 changes (DevTools API limitation)
    const interval = setInterval(inspectElement, 1000)
    return () => clearInterval(interval)
  }, [inspectElement])

  // Open file in editor
  const openInEditor = useCallback((fileName?: string | null, lineNumber?: number | null) => {
    if (!fileName) return

    // Try to open via Cluso connection
    chrome.runtime.sendMessage({
      type: 'open-file',
      fileName,
      lineNumber,
    })

    // Also try vscode:// URL
    const vscodePath = `vscode://file${fileName}${lineNumber ? `:${lineNumber}` : ''}`
    window.open(vscodePath)
  }, [])

  return (
    <div className="h-screen bg-[#1e1e1e] text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-semibold text-white/80">Component Tree</h1>
        <button
          onClick={inspectElement}
          className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
        >
          Refresh
        </button>
      </div>

      {components.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">
          <p>Select an element in the Elements panel</p>
          <p className="text-xs mt-1">
            React components will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {components.map((comp, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                selectedIndex === index
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'hover:bg-white/5'
              }`}
              style={{ paddingLeft: `${8 + comp.depth * 16}px` }}
              onClick={() => setSelectedIndex(index)}
              onDoubleClick={() => openInEditor(comp.fileName, comp.lineNumber)}
            >
              <span className="text-purple-400 font-mono text-sm">
                {comp.componentName}
              </span>
              {comp.fileName && (
                <span className="text-white/30 text-xs truncate flex-1">
                  {comp.fileName.split('/').pop()}
                  {comp.lineNumber && `:${comp.lineNumber}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedIndex !== null && components[selectedIndex] && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg">
          <h3 className="text-xs font-medium text-white/40 mb-2">Selected Component</h3>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-white/40">Name: </span>
              <span className="text-purple-400">{components[selectedIndex].componentName}</span>
            </div>
            {components[selectedIndex].fileName && (
              <div>
                <span className="text-white/40">File: </span>
                <button
                  className="text-blue-400 hover:underline"
                  onClick={() =>
                    openInEditor(
                      components[selectedIndex].fileName,
                      components[selectedIndex].lineNumber
                    )
                  }
                >
                  {components[selectedIndex].fileName}
                  {components[selectedIndex].lineNumber &&
                    `:${components[selectedIndex].lineNumber}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Panel />
    </StrictMode>
  )
}
