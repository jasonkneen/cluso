/**
 * Webview Setup Hook
 *
 * Extracted from App.tsx - the large setupWebviewHandlers function (~1000 lines)
 * Handles webview event handlers setup, IPC message handling, and cleanup
 */

import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { SelectedElement, Message } from '../../types'
import type { TreeNode } from '../../components/ComponentTree'
import type { PendingDOMApproval, PendingPatch } from '../patches'
// EditedFile type is inlined in the deps interface
import { fileService } from '../../services/FileService'

/**
 * Webview element interface (Electron webview API)
 */
export interface WebviewElement extends HTMLElement {
  getURL: () => string
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  send: (channel: string, ...args: unknown[]) => void
  executeJavaScript: <T = unknown>(code: string) => Promise<T>
  contentWindow?: Window
  capturePage: (rect?: {
    x: number
    y: number
    width: number
    height: number
  }) => Promise<Electron.NativeImage>
  addEventListener: (event: string, handler: (e: unknown) => void) => void
  removeEventListener: (event: string, handler: (e: unknown) => void) => void
}

/**
 * Tab state used by webview handlers
 */
export interface WebviewTab {
  id: string
  url?: string
  title?: string
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  isWebviewReady?: boolean
  projectPath?: string
  type?: string
}

/**
 * Console log entry
 */
export interface ConsoleLogEntry {
  type: 'log' | 'warn' | 'error' | 'info'
  message: string
  timestamp: Date
}

/**
 * AI Selected element state
 */
export interface AISelectedElementState {
  selector?: string
  reasoning?: string
  count?: number
  elements?: SelectedElement[]
}

/**
 * Move target position state
 */
export interface MoveTargetPosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Pending change state for DOM changes
 */
export interface PendingChange {
  code: string
  undoCode: string
  description: string
  additions: number
  deletions: number
  source: 'dom'
}

/**
 * Hovered element state
 */
export interface HoveredElementState {
  element: SelectedElement
  rect: { top: number; left: number; width: number; height: number }
}

/**
 * Dependencies required for webview setup
 */
export interface UseWebviewSetupDeps {
  // Tab state
  updateTab: (tabId: string, data: Partial<WebviewTab>) => void
  enqueueConsoleLog: (log: ConsoleLogEntry) => void
  activeTabId: string
  tabsRef: MutableRefObject<WebviewTab[]>

  // UI state setters
  setUrlInput: (url: string) => void
  setHoveredElement: React.Dispatch<React.SetStateAction<HoveredElementState | null>>
  setSelectedElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setSelectedTreeNodeId: React.Dispatch<React.SetStateAction<string | null>>
  setConsoleLogs: React.Dispatch<React.SetStateAction<ConsoleLogEntry[]>>
  setAiSelectedElement: React.Dispatch<React.SetStateAction<AISelectedElementState | null>>
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setScreenshotElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setIsScreenshotActive: React.Dispatch<React.SetStateAction<boolean>>
  setCapturedScreenshot: React.Dispatch<React.SetStateAction<string | null>>
  setMoveTargetPosition: React.Dispatch<React.SetStateAction<MoveTargetPosition | null>>
  setIsMoveActive: React.Dispatch<React.SetStateAction<boolean>>
  setPendingDOMApproval: React.Dispatch<React.SetStateAction<PendingDOMApproval | null>>
  setPendingChange: React.Dispatch<React.SetStateAction<PendingChange | null>>

  // Refs for current state
  selectedElementRef: MutableRefObject<SelectedElement | null>
  isLeftPanelOpenRef: MutableRefObject<boolean>
  layersTreeDataRef: MutableRefObject<TreeNode | null>
  layersTreeStaleRef: MutableRefObject<boolean>
  isLayersLoadingRef: MutableRefObject<boolean>
  isInspectorActiveRef: MutableRefObject<boolean>
  isScreenshotActiveRef: MutableRefObject<boolean>
  handleRefreshLayersRef: MutableRefObject<(() => Promise<void>) | null>
  handleTreeNodeSelectRef: MutableRefObject<((node: TreeNode) => void) | null>
  addEditedFileRef: MutableRefObject<((file: {
    path: string
    additions?: number
    deletions?: number
    undoCode?: string
    originalContent?: string
    isFileModification?: boolean
  }) => void) | null>

  // Patch preparation function (via ref to avoid circular dependency)
  prepareDomPatchRef: MutableRefObject<
    | ((
        approvalId: string,
        element: SelectedElement,
        cssChanges: Record<string, string>,
        description: string,
        undoCode: string,
        applyCode: string,
        userRequest: string,
        projectPath?: string,
        textChange?: { oldText: string; newText: string },
        srcChange?: { oldSrc: string; newSrc: string }
      ) => void)
    | null
  >
}

/**
 * Return type for useWebviewSetup hook
 */
export interface UseWebviewSetupReturn {
  /** Set up webview handlers for a specific tab */
  setupWebviewHandlers: (tabId: string, webview: WebviewElement) => () => void
  /** Get ref callback for webview mounting */
  getWebviewRefCallback: (tabId: string) => (element: HTMLElement | null) => void
  /** Map of webview refs by tab ID */
  webviewRefs: MutableRefObject<Map<string, WebviewElement>>
  /** Map of cleanup functions by tab ID */
  webviewCleanups: MutableRefObject<Map<string, () => void>>
}

/**
 * Hook for setting up webview event handlers
 *
 * Extracted from App.tsx to reduce file size and improve maintainability.
 * Handles all webview events: navigation, loading, IPC messages, console, etc.
 */
