import React, { useState, useCallback, useEffect } from 'react'
import { Plus, Check, Circle, Trash2, Bot, User, AlertCircle, Clock, RefreshCw, Filter } from 'lucide-react'
import { TodoItem } from '../../types/tab'

// Agent todo from external tools (Claude, Cline, Roo, etc.)
interface AgentTodo {
  id: string
  text: string
  completed: boolean
  status?: 'pending' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  agent: string
  source: string
  line?: number
  createdAt: string
}

interface AgentInfo {
  id: string
  name: string
  icon: string
  color: string
  count?: number
}

interface TodosTabProps {
  items: TodoItem[]
  isDarkMode: boolean
  onUpdateItems: (items: TodoItem[]) => void
  projectPath?: string // If provided, will scan for agent todos
}

const PRIORITY_COLORS = {
  low: { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Low' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'Medium' },
  high: { bg: 'bg-red-500/20', text: 'text-red-500', label: 'High' },
}

// Default agent colors (fallback if not provided by scan)
const AGENT_COLORS: Record<string, string> = {
  'claude-code': '#D97706',
  'cline': '#3B82F6',
  'roo-code': '#10B981',
  'codex': '#8B5CF6',
  'aider': '#EF4444',
  'windsurf': '#06B6D4',
  'user': '#6B7280',
}

export function TodosTab({ items, isDarkMode, onUpdateItems, projectPath }: TodosTabProps) {
  const [newTodoText, setNewTodoText] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [agentFilter, setAgentFilter] = useState<string | null>(null) // null = all agents

  // Agent todos state
  const [agentTodos, setAgentTodos] = useState<AgentTodo[]>([])
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({})
  const [isScanning, setIsScanning] = useState(false)
  const [showAgentTodos, setShowAgentTodos] = useState(true)

  // Scan for agent todos when project path changes
  useEffect(() => {
    if (projectPath && window.electronAPI?.agentTodos) {
      scanAgentTodos()
    }
  }, [projectPath])

  const scanAgentTodos = async () => {
    if (!projectPath || !window.electronAPI?.agentTodos) return

    setIsScanning(true)
    try {
      const result = await window.electronAPI.agentTodos.scan(projectPath)
      setAgentTodos(result.todos)
      setAgents(result.agents)
    } catch (err) {
      console.error('[TodosTab] Failed to scan agent todos:', err)
    } finally {
      setIsScanning(false)
    }
  }

  // Add a new todo
  const handleAddTodo = useCallback(() => {
    if (!newTodoText.trim()) return

    const newItem: TodoItem = {
      id: `todo-${Date.now()}`,
      text: newTodoText.trim(),
      completed: false,
      priority: newTodoPriority,
      createdAt: new Date().toISOString(),
      source: 'user',
    }

    onUpdateItems([...items, newItem])
    setNewTodoText('')
  }, [items, newTodoText, newTodoPriority, onUpdateItems])

  // Toggle todo completion
  const handleToggleTodo = useCallback((id: string) => {
    const updatedItems = items.map(item =>
      item.id === id
        ? {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : undefined
          }
        : item
    )
    onUpdateItems(updatedItems)
  }, [items, onUpdateItems])

  // Delete a todo
  const handleDeleteTodo = useCallback((id: string) => {
    onUpdateItems(items.filter(item => item.id !== id))
  }, [items, onUpdateItems])

  // Combine user todos and agent todos into unified format
  const combinedTodos = [
    // User todos
    ...items.map(item => ({
      ...item,
      agent: 'user',
      source: 'local',
    })),
    // Agent todos (if showing)
    ...(showAgentTodos ? agentTodos : []),
  ]

  // Filter items
  const filteredItems = combinedTodos.filter(item => {
    // Completion filter
    if (filter === 'active' && item.completed) return false
    if (filter === 'completed' && !item.completed) return false
    // Agent filter
    if (agentFilter && item.agent !== agentFilter) return false
    return true
  })

  // Sort: incomplete first, then by priority (high > medium > low), then by date
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const aPriority = priorityOrder[a.priority || 'medium']
    const bPriority = priorityOrder[b.priority || 'medium']
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const completedCount = combinedTodos.filter(i => i.completed).length
  const activeCount = combinedTodos.length - completedCount
  const agentCount = agentTodos.length

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-100'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
            Todos
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'}>
              {activeCount} active, {completedCount} completed
            </span>
            {projectPath && (
              <button
                onClick={scanAgentTodos}
                disabled={isScanning}
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'
                } ${isScanning ? 'animate-spin' : ''}`}
                title="Refresh agent todos"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Agent Filter Chips */}
        {Object.keys(agents).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => setAgentFilter(null)}
              className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
                agentFilter === null
                  ? 'bg-neutral-500 text-white'
                  : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
              }`}
            >
              All ({combinedTodos.length})
            </button>
            <button
              onClick={() => setAgentFilter('user')}
              className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
                agentFilter === 'user'
                  ? 'text-white'
                  : isDarkMode
                    ? 'text-neutral-300 hover:opacity-80'
                    : 'text-stone-700 hover:opacity-80'
              }`}
              style={{
                backgroundColor: agentFilter === 'user' ? AGENT_COLORS['user'] : `${AGENT_COLORS['user']}20`,
              }}
            >
              👤 You ({items.length})
            </button>
            {Object.entries(agents).map(([agentId, agent]) => (
              <button
                key={agentId}
                onClick={() => setAgentFilter(agentId)}
                className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
                  agentFilter === agentId
                    ? 'text-white'
                    : isDarkMode
                      ? 'text-neutral-300 hover:opacity-80'
                      : 'text-stone-700 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: agentFilter === agentId ? agent.color : `${agent.color}20`,
                }}
              >
                {agent.icon} {agent.name} ({agent.count || 0})
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          {(['all', 'active', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === f
                  ? isDarkMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500 text-white'
                  : isDarkMode
                    ? 'text-neutral-400 hover:bg-neutral-700'
                    : 'text-stone-500 hover:bg-stone-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Add Todo */}
      <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-white'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a new task..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTodo()
            }}
            className={`flex-1 px-3 py-2 text-sm rounded-lg outline-none ${
              isDarkMode
                ? 'bg-neutral-700 text-white placeholder-neutral-400 border-neutral-600 focus:border-blue-500'
                : 'bg-stone-50 text-stone-800 placeholder-stone-400 border-stone-200 focus:border-blue-500'
            } border`}
          />
          <select
            value={newTodoPriority}
            onChange={(e) => setNewTodoPriority(e.target.value as 'low' | 'medium' | 'high')}
            className={`px-2 py-2 text-sm rounded-lg outline-none ${
              isDarkMode
                ? 'bg-neutral-700 text-white border-neutral-600'
                : 'bg-stone-50 text-stone-800 border-stone-200'
            } border`}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={handleAddTodo}
            disabled={!newTodoText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedItems.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
            <CheckCircleIcon className="mx-auto mb-3" size={48} />
            <p className="text-sm">
              {filter === 'all' ? 'No tasks yet. Add one above!' : `No ${filter} tasks.`}
            </p>
          </div>
        ) : (
          sortedItems.map(item => {
            const priority = PRIORITY_COLORS[item.priority || 'medium']
            return (
              <div
                key={item.id}
                className={`group flex items-start gap-3 p-3 rounded-lg transition-all ${
                  isDarkMode
                    ? `bg-neutral-800 ${item.completed ? 'opacity-60' : ''}`
                    : `bg-white ${item.completed ? 'opacity-60' : ''}`
                } shadow-sm`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleTodo(item.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : isDarkMode
                        ? 'border-neutral-600 hover:border-green-500'
                        : 'border-stone-300 hover:border-green-500'
                  }`}
                >
                  {item.completed && <Check size={12} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm ${
                        item.completed
                          ? isDarkMode ? 'text-neutral-500 line-through' : 'text-stone-400 line-through'
                          : isDarkMode ? 'text-white' : 'text-stone-800'
                      }`}
                    >
                      {item.text}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${priority.bg} ${priority.text}`}>
                      {priority.label}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                    {item.source === 'agent' ? (
                      <span className="flex items-center gap-1">
                        <Bot size={10} />
                        {item.agentName || 'AI Agent'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        You
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteTodo(item.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1.5 rounded transition-opacity ${
                    isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-400'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// Simple check circle icon for empty state
function CheckCircleIcon({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
