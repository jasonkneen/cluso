

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar, FileIcon, Star, BellIcon } from "lucide-react"
import { priorityClasses, statusClasses } from "./enum"
import { Todo, TodoStatus } from "./types"
import { CSS } from "@dnd-kit/utilities"
import { useSortable } from "@dnd-kit/sortable"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TodoItemProps {
  todo: Todo
  onClick?: () => void
  onStatusChange?: (id: string, status: TodoStatus) => void
  viewMode: "list" | "grid"
  onStarToggle?: (id: string, e: React.MouseEvent) => void
  isDraggingOverlay?: boolean
}

const TodoItem = memo(function TodoItem({
  todo,
  onClick,
  onStatusChange,
  viewMode,
  onStarToggle,
  isDraggingOverlay = false
}: TodoItemProps) {
  const completedSubTasks = todo.subTasks?.filter((st) => st.completed).length || 0
  const totalSubTasks = todo.subTasks?.length || 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? (!isDraggingOverlay ? 0.4 : 0.8) : 1,
    zIndex: isDragging ? 100 : 1
  }

  // Format reminder date for tooltip if it exists
  const reminderDateFormatted = todo.reminderDate
    ? format(new Date(todo.reminderDate), "MMM d, yyyy - h:mm a")
    : null

  if (viewMode === "grid") {
    return (
      <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
        <Card
          className={cn(
            "flex h-full cursor-pointer flex-col transition-shadow hover:shadow-md",
            todo.status === "completed" ? "opacity-70" : ""
          )}
          onClick={onClick}>
          <CardContent className="flex h-full flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={todo.status === "completed"}
                  onCheckedChange={() =>
                    onStatusChange
                      ? onStatusChange(
                          todo.id,
                          todo.status === "completed" ? "pending" : "completed"
                        )
                      : undefined
                  }
                  onClick={(e) => e.stopPropagation()}
                />

                <h3
                  className={cn(
                    "text-md flex-1 leading-none font-medium",
                    todo.status === "completed" ? "text-muted-foreground line-through" : ""
                  )}>
                  {todo.title}
                </h3>

                <Star
                  className={cn(
                    "size-5 cursor-pointer",
                    todo.starred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  )}
                  onClick={(e) => (onStarToggle ? onStarToggle(todo.id, e) : undefined)}
                />
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
                <span>Assigned to:</span>
                {todo.assignedTo.map((user, idx) => (
                  <Badge key={idx} variant="outline" className="font-normal">
                    {user}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {todo.dueDate && (
                  <div className="text-muted-foreground flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(todo.dueDate), "MMM d, yyyy")}</span>
                  </div>
                )}

                {todo.reminderDate && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs">
                          <BellIcon className="size-3" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reminder: {reminderDateFormatted}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {totalSubTasks > 0 && (
                <div className="text-muted-foreground text-xs">
                  Subtasks: {completedSubTasks}/{totalSubTasks}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-between border-t">
            <div className="flex items-center gap-2 capitalize">
              <Badge className={statusClasses[todo.status]}>{todo.status.replace("-", " ")}</Badge>
              <Badge className={priorityClasses[todo.priority]}>{todo.priority}</Badge>
            </div>

            {(todo.files?.length || 0) > 0 && (
              <div className="flex items-center gap-1">
                <FileIcon className="text-muted-foreground size-3" />
                <span className="text-muted-foreground text-xs">{todo.files?.length}</span>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <Card
        className={cn(
          "cursor-pointer transition-shadow hover:shadow-md",
          todo.status === "completed" ? "opacity-70" : ""
        )}
        onClick={onClick}>
        <CardContent className="flex items-start gap-3">
          <Checkbox
            checked={todo.status === "completed"}
            onCheckedChange={() =>
              onStatusChange
                ? onStatusChange(todo.id, todo.status === "completed" ? "pending" : "completed")
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
          />

          <div className="flex grow flex-col space-y-2">
            <div className="flex flex-col items-start justify-between space-y-1 lg:flex-row lg:space-y-0">
              <div className="flex items-center space-x-2">
                <h3
                  className={cn(
                    "text-md leading-none font-medium",
                    todo.status === "completed" ? "text-muted-foreground line-through" : ""
                  )}>
                  {todo.title}
                </h3>

                <Star
                  className={cn(
                    "size-4 cursor-pointer",
                    todo.starred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  )}
                  onClick={(e) => (onStarToggle ? onStarToggle(todo.id, e) : undefined)}
                />
              </div>

              <div className="flex items-center gap-2 capitalize">
                <Badge className={statusClasses[todo.status]}>
                  {todo.status.replace("-", " ")}
                </Badge>
                <Badge className={priorityClasses[todo.priority]}>{todo.priority}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap gap-1">
                {todo.assignedTo.map((user, idx) => (
                  <Badge key={idx} variant="outline" className="font-normal">
                    {user}
                  </Badge>
                ))}
              </div>

              {todo.dueDate && (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(todo.dueDate), "MMM d, yyyy")}</span>
                </div>
              )}

              {todo.reminderDate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs">
                        <BellIcon className="size-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reminder: {reminderDateFormatted}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {todo.files && todo.files.length > 0 && (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <FileIcon className="size-3" />
                  <span>{todo.files.length}</span>
                </div>
              )}

              {totalSubTasks > 0 && (
                <div className="text-muted-foreground text-xs">
                  Subtasks: {completedSubTasks}/{totalSubTasks}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}, (prev, next) =>
  prev.todo.id === next.todo.id &&
  prev.todo.status === next.todo.status &&
  prev.todo.starred === next.todo.starred &&
  prev.todo.title === next.todo.title &&
  prev.viewMode === next.viewMode &&
  prev.isDraggingOverlay === next.isDraggingOverlay
)

export default TodoItem
