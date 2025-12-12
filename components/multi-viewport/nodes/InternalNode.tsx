import React from 'react'
import { cn } from '@/lib/utils'
import { KanbanSquare, ListTodo, StickyNote } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { WindowType } from '../types'

const WINDOW_CONFIG: Record<Exclude<WindowType, 'device'>, {
  name: string
  icon: typeof KanbanSquare
  defaultWidth: number
  defaultHeight: number
}> = {
  kanban: { name: 'Kanban', icon: KanbanSquare, defaultWidth: 600, defaultHeight: 400 },
  todo: { name: 'Todo', icon: ListTodo, defaultWidth: 350, defaultHeight: 450 },
  notes: { name: 'Notes', icon: StickyNote, defaultWidth: 350, defaultHeight: 400 },
}

export function getInternalWindowConfig(type: Exclude<WindowType, 'device'>) {
  return WINDOW_CONFIG[type]
}

export interface InternalNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  windowType: Exclude<WindowType, 'device'>
  linkedViewportName?: string
  isDarkMode: boolean
  // Callbacks
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onRemove: () => void
  onFocus: () => void
  // Render content
  children: React.ReactNode
}

export function InternalNode({
  id,
  x,
  y,
  width,
  height,
  zIndex,
  windowType,
  linkedViewportName,
  isDarkMode,
  onMove,
  onResize,
  onRemove,
  onFocus,
  children,
}: InternalNodeProps) {
  const config = WINDOW_CONFIG[windowType]
  const Icon = config.icon

  // Title bar extras - linked viewport indicator
  const titleBarExtra = linkedViewportName ? (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
      isDarkMode ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-600"
    )}>
      <span className="opacity-60">→</span>
      {linkedViewportName}
    </span>
  ) : null

  return (
    <BaseNode
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      zIndex={zIndex}
      isDarkMode={isDarkMode}
      title={config.name}
      icon={<Icon size={12} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />}
      titleBarExtra={titleBarExtra}
      onMove={onMove}
      onResize={onResize}
      onRemove={onRemove}
      onFocus={onFocus}
    >
      <div className={cn(
        "w-full h-full overflow-auto",
        isDarkMode ? "bg-neutral-900" : "bg-white"
      )}>
        {children}
      </div>
    </BaseNode>
  )
}