export function useWebviewSetup(deps: UseWebviewSetupDeps): UseWebviewSetupReturn {
  const {
    updateTab,
    enqueueConsoleLog,
    activeTabId,
    tabsRef,
    setUrlInput,
    setHoveredElement,
    setSelectedElement,
    setSelectedTreeNodeId,
    setConsoleLogs,
    setAiSelectedElement,
    setMessages,
    setScreenshotElement,
    setIsScreenshotActive,
    setCapturedScreenshot,
    setMoveTargetPosition,
    setIsMoveActive,
    setPendingDOMApproval,
    setPendingChange,
    selectedElementRef,
    isLeftPanelOpenRef,
    layersTreeDataRef,
    layersTreeStaleRef,
    isLayersLoadingRef,
    isInspectorActiveRef,
    isScreenshotActiveRef,
    handleRefreshLayersRef,
    handleTreeNodeSelectRef,
    addEditedFileRef,
    prepareDomPatchRef,
  } = deps

  // Webview refs management
  const webviewRefs = useRef<Map<string, WebviewElement>>(new Map())
  const webviewCleanups = useRef<Map<string, () => void>>(new Map())
  const webviewRefCallbacks = useRef<Map<string, (element: HTMLElement | null) => void>>(new Map())

  /**
   * Main webview handlers setup function
   * Sets up all event listeners for a webview element
   */
  const setupWebviewHandlers = useCallback(
    (tabId: string, webview: WebviewElement) => {
      console.log(`[Tab ${tabId}] Setting up webview event handlers`)

      /**
       * Sync inspector selection to layers panel
       */
      const syncInspectorSelectionToLayers = async (xpath: string, element: SelectedElement) => {
        try {
          if (
            (!layersTreeDataRef.current || layersTreeStaleRef.current) &&
            !isLayersLoadingRef.current
          ) {
            await handleRefreshLayersRef.current?.()
          }

          const elementNumber = await webview.executeJavaScript(`
          (function() {
            const map = window.__layersElements;
            if (!map || !(map instanceof Map)) return null;
            const el = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!el) return null;
            for (const entry of map.entries()) {
              const num = entry[0];
              const node = entry[1];
              if (node === el) return num;
            }
            return null;
          })()
        `)

          if (typeof elementNumber === 'number' && elementNumber > 0) {
            const name =
              (element?.text && String(element.text).trim().slice(0, 30)) ||
              (element?.id ? `#${element.id}` : '') ||
              (element?.className ? `.${String(element.className).split(' ')[0]}` : '') ||
              `<${String(element?.tagName || 'element').toLowerCase()}>`

            handleTreeNodeSelectRef.current?.({
              id: xpath,
              name,
              type: 'component',
              tagName: String(element?.tagName || 'div').toLowerCase(),
              elementNumber,
            } as TreeNode)
          } else {
            setSelectedTreeNodeId(null)
          }
        } catch (e) {
          console.warn('[Inspector→Layers] Failed to sync:', e)
        }
      }

      // Navigation event handlers
      const handleDidNavigate = () => {
        const url = webview.getURL()
        console.log(`[Tab ${tabId}] Did navigate:`, url)
        updateTab(tabId, {
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
        })
        if (tabId === activeTabId) {
          setUrlInput(url)
        }
      }

      const handleDidStartLoading = () => {
        console.log(`[Tab ${tabId}] Started loading`)
        updateTab(tabId, { isLoading: true })
      }

      const handleDidStopLoading = () => {
        console.log(`[Tab ${tabId}] Stopped loading`)
        updateTab(tabId, { isLoading: false })
      }

      const handleDidFinishLoad = () => {
        const loadedUrl = webview.getURL()
        console.log(`[Tab ${tabId}] Page finished loading, URL:`, loadedUrl)
        webview.send('set-inspector-mode', isInspectorActiveRef.current)
        webview.send('set-screenshot-mode', isScreenshotActiveRef.current)
        updateTab(tabId, { isWebviewReady: true })
      }

      const handleDidFailLoad = (e: {
        errorCode: number
        errorDescription: string
        validatedURL: string
      }) => {
        console.error(
          `[Tab ${tabId}] Failed to load:`,
          e.errorCode,
          e.errorDescription,
          e.validatedURL
        )
      }

      const handlePageTitleUpdated = (e: { title: string }) => {
        updateTab(tabId, { title: e.title })
      }

      /**
       * Main IPC message handler - handles all messages from webview preload script
       */
      const handleIpcMessage = async (event: { channel: string; args: unknown[] }) => {
        const { channel, args } = event

        if (channel === 'inspector-hover') {
          const data = args[0] as {
            element: SelectedElement
            rect: { top: number; left: number; width: number; height: number }
          }
          setHoveredElement({ element: data.element, rect: data.rect })
        } else if (channel === 'inspector-hover-end') {
          setHoveredElement(null)
        } else if (channel === 'inspector-select') {
          handleInspectorSelect(
            args[0] as {
              element: SelectedElement
              x: number
              y: number
              rect: unknown
              source?: string
            },
            webview,
            tabId,
            syncInspectorSelectionToLayers
          )
        } else if (channel === 'screenshot-select') {
          handleScreenshotSelect(
            args[0] as {
              element: SelectedElement
              rect: { top: number; left: number; width: number; height: number }
            },
            webview
          )
        } else if (channel === 'console-log') {
          handleConsoleLog(args[0] as { level: string; message: string })
        } else if (channel === 'ai-selection-confirmed') {
          handleAiSelectionConfirmed(
            args[0] as {
              selector: string
              count: number
              elements: Array<{ element: SelectedElement; rect: unknown }>
            }
          )
        } else if (channel === 'ai-selection-failed') {
          handleAiSelectionFailed(args[0] as { selector: string; error: string })
        } else if (channel === 'move-select') {
          handleMoveSelect(
            args[0] as {
              element: SelectedElement
              rect: { top: number; left: number; width: number; height: number }
            }
          )
        } else if (channel === 'move-update') {
          handleMoveUpdate(
            args[0] as {
              element: SelectedElement
              originalRect: { top: number; left: number; width: number; height: number }
              targetRect: { x: number; y: number; width: number; height: number }
            }
          )
        } else if (channel === 'move-confirmed') {
          handleMoveConfirmed(
            args[0] as {
              element: SelectedElement
              originalRect: { top: number; left: number; width: number; height: number }
              targetRect: { x: number; y: number; width: number; height: number }
            }
          )
        } else if (channel === 'move-cancelled') {
          handleMoveCancelled()
        } else if (channel === 'drop-image-on-element') {
          await handleDropImageOnElement(
            args[0] as { imageData: string; element: SelectedElement; rect: unknown },
            webview,
            tabId
          )
        } else if (channel === 'drop-url-on-element') {
          handleDropUrlOnElement(
            args[0] as { url: string; element: SelectedElement; rect: unknown },
            webview
          )
        } else if (channel === 'inline-edit-accept') {
          await handleInlineEditAccept(
            args[0] as { oldText: string; newText: string; element: SelectedElement },
            tabId
          )
        }
      }

      // Inspector select handler
      const handleInspectorSelect = async (
        data: {
          element: SelectedElement
          x: number
          y: number
          rect: unknown
          source?: string
        },
        wv: WebviewElement,
        tid: string,
        syncFn: (xpath: string, element: SelectedElement) => Promise<void>
      ) => {
        console.log('[Inspector Select] Full element data:', data.element)
        console.log('[Inspector Select] sourceLocation:', data.element.sourceLocation)

        // Preserve sourceLocation if re-selecting same element with null sourceLocation
        const prevElement = selectedElementRef.current
        const isSameElement =
          prevElement?.xpath && data.element.xpath && prevElement.xpath === data.element.xpath
        const shouldPreserveSource =
          isSameElement && !data.element.sourceLocation && prevElement?.sourceLocation
        if (shouldPreserveSource) {
          console.log('[Inspector Select] Preserving sourceLocation from previous selection')
        }

        setSelectedElement({
          ...data.element,
          x: data.x,
          y: data.y,
          rect: data.rect as SelectedElement['rect'],
          sourceLocation: shouldPreserveSource
            ? prevElement.sourceLocation
            : data.element.sourceLocation,
        })
        setHoveredElement(null)

        // Copy element info to clipboard
        const el = data.element
        const preservedSource = shouldPreserveSource
          ? prevElement.sourceLocation
          : data.element.sourceLocation
        const sourceInfo = preservedSource?.summary || 'no source'
        const clipboardText = `${el.outerHTML || `<${el.tagName}>`}\n\nSource: ${sourceInfo}`
        try {
          if ((window as { electronAPI?: { clipboard?: { writeText?: (text: string) => void } } }).electronAPI?.clipboard?.writeText) {
            (window as { electronAPI?: { clipboard?: { writeText?: (text: string) => void } } }).electronAPI!.clipboard!.writeText!(clipboardText)
            console.log('[Inspector] Copied to clipboard via Electron:', sourceInfo)
          } else {
            await navigator.clipboard.writeText(clipboardText)
            console.log('[Inspector] Copied to clipboard via navigator:', sourceInfo)
          }
        } catch (err) {
          console.log('[Inspector] Clipboard copy skipped (webview focused)')
        }

        // If selection comes from Layers -> inspector sync, don't bounce back
        if (data.source === 'layers') {
          return
        }

        // If the Layers/Properties panel is closed, don't auto-open it
        if (!isLeftPanelOpenRef.current) return

        const xpath = data.element?.xpath
        if (!xpath) return
        await syncFn(xpath, data.element)
      }

      // Screenshot select handler
      const handleScreenshotSelect = (
        data: {
          element: SelectedElement
          rect: { top: number; left: number; width: number; height: number }
        },
        wv: WebviewElement
      ) => {
        setScreenshotElement(data.element)
        setIsScreenshotActive(false)

        if (wv && data.rect) {
          wv.send('hide-move-handles')

          setTimeout(() => {
            wv.capturePage({
              x: Math.floor(data.rect.left),
              y: Math.floor(data.rect.top),
              width: Math.ceil(data.rect.width),
              height: Math.ceil(data.rect.height),
            })
              .then((image: Electron.NativeImage) => {
                setCapturedScreenshot(image.toDataURL())
                wv.send('show-move-handles')
              })
              .catch((err: Error) => {
                console.error('Failed to capture screenshot:', err)
                wv.send('show-move-handles')
              })
          }, 50)
        }
      }

      // Console log handler
      const handleConsoleLog = (data: { level: string; message: string }) => {
        const logType = (
          data.level.toLowerCase() === 'warning' ? 'warn' : data.level.toLowerCase()
        ) as 'log' | 'warn' | 'error' | 'info'
        setConsoleLogs((prev) => [
          ...prev.slice(-99),
          {
            type: logType,
            message: data.message,
            timestamp: new Date(),
          },
        ])
      }

      // AI selection confirmed handler
      const handleAiSelectionConfirmed = (data: {
        selector: string
        count: number
        elements: Array<{ element: SelectedElement; rect: unknown }>
      }) => {
        console.log('[AI] Element selection confirmed:', data)
        setAiSelectedElement((prev) => ({
          selector: data.selector,
          reasoning: prev?.reasoning || '',
          count: data.count,
          elements: data.elements.map((item) => ({
            ...item.element,
            rect: item.rect as SelectedElement['rect'],
          })),
        }))
      }

      // AI selection failed handler
      const handleAiSelectionFailed = (data: { selector: string; error: string }) => {
        console.error('[AI] Element selection failed:', data)
        setAiSelectedElement(null)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'system',
            content: `Could not find element: ${data.selector}. ${data.error}`,
            timestamp: new Date(),
          },
        ])
      }

      // Move select handler
      const handleMoveSelect = (data: {
        element: SelectedElement
        rect: { top: number; left: number; width: number; height: number }
      }) => {
        console.log('[Move] Element selected for repositioning:', data.element.tagName)
        setSelectedElement({
          ...data.element,
          rect: data.rect,
        })
        setMoveTargetPosition({
          x: data.rect.left,
          y: data.rect.top,
          width: data.rect.width,
          height: data.rect.height,
        })
        setHoveredElement(null)
      }

      // Move update handler
      const handleMoveUpdate = (data: {
        element: SelectedElement
        originalRect: { top: number; left: number; width: number; height: number }
        targetRect: { x: number; y: number; width: number; height: number }
      }) => {
        console.log('[Move] Position updated:', data.targetRect)
        setMoveTargetPosition(data.targetRect)
      }

      // Move confirmed handler
      const handleMoveConfirmed = (data: {
        element: SelectedElement
        originalRect: { top: number; left: number; width: number; height: number }
        targetRect: { x: number; y: number; width: number; height: number }
      }) => {
        console.log('[Move] Position confirmed:', data.targetRect)
        setSelectedElement((prev) =>
          prev
            ? {
                ...prev,
                targetPosition: data.targetRect,
                originalPosition: data.originalRect,
              }
            : null
        )
        setIsMoveActive(false)
        setMoveTargetPosition(null)
      }

      // Move cancelled handler
      const handleMoveCancelled = () => {
        console.log('[Move] Cancelled')
        setSelectedElement(null)
        setIsMoveActive(false)
        setMoveTargetPosition(null)
      }

      // Drop image on element handler
      const handleDropImageOnElement = async (
        data: { imageData: string; element: SelectedElement; rect: unknown },
        wv: WebviewElement,
        tid: string
      ) => {
        const currentSelectedElement = selectedElementRef.current
        const elementWithSource = {
          ...data.element,
          sourceLocation: currentSelectedElement?.sourceLocation,
        }
        const tagName = data.element.tagName?.toLowerCase() || ''
        console.log(
          '[Drop] Image dropped on element:',
          tagName,
          'classes:',
          data.element.className,
          'hasSource:',
          !!elementWithSource.sourceLocation
        )

        const currentTab = tabsRef.current.find((t) => t.id === tid)
        const projectPath = currentTab?.projectPath
        if (!projectPath) {
          console.error('[Drop] No project path set for tab:', tid, 'tab:', currentTab)
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'system',
              content:
                'Cannot save dropped image: no project folder selected. Please set a project folder first.',
              timestamp: new Date(),
            },
          ])
          return
        }

        // Generate content-hash based filename
        const hashCode = (str: string) => {
          let hash = 0
          for (let i = 0; i < Math.min(str.length, 10000); i++) {
            const char = str.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash
          }
          return Math.abs(hash).toString(16).padStart(8, '0')
        }
        const contentHash = hashCode(data.imageData)
        const mimeMatch = data.imageData.match(/^data:image\/(\w+);/)
        const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png'
        const filename = `img-${contentHash}.${ext}`
        const publicPath = `${projectPath}/public/uploads`
        const fullPath = `${publicPath}/${filename}`
        const relativePath = `/uploads/${filename}`

        const isImgElement = tagName === 'img'
        const isContainerElement = [
          'div',
          'section',
          'article',
          'aside',
          'header',
          'footer',
          'main',
          'figure',
          'span',
          'p',
        ].includes(tagName)

        const electronAPI = (window as { electronAPI?: { files?: { saveImage?: (data: string, path: string) => Promise<{ success: boolean; error?: string }> } } }).electronAPI

        try {
          const saveResult = await electronAPI?.files?.saveImage?.(data.imageData, fullPath)
          if (!saveResult?.success) throw new Error(saveResult?.error || 'Failed to save')
          console.log('[Drop] Image saved:', relativePath)

          let applyCode: string
          let undoCode: string
          let description: string
          let insertionMethod: 'src' | 'background' | 'child-img' | 'replace-content'

          if (isImgElement) {
            // Strategy 1: Direct img src replacement
            insertionMethod = 'src'
            const captureOriginal = (await wv.executeJavaScript(`
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                return el ? el.src : '';
              })();
            `)) as string

            applyCode = `
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el && el.tagName === 'IMG') {
                  el.src = '${relativePath}';
                  return 'Applied src';
                }
                return 'Element not found';
              })();
            `
            undoCode = `
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el && el.tagName === 'IMG') {
                  el.src = '${captureOriginal}';
                  return 'Reverted';
                }
                return 'Element not found';
              })();
            `
            description = `Set image src to ${filename}`

            if (elementWithSource.sourceLocation?.sources?.[0]) {
              const approvalId = `dom-drop-${Date.now()}`
              const approvalPayload: PendingDOMApproval = {
                id: approvalId,
                element: elementWithSource,
                cssChanges: {},
                srcChange: { oldSrc: captureOriginal || '', newSrc: relativePath },
                description,
                undoCode,
                applyCode,
                userRequest: 'Drop image on element',
                patchStatus: 'preparing',
              }
              setPendingDOMApproval(approvalPayload)
              prepareDomPatchRef.current?.(
                approvalId,
                elementWithSource,
                {},
                description,
                undoCode,
                applyCode,
                'Drop image on element',
                projectPath,
                undefined,
                { oldSrc: captureOriginal || '', newSrc: relativePath }
              )
            }
          } else if (isContainerElement) {
            // Strategy 2: Check for child img, or use background-image
            const childImgInfo = (await wv.executeJavaScript(`
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (!el) return null;
                const img = el.querySelector('img');
                if (img) {
                  return { hasChildImg: true, childSrc: img.src };
                }
                return { hasChildImg: false, currentBg: el.style.backgroundImage };
              })();
            `)) as { hasChildImg: boolean; childSrc?: string; currentBg?: string } | null

            if (childImgInfo?.hasChildImg) {
              // Strategy 2a: Update child img src
              insertionMethod = 'child-img'
              applyCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    const img = el.querySelector('img');
                    if (img) {
                      img.src = '${relativePath}';
                      return 'Applied to child img';
                    }
                  }
                  return 'Element not found';
                })();
              `
              undoCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    const img = el.querySelector('img');
                    if (img) {
                      img.src = '${childImgInfo.childSrc}';
                      return 'Reverted';
                    }
                  }
                  return 'Element not found';
                })();
              `
              description = `Set child image src to ${filename}`

              if (elementWithSource.sourceLocation?.sources?.[0]) {
                const approvalId = `dom-drop-${Date.now()}`
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: elementWithSource,
                  cssChanges: {},
                  srcChange: { oldSrc: childImgInfo.childSrc || '', newSrc: relativePath },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: 'Drop image on child img element',
                  patchStatus: 'preparing',
                }
                setPendingDOMApproval(approvalPayload)
                prepareDomPatchRef.current?.(
                  approvalId,
                  elementWithSource,
                  {},
                  description,
                  undoCode,
                  applyCode,
                  'Drop image on child img element',
                  projectPath,
                  undefined,
                  { oldSrc: childImgInfo.childSrc || '', newSrc: relativePath }
                )
              }
            } else {
              // Strategy 2b: Use background-image and clear text content
              insertionMethod = 'background'
              const captureContent = (await wv.executeJavaScript(`
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  return el ? { text: el.textContent, bg: el.style.backgroundImage, bgSize: el.style.backgroundSize, bgPos: el.style.backgroundPosition } : null;
                })();
              `)) as { text?: string; bg?: string; bgSize?: string; bgPos?: string } | null

              applyCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    el.style.backgroundImage = 'url(${relativePath})';
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.textContent = '';
                    return 'Applied background-image';
                  }
                  return 'Element not found';
                })();
              `
              undoCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    el.style.backgroundImage = '${captureContent?.bg || ''}';
                    el.style.backgroundSize = '${captureContent?.bgSize || ''}';
                    el.style.backgroundPosition = '${captureContent?.bgPos || ''}';
                    el.textContent = '${(captureContent?.text || '').replace(/'/g, "\\'")}';
                    return 'Reverted';
                  }
                  return 'Element not found';
                })();
              `
              description = `Set background-image to ${filename}`

              if (elementWithSource.sourceLocation?.sources?.[0]) {
                const approvalId = `dom-drop-${Date.now()}`
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: elementWithSource,
                  cssChanges: {
                    backgroundImage: `url(${relativePath})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: 'Drop image on container element',
                  patchStatus: 'preparing',
                }
                setPendingDOMApproval(approvalPayload)
                prepareDomPatchRef.current?.(
                  approvalId,
                  elementWithSource,
                  {
                    backgroundImage: `url(${relativePath})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  },
                  description,
                  undoCode,
                  applyCode,
                  'Drop image on container element',
                  projectPath
                )
              }
            }
          } else {
            // Fallback: Try setting src anyway (for video, iframe, etc.)
            insertionMethod = 'src'

            const captureOriginal = (await wv.executeJavaScript(`
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                return el ? el.src : '';
              })();
            `)) as string

            applyCode = `
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el) {
                  el.src = '${relativePath}';
                  return 'Applied src';
                }
                return 'Element not found';
              })();
            `
            undoCode = `
              (function() {
                const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el) {
                  el.src = '${captureOriginal}';
                  return 'Reverted';
                }
                return 'Element not found';
              })();
            `
            description = `Set ${tagName} src to ${filename}`

            if (elementWithSource.sourceLocation?.sources?.[0]) {
              const approvalId = `dom-drop-${Date.now()}`
              const approvalPayload: PendingDOMApproval = {
                id: approvalId,
                element: elementWithSource,
                cssChanges: {},
                srcChange: { oldSrc: captureOriginal || '', newSrc: relativePath },
                description,
                undoCode,
                applyCode,
                userRequest: `Drop image on ${tagName} element`,
                patchStatus: 'preparing',
              }
              setPendingDOMApproval(approvalPayload)
              prepareDomPatchRef.current?.(
                approvalId,
                elementWithSource,
                {},
                description,
                undoCode,
                applyCode,
                `Drop image on ${tagName} element`,
                projectPath,
                undefined,
                { oldSrc: captureOriginal || '', newSrc: relativePath }
              )
            }
          }

          // Execute the DOM change
          await wv.executeJavaScript(applyCode!)
          console.log('[Drop] Applied image with method:', insertionMethod)

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: description!,
              timestamp: new Date(),
              model: 'system',
              intent: 'ui_modify',
            },
          ])

          setPendingChange({
            code: applyCode!,
            undoCode: undoCode!,
            description: description!,
            additions: 1,
            deletions: 1,
            source: 'dom',
          })
        } catch (err) {
          console.error('[Drop] Failed to save/apply image:', err)
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'system',
              content: `Failed to apply image: ${(err as Error).message}`,
              timestamp: new Date(),
            },
          ])
        }
      }

      // Drop URL on element handler
      const handleDropUrlOnElement = (
        data: { url: string; element: SelectedElement; rect: unknown },
        wv: WebviewElement
      ) => {
        console.log('[Drop] URL dropped on element:', data.element.tagName, data.url)

        const tagName = data.element.tagName?.toLowerCase()
        let attrToSet = 'src'
        if (tagName === 'a') attrToSet = 'href'
        else if (tagName === 'img' || tagName === 'video' || tagName === 'audio') attrToSet = 'src'
        else if (tagName === 'iframe') attrToSet = 'src'

        const applyCode = `
          (function() {
            const elements = document.querySelectorAll('${data.element.tagName}');
            for (const el of elements) {
              if (el.className === '${data.element.className}') {
                el.${attrToSet} = '${data.url}';
                return 'Applied';
              }
            }
            return 'Element not found';
          })();
        `

        wv.executeJavaScript(applyCode)

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Set ${attrToSet} to dropped URL on ${data.element.tagName}`,
            timestamp: new Date(),
            model: 'system',
            intent: 'ui_modify',
          },
        ])
      }

      // Inline edit accept handler
      const handleInlineEditAccept = async (
        data: { oldText: string; newText: string; element: SelectedElement },
        tid: string
      ) => {
        const msgSource = data.element?.sourceLocation
        const refSource = selectedElementRef.current?.sourceLocation
        console.log('[Inline Edit] Accepted:', {
          old: data.oldText?.substring(0, 30),
          new: data.newText?.substring(0, 30),
          msgHasSource: !!msgSource,
          msgSourceFile: msgSource?.sources?.[0]?.file,
          refHasSource: !!refSource,
          refSourceFile: refSource?.sources?.[0]?.file,
          refSummary: refSource?.summary,
        })

        const elementWithSource = msgSource?.sources?.[0]
          ? data.element
          : refSource
            ? selectedElementRef.current
            : null

        const currentTab = tabsRef.current.find((t) => t.id === tid)
        const projectPath = currentTab?.projectPath

        // INSTANT SAVE: Direct find/replace in source file
        if (elementWithSource?.sourceLocation && projectPath && data.oldText && data.newText) {
          try {
            const sourceLocation = elementWithSource.sourceLocation!
            console.log('[Inline Edit] sourceLocation keys:', Object.keys(sourceLocation))
            console.log('[Inline Edit] likelyDefinitionFile:', sourceLocation.likelyDefinitionFile)
            console.log('[Inline Edit] summary:', sourceLocation.summary)
            const sources = sourceLocation.sources || []
            let filePath = ''
            let targetLine = 0

            // Strategy 1: Use likelyDefinitionFile FIRST
            if (sourceLocation.likelyDefinitionFile) {
              const defFile = sourceLocation.likelyDefinitionFile
              console.log('[Inline Edit] Using likelyDefinitionFile:', defFile)
              const electronAPI = (window as { electronAPI?: { files?: { glob?: (pattern: string, cwd: string) => Promise<{ success: boolean; data?: Array<{ path: string }> }> } } }).electronAPI
              const globResult = await electronAPI?.files?.glob?.(`**/${defFile}`, projectPath)
              console.log('[Inline Edit] Glob result:', globResult)
              if (globResult?.success && globResult.data && globResult.data.length > 0) {
                filePath = globResult.data[0].path
                console.log('[Inline Edit] Found definition file:', filePath)
              }
            }

            // Strategy 1b: Parse component name from summary
            if (!filePath && sourceLocation.summary) {
              const match = sourceLocation.summary.match(/^(\w+)\s*\(used in/)
              if (match) {
                const componentName = match[1]
                console.log('[Inline Edit] Extracted component name from summary:', componentName)
                const electronAPI = (window as { electronAPI?: { files?: { glob?: (pattern: string, cwd: string) => Promise<{ success: boolean; data?: Array<{ path: string }> }> } } }).electronAPI
                const globResult = await electronAPI?.files?.glob?.(
                  `**/${componentName}.tsx`,
                  projectPath
                )
                if (globResult?.success && globResult.data && globResult.data.length > 0) {
                  filePath = globResult.data[0].path
                  console.log('[Inline Edit] Found component file:', filePath)
                }
              }
            }

            // Strategy 2: Find a source with a full path
            if (!filePath) {
              for (const src of sources) {
                if (src.file && src.file.includes('/') && src.line > 0) {
                  filePath = src.file
                  targetLine = src.line
                  console.log('[Inline Edit] Found full path in sources:', filePath)
                  break
                }
              }
            }

            // Strategy 3: Search for first source file name
            if (!filePath && sources[0]?.file) {
              const fileName = sources[0].file
              console.log('[Inline Edit] Searching for source file:', fileName)
              const electronAPI = (window as { electronAPI?: { files?: { glob?: (pattern: string, cwd: string) => Promise<{ success: boolean; data?: Array<{ path: string }> }> } } }).electronAPI
              const globResult = await electronAPI?.files?.glob?.(`**/${fileName}`, projectPath)
              if (globResult?.success && globResult.data && globResult.data.length > 0) {
                filePath = globResult.data[0].path
                targetLine = sources[0]?.line || 0
                console.log('[Inline Edit] Found via glob:', filePath)
              }
            }

            // Make path absolute if relative
            if (filePath && !filePath.startsWith('/')) {
              filePath = `${projectPath}/${filePath}`
            }

            if (!filePath) {
              console.error('[Inline Edit] Could not determine file path')
              return
            }

            console.log('[Inline Edit] ====== INSTANT SAVE ======')
            console.log('[Inline Edit] File:', filePath)
            console.log('[Inline Edit] Target line:', targetLine)

            // Read source file
            const readResult = await fileService.readFileFull(filePath)
            if (!readResult.success || !readResult.data) {
              console.error('[Inline Edit] Failed to read file:', readResult.error)
              return
            }

            const originalContent = readResult.data
            const oldText = data.oldText
            const newText = data.newText

            console.log(
              '[Inline Edit] Old text (' + oldText.length + ' chars):',
              JSON.stringify(oldText.substring(0, 80))
            )
            console.log(
              '[Inline Edit] New text (' + newText.length + ' chars):',
              JSON.stringify(newText.substring(0, 80))
            )
            console.log(
              '[Inline Edit] File length:',
              originalContent.length,
              'chars,',
              originalContent.split('\n').length,
              'lines'
            )

            // Count occurrences
            let count = 0
            let idx = 0
            while ((idx = originalContent.indexOf(oldText, idx)) !== -1) {
              count++
              idx += oldText.length
            }
            console.log('[Inline Edit] Found', count, 'occurrences in file')

            let patchedContent = originalContent

            if (count === 1) {
              patchedContent = originalContent.replace(oldText, newText)
            } else if (count > 1 && targetLine > 0) {
              const lines = originalContent.split('\n')
              let charOffset = 0
              for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
                charOffset += lines[i].length + 1
              }
              const searchStart = Math.max(0, charOffset - 500)
              const searchEnd = Math.min(originalContent.length, charOffset + 500)
              const nearIdx = originalContent.indexOf(oldText, searchStart)
              if (nearIdx !== -1 && nearIdx < searchEnd) {
                patchedContent =
                  originalContent.slice(0, nearIdx) +
                  newText +
                  originalContent.slice(nearIdx + oldText.length)
                console.log('[Inline Edit] Replaced occurrence near line', targetLine)
              }
            } else if (count === 0) {
              // Text not found - DOM textContent differs from source
              let commonPrefixLen = 0
              while (
                commonPrefixLen < oldText.length &&
                commonPrefixLen < newText.length &&
                oldText[commonPrefixLen] === newText[commonPrefixLen]
              ) {
                commonPrefixLen++
              }
              let commonSuffixLen = 0
              while (
                commonSuffixLen < oldText.length - commonPrefixLen &&
                commonSuffixLen < newText.length - commonPrefixLen &&
                oldText[oldText.length - 1 - commonSuffixLen] ===
                  newText[newText.length - 1 - commonSuffixLen]
              ) {
                commonSuffixLen++
              }
              const changedOld = oldText.slice(commonPrefixLen, oldText.length - commonSuffixLen)
              const changedNew = newText.slice(commonPrefixLen, newText.length - commonSuffixLen)

              console.log(
                '[Inline Edit] Changed part:',
                JSON.stringify(changedOld),
                '→',
                JSON.stringify(changedNew)
              )
              console.log('[Inline Edit] targetLine for search:', targetLine)

              if (targetLine > 0 && changedOld.length >= 2) {
                console.log(
                  '[Inline Edit] Searching lines',
                  Math.max(0, targetLine - 6),
                  'to',
                  Math.min(originalContent.split('\n').length, targetLine + 5)
                )
                const lines = originalContent.split('\n')
                const startLine = Math.max(0, targetLine - 6)
                const endLine = Math.min(lines.length, targetLine + 5)

                for (let lineNum = startLine; lineNum < endLine; lineNum++) {
                  const line = lines[lineNum]
                  if (line.includes(changedOld)) {
                    lines[lineNum] = line.replace(changedOld, changedNew)
                    patchedContent = lines.join('\n')
                    console.log('[Inline Edit] Replaced in line', lineNum + 1)
                    break
                  }
                }

                // Partial word match fallback
                if (patchedContent === originalContent && changedOld.length >= 4) {
                  const partialOld = changedOld.replace(/^["']|["']$/g, '').trim()
                  if (partialOld.length >= 3) {
                    for (let lineNum = startLine; lineNum < endLine; lineNum++) {
                      const line = lines[lineNum]
                      if (line.includes(partialOld)) {
                        lines[lineNum] = line.replace(
                          partialOld,
                          changedNew.replace(/^["']|["']$/g, '').trim()
                        )
                        patchedContent = lines.join('\n')
                        console.log('[Inline Edit] Replaced partial match in line', lineNum + 1)
                        break
                      }
                    }
                  }
                }
              } else if (changedOld && changedOld.length >= 2) {
                console.log('[Inline Edit] No targetLine, trying global search for changedOld')
                const escapedChanged = changedOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const changedCount = (
                  originalContent.match(new RegExp(escapedChanged, 'g')) || []
                ).length
                console.log(
                  '[Inline Edit] Found',
                  changedCount,
                  'occurrences of changedOld globally'
                )
                if (changedCount === 1) {
                  patchedContent = originalContent.replace(changedOld, changedNew)
                  console.log('[Inline Edit] Replaced single global occurrence')
                }
              }
            }

            if (patchedContent === originalContent) {
              console.error(
                '[Inline Edit] Could not find text to replace. Old text:',
                JSON.stringify(oldText.substring(0, 100))
              )
              console.error('[Inline Edit] targetLine was:', targetLine)
              return
            }

            // Write immediately
            const writeResult = await fileService.writeFile(filePath, patchedContent)
            if (writeResult.success) {
              console.log('[Inline Edit] INSTANT SAVED:', filePath)
              addEditedFileRef.current?.({
                path: filePath,
                additions: 1,
                deletions: 1,
              })
            } else {
              console.error('[Inline Edit] Write failed:', writeResult.error)
            }
          } catch (e) {
            console.error('[Inline Edit] Error:', e)
          }
        } else if (projectPath && data.oldText && data.newText) {
          // FALLBACK: Search for text in source files
          console.log('[Inline Edit] No sourceLocation - attempting text search fallback')
          try {
            const oldText = data.oldText!
            const electronAPI = (window as { electronAPI?: { files?: { searchInFiles?: (text: string, cwd: string, opts: { filePattern: string; maxResults: number }) => Promise<{ success: boolean; data?: Array<{ file: string; line: number; content: string }> }> } } }).electronAPI
            const searchResult = await electronAPI?.files?.searchInFiles?.(
              oldText.substring(0, 50),
              projectPath,
              { filePattern: '*.{tsx,jsx,ts,js}', maxResults: 10 }
            )

            if (searchResult?.success && searchResult.data && searchResult.data.length > 0) {
              type Match = { file: string; line: number; content: string }
              const matches = searchResult.data
                .filter((r: Match) => !r.file.includes('node_modules'))
                .filter(
                  (r: Match) =>
                    r.file.includes('src/') ||
                    r.file.includes('app/') ||
                    r.file.includes('components/')
                )

              const bestMatch =
                matches[0] ||
                searchResult.data.find((r: Match) => !r.file.includes('node_modules'))

              if (bestMatch) {
                const filePath = bestMatch.file.startsWith('/')
                  ? bestMatch.file
                  : `${projectPath}/${bestMatch.file}`
                console.log('[Inline Edit] Found text in:', filePath)

                const readResult = await fileService.readFile(filePath)
                if (!readResult.success || !readResult.data) {
                  console.error('[Inline Edit] Could not read file')
                  return
                }

                const originalContent = readResult.data
                if (originalContent.includes(oldText)) {
                  const patchedContent = originalContent.replace(oldText, data.newText!)
                  const writeResult = await fileService.writeFile(filePath, patchedContent)
                  if (writeResult.success) {
                    console.log('[Inline Edit] FALLBACK SAVED:', filePath)
                    addEditedFileRef.current?.({ path: filePath, additions: 1, deletions: 1 })
                  }
                }
              }
            } else {
              console.log('[Inline Edit] Text not found in project files')
            }
          } catch (e) {
            console.error('[Inline Edit] Fallback search failed:', e)
          }
        } else {
          console.log('[Inline Edit] Cannot save - missing project path or text')
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Text changed: "${data.oldText?.substring(0, 30)}..." → "${data.newText?.substring(0, 30)}..."`,
            timestamp: new Date(),
            model: 'system',
            intent: 'ui_modify',
          },
        ])
      }

      // DOM ready handler
      const handleDomReady = () => {
        console.log(`[Tab ${tabId}] Webview DOM ready`)
        updateTab(tabId, { isWebviewReady: true })
        webview.send('set-inspector-mode', isInspectorActiveRef.current)
        webview.send('set-screenshot-mode', isScreenshotActiveRef.current)
      }

      // Console message handler
      const handleConsoleMessage = (e: {
        level: number
        message: string
        line: number
        sourceId: string
      }) => {
        const levelMap: Record<number, 'log' | 'warn' | 'error' | 'info'> = {
          0: 'log',
          1: 'info',
          2: 'warn',
          3: 'error',
        }
        const logType = levelMap[e.level] || 'log'
        enqueueConsoleLog({ type: logType, message: e.message, timestamp: new Date() })
      }

      // Add event listeners
      webview.addEventListener('dom-ready', handleDomReady)
      webview.addEventListener('console-message', handleConsoleMessage as (e: unknown) => void)
      webview.addEventListener('did-navigate', handleDidNavigate)
      webview.addEventListener('did-navigate-in-page', handleDidNavigate)
      webview.addEventListener('did-start-loading', handleDidStartLoading)
      webview.addEventListener('did-stop-loading', handleDidStopLoading)
      webview.addEventListener('did-finish-load', handleDidFinishLoad)
      webview.addEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void)
      webview.addEventListener('page-title-updated', handlePageTitleUpdated as (e: unknown) => void)
      webview.addEventListener('ipc-message', handleIpcMessage as (e: unknown) => void)

      // Check if webview is already ready
      try {
        const currentWebviewUrl = webview.getURL()
        if (currentWebviewUrl) {
          updateTab(tabId, { isWebviewReady: true })
          webview.send('set-inspector-mode', isInspectorActiveRef.current)
          webview.send('set-screenshot-mode', isScreenshotActiveRef.current)
        }
      } catch (e) {
        console.log(`[Tab ${tabId}] Webview not yet ready for getURL`)
      }

      // Return cleanup function
      return () => {
        webview.removeEventListener('dom-ready', handleDomReady)
        webview.removeEventListener('console-message', handleConsoleMessage as (e: unknown) => void)
        webview.removeEventListener('did-navigate', handleDidNavigate)
        webview.removeEventListener('did-navigate-in-page', handleDidNavigate)
        webview.removeEventListener('did-start-loading', handleDidStartLoading)
        webview.removeEventListener('did-stop-loading', handleDidStopLoading)
        webview.removeEventListener('did-finish-load', handleDidFinishLoad)
        webview.removeEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void)
        webview.removeEventListener(
          'page-title-updated',
          handlePageTitleUpdated as (e: unknown) => void
        )
        webview.removeEventListener('ipc-message', handleIpcMessage as (e: unknown) => void)
      }
    },
    [
      updateTab,
      enqueueConsoleLog,
      activeTabId,
      setUrlInput,
      setHoveredElement,
      setSelectedElement,
      setSelectedTreeNodeId,
      setConsoleLogs,
      setAiSelectedElement,
      setMessages,
      setScreenshotElement,
      setIsScreenshotActive,
      setCapturedScreenshot,
      setMoveTargetPosition,
      setIsMoveActive,
      setPendingDOMApproval,
      setPendingChange,
      selectedElementRef,
      isLeftPanelOpenRef,
      layersTreeDataRef,
      layersTreeStaleRef,
      isLayersLoadingRef,
      isInspectorActiveRef,
      isScreenshotActiveRef,
      handleRefreshLayersRef,
      handleTreeNodeSelectRef,
      addEditedFileRef,
      tabsRef,
      prepareDomPatchRef,
    ]
  )

  /**
   * Get ref callback for webview mounting
   * Returns a stable callback for each tabId to prevent constant re-setup
   */
  const getWebviewRefCallback = useCallback(
    (tabId: string) => {
      // Return existing callback if we have one
      let callback = webviewRefCallbacks.current.get(tabId)
      if (callback) return callback

      // Create new stable callback for this tab
      callback = (element: HTMLElement | null) => {
        if (element) {
          const webview = element as unknown as WebviewElement
          webviewRefs.current.set(tabId, webview)

          // Small delay to ensure webview is fully mounted
          setTimeout(() => {
            // Clean up previous handlers if any
            const prevCleanup = webviewCleanups.current.get(tabId)
            if (prevCleanup) prevCleanup()

            // Set up new handlers
            const cleanup = setupWebviewHandlers(tabId, webview)
            webviewCleanups.current.set(tabId, cleanup)
          }, 100)
        } else {
          // Element unmounted - clean up
          const cleanup = webviewCleanups.current.get(tabId)
          if (cleanup) cleanup()
          webviewCleanups.current.delete(tabId)
          webviewRefs.current.delete(tabId)
        }
      }
      webviewRefCallbacks.current.set(tabId, callback)
      return callback
    },
    [setupWebviewHandlers]
  )

  return {
    setupWebviewHandlers,
    getWebviewRefCallback,
    webviewRefs,
    webviewCleanups,
  }
}
