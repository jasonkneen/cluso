import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, GripVertical, Check, Trash2, ChevronDown, ChevronRight, Calendar, FileCode } from 'lucide-react'
import type { TodoItem } from '../types/tab'

const STORAGE_KEY = 'cluso-todo-overlay-config'
const MIN_WIDTH = 280
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 400

interface TodoListOverlayProps {
  todos: TodoItem[]
  isDarkMode: boolean
  onClose: () => void
  onToggleTodo: (id: string, completed: boolean) => void
  onDeleteTodo: (id: string) => void
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void
}

type FilterType = 'all' | 'active' | 'completed'

const priorityColors = {
  low: 'bg-green-500/20 text-green-500',
  medium: 'bg-yellow-500/20 text-yellow-500',
  high: 'bg-red-500/20 text-red-500',
}

interface OverlayConfig {
  x: number
  y: number
  width: number
  height: number
}

function loadConfig(): OverlayConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        x: parsed.x ?? 20,
        y: parsed.y ?? 80,
        width: parsed.width ?? DEFAULT_WIDTH,
        height: parsed.height ?? DEFAULT_HEIGHT,
      }
    }
  } catch (e) {
    console.error('[TodoOverlay] Failed to load config:', e)
  }
  return { x: 20, y: 80, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
}

function saveConfig(config: OverlayConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('[TodoOverlay] Failed to save config:', e)
  }
}

