/**
 * Adapter functions to convert between existing Todo data model
 * and the new shadcn Tasks component data model
 */

import type { ExistingTodoItem, ExistingTodosData, NewTodo } from "./types"

/**
 * Map existing completed state to new status
 */
function getStatusFromCompleted(completed: boolean): NewTodo["status"] {
  return completed ? "done" : "todo"
}

/**
 * Map new status back to completed boolean
 */
function getCompletedFromStatus(status: NewTodo["status"]): boolean {
  return status === "done" || status === "canceled"
}

/**
 * Convert existing TodoItem to new Todo format
 */
export function existingToNewTodo(item: ExistingTodoItem): NewTodo {
  return {
    id: item.id,
    title: item.text,
    label: "feature", // Default since existing model doesn't have labels
    status: getStatusFromCompleted(item.completed),
    priority: item.priority || "medium",
    createdAt: new Date(item.createdAt),
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    completed: item.completed,
  }
}

/**
 * Convert new Todo back to existing TodoItem format
 */
export function newToExistingTodo(todo: NewTodo): ExistingTodoItem {
  const completed = getCompletedFromStatus(todo.status)

  return {
    id: todo.id,
    text: todo.title,
    completed,
    priority: todo.priority,
    dueDate: todo.dueDate?.toISOString(),
    createdAt: todo.createdAt.toISOString(),
    completedAt: completed ? new Date().toISOString() : undefined,
    source: "user",
  }
}

/**
 * Convert all existing todos to new format
 */
export function adaptTodosForComponent(data: ExistingTodosData): NewTodo[] {
  return data.items.map(existingToNewTodo)
}

/**
 * Convert all new todos back to existing format
 */
export function adaptTodosForStorage(todos: NewTodo[]): ExistingTodosData {
  return {
    items: todos.map(newToExistingTodo),
  }
}

/**
 * Create a new todo item in existing format
 */
export function createNewExistingTodo(
  text: string,
  priority: "low" | "medium" | "high" = "medium",
  dueDate?: string
): ExistingTodoItem {
  return {
    id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text,
    completed: false,
    priority,
    dueDate,
    createdAt: new Date().toISOString(),
    source: "user",
  }
}

/**
 * Sort todos by priority (high -> medium -> low) then by creation date
 */
export function sortTodosByPriority(todos: ExistingTodoItem[]): ExistingTodoItem[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return [...todos].sort((a, b) => {
    const priorityA = priorityOrder[a.priority || "medium"]
    const priorityB = priorityOrder[b.priority || "medium"]

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/**
 * Filter todos by status
 */
export function filterTodosByStatus(
  todos: ExistingTodoItem[],
  showCompleted: boolean
): ExistingTodoItem[] {
  if (showCompleted) {
    return todos
  }
  return todos.filter((todo) => !todo.completed)
}
