/**
 * Todo Feature Types
 *
 * Type definitions for todo overlay state management.
 */

/**
 * Priority level for todos
 */
export type TodoPriority = 'low' | 'medium' | 'high'

/**
 * Todo overlay state managed by useTodoOverlayState hook
 */
export interface TodoOverlayState {
  isAddingTodo: boolean
  todoPriority: TodoPriority
  todoDueDate: string
  showTodoOverlay: boolean
}

/**
 * Actions returned by useTodoOverlayState hook
 */
export interface TodoOverlayStateActions {
  setIsAddingTodo: React.Dispatch<React.SetStateAction<boolean>>
  setTodoPriority: React.Dispatch<React.SetStateAction<TodoPriority>>
  setTodoDueDate: React.Dispatch<React.SetStateAction<string>>
  setShowTodoOverlay: React.Dispatch<React.SetStateAction<boolean>>
  toggleTodoOverlay: () => void
  resetTodoForm: () => void
}
