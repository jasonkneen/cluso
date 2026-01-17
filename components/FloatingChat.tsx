import React from 'react'
import { X, ListTodo, ArrowUp, Check } from 'lucide-react'

interface SelectedElement {
  tagName: string
  text?: string
  sourceLocation?: {
    summary?: string
    sources?: Array<{ file?: string; line?: number; endLine?: number }>
  }
  [key: string]: unknown
}

interface FloatingChatProps {
  isDarkMode: boolean
  selectedElement: SelectedElement
  popupInput: string
  isAddingTodo: boolean
  todoPriority: 'low' | 'medium' | 'high'
  todoDueDate: string
  popupStyle: React.CSSProperties
  onPopupInputChange: (value: string) => void
  onIsAddingTodoChange: (value: boolean) => void
  onTodoPriorityChange: (value: 'low' | 'medium' | 'high') => void
  onTodoDueDateChange: (value: string) => void
  onSubmit: (input: string) => void
  onCreateTodo: (input: string, priority: 'low' | 'medium' | 'high', dueDate?: string) => Promise<void>
  onClose: () => void
  onClearSelection: () => void
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
  isDarkMode,
  selectedElement,
  popupInput,
  isAddingTodo,
  todoPriority,
  todoDueDate,
  popupStyle,
  onPopupInputChange,
  onIsAddingTodoChange,
  onTodoPriorityChange,
  onTodoDueDateChange,
  onSubmit,
  onCreateTodo,
  onClose,
  onClearSelection
}) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAddingTodo && popupInput.trim()) {
      await onCreateTodo(popupInput, todoPriority, todoDueDate || undefined)
      onPopupInputChange('')
      onTodoPriorityChange('medium')
      onTodoDueDateChange('')
      onClose()
    } else {
      onSubmit(popupInput)
      onPopupInputChange('')
      onClose()
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isAddingTodo && popupInput.trim()) {
        await onCreateTodo(popupInput, todoPriority, todoDueDate || undefined)
        onPopupInputChange('')
        onTodoPriorityChange('medium')
        onTodoDueDateChange('')
        onClose()
      } else {
        onSubmit(popupInput)
        onPopupInputChange('')
        onClose()
      }
    }
    if (e.key === 'Escape') {
      onClose()
      onIsAddingTodoChange(false)
      onClearSelection()
    }
  }

  return (
    <div className="absolute z-50" style={popupStyle}>
      <div
        className={`rounded-2xl shadow-2xl w-80 p-3 ${isDarkMode ? 'bg-neutral-800/95 border border-neutral-700' : 'bg-white/95 border border-stone-200'}`}
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className={`flex flex-col gap-2 mb-2`}>
          <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
            <div className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
              {selectedElement.tagName}
            </div>
            <span className="truncate max-w-[150px]">{selectedElement.text}</span>
            <div className="flex-1"></div>
            <button
              onClick={() => {
                onClose()
                onClearSelection()
              }}
              className={`p-1 rounded hover:bg-black/10 ${isDarkMode ? 'hover:text-neutral-200' : 'hover:text-stone-900'}`}
              title="Dismiss (Esc)"
            >
              <X size={14} />
            </button>
          </div>
          {selectedElement.sourceLocation && (
            <div className={`text-xs font-mono ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              {selectedElement.sourceLocation.summary}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Add Todo Checkbox */}
          <div className="flex items-center gap-2 mb-2">
            <label className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              <input
                type="checkbox"
                checked={isAddingTodo}
                onChange={(e) => onIsAddingTodoChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-2 accent-blue-500"
              />
              <ListTodo size={14} className={isAddingTodo ? 'text-blue-500' : ''} />
              <span className={isAddingTodo ? 'text-blue-500 font-medium' : ''}>Add Todo</span>
            </label>
          </div>

          {/* Priority and Due Date (shown when checkbox is checked) */}
          {isAddingTodo && (
            <div className="flex items-center gap-2 mb-2">
              <select
                value={todoPriority}
                onChange={(e) => onTodoPriorityChange(e.target.value as 'low' | 'medium' | 'high')}
                className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'bg-stone-50 border-stone-200'}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <div className="relative flex-1">
                <input
                  type="date"
                  value={todoDueDate}
                  onChange={(e) => onTodoDueDateChange(e.target.value)}
                  className={`w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'bg-stone-50 border-stone-200'}`}
                  placeholder="Due date"
                />
              </div>
            </div>
          )}

          <textarea
            value={popupInput}
            onChange={(e) => onPopupInputChange(e.target.value)}
            placeholder={isAddingTodo ? "Add a comment about this element..." : "What would you like to change?"}
            className={`w-full text-sm p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-stone-50 border-stone-200'}`}
            rows={2}
            autoFocus
            onKeyDown={handleKeyDown}
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!popupInput.trim()}
              className={`w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-50 ${isAddingTodo ? 'bg-blue-600 text-white hover:bg-blue-500' : isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-700'}`}
            >
              {isAddingTodo ? <Check size={14} /> : <ArrowUp size={14} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
