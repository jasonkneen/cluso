import React, { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DeviceNode } from './nodes/DeviceNode'
import { InternalNode, getInternalWindowConfig } from './nodes/InternalNode'
import { TerminalNode } from './nodes/TerminalNode'
import { ConnectionLines } from './canvas/ConnectionLines'
import { calculateLayout, calculateFitView, LayoutDirection, LayoutAlgorithm } from './canvas/elkLayout'
import { Viewport, WindowType, DEVICE_PRESETS, getPresetById, getPresetsByType } from './types'

const STORAGE_KEY = 'cluso-multi-viewport-config'

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
  // Internal window render functions
  renderKanban?: () => React.ReactNode
  renderTodo?: () => React.ReactNode
  renderNotes?: () => React.ReactNode
  // Terminal WebSocket URL for PTY connection
  terminalWsUrl?: string
  // External control refs for toolbar integration
  controlsRef?: React.MutableRefObject<{
    viewportCount: number
    addDevice: (type: 'mobile' | 'tablet' | 'desktop') => void
    addInternalWindow: (type: 'kanban' | 'todo' | 'notes') => void
    addTerminal: () => void
    autoLayout: (direction?: LayoutDirection) => void
    fitView: () => void
    getViewports: () => Viewport[]
    focusViewport: (id: string) => void
  } | null>
  onViewportCountChange?: (count: number) => void
  onViewportsChange?: (viewports: Viewport[]) => void
  // Node style - 'standard' (with title bar) or 'chromeless' (floating toolbar)
  nodeStyle?: 'standard' | 'chromeless'
  // ELK Layout settings
  elkAlgorithm?: LayoutAlgorithm
  elkDirection?: LayoutDirection
  elkSpacing?: number
  elkNodeSpacing?: number
}

// Load/save viewports
function loadViewports(): Viewport[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((v: Viewport, i: number) => ({
          ...v,
          windowType: v.windowType || 'device',
          displayWidth: v.displayWidth || 400,
          displayHeight: v.displayHeight || 300,
          x: v.x ?? (i % 3) * 420,
          y: v.y ?? Math.floor(i / 3) * 320,
          zIndex: v.zIndex ?? i + 1,
        }))
      }
    }
  } catch (e) {
    console.error('[ViewportGrid] Failed to load viewports:', e)
  }
  return [{
    id: crypto.randomUUID(),
    windowType: 'device',
    devicePresetId: 'desktop',
    orientation: 'landscape',
    displayWidth: 600,
    displayHeight: 350,
    x: 50,
    y: 50,
    zIndex: 1,
  }]
}

