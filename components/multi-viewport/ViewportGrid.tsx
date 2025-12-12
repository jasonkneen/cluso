import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Plus, Smartphone, Tablet, Monitor, LayoutGrid, X } from 'lucide-react'
import { ViewportItem, ViewportPerformanceWarning } from './ViewportItem'
import { Viewport, DevicePreset, DEVICE_PRESETS, getPresetById, getPresetsByType } from './types'

// Grid snap size
const GRID_SNAP = 50

interface ViewportGridProps {
  url: string
  isDarkMode: boolean
  isElectron: boolean
  webviewPreloadPath?: string
  // Inspector props
  isInspectorActive?: boolean
  isScreenshotActive?: boolean
  isMoveActive?: boolean
  onInspectorHover?: (element: unknown, rect: unknown, viewportId: string) => void
  onInspectorSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onScreenshotSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onConsoleLog?: (level: string, message: string, viewportId: string) => void
  onClose?: () => void
}

const STORAGE_KEY = 'cluso-multi-viewport-config'

// Snap to grid
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}

// Load viewports from localStorage
function loadViewports(): Viewport[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((v: Viewport, i: number) => ({
          ...v,
          displayWidth: v.displayWidth || 400,
          displayHeight: v.displayHeight || 250,
          x: v.x ?? (i % 3) * 420,
          y: v.y ?? Math.floor(i / 3) * 280,
        }))
      }
    }
  } catch (e) {
    console.error('[ViewportGrid] Failed to load viewports from localStorage:', e)
  }
  // Default viewport
  return [{ id: crypto.randomUUID(), devicePresetId: 'desktop', orientation: 'landscape', displayWidth: 600, displayHeight: 300, x: 0, y: 0 }]
}

// Save viewports to localStorage
function saveViewports(viewports: Viewport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(viewports))
  } catch (e) {
    console.error('[ViewportGrid] Failed to save viewports to localStorage:', e)
  }
}

// Draggable wrapper for viewport items - free positioning
function DraggableViewportItem({
  viewport,
  preset,
  url,
  isDarkMode,
  isElectron,
  webviewPreloadPath,
  isPrimary,
  onSetPrimary,
  onNavigate,
  isInspectorActive,
  isScreenshotActive,
  isMoveActive,
  onInspectorHover,
  onInspectorSelect,
  onScreenshotSelect,
  onConsoleLog,
  onExpand,
  onRemove,
  onOrientationToggle,
  onResize,
}: {
  viewport: Viewport
  preset: DevicePreset
  url: string
  isDarkMode: boolean
  isElectron: boolean
  webviewPreloadPath?: string
  isPrimary?: boolean
  onSetPrimary?: () => void
  onNavigate?: (url: string) => void
  isInspectorActive?: boolean
  isScreenshotActive?: boolean
  isMoveActive?: boolean
  onInspectorHover?: (element: unknown, rect: unknown, viewportId: string) => void
  onInspectorSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onScreenshotSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onConsoleLog?: (level: string, message: string, viewportId: string) => void
  onExpand: () => void
  onRemove: () => void
  onOrientationToggle: () => void
  onResize: (width: number, height: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: viewport.id })

  // Absolute position + drag offset
  const style: React.CSSProperties = {
    position: 'absolute',
    left: viewport.x ?? 0,
    top: viewport.y ?? 0,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <ViewportItem
        viewport={viewport}
        preset={preset}
        url={url}
        isDarkMode={isDarkMode}
        isElectron={isElectron}
        webviewPreloadPath={webviewPreloadPath}
        isExpanded={false}
        isPrimary={isPrimary}
        onSetPrimary={onSetPrimary}
        onNavigate={onNavigate}
        isInspectorActive={isInspectorActive}
        isScreenshotActive={isScreenshotActive}
        isMoveActive={isMoveActive}
        onInspectorHover={onInspectorHover}
        onInspectorSelect={onInspectorSelect}
        onScreenshotSelect={onScreenshotSelect}
        onConsoleLog={onConsoleLog}
        onExpand={onExpand}
        onCollapse={() => {}}
        onRemove={onRemove}
        onOrientationToggle={onOrientationToggle}
        onResize={onResize}
        dragHandleProps={listeners}
      />
    </div>
  )
}

