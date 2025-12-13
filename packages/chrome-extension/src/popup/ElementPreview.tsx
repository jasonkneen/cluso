/**
 * Element Preview Component
 *
 * Shows information about the selected element including
 * tag name, attributes, React component stack, and source location.
 */

import type { SelectedElement, ReactComponentInfo } from '@ai-cluso/shared-types'

interface ElementPreviewProps {
  element: SelectedElement
  onClear: () => void
}

export function ElementPreview({ element, onClear }: ElementPreviewProps) {
  const componentStack = element.componentStack as ReactComponentInfo[] | undefined

  return (
    <div className="flex flex-col h-full">
      {/* Element header */}
      <div className="flex items-center justify-between px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-mono text-sm">
            &lt;{element.tagName}&gt;
          </span>
          {element.id && (
            <span className="text-xs text-white/40">#{element.id}</span>
          )}
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          title="Clear selection"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Element details */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {/* Text content */}
        {element.text && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-1">Text</h4>
            <p className="text-sm text-white/80 bg-white/5 rounded px-2 py-1 font-mono text-xs">
              {element.text}
            </p>
          </div>
        )}

        {/* Class name */}
        {element.className && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-1">Class</h4>
            <p className="text-sm text-white/80 bg-white/5 rounded px-2 py-1 font-mono text-xs break-all">
              {typeof element.className === 'string' ? element.className : ''}
            </p>
          </div>
        )}

        {/* React Component Stack */}
        {componentStack && componentStack.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-2">
              React Components
            </h4>
            <div className="space-y-1">
              {componentStack.map((comp, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs bg-white/5 rounded px-2 py-1.5"
                >
                  <span className="text-purple-400 font-medium">
                    {comp.componentName}
                  </span>
                  {comp.fileName && (
                    <span className="text-white/40 truncate flex-1">
                      {comp.fileName}
                      {comp.lineNumber && `:${comp.lineNumber}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source location */}
        {element.fileName && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-1">Source</h4>
            <button
              className="w-full text-left text-sm text-blue-400 bg-blue-500/10 rounded px-2 py-1.5 font-mono text-xs hover:bg-blue-500/20 transition-colors"
              onClick={() => {
                // TODO: Open in editor
                console.log('Open:', element.fileName, element.lineNumber)
              }}
            >
              {element.fileName}
              {element.lineNumber && `:${element.lineNumber}`}
              {element.columnNumber && `:${element.columnNumber}`}
            </button>
          </div>
        )}

        {/* XPath */}
        {element.xpath && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-1">XPath</h4>
            <p className="text-xs text-white/60 bg-white/5 rounded px-2 py-1 font-mono break-all">
              {element.xpath}
            </p>
          </div>
        )}

        {/* Computed styles */}
        {element.computedStyle && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-1">Styles</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(element.computedStyle).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-white/40">{key}:</span>
                  <span className="text-white/70 font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