function saveViewports(viewports: Viewport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(viewports))
  } catch (e) {
    console.error('[ViewportGrid] Failed to save viewports:', e)
  }
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
  renderKanban,
  renderTodo,
  renderNotes,
  terminalWsUrl,
  controlsRef,
  onViewportCountChange,
  onViewportsChange,
  nodeStyle = 'standard',
  elkAlgorithm = 'layered',
  elkDirection = 'RIGHT',
  elkSpacing = 120,
  elkNodeSpacing = 60,
}: ViewportGridProps) {
  const [viewports, setViewports] = useState<Viewport[]>(loadViewports)
  const [expandedViewportId, setExpandedViewportId] = useState<string | null>(null)
  const [primaryViewportId, setPrimaryViewportId] = useState<string | null>(null)
  const [syncedUrl, setSyncedUrl] = useState<string>(url)
  const [maxZIndex, setMaxZIndex] = useState(() => Math.max(...loadViewports().map(v => v.zIndex ?? 1), 1))
  const maxZIndexRef = useRef(maxZIndex)
  const isInitialMount = useRef(true)

  // Canvas zoom
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const MIN_SCALE = 0.25
  const MAX_SCALE = 2

  // Keep ref in sync with state
  useEffect(() => {
    maxZIndexRef.current = maxZIndex
  }, [maxZIndex])

  // Sync URL on mount only
  useEffect(() => {
    if (!syncedUrl || syncedUrl === 'about:blank') {
      setSyncedUrl(url)
    }
  }, [])

  // Save on change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    saveViewports(viewports)
  }, [viewports])

  // Bring node to front - use ref to avoid stale closure
  const bringToFront = useCallback((id: string) => {
    const newZ = maxZIndexRef.current + 1
    maxZIndexRef.current = newZ
    setMaxZIndex(newZ)
    setViewports(prev => prev.map(v =>
      v.id === id ? { ...v, zIndex: newZ } : v
    ))
  }, [])

  // Handle primary navigation
  const handlePrimaryNavigate = useCallback((newUrl: string) => {
    setSyncedUrl(newUrl)
  }, [])

  // Get next position for new node
  const getNextPosition = useCallback(() => {
    if (viewports.length === 0) return { x: 50, y: 50 }
    const lastViewport = viewports[viewports.length - 1]
    const newX = (lastViewport.x ?? 0) + 50
    const newY = (lastViewport.y ?? 0) + 50
    return { x: newX > 800 ? 50 : newX, y: newY > 500 ? 50 : newY }
  }, [viewports])

  // Add device viewport - use ref to avoid stale closure
  const addDevice = useCallback((type: 'mobile' | 'tablet' | 'desktop') => {
    const presets = getPresetsByType(type)
    const preset = presets[0]
    const { x, y } = getNextPosition()
    const newZ = maxZIndexRef.current + 1
    maxZIndexRef.current = newZ
    setMaxZIndex(newZ)

    const defaultWidth = type === 'desktop' ? 600 : type === 'tablet' ? 450 : 320
    const defaultHeight = type === 'desktop' ? 350 : type === 'tablet' ? 380 : 450

    setViewports(prev => [...prev, {
      id: crypto.randomUUID(),
      windowType: 'device',
      devicePresetId: preset.id,
      orientation: type === 'desktop' ? 'landscape' : 'portrait',
      displayWidth: defaultWidth,
      displayHeight: defaultHeight,
      x,
      y,
      zIndex: newZ,
    }])
  }, [getNextPosition])

  // Add internal window - use ref to avoid stale closure
  const addInternalWindow = useCallback((windowType: Exclude<WindowType, 'device'>, linkedToId?: string) => {
    const config = getInternalWindowConfig(windowType)
    const { x, y } = linkedToId
      ? (() => {
          const source = viewports.find(v => v.id === linkedToId)
          if (source) {
            return {
              x: (source.x ?? 0) + (source.displayWidth ?? 400) + 30,
              y: source.y ?? 0
            }
          }
          return getNextPosition()
        })()
      : getNextPosition()

    const newZ = maxZIndexRef.current + 1
    maxZIndexRef.current = newZ
    setMaxZIndex(newZ)

    setViewports(prev => [...prev, {
      id: crypto.randomUUID(),
      windowType,
      displayWidth: config.defaultWidth,
      displayHeight: config.defaultHeight,
      x,
      y,
      zIndex: newZ,
      linkedToViewportId: linkedToId,
    }])
  }, [viewports, getNextPosition])

  // Add terminal window - use ref to avoid stale closure
  const addTerminal = useCallback(() => {
    const { x, y } = getNextPosition()
    const newZ = maxZIndexRef.current + 1
    maxZIndexRef.current = newZ
    setMaxZIndex(newZ)

    setViewports(prev => [...prev, {
      id: crypto.randomUUID(),
      windowType: 'terminal',
      displayWidth: 600,
      displayHeight: 400,
      x,
      y,
      zIndex: newZ,
    }])
  }, [getNextPosition])

  // Update viewport
  const updateViewport = useCallback((id: string, updates: Partial<Viewport>) => {
    setViewports(prev => prev.map(v =>
      v.id === id ? { ...v, ...updates } : v
    ))
  }, [])

  // Remove viewport
  const removeViewport = useCallback((id: string) => {
    setViewports(prev => prev.filter(v => v.id !== id))
    if (expandedViewportId === id) setExpandedViewportId(null)
    if (primaryViewportId === id) setPrimaryViewportId(null)
  }, [expandedViewportId, primaryViewportId])

  // Toggle orientation
  const toggleOrientation = useCallback((id: string) => {
    setViewports(prev => prev.map(v =>
      v.id === id ? { ...v, orientation: v.orientation === 'portrait' ? 'landscape' : 'portrait' } : v
    ))
  }, [])

  // Get linked viewport name
  const getLinkedViewportName = (linkedToId?: string) => {
    if (!linkedToId) return undefined
    const linked = viewports.find(v => v.id === linkedToId)
    if (!linked || linked.windowType !== 'device') return undefined
    return getPresetById(linked.devicePresetId ?? '')?.name
  }

  // Track scale/pan in refs for native event listener
  const scaleRef = useRef(scale)
  const panRef = useRef(pan)
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { panRef.current = pan }, [pan])

  // Use native wheel listener to capture events even over child elements
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom around mouse position
        e.preventDefault()
        e.stopPropagation()
        const rect = canvas.getBoundingClientRect()

        // Mouse position relative to canvas container
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Calculate new scale
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const currentScale = scaleRef.current
        const currentPan = panRef.current
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * delta))

        // Adjust pan so the point under the mouse stays in place
        const canvasX = (mouseX - currentPan.x) / currentScale
        const canvasY = (mouseY - currentPan.y) / currentScale
        const newPanX = mouseX - canvasX * newScale
        const newPanY = mouseY - canvasY * newScale

        setScale(newScale)
        setPan({ x: newPanX, y: newPanY })
      } else {
        // Pan with scroll
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => canvas.removeEventListener('wheel', handleWheel, { capture: true })
  }, [])

  // Middle mouse or space+left mouse pan
  const [isPanning, setIsPanning] = useState(false)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Space key detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceDown(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Middle mouse (1), right mouse (2), or left mouse + space
    if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpaceDown)) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
    }
  }, [isSpaceDown, pan])

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    const deltaX = e.clientX - panStartRef.current.x
    const deltaY = e.clientY - panStartRef.current.y
    setPan({
      x: panStartRef.current.panX + deltaX,
      y: panStartRef.current.panY + deltaY,
    })
  }, [isPanning])

  const handlePanEnd = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Reset zoom
  const resetZoom = useCallback(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Auto-layout using ELK
  const autoLayout = useCallback(async (direction?: LayoutDirection) => {
    if (viewports.length === 0) return

    const nodes = viewports.map(v => ({
      id: v.id,
      width: v.displayWidth ?? 400,
      height: v.displayHeight ?? 300,
      linkedToId: v.linkedToViewportId,
    }))

    const results = await calculateLayout(nodes, {
      algorithm: elkAlgorithm,
      direction: direction ?? elkDirection,
      spacing: elkSpacing,
      nodeSpacing: elkNodeSpacing,
    })

    if (results.length > 0) {
      // Add offset to position nodes nicely
      const offsetX = 50
      const offsetY = 50

      setViewports(prev => prev.map(v => {
        const result = results.find(r => r.id === v.id)
        if (result) {
          return { ...v, x: result.x + offsetX, y: result.y + offsetY }
        }
        return v
      }))
    }
  }, [viewports, elkAlgorithm, elkDirection, elkSpacing, elkNodeSpacing])

  // Fit all nodes in view
  const fitView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || viewports.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const nodes = viewports.map(v => ({
      x: v.x ?? 0,
      y: v.y ?? 0,
      width: v.displayWidth ?? 400,
      height: v.displayHeight ?? 300,
    }))

    const { scale: newScale, panX, panY } = calculateFitView(
      nodes,
      rect.width,
      rect.height,
      60, // padding
      MIN_SCALE,
      MAX_SCALE
    )

    setScale(newScale)
    setPan({ x: panX, y: panY })
  }, [viewports])

  // Expose controls to parent via ref
  useEffect(() => {
    if (controlsRef) {
      controlsRef.current = {
        viewportCount: viewports.length,
        addDevice,
        addInternalWindow: (type) => addInternalWindow(type),
        addTerminal,
        autoLayout,
        fitView,
        getViewports: () => viewports,
        focusViewport: bringToFront,
      }
    }
  }, [viewports, controlsRef, addDevice, addInternalWindow, addTerminal, autoLayout, fitView, bringToFront])

  // Notify parent when viewport count changes (separate effect to avoid loops)
  useEffect(() => {
    onViewportCountChange?.(viewports.length)
    onViewportsChange?.(viewports)
  }, [viewports.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={canvasRef}
      className={cn(
        "h-full w-full relative overflow-hidden",
        isDarkMode ? "bg-neutral-900" : "bg-stone-100",
        isSpaceDown && "cursor-grab",
        isPanning && "cursor-grabbing"
      )}
      style={{ userSelect: isPanning ? 'none' : 'auto' }}
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Canvas - GPU accelerated transforms */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transformOrigin: 'top left',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="relative min-w-[2000px] min-h-[1500px]">
          {/* Connection lines */}
          <ConnectionLines viewports={viewports} isDarkMode={isDarkMode} />

          {/* Nodes */}
          {viewports.map(viewport => {
            if (viewport.windowType === 'device') {
              const preset = getPresetById(viewport.devicePresetId ?? 'desktop') ?? DEVICE_PRESETS[0]
              return (
                <DeviceNode
                  key={viewport.id}
                  id={viewport.id}
                  x={viewport.x ?? 0}
                  y={viewport.y ?? 0}
                  width={viewport.displayWidth ?? 400}
                  height={viewport.displayHeight ?? 300}
                  zIndex={viewport.zIndex ?? 1}
                  preset={preset}
                  orientation={viewport.orientation ?? 'portrait'}
                  url={syncedUrl}
                  isDarkMode={isDarkMode}
                  isElectron={isElectron}
                  webviewPreloadPath={webviewPreloadPath}
                  isPrimary={primaryViewportId === viewport.id}
                  isInspectorActive={isInspectorActive}
                  isScreenshotActive={isScreenshotActive}
                  isMoveActive={isMoveActive}
                  onInspectorHover={(el, rect) => onInspectorHover?.(el, rect, viewport.id)}
                  onInspectorSelect={(el, rect) => onInspectorSelect?.(el, rect, viewport.id)}
                  onScreenshotSelect={(el, rect) => onScreenshotSelect?.(el, rect, viewport.id)}
                  onConsoleLog={(level, msg) => onConsoleLog?.(level, msg, viewport.id)}
                  onMove={(x, y) => updateViewport(viewport.id, { x, y })}
                  onResize={(w, h) => updateViewport(viewport.id, { displayWidth: w, displayHeight: h })}
                  onRemove={() => removeViewport(viewport.id)}
                  onFocus={() => bringToFront(viewport.id)}
                  onOrientationToggle={() => toggleOrientation(viewport.id)}
                  onSetPrimary={() => setPrimaryViewportId(prev => prev === viewport.id ? null : viewport.id)}
                  onNavigate={primaryViewportId === viewport.id ? handlePrimaryNavigate : undefined}
                  onExpand={() => setExpandedViewportId(viewport.id)}
                  onAddLinked={(type) => addInternalWindow(type, viewport.id)}
                  chromeless={nodeStyle === 'chromeless'}
                  canvasScale={scale}
                />
              )
            } else if (viewport.windowType === 'terminal') {
              // Terminal node
              return (
                <TerminalNode
                  key={viewport.id}
                  id={viewport.id}
                  x={viewport.x ?? 0}
                  y={viewport.y ?? 0}
                  width={viewport.displayWidth ?? 600}
                  height={viewport.displayHeight ?? 400}
                  zIndex={viewport.zIndex ?? 1}
                  isDarkMode={isDarkMode}
                  wsUrl={terminalWsUrl ?? 'ws://localhost:3001/pty'}
                  onMove={(x, y) => updateViewport(viewport.id, { x, y })}
                  onResize={(w, h) => updateViewport(viewport.id, { displayWidth: w, displayHeight: h })}
                  onRemove={() => removeViewport(viewport.id)}
                  onFocus={() => bringToFront(viewport.id)}
                  chromeless={nodeStyle === 'chromeless'}
                  canvasScale={scale}
                />
              )
            } else {
              // Internal window (kanban, todo, notes)
              const renderContent = () => {
                switch (viewport.windowType) {
                  case 'kanban': return renderKanban?.()
                  case 'todo': return renderTodo?.()
                  case 'notes': return renderNotes?.()
                  default: return null
                }
              }

              return (
                <InternalNode
                  key={viewport.id}
                  id={viewport.id}
                  x={viewport.x ?? 0}
                  y={viewport.y ?? 0}
                  width={viewport.displayWidth ?? 350}
                  height={viewport.displayHeight ?? 400}
                  zIndex={viewport.zIndex ?? 1}
                  windowType={viewport.windowType as Exclude<WindowType, 'device' | 'terminal'>}
                  linkedViewportName={getLinkedViewportName(viewport.linkedToViewportId)}
                  isDarkMode={isDarkMode}
                  onMove={(x, y) => updateViewport(viewport.id, { x, y })}
                  onResize={(w, h) => updateViewport(viewport.id, { displayWidth: w, displayHeight: h })}
                  onRemove={() => removeViewport(viewport.id)}
                  onFocus={() => bringToFront(viewport.id)}
                  chromeless={nodeStyle === 'chromeless'}
                  canvasScale={scale}
                >
                  {renderContent()}
                </InternalNode>
              )
            }
          })}
        </div>
      </div>

      {/* Zoom indicator */}
      {scale !== 1 && (
        <button
          onClick={resetZoom}
          className={cn(
            "absolute bottom-4 right-4 px-2 py-1 rounded-lg text-xs font-medium transition-all",
            isDarkMode
              ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 shadow-sm"
          )}
          title="Reset zoom (click to reset)"
        >
          {Math.round(scale * 100)}%
        </button>
      )}
    </div>
  )
}

export default ViewportGrid
