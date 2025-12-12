

import React, { useEffect } from "react"
import { useTodoStore } from "./store"

import TodoList from "./todo-list"
import AddTodoSheet from "./add-todo-sheet"
import TodoDetailSheet from "./todo-detail-sheet"
import { Todo } from "./types"

interface TasksProps {
  tasks?: Todo[]
}

export default function Tasks({ tasks = [] }: TasksProps) {
  const {
    setTodos,
    activeTab,
    isAddDialogOpen,
    setAddDialogOpen,
    isTodoSheetOpen,
    setTodoSheetOpen,
    selectedTodoId,
    setSelectedTodoId
  } = useTodoStore()

  useEffect(() => {
    setTodos(tasks)
  }, [tasks, setTodos])

  // Add state for managing edit mode
  const [editTodoId, setEditTodoId] = React.useState<string | null>(null)

  const handleAddTodoClick = () => {
    // Clear edit ID when adding a new todo
    setEditTodoId(null)
    setAddDialogOpen(true)
  }

  const handleEditTodoClick = (id: string) => {
    // Set the edit ID and open the add/edit sheet
    setEditTodoId(id)
    setAddDialogOpen(true)
  }

  const handleSelectTodo = (id: string) => {
    setSelectedTodoId(id)
    setTodoSheetOpen(true)
  }

  const handleCloseAddSheet = () => {
    setAddDialogOpen(false)
    setEditTodoId(null)
  }

  const handleCloseTodoSheet = () => {
    setTodoSheetOpen(false)
    setSelectedTodoId(null)
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-2 text-sm text-muted-foreground">No tasks yet. Create one to get started.</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleAddTodoClick}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Add task
            </button>
          </div>

          <AddTodoSheet isOpen={isAddDialogOpen} onClose={handleCloseAddSheet} editTodoId={editTodoId} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Todo List</h1>
      </header>

      <TodoList
        activeTab={activeTab}
        onSelectTodo={handleSelectTodo}
        onAddTodoClick={handleAddTodoClick}
      />

      <AddTodoSheet
        isOpen={isAddDialogOpen}
        onClose={handleCloseAddSheet}
        editTodoId={editTodoId}
      />

      <TodoDetailSheet
        isOpen={isTodoSheetOpen}
        onClose={handleCloseTodoSheet}
        todoId={selectedTodoId}
        onEditClick={(id) => {
          handleCloseTodoSheet()
          handleEditTodoClick(id)
        }}
      />
    </div>
  )
}