export function ViewportGrid({
  url,
  isDarkMode,
  isElectron,
  webviewPreloadPath,
  isInspectorActive,
  isScreenshotActive,
  isMoveActive,
  onInspectorHover,
  onInspectorSelect,
  onScreenshotSelect,
  onConsoleLog,
  onClose,
}: ViewportGridProps) {
  // State - load from localStorage on init
  const [viewports, setViewports] = useState<Viewport[]>(loadViewports)
  const [expandedViewportId, setExpandedViewportId] = useState<string | null>(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [performanceWarningDismissed, setPerformanceWarningDismissed] = useState(false)
  const isInitialMount = useRef(true)

  // Primary viewport for synced navigation
  const [primaryViewportId, setPrimaryViewportId] = useState<string | null>(null)
  const [syncedUrl, setSyncedUrl] = useState<string>(url)

  // Keep syncedUrl in sync with parent url prop when it changes
  useEffect(() => {
    setSyncedUrl(url)
  }, [url])

  // Handle primary viewport navigation - sync to all others
  const handlePrimaryNavigate = useCallback((newUrl: string) => {
    console.log('[ViewportGrid] Primary navigated to:', newUrl)
    setSyncedUrl(newUrl)
  }, [])

  // Set or unset primary viewport
  const handleSetPrimary = useCallback((viewportId: string) => {
    setPrimaryViewportId(prev => prev === viewportId ? null : viewportId)
  }, [])

  // Save viewports to localStorage when they change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    saveViewports(viewports)
  }, [viewports])

  // DnD sensors - pointer only for free positioning
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ESC key handler for collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedViewportId) {
        setExpandedViewportId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedViewportId])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setIsAddMenuOpen(false)
    if (isAddMenuOpen) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  }, [isAddMenuOpen])

  // Smart device selection - pick a device not already on canvas
  const getNextDevice = useCallback((type: 'mobile' | 'tablet' | 'desktop'): { presetId: string; orientation: 'portrait' | 'landscape' } => {
    const devicesOfType = getPresetsByType(type)
    const existingCombos = new Set(
      viewports
        .filter(v => getPresetById(v.devicePresetId)?.type === type)
        .map(v => `${v.devicePresetId}-${v.orientation}`)
    )

    // Try to find a device+orientation combo not already used
    for (const preset of devicesOfType) {
      // Try portrait first (except desktop which prefers landscape)
      const firstOrientation = type === 'desktop' ? 'landscape' : 'portrait'
      const secondOrientation = type === 'desktop' ? 'portrait' : 'landscape'

      if (!existingCombos.has(`${preset.id}-${firstOrientation}`)) {
        return { presetId: preset.id, orientation: firstOrientation }
      }
      if (!existingCombos.has(`${preset.id}-${secondOrientation}`)) {
        return { presetId: preset.id, orientation: secondOrientation }
      }
    }

    // All combos used, just pick first device with alternating orientation
    const firstPreset = devicesOfType[0]
    const sameDeviceCount = viewports.filter(v => v.devicePresetId === firstPreset.id).length
    const orientation = type === 'desktop'
      ? (sameDeviceCount % 2 === 0 ? 'landscape' : 'portrait')
      : (sameDeviceCount % 2 === 0 ? 'portrait' : 'landscape')

    return { presetId: firstPreset.id, orientation }
  }, [viewports])

  // Calculate next available position for new viewport
  const getNextPosition = useCallback(() => {
    if (viewports.length === 0) return { x: 0, y: 0 }

    // Find rightmost edge of existing viewports
    let maxRight = 0
    let maxBottom = 0
    viewports.forEach(v => {
      const right = (v.x ?? 0) + (v.displayWidth ?? 400)
      const bottom = (v.y ?? 0) + (v.displayHeight ?? 250)
      if (right > maxRight) maxRight = right
      if (bottom > maxBottom) maxBottom = bottom
    })

    // Place to the right with gap, or wrap to next row
    const gap = GRID_SNAP
    const newX = snapToGrid(maxRight + gap)

    // If too far right (> 1200px), wrap to next row
    if (newX > 1200) {
      return { x: 0, y: snapToGrid(maxBottom + gap) }
    }
    return { x: newX, y: 0 }
  }, [viewports])

  // Viewport actions
  const addViewport = useCallback((presetId: string, orientation?: 'portrait' | 'landscape') => {
    const preset = getPresetById(presetId)
    if (!preset) return

    // Default sizes based on device type
    const defaultWidth = preset.type === 'desktop' ? 600 : preset.type === 'tablet' ? 450 : 300
    const defaultHeight = 250
    const { x, y } = getNextPosition()

    setViewports(prev => [...prev, {
      id: crypto.randomUUID(),
      devicePresetId: presetId,
      orientation: orientation ?? (preset.type === 'desktop' ? 'landscape' : 'portrait'),
      displayWidth: defaultWidth,
      displayHeight: defaultHeight,
      x,
      y,
    }])
    setIsAddMenuOpen(false)
  }, [getNextPosition])

  // Smart add - picks next device not on canvas
  const addSmartViewport = useCallback((type: 'mobile' | 'tablet' | 'desktop') => {
    const { presetId, orientation } = getNextDevice(type)
    addViewport(presetId, orientation)
  }, [getNextDevice, addViewport])

  const removeViewport = useCallback((id: string) => {
    setViewports(prev => prev.filter(v => v.id !== id))
    if (expandedViewportId === id) {
      setExpandedViewportId(null)
    }
  }, [expandedViewportId])

  const toggleOrientation = useCallback((id: string) => {
    setViewports(prev => prev.map(v =>
      v.id === id
        ? { ...v, orientation: v.orientation === 'portrait' ? 'landscape' : 'portrait' }
        : v
    ))
  }, [])

  const updateViewportSize = useCallback((id: string, width: number, height: number) => {
    setViewports(prev => prev.map(v =>
      v.id === id
        ? { ...v, displayWidth: width, displayHeight: height }
        : v
    ))
  }, [])

  // Drag end handler - update position with grid snap
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    if (!delta) return

    setViewports(prev => prev.map(v => {
      if (v.id === active.id) {
        const newX = snapToGrid(Math.max(0, (v.x ?? 0) + delta.x))
        const newY = snapToGrid(Math.max(0, (v.y ?? 0) + delta.y))
        return { ...v, x: newX, y: newY }
      }
      return v
    }))
  }, [])

  // Get preset for a viewport
  const getViewportPreset = (viewport: Viewport): DevicePreset => {
    return getPresetById(viewport.devicePresetId) || DEVICE_PRESETS[0]
  }

  // Find expanded viewport if any
  const expandedViewport = expandedViewportId ? viewports.find(v => v.id === expandedViewportId) : null

  return (
    <div className={cn(
      "h-full flex flex-col relative",
      isDarkMode ? "bg-neutral-900" : "bg-stone-100"
    )}>
      {/* Floating toolbar - top right */}
      <div className={cn(
        "absolute top-2 right-2 z-40 flex items-center gap-1 px-1.5 py-1 rounded-lg shadow-lg border",
        isDarkMode ? "bg-neutral-800/95 border-neutral-700" : "bg-white/95 border-stone-200"
      )}>
        <LayoutGrid size={10} className={isDarkMode ? "text-neutral-500" : "text-stone-400"} />
        <span className={cn(
          "text-[10px] px-1 rounded",
          isDarkMode ? "bg-neutral-700 text-neutral-400" : "bg-stone-200 text-stone-500"
        )}>
          {viewports.length}
        </span>

        <div className="w-px h-3 mx-0.5 bg-neutral-600" />

        {/* Quick add buttons */}
        <button
          onClick={() => addSmartViewport('desktop')}
          className={cn(
            "p-1 rounded transition-colors",
            isDarkMode
              ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
          )}
          title="Add Desktop"
        >
          <Monitor size={11} />
        </button>
        <button
          onClick={() => addSmartViewport('tablet')}
          className={cn(
            "p-1 rounded transition-colors",
            isDarkMode
              ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
          )}
          title="Add Tablet"
        >
          <Tablet size={11} />
        </button>
        <button
          onClick={() => addSmartViewport('mobile')}
          className={cn(
            "p-1 rounded transition-colors",
            isDarkMode
              ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
          )}
          title="Add Mobile"
        >
          <Smartphone size={11} />
        </button>

        {/* Add dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsAddMenuOpen(!isAddMenuOpen)
            }}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
            )}
            title="More devices"
          >
            <Plus size={11} />
          </button>

          {isAddMenuOpen && (
            <div
              className={cn(
                "absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl border z-50 py-1 max-h-80 overflow-y-auto",
                isDarkMode
                  ? "bg-neutral-800 border-neutral-700"
                  : "bg-white border-stone-200"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile devices */}
              <div className={cn(
                "px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                isDarkMode ? "text-neutral-500" : "text-stone-400"
              )}>
                Mobile
              </div>
              {getPresetsByType('mobile').map(preset => (
                <button
                  key={preset.id}
                  onClick={() => addViewport(preset.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1 text-xs",
                    isDarkMode
                      ? "text-neutral-200 hover:bg-neutral-700"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <span>{preset.name}</span>
                  <span className={cn("text-[10px]", isDarkMode ? "text-neutral-500" : "text-stone-400")}>
                    {preset.width}×{preset.height}
                  </span>
                </button>
              ))}

              <div className={cn("my-1 border-t", isDarkMode ? "border-neutral-700" : "border-stone-200")} />

              {/* Tablet devices */}
              <div className={cn(
                "px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                isDarkMode ? "text-neutral-500" : "text-stone-400"
              )}>
                Tablet
              </div>
              {getPresetsByType('tablet').map(preset => (
                <button
                  key={preset.id}
                  onClick={() => addViewport(preset.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1 text-xs",
                    isDarkMode
                      ? "text-neutral-200 hover:bg-neutral-700"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <span>{preset.name}</span>
                  <span className={cn("text-[10px]", isDarkMode ? "text-neutral-500" : "text-stone-400")}>
                    {preset.width}×{preset.height}
                  </span>
                </button>
              ))}

              <div className={cn("my-1 border-t", isDarkMode ? "border-neutral-700" : "border-stone-200")} />

              {/* Desktop devices */}
              <div className={cn(
                "px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                isDarkMode ? "text-neutral-500" : "text-stone-400"
              )}>
                Desktop
              </div>
              {getPresetsByType('desktop').map(preset => (
                <button
                  key={preset.id}
                  onClick={() => addViewport(preset.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1 text-xs",
                    isDarkMode
                      ? "text-neutral-200 hover:bg-neutral-700"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <span>{preset.name}</span>
                  <span className={cn("text-[10px]", isDarkMode ? "text-neutral-500" : "text-stone-400")}>
                    {preset.width}×{preset.height}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-3 mx-0.5 bg-neutral-600" />

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
            )}
            title="Exit Multi-Viewport"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Performance warning */}
      {!performanceWarningDismissed && viewports.length >= 6 && (
        <div className="absolute top-2 left-2 z-40">
          <ViewportPerformanceWarning
            count={viewports.length}
            isDarkMode={isDarkMode}
            onDismiss={() => setPerformanceWarningDismissed(true)}
          />
        </div>
      )}

      {/* Viewport canvas - free positioning */}
      <div className="flex-1 overflow-auto p-2">
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <div className={cn(
            "relative w-full h-full min-h-[600px] transition-all duration-200",
            expandedViewport && "blur-sm pointer-events-none"
          )}>
            {viewports.map(viewport => (
              <DraggableViewportItem
                key={viewport.id}
                viewport={viewport}
                preset={getViewportPreset(viewport)}
                url={syncedUrl}
                isDarkMode={isDarkMode}
                isElectron={isElectron}
                webviewPreloadPath={webviewPreloadPath}
                isPrimary={primaryViewportId === viewport.id}
                onSetPrimary={() => handleSetPrimary(viewport.id)}
                onNavigate={primaryViewportId === viewport.id ? handlePrimaryNavigate : undefined}
                isInspectorActive={isInspectorActive}
                isScreenshotActive={isScreenshotActive}
                isMoveActive={isMoveActive}
                onInspectorHover={onInspectorHover}
                onInspectorSelect={onInspectorSelect}
                onScreenshotSelect={onScreenshotSelect}
                onConsoleLog={onConsoleLog}
                onExpand={() => setExpandedViewportId(viewport.id)}
                onRemove={() => removeViewport(viewport.id)}
                onOrientationToggle={() => toggleOrientation(viewport.id)}
                onResize={(width, height) => updateViewportSize(viewport.id, width, height)}
              />
            ))}
          </div>
        </DndContext>

        {/* Expanded viewport overlay */}
        {expandedViewport && (
          <div className="absolute inset-4 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl">
            <ViewportItem
              viewport={expandedViewport}
              preset={getViewportPreset(expandedViewport)}
              url={syncedUrl}
              isDarkMode={isDarkMode}
              isElectron={isElectron}
              webviewPreloadPath={webviewPreloadPath}
              isExpanded={true}
              isPrimary={primaryViewportId === expandedViewport.id}
              onSetPrimary={() => handleSetPrimary(expandedViewport.id)}
              onNavigate={primaryViewportId === expandedViewport.id ? handlePrimaryNavigate : undefined}
              isInspectorActive={isInspectorActive}
              isScreenshotActive={isScreenshotActive}
              isMoveActive={isMoveActive}
              onInspectorHover={onInspectorHover}
              onInspectorSelect={onInspectorSelect}
              onScreenshotSelect={onScreenshotSelect}
              onConsoleLog={onConsoleLog}
              onExpand={() => {}}
              onCollapse={() => setExpandedViewportId(null)}
              onRemove={() => removeViewport(expandedViewport.id)}
              onOrientationToggle={() => toggleOrientation(expandedViewport.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewportGrid
