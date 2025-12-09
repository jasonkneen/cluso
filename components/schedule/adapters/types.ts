/**
 * Type adapters to bridge between existing ai-cluso data model
 * and the new shadcn component data models
 */

// ============================================
// EXISTING DATA MODEL (from ai-cluso/types/tab.ts)
// ============================================

export interface ExistingKanbanColumn {
  id: string
  title: string
  cards: ExistingKanbanCard[]
}

export interface ExistingKanbanCard {
  id: string
  title: string
  description?: string
  labels?: string[]
  dueDate?: string
  createdAt: string
}

export interface ExistingTodoItem {
  id: string
  text: string
  completed: boolean
  priority?: "low" | "medium" | "high"
  dueDate?: string
  createdAt: string
  completedAt?: string
  source?: "user" | "agent"
  agentName?: string
}

export interface ExistingKanbanData {
  boardId: string
  boardTitle: string
  columns: ExistingKanbanColumn[]
}

export interface ExistingTodosData {
  items: ExistingTodoItem[]
}

export interface ExistingNotesData {
  content: string
}

// ============================================
// NEW COMPONENT DATA MODEL
// ============================================

export interface NewKanbanTask {
  id: string
  title: string
  description?: string
  priority: "low" | "medium" | "high"
  assignee?: string
  dueDate?: string
  progress: number
  attachments?: number
  comments?: number
  users: Array<{
    name: string
    src: string
    alt?: string
    fallback?: string
  }>
}

export interface NewTodo {
  id: string
  title: string
  label: "bug" | "feature" | "enhancement" | "documentation"
  status: "todo" | "in-progress" | "done" | "canceled"
  priority: "low" | "medium" | "high"
  createdAt: Date
  dueDate?: Date
  completed?: boolean
}
