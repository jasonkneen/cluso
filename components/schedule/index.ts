// Main Schedule component with Kanban/Tasks/Calendar views
export { Schedule } from "./Schedule"
export type { ScheduleProps, ScheduleView } from "./Schedule"

// Individual view components
export { EventCalendar } from "./calendar"
export { Tasks } from "./tasks"
export { NotesTab } from "./notes"

// Re-export types
export type { CalendarEvent, EventFormData, RecurrencePattern } from "./calendar/types"
export type { Todo, TodoFormValues } from "./tasks/types"
export type { NotesTabProps } from "./notes"
