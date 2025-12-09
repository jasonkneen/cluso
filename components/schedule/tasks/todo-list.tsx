"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

import { FilterTab, Todo, TodoStatus } from "./types"

import { Button } from "@/components/ui/button"
import { Plus, X, Search, SlidersHorizontal, GridIcon, ListIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Toggle } from "@/components/ui/toggle"
import TodoItem from "./todo-item"
import { useTodoStore } from "./store"
import StatusTabs from "./status-tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  priorityDotColors,
  EnumTodoPriority
} from "./enum"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
  DragOverlay
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from "@dnd-kit/sortable"

interface TodoListProps {
  activeTab: FilterTab
  onSelectTodo: (id: string) => void
  onAddTodoClick: () => void
}

export default function TodoList({ activeTab, onSelectTodo, onAddTodoClick }: TodoListProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const {
    todos,
    updateTodo,
    reorderTodos,
    viewMode,
    setViewMode,
    filterUser,
    setFilterUser,
    filterPriority,
    setFilterPriority,
    searchQuery,
    setSearchQuery,
    toggleStarred,
    showStarredOnly,
    toggleShowStarredOnly,
    setActiveTab
  } = useTodoStore()
  const [, setReorderedPositions] = React.useState<{ id: string; position: number }[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab)
  }

  // Get unique users for the filter dropdown
  const uniqueUsers = Array.from(new Set(todos.flatMap((todo) => todo.assignedTo)))

  // Apply all filters
  const filteredTodos = todos.filter((todo) => {
    // Tab filter
    if (activeTab !== "all") return todo.status === activeTab

    // User filter
    if (filterUser && filterUser.length > 0) {
      if (!filterUser.some((user) => todo.assignedTo.includes(user))) return false
    }

    // Priority filter
    if (filterPriority && todo.priority !== filterPriority) return false

    // Starred filter
    if (showStarredOnly && !todo.starred) return false

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        todo.title.toLowerCase().includes(query) ||
        todo.description?.toLowerCase().includes(query) ||
        todo.assignedTo.some((user) => user.toLowerCase().includes(query))
      )
    }

    return true
  })

  const handleStatusChange = (id: string, status: TodoStatus) => {
    updateTodo(id, { status })
    toast.success(`Task status changed to ${status.replace("-", " ")}`)
  }

  const handleDragStart = (event: DragStartEvent) => {
    console.log("event.active.id", event.active.id)
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = filteredTodos.findIndex((item) => item.id === active.id)
    const newIndex = filteredTodos.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newItems = arrayMove(filteredTodos, oldIndex, newIndex)

    const positions = newItems.map((item, index) => ({
      id: item.id,
      position: index
    }))

    reorderTodos(positions)
    setReorderedPositions(positions)

    console.log("Todos after reordering:", {
      reorderedTodos: newItems.map((todo) => ({
        id: todo.id,
        title: todo.title,
        position: positions.find((p) => p.id === todo.id)?.position
      }))
    })

    toast.success("The to-do items have been reordered successfully.")
  }

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveId(null)
  }

  const handleUserFilterChange = (user: string, checked: boolean) => {
    if (!filterUser) {
      setFilterUser(checked ? [user] : null)
    } else {
      const newUsers = checked ? [...filterUser, user] : filterUser.filter((u) => u !== user)

      setFilterUser(newUsers.length > 0 ? newUsers : null)
    }
  }

  const clearFilters = () => {
    setFilterUser(null)
    setFilterPriority(null)
    setSearchQuery("")
    if (showStarredOnly) {
      toggleShowStarredOnly()
    }
  }

  const handleStarToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    toggleStarred(id)
  }

  const renderFilterContent = () => (
    <div className="space-y-6 p-4">
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Assigned Users</h4>
        <div className="flex flex-wrap gap-2">
          {uniqueUsers.map((user) => (
            <Toggle
              key={user}
              variant="outline"
              size="sm"
              pressed={filterUser?.includes(user) || false}
              onPressedChange={(pressed) => handleUserFilterChange(user, pressed)}
              className="px-3 text-xs">
              {user}
            </Toggle>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="starred" checked={showStarredOnly} onCheckedChange={toggleShowStarredOnly} />
        <Label htmlFor="starred">Show starred only</Label>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Priority</h4>
        <div className="flex gap-2 *:grow">
          {Object.values(EnumTodoPriority).map((priority) => (
            <Toggle
              key={priority}
              variant="outline"
              size="sm"
              pressed={filterPriority?.includes(priority) || false}
              onPressedChange={() => setFilterPriority(priority)}
              className="px-3 text-xs capitalize">
              <span className={cn("size-2 rounded-full", priorityDotColors[priority])}></span>
              {priority}
            </Toggle>
          ))}
        </div>

        {(filterUser || filterPriority || showStarredOnly) && (
          <div className="text-end">
            <Button variant="link" size="sm" className="px-0!" onClick={clearFilters}>
              Clear Filters
              <X />
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const items = todos.map((v) => v.id)

  const renderTodoItems = () => {
    if (viewMode === "grid") {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}>
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onClick={() => onSelectTodo(todo.id)}
                  onStatusChange={handleStatusChange}
                  viewMode="grid"
                  onStarToggle={handleStarToggle}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <TodoItem
                todo={filteredTodos.find((t) => t.id === activeId) as Todo}
                viewMode="grid"
                isDraggingOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )
    }

    // List view with drag and drop
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 space-y-4">
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onClick={() => onSelectTodo(todo.id)}
                onStatusChange={handleStatusChange}
                viewMode="list"
                onStarToggle={handleStarToggle}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <TodoItem
              todo={filteredTodos.find((t) => t.id === activeId) as Todo}
              viewMode="list"
              isDraggingOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    )
  }

  return (
    <>
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <StatusTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="flex w-full items-center gap-2 lg:w-auto">
          {/* Search input */}
          <div className="relative w-auto">
            <Search className="absolute top-2.5 left-3 size-4 opacity-50" />
            <Input
              placeholder="Search tasks..."
              className="ps-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="relative">
                <SlidersHorizontal />
                {(filterUser || filterPriority || showStarredOnly) && (
                  <Badge
                    variant="secondary"
                    className="absolute -end-1.5 -top-1.5 size-4 rounded-full p-0">
                    {(filterUser ? 1 : 0) + (filterPriority ? 1 : 0) + (showStarredOnly ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              {renderFilterContent()}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <ToggleGroup
            type="single"
            variant="outline"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as "list" | "grid")}>
            <ToggleGroupItem value="list" aria-label="List view">
              <ListIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <GridIcon />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Add button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  onClick={onAddTodoClick}
                  className="fixed end-6 bottom-6 z-10 rounded-full! md:size-14">
                  <Plus className="md:size-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Add To-Do</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {filteredTodos.length === 0 ? (
        <div className="flex h-[calc(100vh-12rem)] flex-col items-center justify-center py-12 text-center">
          <h3 className="text-xl font-medium">No tasks found</h3>
          <p className="text-muted-foreground mt-2">Add a new task to get started</p>
        </div>
      ) : (
        renderTodoItems()
      )}
    </>
  )
}
