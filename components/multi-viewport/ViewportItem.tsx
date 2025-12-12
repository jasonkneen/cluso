import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Maximize2, Minimize2, Trash2, RotateCcw, GripVertical, Smartphone, Tablet, Monitor, AlertTriangle, Lock, Unlock } from 'lucide-react'
import { ViewportItemProps } from './types'

// Grid snap size in pixels
const GRID_SNAP_SIZE = 50
const MIN_WIDTH = 250
const MIN_HEIGHT = 150 // Allow shorter cards

// Snap value to nearest grid point with bounds
function snapToGrid(value: number, min: number, max: number): number {
  const snapped = Math.round(value / GRID_SNAP_SIZE) * GRID_SNAP_SIZE
  return Math.max(min, Math.min(max, snapped))
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

    // Get the container bounds (parent of the card)
    const container = cardRef.current?.parentElement?.parentElement?.parentElement
    const containerRect = container?.getBoundingClientRect()
    const maxWidth = containerRect ? containerRect.width - 32 : 1200 // 32px for padding
    const maxHeight = containerRect ? containerRect.height - 100 : 600

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()

      const deltaX = axis === 'y' ? 0 : moveEvent.clientX - startX
      const deltaY = axis === 'x' ? 0 : moveEvent.clientY - startY

      // Calculate new size with bounds and snap
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

// Hook to measure container size - with debouncing to prevent render loops
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const lastSize = useRef({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const newWidth = Math.round(entry.contentRect.width)
        const newHeight = Math.round(entry.contentRect.height)

        // Only update if size changed by more than 1px to prevent loops
        if (Math.abs(newWidth - lastSize.current.width) > 1 ||
            Math.abs(newHeight - lastSize.current.height) > 1) {
          lastSize.current = { width: newWidth, height: newHeight }
          setSize({ width: newWidth, height: newHeight })
        }
      }
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, []) // Empty deps - ref is stable

  return size
}