export function TodoListOverlay({
  todos,
  isDarkMode,
  onClose,
  onToggleTodo,
  onDeleteTodo,
}: TodoListOverlayProps) {
  const [position, setPosition] = useState(() => {
    const config = loadConfig()
    return { x: config.x, y: config.y }
  })
  const [size, setSize] = useState(() => {
    const config = loadConfig()
    return { width: config.width, height: config.height }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set())
  const overlayRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Save config debounced
  const saveConfigDebounced = useCallback((config: OverlayConfig) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveConfig(config)
    }, 300)
  }, [])

  // Update config when position or size changes
  useEffect(() => {
    saveConfigDebounced({ ...position, ...size })
  }, [position, size, saveConfigDebounced])

  // Handle drag start
  const handleDragStart = (e: React.PointerEvent) => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  // Handle drag move
  const handleDragMove = (e: React.PointerEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      // Keep within viewport bounds
      const maxX = window.innerWidth - size.width
      const maxY = window.innerHeight - size.height
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }
  }

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false)
  }

  // Handle resize start
  const handleResizeStart = (e: React.PointerEvent, direction: string) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  // Handle resize move
  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!isResizing || !resizeDirection || !overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()

    let newWidth = size.width
    let newHeight = size.height
    let newX = position.x
    let newY = position.y

    if (resizeDirection.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, e.clientX - rect.left)
    }
    if (resizeDirection.includes('w')) {
      const delta = rect.left - e.clientX
      newWidth = Math.max(MIN_WIDTH, size.width + delta)
      if (newWidth > MIN_WIDTH) {
        newX = e.clientX
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, e.clientY - rect.top)
    }
    if (resizeDirection.includes('n')) {
      const delta = rect.top - e.clientY
      newHeight = Math.max(MIN_HEIGHT, size.height + delta)
      if (newHeight > MIN_HEIGHT) {
        newY = e.clientY
      }
    }

    // Keep within viewport
    newWidth = Math.min(newWidth, window.innerWidth - newX)
    newHeight = Math.min(newHeight, window.innerHeight - newY)

    setSize({ width: newWidth, height: newHeight })
    setPosition({ x: newX, y: newY })
  }, [isResizing, resizeDirection, size, position])

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
  }, [])

  // Add global mouse listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('pointermove', handleResizeMove)
      window.addEventListener('pointerup', handleResizeEnd)
      return () => {
        window.removeEventListener('pointermove', handleResizeMove)
        window.removeEventListener('pointerup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // Filter todos
  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  // Toggle expanded state
  const toggleExpanded = (id: string) => {
    setExpandedTodos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Resize handle component
  const ResizeHandle = ({ direction, className }: { direction: string; className: string }) => (
    <div
      className={`absolute ${className} ${isResizing && resizeDirection === direction ? 'bg-blue-500/30' : ''}`}
      onPointerDown={(e) => handleResizeStart(e, direction)}
      style={{ touchAction: 'none' }}
    />
  )

  return (
    <div
      ref={overlayRef}
      className={`fixed z-[100] rounded-xl shadow-2xl border ${
        isDarkMode ? 'bg-neutral-800/95 border-neutral-700' : 'bg-white/95 border-stone-200'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Resize handles */}
      <ResizeHandle direction="n" className="top-0 left-2 right-2 h-1 cursor-ns-resize" />
      <ResizeHandle direction="s" className="bottom-0 left-2 right-2 h-1 cursor-ns-resize" />
      <ResizeHandle direction="e" className="right-0 top-2 bottom-2 w-1 cursor-ew-resize" />
      <ResizeHandle direction="w" className="left-0 top-2 bottom-2 w-1 cursor-ew-resize" />
      <ResizeHandle direction="ne" className="top-0 right-0 w-3 h-3 cursor-nesw-resize" />
      <ResizeHandle direction="nw" className="top-0 left-0 w-3 h-3 cursor-nwse-resize" />
      <ResizeHandle direction="se" className="bottom-0 right-0 w-3 h-3 cursor-nwse-resize" />
      <ResizeHandle direction="sw" className="bottom-0 left-0 w-3 h-3 cursor-nesw-resize" />

      {/* Header with drag handle */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none ${
          isDarkMode ? 'border-neutral-700' : 'border-stone-200'
        }`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'} />
          <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
            Todos
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-100 text-stone-500'}`}>
            {filteredTodos.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-black/10 ${isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className={`flex gap-1 p-2 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
        {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filter === f
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-stone-900 text-white'
                : isDarkMode
                  ? 'text-neutral-400 hover:bg-neutral-700'
                  : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Todo list - fills remaining height */}
      <div
        className="overflow-y-auto p-2 space-y-1"
        style={{ height: `calc(100% - 85px)` }}
      >
        {filteredTodos.length === 0 ? (
          <div className={`text-center py-8 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
            {filter === 'all' ? 'No todos yet' : `No ${filter} todos`}
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const isExpanded = expandedTodos.has(todo.id)
            return (
              <div
                key={todo.id}
                className={`rounded-lg p-2 ${isDarkMode ? 'bg-neutral-700/50' : 'bg-stone-50'}`}
              >
                <div className="flex items-start gap-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggleTodo(todo.id, !todo.completed)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                      todo.completed
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : isDarkMode
                          ? 'border-neutral-500 hover:border-blue-500'
                          : 'border-stone-300 hover:border-blue-500'
                    }`}
                  >
                    {todo.completed && <Check size={12} />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {/* Expand button if has element context */}
                      {todo.elementContext && (
                        <button
                          onClick={() => toggleExpanded(todo.id)}
                          className={`p-0.5 rounded ${isDarkMode ? 'hover:bg-neutral-600' : 'hover:bg-stone-200'}`}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                      <span
                        className={`text-sm flex-1 ${
                          todo.completed
                            ? isDarkMode
                              ? 'text-neutral-500 line-through'
                              : 'text-stone-400 line-through'
                            : isDarkMode
                              ? 'text-neutral-100'
                              : 'text-stone-800'
                        }`}
                      >
                        {todo.userComment || todo.text}
                      </span>
                    </div>

                    {/* Priority badge and due date */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {todo.priority && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[todo.priority]}`}>
                          {todo.priority}
                        </span>
                      )}
                      {todo.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                          <Calendar size={10} />
                          {new Date(todo.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {todo.source === 'element-inspection' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                          element
                        </span>
                      )}
                    </div>

                    {/* Expanded element context */}
                    {isExpanded && todo.elementContext && (
                      <div className={`mt-2 p-2 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-800' : 'bg-stone-100'}`}>
                        <div className={`flex items-center gap-1 mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                          <FileCode size={10} />
                          {todo.elementContext.sourceLocation?.summary || 'Unknown source'}
                        </div>
                        <div className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
                          &lt;{todo.elementContext.tagName.toLowerCase()}
                          {todo.elementContext.id && ` id="${todo.elementContext.id}"`}
                          {todo.elementContext.className && ` class="${todo.elementContext.className.substring(0, 30)}${todo.elementContext.className.length > 30 ? '...' : ''}"`}
                          &gt;
                        </div>
                        {todo.elementContext.text && (
                          <div className={`truncate ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {todo.elementContext.text.substring(0, 50)}{todo.elementContext.text.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => onDeleteTodo(todo.id)}
                    className={`flex-shrink-0 p-1 rounded transition-opacity ${
                      isDarkMode ? 'hover:bg-red-500/20 text-neutral-400 hover:text-red-400' : 'hover:bg-red-100 text-stone-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
