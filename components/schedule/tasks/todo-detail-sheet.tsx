"use client"

import React from "react"
// Link removed - using native anchor tags for Vite compatibility
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
  Check,
  FileIcon,
  FilePlus,
  Trash2,
  X,
  Edit,
  PlusCircleIcon,
  ClockIcon
} from "lucide-react"
import { useTodoStore } from "./store"
import { statusClasses, priorityClasses } from "./enum"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

interface TodoDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  todoId: string | null
  onEditClick?: (id: string) => void
}

const TodoDetailSheet: React.FC<TodoDetailSheetProps> = ({
  isOpen,
  onClose,
  todoId,
  onEditClick
}) => {
  const {
    todos,
    addComment,
    deleteComment,
    addFile,
    removeFile,
    addSubTask,
    updateSubTask,
    removeSubTask
  } = useTodoStore()

  const [newComment, setNewComment] = React.useState("")
  const [newSubTask, setNewSubTask] = React.useState("")
  const [isAddingSubTask, setIsAddingSubTask] = React.useState(false)

  const todo = todos.find((t) => t.id === todoId)

  if (!todo) return null

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error("Both comment and author name are required")
      return
    }

    addComment(todo.id, newComment)
    setNewComment("")
    toast.success("Your comment has been added successfully.")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        addFile(todo.id, {
          name: file.name,
          url: reader.result as string,
          type: file.type,
          size: file.size,
          uploadedAt: new Date()
        })

        toast.success(`${file.name} has been added to the task`)
      }
    })

    e.target.value = ""
  }

  const handleAddSubTask = () => {
    if (!newSubTask.trim()) {
      toast.error("Subtask title is required")
      return
    }

    addSubTask(todo.id, newSubTask)
    setNewSubTask("")
    setIsAddingSubTask(false)
    toast.success("Your subtask has been added successfully.")
  }

  const handleSubTaskToggle = (subTaskId: string, completed: boolean) => {
    updateSubTask(todo.id, subTaskId, completed)
  }

  const handleRemoveSubTask = (subTaskId: string) => {
    removeSubTask(todo.id, subTaskId)
    toast.success("The subtask has been removed successfully.")
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " bytes"
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / 1048576).toFixed(1) + " MB"
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start justify-between pe-6">
            <SheetTitle>{todo.title}</SheetTitle>
            {onEditClick && (
              <Button variant="outline" onClick={() => onEditClick(todo.id)}>
                <Edit />
                Edit
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 capitalize">
            <Badge className={statusClasses[todo.status]}>{todo.status.replace("-", " ")}</Badge>
            <Badge className={priorityClasses[todo.priority]}>{todo.priority}</Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Description</h4>
            <p className="text-muted-foreground text-sm">
              {todo.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Assigned To</h4>
              <p className="text-muted-foreground text-sm">{todo.assignedTo || "Unassigned"}</p>
            </div>
            {todo.dueDate && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Due Date</h4>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(todo.dueDate), "PPP")}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Created</h4>
              <p className="text-muted-foreground text-sm">
                {format(new Date(todo.createdAt), "PPP")}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Subtasks</h4>
          {todo.subTasks && todo.subTasks.length > 0 ? (
            <div className="space-y-2">
              {todo.subTasks.map((subTask) => (
                <div
                  key={subTask.id}
                  className="bg-muted flex items-center justify-between rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={subTask.completed}
                      onCheckedChange={(checked) =>
                        handleSubTaskToggle(subTask.id, Boolean(checked))
                      }
                    />
                    <span
                      className={cn(
                        "text-sm",
                        subTask.completed && "text-muted-foreground line-through"
                      )}>
                      {subTask.title}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-red-400!"
                    size="sm"
                    onClick={() => handleRemoveSubTask(subTask.id)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No subtasks yet.
            </div>
          )}

          {!isAddingSubTask && (
            <div>
              <Button variant="outline" size="sm" onClick={() => setIsAddingSubTask(true)}>
                <PlusCircleIcon />
                <span>Add Sub Task</span>
              </Button>
            </div>
          )}

          {isAddingSubTask && (
            <div className="flex gap-2">
              <Input
                value={newSubTask}
                onChange={(e) => setNewSubTask(e.target.value)}
                placeholder="Enter subtask title"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddSubTask()
                  } else if (e.key === "Escape") {
                    setIsAddingSubTask(false)
                    setNewSubTask("")
                  }
                }}
              />
              <Button onClick={handleAddSubTask}>
                <Check />
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsAddingSubTask(false)
                  setNewSubTask("")
                }}>
                <X />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Attachments</h4>
            <div>
              <input
                type="file"
                id="file-upload"
                multiple
                className="sr-only"
                onChange={handleFileUpload}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <FilePlus />
                    Upload
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {todo.files && todo.files.length > 0 ? (
            <div className="space-y-2">
              {todo.files.map((file) => (
                <div
                  key={file.id}
                  className="bg-muted flex items-center justify-between rounded-md p-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <div className="overflow-hidden">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm hover:underline">
                        {file.name}
                      </a>
                      <span className="text-muted-foreground text-xs">
                        {formatFileSize(file.size)} •{" "}
                        {format(new Date(file.uploadedAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(todo.id, file.id)}
                    className="text-red-400!">
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No files attached.
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Comments ({todo.comments.length})</h4>

          {todo.comments.length === 0 && (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No comments yet.
            </div>
          )}

          <div className="space-y-2">
            {todo.comments.map((comment) => (
              <div key={comment.id} className="bg-muted group relative space-y-3 rounded-md p-3">
                <p className="text-sm">{comment.text}</p>
                <div className="text-muted-foreground flex justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="size-3" /> {format(new Date(comment.createdAt), "PPp")}
                  </div>
                  <div className="absolute end-2 bottom-2 flex items-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      onClick={() => deleteComment(todo.id, comment.id)}
                      className="text-red-400!"
                      size="sm">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Textarea
              placeholder="Write your comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button onClick={handleAddComment}>Add Comment</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default TodoDetailSheet