// ViewportContent - scales device to fit within container bounds
function ViewportContent({
  deviceWidth,
  deviceHeight,
  url,
  presetName,
  isDarkMode,
  isElectron,
  webviewPreloadPath,
  setupWebview,
}: {
  deviceWidth: number
  deviceHeight: number
  url: string
  presetName: string
  isDarkMode: boolean
  isElectron: boolean
  webviewPreloadPath?: string
  setupWebview: (webview: WebviewElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const containerSize = useContainerSize(containerRef)

  // Calculate scale to fit within container (both width AND height)
  const padding = 16
  const availableWidth = Math.max(containerSize.width - padding * 2, 100)
  const availableHeight = Math.max(containerSize.height - padding * 2, 100)

  // Scale to fit within bounds while maintaining aspect ratio
  const scaleX = availableWidth / deviceWidth
  const scaleY = availableHeight / deviceHeight
  const scale = Math.min(scaleX, scaleY, 1) // Don't scale up, only down

  const scaledWidth = deviceWidth * scale
  const scaledHeight = deviceHeight * scale

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center flex-1 overflow-hidden",
        isDarkMode ? "bg-neutral-900" : "bg-stone-100"
      )}
    >
      {containerSize.width > 0 && containerSize.height > 0 && (
        <div
          className="rounded-lg shadow-xl ring-2 ring-neutral-600 overflow-hidden"
          style={{
            width: scaledWidth,
            height: scaledHeight,
            willChange: 'transform',
            contain: 'strict',
          }}
        >
          {isElectron && webviewPreloadPath ? (
            <webview
              ref={setupWebview as React.Ref<HTMLElement>}
              src={url || 'about:blank'}
              preload={`file://${webviewPreloadPath}`}
              style={{
                width: deviceWidth,
                height: deviceHeight,
                transform: `scale(${scale}) translateZ(0)`,
                transformOrigin: 'top left',
                willChange: 'transform',
              }}
              // @ts-expect-error - webview is an Electron-specific element
              allowpopups="true"
              nodeintegration="true"
              webpreferences="contextIsolation=no"
            />
          ) : (
            <iframe
              src={url}
              style={{
                width: deviceWidth,
                height: deviceHeight,
                transform: `scale(${scale}) translateZ(0)`,
                transformOrigin: 'top left',
                border: 'none',
                willChange: 'transform',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              title={`Viewport ${presetName}`}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Type for Electron webview element
type WebviewElement = HTMLElement & {
  src: string
  loadURL: (url: string) => void
  reload: () => void
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  executeJavaScript: (code: string) => Promise<unknown>
  getURL: () => string
  send: (channel: string, ...args: unknown[]) => void
  addEventListener: (event: string, callback: (...args: unknown[]) => void) => void
  removeEventListener: (event: string, callback: (...args: unknown[]) => void) => void
}

// Type for IPC message event
interface IpcMessageEvent {
  channel: string
  args: unknown[]
}

export function ViewportItem({
  viewport,
  preset,
  url,
  isExpanded,
  isDarkMode,
  isElectron,
  webviewPreloadPath,
  cardWidth,
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
  onCollapse,
  onRemove,
  onOrientationToggle,
  onResize,
  dragHandleProps,
}: ViewportItemProps) {
  const webviewRef = useRef<WebviewElement | null>(null)

  // Calculate dimensions based on orientation
  // For landscape: width > height (wider than tall)
  // For portrait: height > width (taller than wide)
  const isLandscape = viewport.orientation === 'landscape'
  const deviceWidth = isLandscape
    ? Math.max(preset.width, preset.height)
    : Math.min(preset.width, preset.height)
  const deviceHeight = isLandscape
    ? Math.min(preset.width, preset.height)
    : Math.max(preset.width, preset.height)

  // Get device type icon
  const DeviceIcon = preset.type === 'mobile' ? Smartphone : preset.type === 'tablet' ? Tablet : Monitor

  // Track webview ready state
  const [isWebviewReady, setIsWebviewReady] = useState(false)

  // Store callbacks in refs to avoid recreating setupWebview
  const onInspectorHoverRef = useRef(onInspectorHover)
  const onInspectorSelectRef = useRef(onInspectorSelect)
  const onScreenshotSelectRef = useRef(onScreenshotSelect)
  const onConsoleLogRef = useRef(onConsoleLog)
  const onNavigateRef = useRef(onNavigate)
  const isPrimaryRef = useRef(isPrimary)

  // Keep refs updated
  useEffect(() => { onInspectorHoverRef.current = onInspectorHover }, [onInspectorHover])
  useEffect(() => { onInspectorSelectRef.current = onInspectorSelect }, [onInspectorSelect])
  useEffect(() => { onScreenshotSelectRef.current = onScreenshotSelect }, [onScreenshotSelect])
  useEffect(() => { onConsoleLogRef.current = onConsoleLog }, [onConsoleLog])
  useEffect(() => { onNavigateRef.current = onNavigate }, [onNavigate])
  useEffect(() => { isPrimaryRef.current = isPrimary }, [isPrimary])

  // Track when webview ref is set
  const [webviewMounted, setWebviewMounted] = useState(false)

  // Setup webview ref - store reference and trigger effect
  const setupWebview = useCallback((webview: WebviewElement | null) => {
    webviewRef.current = webview
    setWebviewMounted(!!webview)
    if (!webview) {
      setIsWebviewReady(false)
    }
  }, [])

  // Setup webview event listeners via useEffect (proper cleanup)
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !webviewMounted) return

    const handleDomReady = () => {
      console.log(`[ViewportItem:${viewport.id}] DOM ready`)
      setIsWebviewReady(true)
    }

    const handleDidNavigate = (event: { url: string }) => {
      console.log(`[ViewportItem:${viewport.id}] Navigated to:`, event.url, 'isPrimary:', isPrimaryRef.current)
      // If this is the primary viewport, broadcast navigation to others
      if (isPrimaryRef.current && onNavigateRef.current && event.url) {
        console.log(`[ViewportItem:${viewport.id}] Broadcasting URL to other viewports:`, event.url)
        onNavigateRef.current(event.url)
      }
    }

    // Also handle in-page navigation (SPA client-side routing)
    const handleDidNavigateInPage = (event: { url: string; isMainFrame: boolean }) => {
      if (!event.isMainFrame) return
      console.log(`[ViewportItem:${viewport.id}] In-page navigation to:`, event.url, 'isPrimary:', isPrimaryRef.current)
      if (isPrimaryRef.current && onNavigateRef.current && event.url) {
        console.log(`[ViewportItem:${viewport.id}] Broadcasting in-page URL:`, event.url)
        onNavigateRef.current(event.url)
      }
    }

    // Handle IPC messages from webview - use refs for callbacks
    const handleIpcMessage = (event: IpcMessageEvent) => {
      const { channel, args } = event

      if (channel === 'inspector-hover' && onInspectorHoverRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onInspectorHoverRef.current(data.element, data.rect, viewport.id)
      } else if (channel === 'inspector-select' && onInspectorSelectRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onInspectorSelectRef.current(data.element, data.rect, viewport.id)
      } else if (channel === 'screenshot-select' && onScreenshotSelectRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onScreenshotSelectRef.current(data.element, data.rect, viewport.id)
      } else if (channel === 'console-log' && onConsoleLogRef.current) {
        const [data] = args as [{ level: string; message: string }]
        onConsoleLogRef.current(data.level, data.message, viewport.id)
      }
    }

    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage as unknown as (...args: unknown[]) => void)
    webview.addEventListener('ipc-message', handleIpcMessage as unknown as (...args: unknown[]) => void)

    // Check if already ready (webview may have loaded before listener attached)
    try {
      const url = webview.getURL?.()
      if (url && url !== 'about:blank') {
        console.log(`[ViewportItem:${viewport.id}] Webview already loaded, marking ready`)
        setIsWebviewReady(true)
      }
    } catch {
      // Not ready yet
    }

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage as unknown as (...args: unknown[]) => void)
      webview.removeEventListener('ipc-message', handleIpcMessage as unknown as (...args: unknown[]) => void)
    }
  }, [viewport.id, webviewMounted])

  // Handle URL changes - only load if URL meaningfully changed
  const lastLoadedUrlRef = useRef<string>('')
  useEffect(() => {
    if (webviewRef.current && url && isWebviewReady) {
      // Skip if we already loaded this URL
      if (lastLoadedUrlRef.current === url) {
        return
      }
      try {
        const currentUrl = webviewRef.current.getURL?.()
        // Only reload if the webview's actual URL differs from target
        if (currentUrl && currentUrl !== url && url !== 'about:blank') {
          console.log(`[ViewportItem:${viewport.id}] Loading URL:`, url, 'was:', currentUrl)
          lastLoadedUrlRef.current = url
          webviewRef.current.loadURL?.(url)
        } else if (!currentUrl || currentUrl === 'about:blank') {
          // Initial load
          console.log(`[ViewportItem:${viewport.id}] Initial URL load:`, url)
          lastLoadedUrlRef.current = url
          webviewRef.current.loadURL?.(url)
        }
      } catch (e) {
        // Webview not ready yet, ignore
        console.log('[ViewportItem] Webview not ready for URL sync')
      }
    }
  }, [url, isWebviewReady, viewport.id])

  // Sync inspector modes to webview when they change
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview?.send) {
      console.log(`[ViewportItem:${viewport.id}] No webview.send available`)
      return
    }

    console.log(`[ViewportItem:${viewport.id}] Syncing inspector modes:`, {
      isInspectorActive,
      isScreenshotActive,
      isMoveActive,
      isWebviewReady
    })

    // Send even if not "ready" - the webview might still accept messages
    webview.send('set-inspector-mode', isInspectorActive || false)
    webview.send('set-screenshot-mode', isScreenshotActive || false)
    webview.send('set-move-mode', isMoveActive || false)
  }, [isInspectorActive, isScreenshotActive, isMoveActive, isWebviewReady, viewport.id])

  if (isExpanded) {
    return (
      <div className={cn(
        "flex flex-col h-full w-full border",
        isDarkMode ? "bg-neutral-900 border-neutral-600" : "bg-stone-100 border-stone-300"
      )}>
        {/* Expanded header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-2 border-b",
          isDarkMode ? "bg-neutral-800 border-neutral-700" : "bg-white border-stone-200"
        )}>
          <div className="flex items-center gap-2">
            <DeviceIcon size={16} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />
            <span className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-neutral-200" : "text-stone-700"
            )}>
              {preset.name}
            </span>
            <span className={cn(
              "text-xs",
              isDarkMode ? "text-neutral-500" : "text-stone-400"
            )}>
              {deviceWidth} x {deviceHeight}
            </span>
          </div>
          <button
            onClick={onCollapse}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isDarkMode
                ? "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                : "bg-stone-200 text-stone-700 hover:bg-stone-300"
            )}
          >
            <Minimize2 size={14} />
            <span>Collapse</span>
            <kbd className={cn(
              "ml-2 px-1.5 py-0.5 rounded text-xs",
              isDarkMode ? "bg-neutral-600" : "bg-stone-300"
            )}>ESC</kbd>
          </button>
        </div>

        {/* Full viewport webview */}
        <div className="flex-1 flex items-center justify-center p-4">
          {isElectron && webviewPreloadPath ? (
            <webview
              ref={setupWebview as React.Ref<HTMLElement>}
              src={url || 'about:blank'}
              preload={`file://${webviewPreloadPath}`}
              className="w-full h-full"
              // @ts-expect-error - webview is an Electron-specific element
              allowpopups="true"
              nodeintegration="true"
              webpreferences="contextIsolation=no"
            />
          ) : (
            <iframe
              src={url}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              title={`Viewport ${preset.name}`}
            />
          )}
        </div>
      </div>
    )
  }

  // Local resize state - track size changes during drag (snapped to grid)
  const [localSize, setLocalSize] = useState<{ width: number; height: number }>({
    width: snapToGrid(viewport.displayWidth || 400, MIN_WIDTH, 2000),
    height: snapToGrid(viewport.displayHeight || 250, MIN_HEIGHT, 1200),
  })
  const cardRef = useRef<HTMLDivElement>(null)

  // Handle resize - receives final snapped and bounded values
  const handleResize = useCallback((width: number, height: number) => {
    setLocalSize({ width, height })
  }, [])

  // Notify parent when resize completes
  useEffect(() => {
    if (onResize && (localSize.width !== viewport.displayWidth || localSize.height !== viewport.displayHeight)) {
      onResize(localSize.width, localSize.height)
    }
  }, [localSize.width, localSize.height, onResize, viewport.displayWidth, viewport.displayHeight])

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col rounded-xl overflow-hidden transition-shadow hover:shadow-lg relative",
        isPrimary
          ? "ring-1 ring-blue-500 border border-blue-500/50"
          : "border",
        !isPrimary && (isDarkMode
          ? "bg-neutral-800 border-neutral-700"
          : "bg-white border-stone-200"),
        isPrimary && (isDarkMode
          ? "bg-neutral-800"
          : "bg-white")
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
          {/* Drag handle icon */}
          <GripVertical size={12} className={isDarkMode ? "text-neutral-500" : "text-stone-400"} />

          <DeviceIcon size={12} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />
          <span className={cn(
            "text-xs font-medium",
            isDarkMode ? "text-neutral-200" : "text-stone-700"
          )}>
            {preset.name}
          </span>
          <span className={cn(
            "text-[10px]",
            isDarkMode ? "text-neutral-500" : "text-stone-400"
          )}>
            {deviceWidth}×{deviceHeight}
          </span>
          <span className={cn(
            "text-[10px] px-1 py-0.5 rounded",
            isDarkMode ? "bg-neutral-700 text-neutral-400" : "bg-stone-200 text-stone-500"
          )}>
            {localSize.width}×{localSize.height}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Lock/Primary toggle */}
          {onSetPrimary && (
            <button
              onClick={onSetPrimary}
              className={cn(
                "p-1 rounded transition-colors",
                isPrimary
                  ? "text-blue-400 bg-blue-500/20"
                  : isDarkMode
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
              )}
              title={isPrimary ? "Primary viewport (others follow navigation)" : "Make primary (others will follow navigation)"}
            >
              {isPrimary ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          )}

          {/* Orientation toggle */}
          <button
            onClick={onOrientationToggle}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
            )}
            title={`Rotate to ${viewport.orientation === 'portrait' ? 'landscape' : 'portrait'}`}
          >
            <RotateCcw size={12} />
          </button>

          {/* Expand button */}
          <button
            onClick={onExpand}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
            )}
            title="Expand to fullscreen"
          >
            <Maximize2 size={12} />
          </button>

          {/* Remove button */}
          <button
            onClick={onRemove}
            className={cn(
              "p-1 rounded transition-colors",
              isDarkMode
                ? "text-neutral-400 hover:text-red-400 hover:bg-neutral-700"
                : "text-stone-400 hover:text-red-500 hover:bg-stone-200"
            )}
            title="Remove viewport"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Viewport content - fills width, scales device to fit */}
      <ViewportContent
        deviceWidth={deviceWidth}
        deviceHeight={deviceHeight}
        url={url}
        presetName={preset.name}
        isDarkMode={isDarkMode}
        isElectron={isElectron}
        webviewPreloadPath={webviewPreloadPath}
        setupWebview={setupWebview}
      />
    </div>
  )
}

// Performance warning component
export function ViewportPerformanceWarning({
  count,
  isDarkMode,
  onDismiss,
}: {
  count: number
  isDarkMode: boolean
  onDismiss: () => void
}) {
  if (count < 6) return null

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
      isDarkMode
        ? "bg-yellow-900/30 text-yellow-200 border border-yellow-700/50"
        : "bg-yellow-50 text-yellow-800 border border-yellow-200"
    )}>
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>
        {count} viewports may impact performance. Each viewport runs a separate browser instance.
      </span>
      <button
        onClick={onDismiss}
        className={cn(
          "ml-auto text-xs underline",
          isDarkMode ? "text-yellow-300" : "text-yellow-700"
        )}
      >
        Dismiss
      </button>
    </div>
  )
}
