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
  // For chromeless mode - separate size label and toolbar controls
  sizeLabel?: string
  toolbarControls?: React.ReactNode
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
  // Chromeless mode - no title bar, floating toolbar on hover
  chromeless?: boolean
  // Canvas scale - used to keep toolbar fixed size in chromeless mode
  canvasScale?: number
  // Lock aspect ratio during resize (width/height)
  lockedAspectRatio?: number
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
  sizeLabel,
  toolbarControls,
  onMove,
  onResize,
  onRemove,
  onFocus,
  showLinkHandle,
  onAddLinked,
  children,
  chromeless = false,
  canvasScale = 1,
  lockedAspectRatio,
}: BaseNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle hover with delay for hiding (so toolbar doesn't disappear too fast)
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    // Don't hide toolbar while dragging
    if (isDragging) return
    // Delay hiding the toolbar so user can move to it
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 300) // 300ms delay before hiding
  }, [isDragging])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

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

  // Smooth drag handler - accounts for canvas scale
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFocus()

    const startX = e.clientX
    const startY = e.clientY
    const startNodeX = x
    const startNodeY = y
    const scale = canvasScale

    setIsDragging(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Divide by scale to account for canvas zoom
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      const newX = startNodeX + deltaX
      const newY = startNodeY + deltaY
      onMove(newX, newY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Also cleanup if mouse leaves the document (prevents sticky)
    document.addEventListener('mouseleave', handleMouseUp)
  }, [x, y, onMove, onFocus, canvasScale])

  // Smooth resize handler - accounts for canvas scale
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
    const scale = canvasScale

    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Divide by scale to account for canvas zoom
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale

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

      // Apply aspect ratio lock if set
      if (lockedAspectRatio) {
        const isCorner = direction.length === 2
        const isHorizontal = direction === 'e' || direction === 'w'
        const isVertical = direction === 'n' || direction === 's'

        if (isCorner) {
          // For corners, use the larger delta to determine size
          const widthChange = Math.abs(newWidth - startWidth)
          const heightChange = Math.abs(newHeight - startHeight)

          if (widthChange > heightChange) {
            newHeight = Math.max(MIN_HEIGHT, newWidth / lockedAspectRatio)
          } else {
            newWidth = Math.max(MIN_WIDTH, newHeight * lockedAspectRatio)
          }
        } else if (isHorizontal) {
          // Width changed, adjust height
          newHeight = Math.max(MIN_HEIGHT, newWidth / lockedAspectRatio)
        } else if (isVertical) {
          // Height changed, adjust width
          newWidth = Math.max(MIN_WIDTH, newHeight * lockedAspectRatio)
        }

        // Recalculate position for north/west edges with aspect lock
        if (direction.includes('n')) {
          newY = startNodeY + (startHeight - newHeight)
        }
        if (direction.includes('w')) {
          newX = startNodeX + (startWidth - newWidth)
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
      document.removeEventListener('mouseleave', handleMouseUp)
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
    // Also cleanup if mouse leaves the document (prevents sticky)
    document.addEventListener('mouseleave', handleMouseUp)
  }, [x, y, width, height, onMove, onResize, onFocus, lockedAspectRatio, canvasScale])

  // Resize handles (used in both modes)
  const resizeHandles = (
    <>
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
    </>
  )

  // Visual corner indicator (used in both modes)
  const cornerIndicator = (
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
  )

  // Link handle (used in both modes)
  const linkHandle = showLinkHandle && onAddLinked && (
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
  )

  // Chromeless mode - no title bar, floating toolbar on hover
  if (chromeless) {
    return (
      <div
        ref={nodeRef}
        className={cn(
          "absolute flex flex-col rounded-xl transition-shadow",
          isDragging && "shadow-2xl",
          isResizing && "shadow-xl",
          isHovered && "shadow-md ring-2",
          isDarkMode
            ? isHovered ? "ring-neutral-500" : "ring-1 ring-neutral-700"
            : isHovered ? "ring-stone-400" : "ring-1 ring-stone-300"
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {resizeHandles}
        {cornerIndicator}
        {linkHandle}

        {/* Name label - top left above node (always visible) */}
        <div
          className="absolute flex items-center gap-1.5 pointer-events-none"
          style={{
            zIndex: zIndex + 1,
            transform: `translateY(calc(-100% - ${4 / canvasScale}px)) scale(${1 / canvasScale})`,
            transformOrigin: 'bottom left',
            top: 0,
            left: 0,
          }}
        >
          {icon}
          <span className={cn(
            "text-[11px] font-medium",
            isDarkMode ? "text-neutral-400" : "text-stone-500"
          )}>
            {title}
          </span>
        </div>

        {/* Size label - top right above node (always visible) */}
        {sizeLabel && (
          <div
            className="absolute pointer-events-none"
            style={{
              zIndex: zIndex + 1,
              transform: `translateY(calc(-100% - ${4 / canvasScale}px)) scale(${1 / canvasScale})`,
              transformOrigin: 'bottom right',
              top: 0,
              right: 0,
            }}
          >
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              isDarkMode ? "bg-neutral-700/80 text-neutral-400" : "bg-stone-200/80 text-stone-500"
            )}>
              {sizeLabel}
            </span>
          </div>
        )}

        {/* Floating toolbar - centered above node, just controls */}
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "absolute left-1/2 flex items-center gap-1 px-2 py-1 rounded-full transition-all pointer-events-auto",
            "shadow-lg border",
            isDarkMode
              ? "bg-neutral-800/95 border-neutral-600 backdrop-blur-sm"
              : "bg-white/95 border-stone-300 backdrop-blur-sm",
            isHovered || isDragging
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          )}
          style={{
            zIndex: zIndex + 1,
            transform: `translateX(-50%) translateY(calc(-100% - ${4 / canvasScale}px)) scale(${1 / canvasScale})`,
            transformOrigin: 'bottom center',
            top: 0,
          }}
        >
          {/* Drag handle */}
          <div
            onMouseDown={handleDragStart}
            className="cursor-grab active:cursor-grabbing p-0.5"
          >
            <GripVertical size={10} className={isDarkMode ? "text-neutral-500" : "text-stone-400"} />
          </div>
          {toolbarControls}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className={cn(
              "p-0.5 rounded-full transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-red-400 hover:bg-neutral-700"
                : "text-stone-400 hover:text-red-500 hover:bg-stone-200"
            )}
          >
            <X size={10} />
          </button>
        </div>

        {/* Content area - full height, edge-to-edge in chromeless mode */}
        <div className="flex-1 overflow-hidden rounded-xl">
          {children}
        </div>
      </div>
    )
  }

  // Standard mode with title bar
  return (
    <div
      ref={nodeRef}
      className={cn(
        "absolute flex flex-col rounded-xl shadow-lg transition-shadow",
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
      {resizeHandles}
      {cornerIndicator}
      {linkHandle}

      {/* Title bar */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-t-xl cursor-grab active:cursor-grabbing select-none",
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
      <div className="flex-1 overflow-hidden rounded-b-xl">
        {children}
      </div>
    </div>
  )
})
