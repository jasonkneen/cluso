

import React, { useEffect } from "react"
import { useTodoStore } from "./store"

import TodoList from "./todo-list"
import AddTodoSheet from "./add-todo-sheet"
import TodoDetailSheet from "./todo-detail-sheet"
import { Todo } from "./types"

export default function Tasks({ tasks }: { tasks: Todo[] }) {
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
  }, [tasks])

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
