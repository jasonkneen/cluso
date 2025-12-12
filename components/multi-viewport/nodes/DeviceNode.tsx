import React, { useRef, useEffect, useCallback, useState, memo } from 'react'
import { cn } from '@/lib/utils'
import { Smartphone, Tablet, Monitor, RotateCcw, Lock, Unlock, Maximize2 } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { DevicePreset } from '../types'

// Type for Electron webview element
type WebviewElement = HTMLElement & {
  src: string
  loadURL: (url: string) => void
  reload: () => void
  getURL: () => string
  send: (channel: string, ...args: unknown[]) => void
  addEventListener: (event: string, callback: (...args: unknown[]) => void) => void
  removeEventListener: (event: string, callback: (...args: unknown[]) => void) => void
}

interface IpcMessageEvent {
  channel: string
  args: unknown[]
}

export interface DeviceNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  preset: DevicePreset
  orientation: 'portrait' | 'landscape'
  url: string
  isDarkMode: boolean
  isElectron: boolean
  webviewPreloadPath?: string
  isPrimary?: boolean
  // Inspector
  isInspectorActive?: boolean
  isScreenshotActive?: boolean
  isMoveActive?: boolean
  onInspectorHover?: (element: unknown, rect: unknown) => void
  onInspectorSelect?: (element: unknown, rect: unknown) => void
  onScreenshotSelect?: (element: unknown, rect: unknown) => void
  onConsoleLog?: (level: string, message: string) => void
  // Callbacks
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onRemove: () => void
  onFocus: () => void
  onOrientationToggle: () => void
  onSetPrimary: () => void
  onNavigate?: (url: string) => void
  onExpand?: () => void
  onAddLinked?: (type: 'kanban' | 'todo' | 'notes') => void
}

