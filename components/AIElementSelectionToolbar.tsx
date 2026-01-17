import React from 'react'
import { Check } from 'lucide-react'
import type { AISelectedElement } from '../features/ai-selection'

interface AIElementSelectionToolbarProps {
  isDarkMode: boolean
  aiSelectedElement: AISelectedElement
  onConfirmSelection: (confirmed: boolean, elementIndex?: number) => void
}

export function AIElementSelectionToolbar({
  isDarkMode,
  aiSelectedElement,
  onConfirmSelection,
}: AIElementSelectionToolbarProps): React.ReactElement {
  const { elements, count } = aiSelectedElement

  if (count === 1) {
    // Single element - simple confirmation
    return (
      <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 rounded-lg shadow-2xl px-4 py-3 z-50 max-w-3xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Check size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              Found <code className={`px-1.5 py-0.5 rounded font-mono text-xs ${isDarkMode ? 'bg-neutral-700 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>{elements[0].tagName}</code>
              {elements[0].text && (
                <span className="ml-1">"{elements[0].text.substring(0, 40)}{elements[0].text.length > 40 ? '...' : ''}"</span>
              )}
              <span className={`ml-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>- Is this correct?</span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onConfirmSelection(false)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}
            >
              No
            </button>
            <button
              onClick={() => onConfirmSelection(true, 1)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Multiple elements - show list with numbers
  return (
    <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 rounded-lg shadow-2xl px-4 py-3 z-50 max-w-3xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Check size={16} />
          </div>
          <div className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
            Found {count} elements - which one?
          </div>
          <button
            onClick={() => onConfirmSelection(false)}
            className={`ml-auto px-3 py-1.5 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}
          >
            Cancel
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
          {elements.map((element, index) => (
            <button
              key={index}
              onClick={() => onConfirmSelection(true, index + 1)}
              className={`flex items-center gap-3 p-2 rounded-lg text-left transition ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-neutral-50'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isDarkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <code className={`text-xs font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{element.tagName}</code>
                {element.text && (
                  <span className={`ml-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    "{element.text.substring(0, 50)}{element.text.length > 50 ? '...' : ''}"
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
