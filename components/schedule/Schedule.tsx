import * as React from "react"
import {
  LayoutGrid,
  ListTodo,
  Calendar as CalendarIcon,
  Plus,
  Search,
  SlidersHorizontal,
  GripVertical,
  Paperclip,
  MessageSquare,
  PlusCircle,
  CheckIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import * as Kanban from "@/components/ui/kanban"

// Import sub-components
import { EventCalendar } from "./calendar"
import { Tasks } from "./tasks"

export type ScheduleView = "kanban" | "tasks" | "calendar"

interface TaskUser {
  name: string
  src: string
  alt?: string
  fallback?: string
}

interface KanbanTask {
  id: string
  title: string
  description?: string
  priority: "low" | "medium" | "high"
  assignee?: string
  dueDate?: string
  progress: number
  attachments?: number
  comments?: number
  users: TaskUser[]
}

const DEFAULT_KANBAN_COLUMNS: Record<string, KanbanTask[]> = {
  backlog: [],
  inProgress: [],
  done: [],
}

export interface ScheduleProps {
  defaultView?: ScheduleView
  onViewChange?: (view: ScheduleView) => void
  className?: string
}

export function Schedule({
  defaultView = "kanban",
  onViewChange,
  className,
}: ScheduleProps) {
  const [view, setView] = React.useState<ScheduleView>(defaultView)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Kanban state
  const [columns, setColumns] = React.useState<Record<string, KanbanTask[]>>(DEFAULT_KANBAN_COLUMNS)

  const [columnTitles] = React.useState<Record<string, string>>({
    backlog: "Backlog",
    inProgress: "In Progress",
    done: "Done",
  })

  const [isNewColumnModalOpen, setIsNewColumnModalOpen] = React.useState(false)
  const [newColumnTitle, setNewColumnTitle] = React.useState("")

  const handleViewChange = (newView: ScheduleView) => {
    setView(newView)
    onViewChange?.(newView)
  }

  const addColumn = (title: string) => {
    const id = `col-${Date.now()}`
    setColumns((prev) => ({
      ...prev,
      [id]: [],
    }))
    setNewColumnTitle("")
    setIsNewColumnModalOpen(false)
  }

  const filteredColumns = React.useMemo(() => {
    if (!searchQuery.trim()) return columns

    const filtered: Record<string, KanbanTask[]> = {}
    Object.entries(columns).forEach(([key, tasks]) => {
      filtered[key] = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
    return filtered
  }, [columns, searchQuery])

  return (
    <TooltipProvider>
      <div className={cn("flex h-full flex-col", className)}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => handleViewChange(v as ScheduleView)}>
              <TabsList className="h-9">
                <TabsTrigger value="kanban" className="gap-1.5">
                  <LayoutGrid className="size-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5">
                  <ListTodo className="size-4" />
                  <span className="hidden sm:inline">Tasks</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <CalendarIcon className="size-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-[200px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>High Priority</DropdownMenuItem>
                <DropdownMenuItem>Medium Priority</DropdownMenuItem>
                <DropdownMenuItem>Low Priority</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Due Today</DropdownMenuItem>
                <DropdownMenuItem>Overdue</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add New */}
            {view === "kanban" && (
              <Dialog open={isNewColumnModalOpen} onOpenChange={setIsNewColumnModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4 mr-1" />
                    <span className="hidden sm:inline">Add Column</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Column</DialogTitle>
                  </DialogHeader>
                  <div className="mt-4 flex gap-2">
                    <Input
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Enter column name..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newColumnTitle.trim()) {
                          addColumn(newColumnTitle.trim())
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!newColumnTitle.trim()}
                      onClick={() => addColumn(newColumnTitle.trim())}
                    >
                      <CheckIcon className="size-4" />
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === "kanban" && (
            <div className="h-full overflow-x-auto p-4">
              <Kanban.Kanban
                value={filteredColumns}
                onValueChange={setColumns}
                getItemValue={(item) => item.id}
              >
                <Kanban.KanbanBoard className="flex gap-4 pb-4">
                  {Object.entries(filteredColumns).map(([columnValue, tasks]) => (
                    <Kanban.KanbanColumn
                      key={columnValue}
                      value={columnValue}
                      className="w-[320px] min-w-[320px] shrink-0"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {columnTitles[columnValue] || columnValue}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {tasks.length}
                          </Badge>
                        </div>
                        <div className="flex">
                          <Kanban.KanbanColumnHandle asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <GripVertical className="size-4" />
                            </Button>
                          </Kanban.KanbanColumnHandle>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <PlusCircle className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add Task</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {tasks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {tasks.map((task) => (
                            <Kanban.KanbanItem key={task.id} value={task.id} asHandle asChild>
                              <Card className="cursor-grab active:cursor-grabbing border-0 shadow-sm">
                                <CardHeader className="p-3 pb-2">
                                  <CardTitle className="text-sm font-medium line-clamp-2">
                                    {task.title}
                                  </CardTitle>
                                  {task.description && (
                                    <CardDescription className="text-xs line-clamp-2">
                                      {task.description}
                                    </CardDescription>
                                  )}
                                </CardHeader>
                                <CardContent className="p-3 pt-0 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex -space-x-1.5">
                                      {task.users.slice(0, 3).map((user, index) => (
                                        <Avatar
                                          key={index}
                                          className="size-6 border-2 border-background"
                                        >
                                          {user.src && (
                                            <AvatarImage src={user.src} alt={user.alt} />
                                          )}
                                          <AvatarFallback className="text-[10px]">
                                            {user.fallback}
                                          </AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {task.users.length > 3 && (
                                        <Avatar className="size-6 border-2 border-background">
                                          <AvatarFallback className="text-[10px]">
                                            +{task.users.length - 3}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Progress value={task.progress} className="w-12 h-1.5" />
                                      <span>{task.progress}%</span>
                                    </div>
                                  </div>

                                  <Separator />

                                  <div className="flex items-center justify-between">
                                    <Badge
                                      variant={
                                        task.priority === "high"
                                          ? "destructive"
                                          : task.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-[10px] capitalize"
                                    >
                                      {task.priority}
                                    </Badge>
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                      {task.attachments ? (
                                        <div className="flex items-center gap-1 text-xs">
                                          <Paperclip className="size-3" />
                                          <span>{task.attachments}</span>
                                        </div>
                                      ) : null}
                                      {task.comments ? (
                                        <div className="flex items-center gap-1 text-xs">
                                          <MessageSquare className="size-3" />
                                          <span>{task.comments}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Kanban.KanbanItem>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                          <p className="text-sm text-muted-foreground">No tasks yet</p>
                          <Button variant="outline" size="sm">
                            <Plus className="size-4 mr-1" />
                            Add Task
                          </Button>
                        </div>
                      )}
                    </Kanban.KanbanColumn>
                  ))}
                </Kanban.KanbanBoard>
                <Kanban.KanbanOverlay>
                  <div className="bg-primary/10 size-full rounded-md" />
                </Kanban.KanbanOverlay>
              </Kanban.Kanban>
            </div>
          )}

          {view === "tasks" && (
            <div className="h-full overflow-auto">
              <Tasks />
            </div>
          )}

          {view === "calendar" && (
            <div className="h-full overflow-auto p-4">
              <EventCalendar />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default Schedule