export const DeviceNode = memo(function DeviceNode({
  id,
  x,
  y,
  width,
  height,
  zIndex,
  preset,
  orientation,
  url,
  isDarkMode,
  isElectron,
  webviewPreloadPath,
  isPrimary,
  isInspectorActive,
  isScreenshotActive,
  isMoveActive,
  onInspectorHover,
  onInspectorSelect,
  onScreenshotSelect,
  onConsoleLog,
  onMove,
  onResize,
  onRemove,
  onFocus,
  onOrientationToggle,
  onSetPrimary,
  onNavigate,
  onExpand,
  onAddLinked,
}: DeviceNodeProps) {
  const webviewRef = useRef<WebviewElement | null>(null)
  const [isWebviewReady, setIsWebviewReady] = useState(false)
  const lastLoadedUrlRef = useRef<string>('')

  // Calculate device dimensions
  const isLandscape = orientation === 'landscape'
  const deviceWidth = isLandscape
    ? Math.max(preset.width, preset.height)
    : Math.min(preset.width, preset.height)
  const deviceHeight = isLandscape
    ? Math.min(preset.width, preset.height)
    : Math.max(preset.width, preset.height)

  // Get icon
  const DeviceIcon = preset.type === 'mobile' ? Smartphone : preset.type === 'tablet' ? Tablet : Monitor

  // Refs for callbacks to avoid recreating setupWebview
  const onInspectorHoverRef = useRef(onInspectorHover)
  const onInspectorSelectRef = useRef(onInspectorSelect)
  const onScreenshotSelectRef = useRef(onScreenshotSelect)
  const onConsoleLogRef = useRef(onConsoleLog)
  const onNavigateRef = useRef(onNavigate)
  const isPrimaryRef = useRef(isPrimary)

  useEffect(() => { onInspectorHoverRef.current = onInspectorHover }, [onInspectorHover])
  useEffect(() => { onInspectorSelectRef.current = onInspectorSelect }, [onInspectorSelect])
  useEffect(() => { onScreenshotSelectRef.current = onScreenshotSelect }, [onScreenshotSelect])
  useEffect(() => { onConsoleLogRef.current = onConsoleLog }, [onConsoleLog])
  useEffect(() => { onNavigateRef.current = onNavigate }, [onNavigate])
  useEffect(() => { isPrimaryRef.current = isPrimary }, [isPrimary])

  // Setup webview
  const setupWebview = useCallback((webview: WebviewElement | null) => {
    webviewRef.current = webview
    if (!webview) {
      setIsWebviewReady(false)
      return
    }

    const handleDomReady = () => setIsWebviewReady(true)

    const handleDidNavigate = (event: { url: string }) => {
      if (isPrimaryRef.current && onNavigateRef.current && event.url) {
        onNavigateRef.current(event.url)
      }
    }

    const handleDidNavigateInPage = (event: { url: string; isMainFrame: boolean }) => {
      if (!event.isMainFrame) return
      if (isPrimaryRef.current && onNavigateRef.current && event.url) {
        onNavigateRef.current(event.url)
      }
    }

    const handleIpcMessage = (event: IpcMessageEvent) => {
      const { channel, args } = event
      if (channel === 'inspector-hover' && onInspectorHoverRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onInspectorHoverRef.current(data.element, data.rect)
      } else if (channel === 'inspector-select' && onInspectorSelectRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onInspectorSelectRef.current(data.element, data.rect)
      } else if (channel === 'screenshot-select' && onScreenshotSelectRef.current) {
        const [data] = args as [{ element: unknown; rect: unknown }]
        onScreenshotSelectRef.current(data.element, data.rect)
      } else if (channel === 'console-log' && onConsoleLogRef.current) {
        const [data] = args as [{ level: string; message: string }]
        onConsoleLogRef.current(data.level, data.message)
      }
    }

    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage as unknown as (...args: unknown[]) => void)
    webview.addEventListener('ipc-message', handleIpcMessage as unknown as (...args: unknown[]) => void)

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage as unknown as (...args: unknown[]) => void)
      webview.removeEventListener('ipc-message', handleIpcMessage as unknown as (...args: unknown[]) => void)
    }
  }, [])

  // Handle URL changes
  useEffect(() => {
    if (webviewRef.current && url && isWebviewReady) {
      if (lastLoadedUrlRef.current === url) return
      try {
        const currentUrl = webviewRef.current.getURL?.()
        if (currentUrl !== url && url !== 'about:blank') {
          lastLoadedUrlRef.current = url
          webviewRef.current.loadURL?.(url)
        }
      } catch {
        // Webview not ready
      }
    }
  }, [url, isWebviewReady])

  // Sync inspector modes
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview?.send || !isWebviewReady) return
    try {
      webview.send('set-inspector-mode', isInspectorActive || false)
      webview.send('set-screenshot-mode', isScreenshotActive || false)
      webview.send('set-move-mode', isMoveActive || false)
    } catch {
      // Webview not yet fully ready
    }
  }, [isInspectorActive, isScreenshotActive, isMoveActive, isWebviewReady])

  // Calculate scale to fit device in container
  const contentHeight = height - 32 // Account for titlebar
  const padding = 12
  const availableWidth = width - padding * 2
  const availableHeight = contentHeight - padding * 2
  const scaleX = availableWidth / deviceWidth
  const scaleY = availableHeight / deviceHeight
  const scale = Math.min(scaleX, scaleY, 1)
  const scaledWidth = deviceWidth * scale
  const scaledHeight = deviceHeight * scale

  // Title bar extras
  const titleBarExtra = (
    <div className="flex items-center gap-0.5">
      <span className={cn(
        "text-[10px] px-1 py-0.5 rounded",
        isDarkMode ? "bg-neutral-700 text-neutral-400" : "bg-stone-200 text-stone-500"
      )}>
        {deviceWidth}×{deviceHeight}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onSetPrimary() }}
        className={cn(
          "p-1 rounded transition-colors",
          isPrimary
            ? "text-blue-400 bg-blue-500/20"
            : isDarkMode
              ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
        )}
        title={isPrimary ? "Primary (others follow)" : "Make primary"}
      >
        {isPrimary ? <Lock size={10} /> : <Unlock size={10} />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onOrientationToggle() }}
        className={cn(
          "p-1 rounded transition-colors",
          isDarkMode ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700" : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
        )}
        title="Rotate"
      >
        <RotateCcw size={10} />
      </button>
      {onExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          className={cn(
            "p-1 rounded transition-colors",
            isDarkMode ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700" : "text-stone-400 hover:text-stone-700 hover:bg-stone-200"
          )}
          title="Expand"
        >
          <Maximize2 size={10} />
        </button>
      )}
    </div>
  )

  return (
    <BaseNode
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      zIndex={zIndex}
      isDarkMode={isDarkMode}
      title={preset.name}
      icon={<DeviceIcon size={12} className={isDarkMode ? "text-neutral-400" : "text-stone-500"} />}
      titleBarExtra={titleBarExtra}
      onMove={onMove}
      onResize={onResize}
      onRemove={onRemove}
      onFocus={onFocus}
      showLinkHandle={!!onAddLinked}
      onAddLinked={onAddLinked}
    >
      <div className={cn(
        "w-full h-full flex items-center justify-center",
        isDarkMode ? "bg-neutral-900" : "bg-stone-100"
      )}>
        <div
          className="rounded-md shadow-lg ring-1 ring-neutral-600 overflow-hidden"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          {isElectron && webviewPreloadPath ? (
            <webview
              ref={setupWebview as React.Ref<HTMLElement>}
              src={url || 'about:blank'}
              preload={`file://${webviewPreloadPath}`}
              style={{
                width: deviceWidth,
                height: deviceHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              // @ts-expect-error - webview is Electron-specific
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
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                border: 'none',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              title={preset.name}
            />
          )}
        </div>
      </div>
    </BaseNode>
  )
})
