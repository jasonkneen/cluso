import { Message, SelectedElement } from '../types'

export type TabType = 'browser' | 'kanban' | 'todos' | 'notes'

export interface TabState {
  id: string
  title: string
  url: string
  favicon?: string
  type: TabType

  // Project mapping - used to resolve source file paths
  projectPath?: string

  // Browser state (for browser tabs)
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  isWebviewReady: boolean

  // Chat state
  messages: Message[]
  selectedElement: SelectedElement | null
  screenshotElement: SelectedElement | null
  capturedScreenshot: string | null

  // Logs
  logs: string[]

  // Pending changes
  pendingChange: {
    code: string
    undoCode: string
    description: string
  } | null

  // AI selection
  aiSelectedElement: {
    selector: string
    reasoning: string
    count?: number
    elements?: SelectedElement[]
  } | null

  // Kanban data (for kanban tabs)
  kanbanData?: {
    boardId: string // Unique ID for saving
    boardTitle: string // Editable board name
    columns: KanbanColumn[]
  }

  // Todos data (for todos tabs)
  todosData?: {
    items: TodoItem[]
  }

  // Notes data (for notes tabs)
  notesData?: {
    content: string // HTML content
  }
}

// Kanban types
export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
}

export interface KanbanCard {
  id: string
  title: string
  description?: string
  labels?: string[]
  dueDate?: string
  createdAt: string
}

// Todo types
export interface TodoElementContext {
  tagName: string
  id?: string
  className?: string
  text?: string
  xpath?: string
  outerHTML?: string
  sourceLocation?: {
    file?: string
    line?: number
    column?: number
    summary?: string
  }
}

export interface TodoItem {
  id: string
  text: string
  completed: boolean
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  createdAt: string
  completedAt?: string
  source?: 'user' | 'agent' | 'element-inspection' // Who/what created it
  agentName?: string // Which agent created it
  userComment?: string // Comment from the mini chat popup
  elementContext?: TodoElementContext // Captured element details
}

const TAB_TITLES: Record<TabType, string> = {
  browser: 'Cluso',
  kanban: 'Kanban',
  todos: 'Todos',
  notes: 'Notes',
}

// Counter to ensure unique IDs even when created in same millisecond
let tabIdCounter = 0

export function createNewTab(id?: string, type: TabType = 'browser'): TabState {
  const baseTab = {
    id: id || `tab-${Date.now()}-${++tabIdCounter}`,
    title: TAB_TITLES[type],
    url: '',
    favicon: undefined,
    type,

    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    isWebviewReady: false,

    messages: [],
    selectedElement: null,
    screenshotElement: null,
    capturedScreenshot: null,

    logs: [],
    pendingChange: null,
    aiSelectedElement: null,
  }

  // Add type-specific data
  if (type === 'kanban') {
    const boardId = `kanban-${Date.now()}-${tabIdCounter}`
    return {
      ...baseTab,
      title: 'New Board',
      kanbanData: {
        boardId,
        boardTitle: 'New Board',
        columns: [
          { id: 'backlog', title: 'Backlog', cards: [] },
          { id: 'todo', title: 'To Do', cards: [] },
          { id: 'in-progress', title: 'In Progress', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ]
      }
    }
  }

  if (type === 'todos') {
    return {
      ...baseTab,
      todosData: {
        items: []
      }
    }
  }

  if (type === 'notes') {
    return {
      ...baseTab,
      notesData: {
        content: ''
      }
    }
  }

  return baseTab
}
