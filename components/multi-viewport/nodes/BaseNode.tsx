import React, { useRef, useState, useCallback, useEffect, memo } from 'react'
import { cn } from '@/lib/utils'
import { GripVertical, X, Plus } from 'lucide-react'

const MIN_WIDTH = 200
const MIN_HEIGHT = 150

export interface BaseNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  isDarkMode: boolean
  // Title bar
  title: string
  icon?: React.ReactNode
  titleBarExtra?: React.ReactNode
  // Callbacks
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onRemove: () => void
  onFocus: () => void
  // Link handle
  showLinkHandle?: boolean
  onAddLinked?: (type: 'kanban' | 'todo' | 'notes') => void
  // Children
  children: React.ReactNode
}

export const BaseNode = memo(function BaseNode({
  id,
  x,
  y,
  width,
  height,
  zIndex,
  isDarkMode,
  title,
  icon,
  titleBarExtra,
  onMove,
  onResize,
  onRemove,
  onFocus,
  showLinkHandle,
  onAddLinked,
  children,
}: BaseNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showLinkDropdown) return
    const close = () => setShowLinkDropdown(false)
    const timer = setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', close)
    }
  }, [showLinkDropdown])

  // Smooth drag handler
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFocus()

    const startX = e.clientX
    const startY = e.clientY
    const startNodeX = x
    const startNodeY = y

    setIsDragging(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const newX = Math.max(0, startNodeX + deltaX)
      const newY = Math.max(0, startNodeY + deltaY)
      onMove(newX, newY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [x, y, onMove, onFocus])

  // Smooth resize handler
  const createResizeHandler = useCallback((
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFocus()

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = width
    const startHeight = height
    const startNodeX = x
    const startNodeY = y

    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight
      let newX = startNodeX
      let newY = startNodeY

      // East (right)
      if (direction.includes('e')) {
        newWidth = Math.max(MIN_WIDTH, startWidth + deltaX)
      }
      // West (left)
      if (direction.includes('w')) {
        const possibleWidth = startWidth - deltaX
        if (possibleWidth >= MIN_WIDTH) {
          newWidth = possibleWidth
          newX = startNodeX + deltaX
        }
      }
      // South (bottom)
      if (direction.includes('s')) {
        newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY)
      }
      // North (top)
      if (direction.includes('n')) {
        const possibleHeight = startHeight - deltaY
        if (possibleHeight >= MIN_HEIGHT) {
          newHeight = possibleHeight
          newY = startNodeY + deltaY
        }
      }

      onResize(newWidth, newHeight)
      if (newX !== startNodeX || newY !== startNodeY) {
        onMove(newX, newY)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    const cursors: Record<string, string> = {
      n: 'ns-resize', s: 'ns-resize',
      e: 'ew-resize', w: 'ew-resize',
      ne: 'nesw-resize', sw: 'nesw-resize',
      nw: 'nwse-resize', se: 'nwse-resize',
    }
    document.body.style.cursor = cursors[direction]
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [x, y, width, height, onMove, onResize, onFocus])

  return (
    <div
      ref={nodeRef}
      className={cn(
        "absolute flex flex-col rounded-lg shadow-lg transition-shadow",
        isDragging && "shadow-2xl",
        isResizing && "shadow-xl",
        isDarkMode
          ? "bg-neutral-800 border border-neutral-700"
          : "bg-white border border-stone-200"
      )}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width,
        height,
        zIndex,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
      onMouseDown={onFocus}
    >
      {/* Resize handles - invisible but hoverable */}
      {/* Edges */}
      <div onMouseDown={createResizeHandler('n')} className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize" />
      <div onMouseDown={createResizeHandler('s')} className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize" />
      <div onMouseDown={createResizeHandler('e')} className="absolute top-2 bottom-2 -right-1 w-2 cursor-ew-resize" />
      <div onMouseDown={createResizeHandler('w')} className="absolute top-2 bottom-2 -left-1 w-2 cursor-ew-resize" />
      {/* Corners */}
      <div onMouseDown={createResizeHandler('nw')} className="absolute -top-1 -left-1 w-3 h-3 cursor-nwse-resize" />
      <div onMouseDown={createResizeHandler('ne')} className="absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize" />
      <div onMouseDown={createResizeHandler('sw')} className="absolute -bottom-1 -left-1 w-3 h-3 cursor-nesw-resize" />
      <div onMouseDown={createResizeHandler('se')} className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize" />

      {/* Visual corner indicator */}
      <div
        onMouseDown={createResizeHandler('se')}
        className={cn(
          "absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize opacity-50 hover:opacity-100 transition-opacity",
          isDarkMode ? "text-neutral-500" : "text-stone-400"
        )}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full">
          <path d="M9 1v8H1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* Link handle */}
      {showLinkHandle && onAddLinked && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowLinkDropdown(!showLinkDropdown)
            }}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20",
              "w-5 h-5 rounded-full flex items-center justify-center transition-all border",
              isDarkMode
                ? "border-neutral-600 text-neutral-400 hover:border-neutral-400 hover:text-neutral-200 bg-neutral-800"
                : "border-stone-300 text-stone-400 hover:border-stone-500 hover:text-stone-600 bg-white"
            )}
          >
            <Plus size={12} />
          </button>
          {showLinkDropdown && (
            <div
              className={cn(
                "absolute rounded-lg shadow-xl border py-1 min-w-[100px]",
                isDarkMode ? "bg-neutral-800 border-neutral-700" : "bg-white border-stone-200"
              )}
              style={{ left: width + 12, top: '50%', transform: 'translateY(-50%)', zIndex: 9999 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(['todo', 'kanban', 'notes'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { onAddLinked(type); setShowLinkDropdown(false) }}
                  className={cn(
                    "w-full px-3 py-1.5 text-sm text-left transition-colors",
                    isDarkMode ? "text-neutral-200 hover:bg-neutral-700" : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Title bar */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-t-lg cursor-grab active:cursor-grabbing select-none",
          isDarkMode ? "bg-neutral-800 border-b border-neutral-700" : "bg-stone-50 border-b border-stone-200"
        )}
      >
        <GripVertical size={12} className={isDarkMode ? "text-neutral-500" : "text-stone-400"} />
        {icon}
        <span className={cn(
          "text-xs font-medium flex-1 truncate",
          isDarkMode ? "text-neutral-200" : "text-stone-700"
        )}>
          {title}
        </span>
        {titleBarExtra}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className={cn(
            "p-0.5 rounded transition-colors",
            isDarkMode
              ? "text-neutral-400 hover:text-red-400 hover:bg-neutral-700"
              : "text-stone-400 hover:text-red-500 hover:bg-stone-200"
          )}
        >
          <X size={12} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden rounded-b-lg">
        {children}
      </div>
    </div>
  )
}
