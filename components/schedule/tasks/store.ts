

import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import {
  Todo,
  FilterTab,
  ViewMode,
  TodoFile,
  TodoPriority
} from "./types"

interface TodoStore {
  todos: Todo[]
  selectedTodoId: string | null
  activeTab: FilterTab
  isAddDialogOpen: boolean
  isTodoSheetOpen: boolean
  viewMode: ViewMode
  filterUser: string[] | null
  filterPriority: TodoPriority | null
  showStarredOnly: boolean
  searchQuery: string

  // Actions
  setTodos: (todos: Todo[]) => void
  addTodo: (
    todo: Omit<
      Todo,
      "id" | "createdAt" | "comments" | "files" | "subTasks" | "starred" | "reminderDate"
    >
  ) => void
  updateTodo: (id: string, updatedTodo: Partial<Omit<Todo, "id">>) => void
  deleteTodo: (id: string) => void
  setSelectedTodoId: (id: string | null) => void
  setActiveTab: (tab: FilterTab) => void
  setAddDialogOpen: (isOpen: boolean) => void
  setTodoSheetOpen: (isOpen: boolean) => void
  addComment: (todoId: string, text: string) => void
  deleteComment: (todoId: string, commentId: string) => void
  reorderTodos: (todoPositions: { id: string; position: number }[]) => void
  setViewMode: (mode: ViewMode) => void
  setFilterUser: (users: string[] | null) => void
  setFilterPriority: (priority: TodoPriority | null) => void
  setSearchQuery: (query: string) => void
  toggleShowStarredOnly: () => void
  addFile: (todoId: string, file: Omit<TodoFile, "id">) => void
  removeFile: (todoId: string, fileId: string) => void
  addSubTask: (todoId: string, title: string) => void
  updateSubTask: (todoId: string, subTaskId: string, completed: boolean) => void
  removeSubTask: (todoId: string, subTaskId: string) => void
  toggleStarred: (todoId: string) => void
}

export const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  selectedTodoId: null,
  activeTab: "all",
  isAddDialogOpen: false,
  isTodoSheetOpen: false,
  viewMode: "list",
  filterUser: null,
  filterPriority: null,
  showStarredOnly: false,
  searchQuery: "",

  setTodos: (todos) =>
    set(() => ({
      todos: todos
    })),
  addTodo: (todo) =>
    set((state) => ({
      todos: [
        ...state.todos,
        {
          ...todo,
          id: uuidv4(),
          createdAt: new Date(),
          comments: [],
          files: [],
          subTasks: [],
          starred: false
        }
      ]
    })),

  updateTodo: (id, updatedTodo) =>
    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === id ? { ...todo, ...updatedTodo } : todo))
    })),

  deleteTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id)
    })),

  setSelectedTodoId: (id) =>
    set(() => ({
      selectedTodoId: id
    })),

  setActiveTab: (tab) =>
    set(() => ({
      activeTab: tab
    })),

  setAddDialogOpen: (isOpen) =>
    set(() => ({
      isAddDialogOpen: isOpen
    })),

  setTodoSheetOpen: (isOpen) =>
    set(() => ({
      isTodoSheetOpen: isOpen
    })),

  addComment: (todoId, text) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              comments: [
                ...todo.comments,
                {
                  id: uuidv4(),
                  text,
                  createdAt: new Date()
                }
              ]
            }
          : todo
      )
    })),

  deleteComment: (todoId, commentId) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              comments: todo.comments.filter((comment) => comment.id !== commentId)
            }
          : todo
      )
    })),

  reorderTodos: (todoPositions) =>
    set((state) => {
      const reorderedTodos = [...state.todos]

      todoPositions.forEach(({ id, position }) => {
        const todoIndex = reorderedTodos.findIndex((todo) => todo.id === id)
        if (todoIndex !== -1) {
          const [todo] = reorderedTodos.splice(todoIndex, 1)
          reorderedTodos.splice(position, 0, todo)
        }
      })

      return { todos: reorderedTodos }
    }),

  setViewMode: (mode) =>
    set(() => ({
      viewMode: mode
    })),

  setFilterUser: (users) =>
    set(() => ({
      filterUser: users
    })),

  setFilterPriority: (priority) =>
    set(() => ({
      filterPriority: priority
    })),

  setSearchQuery: (query) =>
    set(() => ({
      searchQuery: query
    })),

  toggleShowStarredOnly: () =>
    set((state) => ({
      showStarredOnly: !state.showStarredOnly
    })),

  addFile: (todoId, file) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              files: [
                ...(todo.files || []),
                {
                  ...file,
                  id: uuidv4()
                }
              ]
            }
          : todo
      )
    })),

  removeFile: (todoId, fileId) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              files: (todo.files || []).filter((file) => file.id !== fileId)
            }
          : todo
      )
    })),

  addSubTask: (todoId, title) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              subTasks: [
                ...(todo.subTasks || []),
                {
                  id: uuidv4(),
                  title,
                  completed: false
                }
              ]
            }
          : todo
      )
    })),

  updateSubTask: (todoId, subTaskId, completed) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              subTasks: (todo.subTasks || []).map((subTask) =>
                subTask.id === subTaskId ? { ...subTask, completed } : subTask
              )
            }
          : todo
      )
    })),

  removeSubTask: (todoId, subTaskId) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              subTasks: (todo.subTasks || []).filter((subTask) => subTask.id !== subTaskId)
            }
          : todo
      )
    })),

  toggleStarred: (todoId) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId ? { ...todo, starred: !todo.starred } : todo
      )
    }))
}))
