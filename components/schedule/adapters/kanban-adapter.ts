/**
 * Adapter functions to convert between existing Kanban data model
 * and the new shadcn Kanban component data model
 */

import type {
  ExistingKanbanColumn,
  ExistingKanbanCard,
  ExistingKanbanData,
  NewKanbanTask,
} from "./types"

/**
 * Convert existing KanbanCard to new KanbanTask format
 */
export function cardToTask(card: ExistingKanbanCard): NewKanbanTask {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    priority: "medium", // Default since existing model doesn't have priority
    dueDate: card.dueDate,
    progress: 0, // Default since existing model doesn't track progress
    users: [], // No user data in existing model
    attachments: undefined,
    comments: undefined,
  }
}

/**
 * Convert new KanbanTask back to existing KanbanCard format
 */
export function taskToCard(task: NewKanbanTask): ExistingKanbanCard {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    createdAt: new Date().toISOString(),
    labels: task.priority ? [task.priority] : undefined,
  }
}

/**
 * Convert existing columns to new format (Record<string, Task[]>)
 */
export function columnsToRecord(
  columns: ExistingKanbanColumn[]
): Record<string, NewKanbanTask[]> {
  const result: Record<string, NewKanbanTask[]> = {}

  for (const column of columns) {
    result[column.id] = column.cards.map(cardToTask)
  }

  return result
}

/**
 * Convert new format back to existing columns
 */
export function recordToColumns(
  record: Record<string, NewKanbanTask[]>,
  columnTitles: Record<string, string>
): ExistingKanbanColumn[] {
  return Object.entries(record).map(([id, tasks]) => ({
    id,
    title: columnTitles[id] || id,
    cards: tasks.map(taskToCard),
  }))
}

/**
 * Full adapter: Convert ExistingKanbanData to new component props
 */
export function adaptKanbanDataForComponent(data: ExistingKanbanData): {
  columns: Record<string, NewKanbanTask[]>
  columnTitles: Record<string, string>
  boardTitle: string
} {
  const columnTitles: Record<string, string> = {}

  for (const column of data.columns) {
    columnTitles[column.id] = column.title
  }

  return {
    columns: columnsToRecord(data.columns),
    columnTitles,
    boardTitle: data.boardTitle,
  }
}

/**
 * Full adapter: Convert new component state back to ExistingKanbanData
 */
export function adaptComponentDataForStorage(
  columns: Record<string, NewKanbanTask[]>,
  columnTitles: Record<string, string>,
  boardId: string,
  boardTitle: string
): ExistingKanbanData {
  return {
    boardId,
    boardTitle,
    columns: recordToColumns(columns, columnTitles),
  }
}
