import React, { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Trash2, GripVertical, KanbanSquare, ListTodo, StickyNote } from 'lucide-react'
import { Viewport, WindowType } from './types'

// Grid snap size in pixels
const GRID_SNAP_SIZE = 50
const MIN_WIDTH = 300
const MIN_HEIGHT = 200

// Snap value to nearest grid point with bounds
function snapToGrid(value: number, min: number, max: number): number {
  const snapped = Math.round(value / GRID_SNAP_SIZE) * GRID_SNAP_SIZE
  return Math.max(min, Math.min(max, snapped))
}

// Window type config
const WINDOW_CONFIG: Record<WindowType, { name: string; icon: typeof KanbanSquare; defaultWidth: number; defaultHeight: number }> = {
  device: { name: 'Device', icon: GripVertical, defaultWidth: 400, defaultHeight: 300 },
  kanban: { name: 'Kanban', icon: KanbanSquare, defaultWidth: 600, defaultHeight: 400 },
  todo: { name: 'Todo', icon: ListTodo, defaultWidth: 400, defaultHeight: 500 },
  notes: { name: 'Notes', icon: StickyNote, defaultWidth: 400, defaultHeight: 400 },
}

export function getWindowConfig(type: WindowType) {
  return WINDOW_CONFIG[type]
}

// Edge resize handles with snap-to-grid
function ResizeHandles({
  onResize,
  isDarkMode,
  currentWidth,
  currentHeight,
  cardRef,
}: {
  onResize: (width: number, height: number) => void
  isDarkMode: boolean
  currentWidth: number
  currentHeight: number
  cardRef: React.RefObject<HTMLDivElement | null>
}) {
  const createDragHandler = (
    axis: 'x' | 'y' | 'xy',
    cursor: string
  ) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = currentWidth
    const startHeight = currentHeight

    const container = cardRef.current?.parentElement?.parentElement?.parentElement
    const containerRect = container?.getBoundingClientRect()
    const maxWidth = containerRect ? containerRect.width - 32 : 1200
    const maxHeight = containerRect ? containerRect.height - 100 : 800

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()

      const deltaX = axis === 'y' ? 0 : moveEvent.clientX - startX
      const deltaY = axis === 'x' ? 0 : moveEvent.clientY - startY

      const newWidth = snapToGrid(startWidth + deltaX, MIN_WIDTH, maxWidth)
      const newHeight = snapToGrid(startHeight + deltaY, MIN_HEIGHT, maxHeight)

      onResize(newWidth, newHeight)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <>
      {/* Right edge handle */}
      <div
        onMouseDown={createDragHandler('x', 'ew-resize')}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-0 w-2 h-16 cursor-ew-resize rounded-l-md transition-opacity opacity-0 hover:opacity-100 z-10",
          isDarkMode ? "bg-blue-500/50" : "bg-blue-400/50"
        )}
        title="Drag to resize width"
      />

      {/* Bottom edge handle */}
      <div
        onMouseDown={createDragHandler('y', 'ns-resize')}
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-16 cursor-ns-resize rounded-t-md transition-opacity opacity-0 hover:opacity-100 z-10",
          isDarkMode ? "bg-blue-500/50" : "bg-blue-400/50"
        )}
        title="Drag to resize height"
      />

      {/* Corner handle */}
      <div
        onMouseDown={createDragHandler('xy', 'nwse-resize')}
        className={cn(
          "absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 transition-colors",
          isDarkMode
            ? "bg-neutral-700 hover:bg-blue-500/50"
            : "bg-stone-300 hover:bg-blue-400/50"
        )}
        title="Drag to resize"
      >
        <svg className="w-full h-full p-0.5" viewBox="0 0 10 10" fill="currentColor" opacity={0.5}>
          <path d="M9 1v8H1" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>
    </>
  )
}

export interface InternalWindowItemProps {
  viewport: Viewport
  isDarkMode: boolean
  onRemove: () => void
  onResize?: (width: number, height: number) => void
  dragHandleProps?: Record<string, unknown>
  // Content render props
  renderKanban?: () => React.ReactNode
  renderTodo?: () => React.ReactNode
  renderNotes?: () => React.ReactNode
}

export function InternalWindowItem({
  viewport,
  isDarkMode,
  onRemove,
  onResize,
  dragHandleProps,
  renderKanban,
  renderTodo,
  renderNotes,
}: InternalWindowItemProps) {
  const config = WINDOW_CONFIG[viewport.windowType]
  const Icon = config.icon

  const cardRef = useRef<HTMLDivElement>(null)
  const [localSize, setLocalSize] = useState<{ width: number; height: number }>({
    width: snapToGrid(viewport.displayWidth || config.defaultWidth, MIN_WIDTH, 2000),
    height: snapToGrid(viewport.displayHeight || config.defaultHeight, MIN_HEIGHT, 1200),
  })

  const handleResize = useCallback((width: number, height: number) => {
    setLocalSize({ width, height })
    onResize?.(width, height)
  }, [onResize])

  // Render content based on window type
  const renderContent = () => {
    switch (viewport.windowType) {
      case 'kanban':
        return renderKanban ? renderKanban() : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Kanban content
          </div>
        )
      case 'todo':
        return renderTodo ? renderTodo() : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Todo content
          </div>
        )
      case 'notes':
        return renderNotes ? renderNotes() : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Notes content
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col rounded-xl overflow-hidden border transition-shadow hover:shadow-lg relative",
        isDarkMode
          ? "bg-neutral-800 border-neutral-700"
          : "bg-white border-stone-200"
      )}
      style={{
        width: localSize.width,
        height: localSize.height,
        flexShrink: 0,
        flexGrow: 0,
        contain: 'layout style paint',
        isolation: 'isolate',
      }}
    >
      {/* Resize handles */}
      <ResizeHandles
        onResize={handleResize}
        isDarkMode={isDarkMode}
        currentWidth={localSize.width}
        currentHeight={localSize.height}
        cardRef={cardRef}
      />

      {/* Card header - compact */}
      <div className={cn(
        "flex items-center justify-between px-2 py-1 border-b",
        isDarkMode ? "bg-neutral-800 border-neutral-700" : "bg-stone-50 border-stone-200"
      )}>
        <div
          {...dragHandleProps}
          className={cn(
            "flex items-center gap-1.5 cursor-grab active:cursor-grabbing",
            isDarkMode ? "hover:bg-neutral-700/50" : "hover:bg-stone-200/50"
          )}
        >
          <GripVertical size={12} className={isDarkMode ? "text-neutral-500" : "text-stone-400"} />
          <Icon size={12} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />
          <span className={cn(
            "text-xs font-medium",
            isDarkMode ? "text-neutral-200" : "text-stone-700"
          )}>
            {config.name}
          </span>
          <span className={cn(
            "text-[10px] px-1 py-0.5 rounded",
            isDarkMode ? "bg-neutral-700 text-neutral-400" : "bg-stone-200 text-stone-500"
          )}>
            {localSize.width}x{localSize.height}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Remove button */}
          <button
            onClick={onRemove}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-red-400 hover:bg-neutral-700"
                : "text-stone-400 hover:text-red-500 hover:bg-stone-200"
            )}
            title="Remove window"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Window content */}
      <div className={cn(
        "flex-1 overflow-auto",
        isDarkMode ? "bg-neutral-900" : "bg-white"
      )}>
        {renderContent()}
      </div>
    </div>
  )
}
