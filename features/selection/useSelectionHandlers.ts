/**
 * Selection Handlers Hook
 *
 * Centralizes element selection handlers extracted from App.tsx.
 * Provides handlers for AI element selection, DOM navigation,
 * drill-down selection, layers, and element style changes.
 */

import { useCallback, useRef, useEffect } from 'react'
import type { SelectedElement, Message } from '../../types'
import type { ElementStyles } from '../../types/elementStyles'
import type { TreeNode } from '../../components/ComponentTree'
import { getTargetOrigin } from '../../utils/webviewMessaging'

// WebView element type from Electron
export interface WebviewElement extends HTMLElement {
  getURL: () => string
  canGoBack: () => boolean
  canGoForward: () => boolean
  send: (channel: string, ...args: unknown[]) => void
  executeJavaScript: <T = unknown>(code: string) => Promise<T>
  contentWindow?: Window
  capturePage: (rect?: { x: number; y: number; width: number; height: number }) => Promise<Electron.NativeImage>
}

/**
 * AI Selected Element state
 */
export interface AiSelectedElement {
  selector?: string
  reasoning: string
  count?: number
  elements?: SelectedElement[]
}

/**
 * Dependencies required by the selection handlers
 */
export interface SelectionHandlersDeps {
  // Webview access
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
  activeTabId: string
  activeTab: { url?: string; projectPath?: string }
  isWebviewReady: boolean

  // State setters
  setSelectedElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setAiSelectedElement: React.Dispatch<React.SetStateAction<AiSelectedElement | null>>
  setViewportSize: (size: 'mobile' | 'tablet' | 'desktop') => void
  setActiveTabId: (id: string) => void
  handleNewTab: (type: string) => void
  tabs: Array<{ id: string; type: string }>

  // Layers panel
  setIsLayersLoading: React.Dispatch<React.SetStateAction<boolean>>
  setLayersTreeData: React.Dispatch<React.SetStateAction<TreeNode | null>>
  layersTreeStaleRef: React.MutableRefObject<boolean>
  isMultiViewportMode: boolean
  multiViewportData: Array<{ id: string; windowType: string; devicePresetId?: string }>

  // Tree node selection
  setSelectedTreeNodeId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedLayerElementNumber: React.Dispatch<React.SetStateAction<number | null>>
  setSelectedLayerElementName: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedLayerComputedStyles: React.Dispatch<React.SetStateAction<Record<string, string> | null>>
  setSelectedLayerAttributes: React.Dispatch<React.SetStateAction<Record<string, string> | null>>
  setSelectedLayerDataset: React.Dispatch<React.SetStateAction<Record<string, string> | null>>
  setSelectedLayerFontFamilies: React.Dispatch<React.SetStateAction<string[] | null>>
  setSelectedLayerClassNames: React.Dispatch<React.SetStateAction<string[] | null>>

  // Element styles
  setElementStyles: React.Dispatch<React.SetStateAction<ElementStyles>>
  elementStylesRef: React.MutableRefObject<ElementStyles>
  selectedLayerElementNumberRef: React.MutableRefObject<number | null>
  activeTabIdRef: React.MutableRefObject<string>

  // Viewport controls
  viewportControlsRef: React.MutableRefObject<{ focusViewport?: (id: string) => void } | null>

  // AI state
  aiSelectedElement: AiSelectedElement | null
}

/**
 * Return type for the selection handlers hook
 */
export interface UseSelectionHandlersReturn {
  // AI element handlers
  handleAiElementSelect: (selector: string, reasoning?: string) => void
  handleExecuteCode: (code: string, description: string) => void
  handleConfirmSelection: (confirmed: boolean, elementNumber?: number) => void
  handleHighlightByNumber: (elementNumber: number) => Promise<{ success: boolean; element?: unknown; error?: string }>

  // Focus handlers
  handleClearFocus: () => Promise<{ success: boolean }>
  handleSetViewport: (mode: 'mobile' | 'tablet' | 'desktop') => Promise<{ success: boolean }>
  handleSwitchTab: (type: 'browser' | 'kanban' | 'todos' | 'notes') => Promise<{ success: boolean }>
  handleFindElementByText: (searchText: string, elementType?: string) => Promise<{
    success: boolean
    matches?: Array<{ elementNumber: number; text: string; tagName: string }>
    error?: string
  }>

  // DOM navigation handlers
  handleSelectParent: (levels?: number) => Promise<{ success: boolean; element?: Record<string, unknown>; error?: string }>
  handleSelectChildren: (selector?: string) => Promise<{ success: boolean; children?: Record<string, unknown>[]; error?: string }>
  handleSelectSiblings: (direction: 'next' | 'prev' | 'all') => Promise<{ success: boolean; siblings?: Record<string, unknown>[]; error?: string }>
  handleSelectAllMatching: (matchBy: 'tag' | 'class' | 'both') => Promise<{ success: boolean; matches?: Record<string, unknown>[]; error?: string }>

  // Drill-down handlers
  handleStartDrillSelection: () => Promise<{ success: boolean; sections?: Record<string, unknown>[]; level?: number; error?: string }>
  handleDrillInto: (elementNumber: number) => Promise<{
    success: boolean
    isFinalSelection?: boolean
    element?: Record<string, unknown>
    children?: Record<string, unknown>[]
    description?: string
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }>
  handleDrillBack: () => Promise<{
    success: boolean
    children?: Record<string, unknown>[]
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }>
  handleDrillForward: () => Promise<{
    success: boolean
    children?: Record<string, unknown>[]
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }>
  handleExitDrillMode: () => Promise<{ success: boolean }>

  // Layers handlers
  handleRefreshLayers: () => Promise<void>
  handleRefreshLayersRef: React.MutableRefObject<() => Promise<void>>
  handleTreeNodeSelect: (node: TreeNode) => Promise<void>
  handleTreeNodeSelectRef: React.MutableRefObject<(node: TreeNode) => void>

  // Element style handlers
  handleElementStyleChange: (key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => void
  flushApplyElementStyles: () => void
  queueApplyElementStyles: () => void

  // Page elements handler
  handleGetPageElements: (category?: string, showBadges?: boolean) => Promise<string>
}

/**
 * Hook for managing element selection handlers
 *
 * Extracts and centralizes selection handlers from App.tsx.
 * Provides handlers for AI element selection, DOM navigation,
 * drill-down selection, layers, and element style changes.
 */
export function useSelectionHandlers(deps: SelectionHandlersDeps): UseSelectionHandlersReturn {
  const {
    webviewRefs,
    activeTabId,
    activeTab,
    isWebviewReady,
    setSelectedElement,
    setMessages,
    setAiSelectedElement,
    setViewportSize,
    setActiveTabId,
    handleNewTab,
    tabs,
    setIsLayersLoading,
    setLayersTreeData,
    layersTreeStaleRef,
    isMultiViewportMode,
    multiViewportData,
    setSelectedTreeNodeId,
    setSelectedLayerElementNumber,
    setSelectedLayerElementName,
    setSelectedLayerComputedStyles,
    setSelectedLayerAttributes,
    setSelectedLayerDataset,
    setSelectedLayerFontFamilies,
    setSelectedLayerClassNames,
    setElementStyles,
    elementStylesRef,
    selectedLayerElementNumberRef,
    activeTabIdRef,
    viewportControlsRef,
    aiSelectedElement,
  } = deps

  const applyElementStylesTimerRef = useRef<number | null>(null)

  // Handle AI element selection request
  const handleAiElementSelect = useCallback((selector: string, reasoning?: string) => {
    console.log('[AI] Requesting element selection:', selector, reasoning)

    // Validate selector - catch common jQuery mistakes
    const invalidPatterns = [
      { pattern: /:contains\s*\(/i, name: ':contains()' },
      { pattern: /:has\s*\([^)]*text/i, name: ':has(text)' },
      { pattern: /:eq\s*\(/i, name: ':eq()' },
      { pattern: /:gt\s*\(/i, name: ':gt()' },
      { pattern: /:lt\s*\(/i, name: ':lt()' },
      { pattern: /:first(?!-)/i, name: ':first (use :first-child or :first-of-type)' },
      { pattern: /:last(?!-)/i, name: ':last (use :last-child or :last-of-type)' },
    ]

    for (const { pattern, name } of invalidPatterns) {
      if (pattern.test(selector)) {
        console.error(`[AI] Invalid selector: ${name} is not valid CSS. Use attribute selectors like [attr*="text"] instead.`)
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Invalid selector: ${name} is jQuery-only, not valid CSS. Use attribute selectors like [attr*="text"] or call get_page_elements first.`,
          timestamp: new Date()
        }])
        return
      }
    }

    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isWebviewReady) {
      // Send IPC message to webview to highlight the element
      webview.send('select-element-by-selector', selector)

      // Store pending selection (we'll get confirmation via message)
      setAiSelectedElement({ selector, reasoning: reasoning || '' })
    }
  }, [isWebviewReady, activeTabId, webviewRefs, setMessages, setAiSelectedElement])

  // Handle AI code execution
  const handleExecuteCode = useCallback((code: string, description: string) => {
    console.log('[AI] Executing code:', description)
    console.log('[AI] Code to execute:', code)
    const webview = webviewRefs.current.get(activeTabId)
    if (webview && isWebviewReady) {
      // Wrap code in try-catch to capture actual error from webview
      const wrappedCode = `
        (function() {
          try {
            ${code}
            return { success: true };
          } catch (err) {
            return { success: false, error: err.message, stack: err.stack };
          }
        })()
      `
      webview.executeJavaScript(wrappedCode)
        .then((result: { success: boolean; error?: string; stack?: string }) => {
          if (result && result.success) {
            console.log('[AI] Code executed successfully')
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `\u2713 ${description}`,
              timestamp: new Date()
            }])
          } else {
            const errorMsg = result?.error || 'Unknown error'
            console.error('[AI] Code execution error inside webview:', errorMsg)
            if (result?.stack) console.error('[AI] Stack:', result.stack)
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `\u2717 Error: ${errorMsg}`,
              timestamp: new Date()
            }])
          }
        })
        .catch((err: Error) => {
          // This catches syntax errors that prevent the code from even running
          console.error('[AI] Code execution error (syntax/parse):', err)
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `\u2717 Syntax Error: ${err.message}`,
            timestamp: new Date()
          }])
        })
    }
  }, [isWebviewReady, activeTabId, webviewRefs, setMessages])

  // Handle voice confirmation - can optionally specify which numbered element (1-indexed)
  const handleConfirmSelection = useCallback((confirmed: boolean, elementNumber?: number) => {
    console.log('[AI] Voice confirmation:', confirmed, 'element number:', elementNumber)
    const webview = webviewRefs.current.get(activeTabId)
    if (confirmed && aiSelectedElement?.elements && aiSelectedElement.elements.length > 0) {
      // If elementNumber specified (1-indexed), use that, otherwise use first
      const index = elementNumber ? Math.min(Math.max(elementNumber - 1, 0), aiSelectedElement.elements.length - 1) : 0
      setSelectedElement(aiSelectedElement.elements[index])
      webview?.send('clear-selection')
      setAiSelectedElement(null)
    } else {
      webview?.send('clear-selection')
      setAiSelectedElement(null)
    }
  }, [aiSelectedElement, activeTabId, webviewRefs, setSelectedElement, setAiSelectedElement])

  // Handle highlight by number - visually highlights element without editing code
  const handleHighlightByNumber = useCallback(async (elementNumber: number): Promise<{ success: boolean; element?: unknown; error?: string }> => {
    console.log('[AI] Highlighting element by number:', elementNumber)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    const highlightCode = `
      (function() {
        const elementNumber = ${elementNumber};
        const elements = window.__numberedElements;

        if (!elements || elements.length === 0) {
          return { success: false, error: 'No numbered elements. Call get_page_elements first.' };
        }

        const index = elementNumber - 1; // Convert to 0-indexed
        if (index < 0 || index >= elements.length) {
          return { success: false, error: 'Element ' + elementNumber + ' not found. Valid range: 1-' + elements.length };
        }

        const element = elements[index];

        // Clear any previous highlight
        document.querySelectorAll('.cluso-highlighted').forEach(el => {
          el.classList.remove('cluso-highlighted');
          el.style.outline = '';
          el.style.outlineOffset = '';
        });

        // Clear all number badges now that user has selected one
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());

        // Highlight the selected element
        element.classList.add('cluso-highlighted');
        element.style.outline = '3px solid #3b82f6';
        element.style.outlineOffset = '2px';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Store as current focus for subsequent operations
        window.__focusedElement = element;

        const text = element.innerText?.substring(0, 50) || '';
        const tag = element.tagName.toLowerCase();

        return {
          success: true,
          element: { number: elementNumber, tag, text: text.trim(), totalElements: elements.length }
        };
      })()
    `

    try {
      const result = await webview.executeJavaScript(highlightCode) as { success: boolean; element?: unknown; error?: string }
      console.log('[AI] Highlight by number result:', result)
      return result
    } catch (err) {
      console.error('[AI] Highlight by number error:', err)
      return { success: false, error: (err as Error).message }
    }
  }, [isWebviewReady, activeTabId, webviewRefs])

  // Handle clear_focus tool - clears the hierarchical focus scope
  const handleClearFocus = useCallback(async (): Promise<{ success: boolean }> => {
    console.log('[AI] Clearing focus scope')
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false }
    }

    const clearCode = `
      (function() {
        // Clear focus
        window.__focusedElement = null;

        // Clear all highlights
        document.querySelectorAll('.cluso-highlighted').forEach(el => {
          el.classList.remove('cluso-highlighted');
          el.style.outline = '';
          el.style.outlineOffset = '';
        });

        // Clear number badges
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());

        // Clear stored elements
        window.__numberedElements = [];

        return { success: true };
      })()
    `

    try {
      await webview.executeJavaScript(clearCode)
      console.log('[AI] Focus cleared')
      return { success: true }
    } catch (err) {
      console.error('[AI] Clear focus error:', err)
      return { success: false }
    }
  }, [isWebviewReady, activeTabId, webviewRefs])

  // Handle set_viewport tool - switches between mobile/tablet/desktop views
  const handleSetViewport = useCallback(async (mode: 'mobile' | 'tablet' | 'desktop'): Promise<{ success: boolean }> => {
    console.log('[AI] Setting viewport to:', mode)
    setViewportSize(mode)
    return { success: true }
  }, [setViewportSize])

  // Handle switch_tab tool - switches to or creates different tab types
  const handleSwitchTab = useCallback(async (type: 'browser' | 'kanban' | 'todos' | 'notes'): Promise<{ success: boolean }> => {
    console.log('[AI] Switching to tab type:', type)
    // Check if a tab of this type already exists
    const existingTab = tabs.find(t => t.type === type)
    if (existingTab) {
      setActiveTabId(existingTab.id)
    } else {
      // Create a new tab of the specified type
      handleNewTab(type)
    }
    return { success: true }
  }, [tabs, handleNewTab, setActiveTabId])

  // Handle find_element_by_text tool - searches page for elements by visible text content
  const handleFindElementByText = useCallback(async (
    searchText: string,
    elementType?: string
  ): Promise<{ success: boolean; matches?: Array<{ elementNumber: number; text: string; tagName: string }>; error?: string }> => {
    console.log('[AI] Finding elements by text:', searchText, 'type:', elementType)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    const searchCode = `
      (function() {
        const searchText = ${JSON.stringify(searchText.toLowerCase())};
        const elementType = ${elementType ? JSON.stringify(elementType.toLowerCase()) : 'null'};

        // Get all visible elements with text content
        const allElements = Array.from(document.querySelectorAll('*'));
        const matches = [];
        let elementNumber = 0;

        // Store elements for later highlighting
        const numberedElements = [];

        for (const el of allElements) {
          // Skip invisible elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          // Skip non-interactive elements (unless they have meaningful text)
          const tagName = el.tagName.toLowerCase();
          const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'label', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li'];
          if (!interactiveTags.includes(tagName)) continue;

          // Filter by element type if specified
          if (elementType && tagName !== elementType) continue;

          // Get text content (direct text, not from children)
          let text = '';
          if (tagName === 'input') {
            text = el.value || el.placeholder || el.getAttribute('aria-label') || '';
          } else {
            // Get direct text content
            text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent)
              .join(' ').trim();
            // If no direct text, try innerText but limit to prevent huge strings
            if (!text) {
              text = (el.innerText || '').substring(0, 100);
            }
          }

          // Also check aria-label and title
          const ariaLabel = el.getAttribute('aria-label') || '';
          const title = el.getAttribute('title') || '';
          const combinedText = (text + ' ' + ariaLabel + ' ' + title).toLowerCase();

          // Check for match (case-insensitive, partial match)
          if (combinedText.includes(searchText)) {
            elementNumber++;
            numberedElements.push(el);
            matches.push({
              elementNumber,
              text: text.trim().substring(0, 100) || ariaLabel || title || tagName,
              tagName: tagName.toUpperCase()
            });

            // Limit to 20 matches
            if (matches.length >= 20) break;
          }
        }

        // Store for highlighting
        window.__numberedElements = numberedElements;

        // Add number badges to matched elements
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());
        numberedElements.forEach((el, i) => {
          const badge = document.createElement('div');
          badge.className = 'element-number-badge';
          badge.setAttribute('data-cluso-ui', '1');
          badge.textContent = String(i + 1);
          badge.style.cssText = 'position:absolute;background:#3b82f6;color:white;font-size:10px;font-weight:bold;padding:1px 4px;border-radius:3px;z-index:99999;pointer-events:none;';
          const rect = el.getBoundingClientRect();
          badge.style.top = (rect.top + window.scrollY - 15) + 'px';
          badge.style.left = (rect.left + window.scrollX) + 'px';
          document.body.appendChild(badge);
        });

        return { success: true, matches };
      })()
    `

    try {
      const result = await webview.executeJavaScript(searchCode) as { success: boolean; matches?: { elementNumber: number; text: string; tagName: string }[]; error?: string }
      console.log('[AI] Find by text result:', result)
      return result
    } catch (err) {
      console.error('[AI] Find by text error:', err)
      return { success: false, error: (err as Error).message }
    }
  }, [isWebviewReady, activeTabId, webviewRefs])

  // DOM Navigation handlers for voice agent - these communicate with iframe-injection.ts
  const handleSelectParent = useCallback(async (levels: number = 1): Promise<{ success: boolean; element?: Record<string, unknown>; error?: string }> => {
    console.log('[AI] Select parent, levels:', levels)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_PARENT_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success && event.data.element) {
            resolve({ success: true, element: event.data.element })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to select parent' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      // Send message to webview
      webview.contentWindow?.postMessage({ type: 'SELECT_PARENT', levels }, getTargetOrigin(activeTab?.url))

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout waiting for parent selection' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleSelectChildren = useCallback(async (selector?: string): Promise<{ success: boolean; children?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select children, filter:', selector)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_CHILDREN_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            const children = event.data.children?.map((c: { element: Record<string, unknown> }) => c.element) || []
            resolve({ success: true, children })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to get children' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'SELECT_CHILDREN', selector }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout waiting for children' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleSelectSiblings = useCallback(async (direction: 'next' | 'prev' | 'all'): Promise<{ success: boolean; siblings?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select siblings, direction:', direction)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_SIBLINGS_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            const siblings = event.data.siblings?.map((s: { element: Record<string, unknown> }) => s.element) || []
            resolve({ success: true, siblings })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to get siblings' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'SELECT_SIBLINGS', direction }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout waiting for siblings' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleSelectAllMatching = useCallback(async (matchBy: 'tag' | 'class' | 'both'): Promise<{ success: boolean; matches?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select all matching, by:', matchBy)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_ALL_MATCHING_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            const matches = event.data.matches?.map((m: { element: Record<string, unknown> }) => m.element) || []
            resolve({ success: true, matches })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to find matching elements' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'SELECT_ALL_MATCHING', matchBy }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout waiting for matching elements' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  // --- Hierarchical Drill-Down Selection Handlers ---
  const handleStartDrillSelection = useCallback(async (): Promise<{ success: boolean; sections?: Record<string, unknown>[]; level?: number; error?: string }> => {
    console.log('[AI] Starting drill-down selection')
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'START_DRILL_SELECTION_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            resolve({ success: true, sections: event.data.sections, level: event.data.level })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to start drill selection' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'START_DRILL_SELECTION' }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout starting drill selection' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleDrillInto = useCallback(async (elementNumber: number): Promise<{
    success: boolean
    isFinalSelection?: boolean
    element?: Record<string, unknown>
    children?: Record<string, unknown>[]
    description?: string
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }> => {
    console.log('[AI] Drill into element:', elementNumber)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_INTO_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            resolve({
              success: true,
              isFinalSelection: event.data.isFinalSelection,
              element: event.data.element,
              children: event.data.children,
              description: event.data.description || event.data.parentDescription,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            })
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to drill into element' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'DRILL_INTO', elementNumber }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout drilling into element' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleDrillBack = useCallback(async (): Promise<{
    success: boolean
    children?: Record<string, unknown>[]
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }> => {
    console.log('[AI] Drill back')
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_BACK_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            resolve({
              success: true,
              children: event.data.children,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            })
          } else {
            resolve({ success: false, error: event.data.error || 'Cannot go back' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'DRILL_BACK' }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout going back' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleDrillForward = useCallback(async (): Promise<{
    success: boolean
    children?: Record<string, unknown>[]
    level?: number
    canGoBack?: boolean
    canGoForward?: boolean
    error?: string
  }> => {
    console.log('[AI] Drill forward')
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_FORWARD_RESULT') {
          window.removeEventListener('message', handleResponse)
          if (event.data.success) {
            resolve({
              success: true,
              children: event.data.children,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            })
          } else {
            resolve({ success: false, error: event.data.error || 'No forward history' })
          }
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'DRILL_FORWARD' }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, error: 'Timeout going forward' })
      }, 5000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  const handleExitDrillMode = useCallback(async (): Promise<{ success: boolean }> => {
    console.log('[AI] Exit drill mode')
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return { success: false }
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'EXIT_DRILL_MODE_RESULT') {
          window.removeEventListener('message', handleResponse)
          resolve({ success: event.data.success })
        }
      }
      window.addEventListener('message', handleResponse)

      webview.contentWindow?.postMessage({ type: 'EXIT_DRILL_MODE' }, getTargetOrigin(activeTab?.url))

      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: true }) // Assume success on timeout
      }, 2000)
    })
  }, [isWebviewReady, activeTabId, activeTab?.url, webviewRefs])

  // Layers panel handlers
  const handleRefreshLayers = useCallback(async () => {
    setIsLayersLoading(true)
    try {
      // In multi-viewport mode, show canvas/nodes tree instead of page elements
      if (isMultiViewportMode && multiViewportData.length > 0) {
        const getNodeName = (v: { windowType: string; devicePresetId?: string }) => {
          if (v.windowType === 'device') {
            const presetNames: Record<string, string> = {
              'desktop': 'Desktop',
              'laptop': 'Laptop',
              'iphone-15-pro': 'iPhone 15 Pro',
              'iphone-15': 'iPhone 15',
              'iphone-se': 'iPhone SE',
              'pixel-8': 'Pixel 8',
              'galaxy-s24': 'Galaxy S24',
              'ipad-pro-12': 'iPad Pro 12.9"',
              'ipad-pro-11': 'iPad Pro 11"',
              'ipad-mini': 'iPad Mini',
            }
            return presetNames[v.devicePresetId || 'desktop'] || v.devicePresetId || 'Device'
          }
          const typeNames: Record<string, string> = {
            'kanban': 'Kanban Board',
            'todo': 'Todo List',
            'notes': 'Notes',
            'terminal': 'Terminal',
          }
          return typeNames[v.windowType] || v.windowType
        }

        const getNodeType = (windowType: string): TreeNode['type'] => {
          if (windowType === 'device') return 'frame'
          if (windowType === 'terminal') return 'input'
          return 'component'
        }

        const canvasTree: TreeNode = {
          id: 'canvas',
          name: 'Canvas',
          type: 'page',
          children: multiViewportData.map(v => ({
            id: `node-${v.id}`,
            name: getNodeName(v),
            type: getNodeType(v.windowType),
            tagName: v.windowType,
          })),
        }

        setLayersTreeData(canvasTree)
        setIsLayersLoading(false)
        return
      }

      // Single viewport mode - scan page elements
      if (!isWebviewReady) {
        setIsLayersLoading(false)
        return
      }

      const webview = webviewRefs.current.get(activeTabId)
      if (!webview) {
        setIsLayersLoading(false)
        return
      }

      // Get page elements and build tree structure with proper DOM nesting
      const scanCode = `
        (function() {
          let elementNumber = 0;
          const elementMap = new Map(); // Store elements by number for highlighting

          // Important selectors - elements we want to show in tree
          const importantTags = new Set(['button', 'a', 'input', 'textarea', 'select', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form', 'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', 'ul', 'ol', 'table']);
          const containerTags = new Set(['div', 'span', 'li', 'p', 'label', 'td', 'tr', 'th']);

          function getXPath(el) {
            try {
              if (!el || el.nodeType !== 1) return '';
              const parts = [];
              while (el && el.nodeType === 1) {
                let idx = 1;
                for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
                  if (sib.nodeType === 1 && sib.nodeName === el.nodeName) idx++;
                }
                parts.unshift(el.nodeName.toLowerCase() + '[' + idx + ']');
                el = el.parentNode;
              }
              return '/' + parts.join('/');
            } catch (e) {
              return '';
            }
          }

          function processElement(el) {
            if (!el || el.nodeType !== 1) return null;

            const tagName = el.tagName.toLowerCase();
            if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') return null;
            if (el.closest && el.closest('[data-cluso-ui="1"]')) return null;

            const style = window.getComputedStyle(el);
            if (style.display === 'none') return null;

            const isImportant = importantTags.has(tagName);
            const isContainer = containerTags.has(tagName);

            // Skip non-important containers with no text/children
            if (!isImportant && isContainer) {
              const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim());
              if (!hasDirectText && !el.children.length) return null;
            }

            elementNumber++;
            elementMap.set(elementNumber, el);

            const text = (el.innerText || '').substring(0, 50).trim();
            const id = el.id || '';
            const className = el.className || '';
            const displayName = text || (id ? '#' + id : '') || (className ? '.' + String(className).split(' ')[0] : '') || tagName;

            // Determine node type based on tag
            let type = 'component';
            if (tagName === 'button' || el.getAttribute('role') === 'button') type = 'button';
            else if (tagName === 'a') type = 'link';
            else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') type = 'input';
            else if (tagName === 'img') type = 'image';
            else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'].includes(tagName)) type = 'text';
            else if (['ul', 'ol', 'li'].includes(tagName)) type = 'list';
            else if (['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'].includes(tagName)) type = 'frame';

            // Check for source mapping
            const sourceFile = el.getAttribute('data-cluso-file') || null;
            const sourceLine = el.getAttribute('data-cluso-line') ? parseInt(el.getAttribute('data-cluso-line'), 10) : null;
            const sourceColumn = el.getAttribute('data-cluso-column') ? parseInt(el.getAttribute('data-cluso-column'), 10) : null;

            const children = [];
            for (const child of el.children) {
              const childNode = processElement(child);
              if (childNode) children.push(childNode);
            }

            return {
              id: getXPath(el),
              name: displayName.substring(0, 40),
              type,
              tagName,
              elementNumber,
              sourceFile,
              sourceLine,
              sourceColumn,
              children: children.length > 0 ? children : undefined,
            };
          }

          // Process body children
          const elements = [];
          for (const child of document.body.children) {
            const node = processElement(child);
            if (node) elements.push(node);
          }

          // Store element map globally for highlighting
          window.__layersElements = elementMap;

          return elements;
        })()
      `

      const elements = await webview.executeJavaScript(scanCode) as TreeNode[]

      const treeData: TreeNode = {
        id: 'root',
        name: 'Page',
        type: 'page',
        children: elements.slice(0, 200), // Limit for performance
      }

      setLayersTreeData(treeData)
      layersTreeStaleRef.current = false
    } catch (err) {
      console.error('[Layers] Refresh error:', err)
    }
    setIsLayersLoading(false)
  }, [isWebviewReady, activeTabId, isMultiViewportMode, multiViewportData, webviewRefs, setIsLayersLoading, setLayersTreeData, layersTreeStaleRef])

  const handleRefreshLayersRef = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => { handleRefreshLayersRef.current = handleRefreshLayers }, [handleRefreshLayers])

  const handleTreeNodeSelect = useCallback(async (node: TreeNode) => {
    setSelectedTreeNodeId(node.id)

    // In multi-viewport mode, clicking a node focuses it on the canvas
    if (isMultiViewportMode && node.id.startsWith('node-')) {
      const viewportId = node.id.replace('node-', '')
      viewportControlsRef.current?.focusViewport?.(viewportId)
      return
    }

    if (node.elementNumber) {
      setSelectedLayerElementNumber(node.elementNumber)
      setSelectedLayerElementName(node.name || null)

      // Highlight in webview
      const webview = webviewRefs.current.get(activeTabId)
      if (!webview) return

      // Also sync selection into the inspector overlay for a unified experience
      try {
        webview.send('select-layer-element-by-number', node.elementNumber)
      } catch {
        // ignore
      }

      // Pull computed styles for the element to seed the properties panel
      try {
        const result = await webview.executeJavaScript(`
          (function() {
            const map = window.__layersElements;
            if (!map || !(map instanceof Map)) return { success: false, error: 'No element map' };
            const el = map.get(${node.elementNumber});
            if (!el) return { success: false, error: 'Element not found' };

            const rect = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            const computedStyles = {};
            try {
              for (let i = 0; i < cs.length; i++) {
                const prop = cs[i];
                computedStyles[prop] = String(cs.getPropertyValue(prop) || '').trim();
              }
            } catch (e) {}

            const attributes = {};
            try {
              for (const attr of Array.from(el.attributes || [])) {
                if (!attr || !attr.name) continue;
                attributes[attr.name] = String(attr.value ?? '');
              }
            } catch (e) {}

            const dataset = {};
            try {
              const ds = el.dataset || {};
              for (const k in ds) {
                if (!Object.prototype.hasOwnProperty.call(ds, k)) continue;
                dataset[k] = String(ds[k] ?? '');
              }
            } catch (e) {}

            function addFamilies(set, raw) {
              if (!raw) return;
              const parts = String(raw)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => s.replace(/^['\"]|['\"]$/g, ''));
              for (const p of parts) {
                if (p) set.add(p);
              }
            }

            const fontFamiliesSet = new Set();
            try {
              addFamilies(fontFamiliesSet, cs.fontFamily);
              const sheets = Array.from(document.styleSheets || []);
              for (const sheet of sheets) {
                let rules;
                try { rules = sheet.cssRules; } catch (e) { continue; }
                if (!rules) continue;
                for (const rule of Array.from(rules)) {
                  const t = rule.type;
                  // CSSFontFaceRule
                  if (t === 5 && rule.style) {
                    addFamilies(fontFamiliesSet, rule.style.getPropertyValue('font-family'));
                    continue;
                  }
                  // CSSStyleRule
                  if (t === 1 && rule.style) {
                    addFamilies(fontFamiliesSet, rule.style.fontFamily || rule.style.getPropertyValue('font-family'));
                    continue;
                  }
                }
              }
            } catch (e) {}

            const classNamesSet = new Set();
            try {
              const all = Array.from(document.querySelectorAll('[class]'));
              for (const node of all) {
                if (node.closest && node.closest('[data-cluso-ui="1"]')) continue;
                const cls = node.className;
                if (!cls) continue;
                const tokens = String(cls).split(/\\s+/).map(s => s.trim()).filter(Boolean);
                for (const t of tokens) {
                  if (!t || t.length >= 80) continue;
                  if (t === 'element-number-badge' || t === 'inspector-hover-target' || t === 'inspector-selected-target') continue;
                  if (t === 'screenshot-hover-target' || t === 'move-hover-target') continue;
                  if (t === 'drop-zone-label' || t === 'move-floating-overlay' || t === 'move-resize-handle' || t === 'move-position-label') continue;
                  classNamesSet.add(t);
                }
                if (classNamesSet.size > 5000) break;
              }
            } catch (e) {}

            function px(v) {
              const n = parseFloat(String(v || '0'));
              return Number.isFinite(n) ? n : 0;
            }

            function rgbToHex(color) {
              if (!color) return '#000000';
              const c = String(color).trim();
              if (c.startsWith('#')) return c;
              const m = c.match(/^rgba?\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
              if (!m) return '#000000';
              const r = Number(m[1]) || 0;
              const g = Number(m[2]) || 0;
              const b = Number(m[3]) || 0;
              const toHex = (n) => n.toString(16).padStart(2, '0');
              return '#' + toHex(r) + toHex(g) + toHex(b);
            }

            function parseTransform(transform) {
              const t = String(transform || '').trim();
              if (!t || t === 'none') return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
              const m2 = t.match(/^matrix\\(([^)]+)\\)$/);
              if (m2) {
                const parts = m2[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 6) {
                  const [a, b, c, d, tx, ty] = parts;
                  const rotation = Math.round(Math.atan2(b, a) * (180 / Math.PI));
                  const scaleX = Math.sign(a || 1) * Math.sqrt((a * a) + (b * b));
                  const scaleY = Math.sign(d || 1) * Math.sqrt((c * c) + (d * d));
                  return { x: Math.round(tx), y: Math.round(ty), rotation, scaleX: scaleX >= 0 ? 1 : -1, scaleY: scaleY >= 0 ? 1 : -1 };
                }
              }
              const m3 = t.match(/^matrix3d\\(([^)]+)\\)$/);
              if (m3) {
                const parts = m3[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 16) {
                  const a = parts[0];
                  const b = parts[1];
                  const c = parts[4];
                  const d = parts[5];
                  const tx = parts[12];
                  const ty = parts[13];
                  const rotation = Math.round(Math.atan2(b, a) * (180 / Math.PI));
                  const scaleX = Math.sign(a || 1) * Math.sqrt((a * a) + (b * b));
                  const scaleY = Math.sign(d || 1) * Math.sqrt((c * c) + (d * d));
                  return { x: Math.round(tx), y: Math.round(ty), rotation, scaleX: scaleX >= 0 ? 1 : -1, scaleY: scaleY >= 0 ? 1 : -1 };
                }
              }
              return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
            }

            const transform = parseTransform(cs.transform);
            const display = cs.display === 'flex' ? 'flex' : cs.display === 'grid' ? 'grid' : 'block';
            const flexDirection = cs.flexDirection === 'column' ? 'column' : 'row';
            const justify = ['flex-start', 'center', 'flex-end', 'space-between'].includes(cs.justifyContent)
              ? cs.justifyContent
              : 'flex-start';
            const align = ['flex-start', 'center', 'flex-end'].includes(cs.alignItems)
              ? cs.alignItems
              : 'flex-start';

            return {
              success: true,
              styles: {
                className: (el.className || ''),
                cssOverrides: {},
                attributeOverrides: {},
                datasetOverrides: {},
                x: transform.x,
                y: transform.y,
                rotation: transform.rotation,
                scaleX: transform.scaleX,
                scaleY: transform.scaleY,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                display,
                flexDirection,
                justifyContent: justify,
                alignItems: align,
                gap: px(cs.gap),
                padding: px(cs.paddingTop),
                overflow: (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') ? 'hidden' : 'visible',
                boxSizing: cs.boxSizing === 'content-box' ? 'content-box' : 'border-box',
                backgroundColor: rgbToHex(cs.backgroundColor),
                opacity: Math.round(parseFloat(cs.opacity || '1') * 100),
                borderRadius: px(cs.borderTopLeftRadius),
                borderWidth: px(cs.borderTopWidth),
                borderStyle: ['none', 'solid', 'dashed', 'dotted'].includes(cs.borderTopStyle) ? cs.borderTopStyle : 'solid',
                borderColor: rgbToHex(cs.borderTopColor),
                color: rgbToHex(cs.color),
                fontFamily: String(cs.fontFamily || 'system-ui'),
                fontSize: px(cs.fontSize),
                fontWeight: Number.parseInt(String(cs.fontWeight || '400'), 10) || 400,
                lineHeight: String(cs.lineHeight || '').trim() === 'normal' ? 0 : px(cs.lineHeight),
                letterSpacing: String(cs.letterSpacing || '').trim() === 'normal' ? 0 : px(cs.letterSpacing),
                textAlign: ['left', 'center', 'right', 'justify'].includes(cs.textAlign) ? cs.textAlign : 'left',
                shadowEnabled: String(cs.boxShadow || '').trim() !== '' && String(cs.boxShadow || '').trim() !== 'none',
                shadowVisible: String(cs.boxShadow || '').trim() !== '' && String(cs.boxShadow || '').trim() !== 'none',
                shadowType: String(cs.boxShadow || '').includes('inset') ? 'inner' : 'drop',
                shadowX: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[1]) || 0) : 0;
                })(),
                shadowY: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[2]) || 0) : 0;
                })(),
                shadowBlur: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[3]) || 0) : 0;
                })(),
                shadowSpread: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[4]) || 0) : 0;
                })(),
                shadowColor: (function() {
                  const c = String(cs.boxShadow || '');
                  const m = c.match(/(rgba?\\([^\\)]+\\)|#[0-9a-fA-F]{3,8})/);
                  return m ? m[1] : 'rgba(0,0,0,0.25)';
                })(),
                blurType: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  if (b) return 'backdrop';
                  return 'layer';
                })(),
                blurEnabled: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  const f = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return !!(b || f);
                })(),
                blurVisible: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  const f = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return !!(b || f);
                })(),
                blur: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  if (b) return (parseFloat(b[1]) || 0);
                  const m = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return m ? (parseFloat(m[1]) || 0) : 0;
                })(),
              }
              ,
              computedStyles,
              attributes,
              dataset,
              fontFamilies: Array.from(fontFamiliesSet).slice(0, 200),
              classNames: Array.from(classNamesSet).slice(0, 5000)
            };
          })()
        `) as { success: boolean; styles?: Record<string, string>; computedStyles?: Record<string, string>; attributes?: Record<string, string>; dataset?: Record<string, string>; fontFamilies?: string[]; classNames?: string[] } | null
        if (result?.success && result.styles) {
          setElementStyles((prev) => ({ ...prev, ...result.styles }))
          setSelectedLayerComputedStyles(result.computedStyles || null)
          setSelectedLayerAttributes(result.attributes || null)
          setSelectedLayerDataset(result.dataset || null)
          setSelectedLayerFontFamilies(Array.isArray(result.fontFamilies) ? result.fontFamilies : null)
          setSelectedLayerClassNames(Array.isArray(result.classNames) ? result.classNames : null)
        }
      } catch (e) {
        console.warn('[Layers] Failed to read element styles:', e)
      }
    } else {
      setSelectedLayerElementNumber(null)
      setSelectedLayerElementName(null)
      setSelectedLayerComputedStyles(null)
      setSelectedLayerAttributes(null)
      setSelectedLayerDataset(null)
      setSelectedLayerFontFamilies(null)
      setSelectedLayerClassNames(null)
    }
  }, [activeTabId, isMultiViewportMode, webviewRefs, viewportControlsRef, setSelectedTreeNodeId, setSelectedLayerElementNumber, setSelectedLayerElementName, setElementStyles, setSelectedLayerComputedStyles, setSelectedLayerAttributes, setSelectedLayerDataset, setSelectedLayerFontFamilies, setSelectedLayerClassNames])

  const handleTreeNodeSelectRef = useRef<(node: TreeNode) => void>(() => {})
  useEffect(() => { handleTreeNodeSelectRef.current = handleTreeNodeSelect as unknown as (node: TreeNode) => void }, [handleTreeNodeSelect])

  // Element style change handlers
  const flushApplyElementStyles = useCallback(() => {
    if (applyElementStylesTimerRef.current) {
      window.clearTimeout(applyElementStylesTimerRef.current)
      applyElementStylesTimerRef.current = null
    }

    const elementNumber = selectedLayerElementNumberRef.current
    if (!elementNumber) return

    const tabId = activeTabIdRef.current
    const webview = webviewRefs.current.get(tabId)
    if (!webview) return

    const s = elementStylesRef.current
    const payload = JSON.stringify({
      className: s.className,
      cssOverrides: s.cssOverrides,
      attributeOverrides: s.attributeOverrides,
      datasetOverrides: s.datasetOverrides,
      googleFonts: s.googleFonts,
      fontFaces: s.fontFaces,
      x: s.x,
      y: s.y,
      rotation: s.rotation,
      scaleX: s.scaleX,
      scaleY: s.scaleY,
      width: s.width,
      height: s.height,
      display: s.display,
      flexDirection: s.flexDirection,
      justifyContent: s.justifyContent,
      alignItems: s.alignItems,
      gap: s.gap,
      padding: s.padding,
      overflow: s.overflow,
      boxSizing: s.boxSizing,
      backgroundColor: s.backgroundColor,
      opacity: s.opacity,
      borderRadius: s.borderRadius,
      borderWidth: s.borderWidth,
      borderStyle: s.borderStyle,
      borderColor: s.borderColor,
      color: s.color,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textAlign: s.textAlign,
      shadowEnabled: s.shadowEnabled,
      shadowVisible: s.shadowVisible,
      shadowType: s.shadowType,
      shadowX: s.shadowX,
      shadowY: s.shadowY,
      shadowBlur: s.shadowBlur,
      shadowSpread: s.shadowSpread,
      shadowColor: s.shadowColor,
      blurEnabled: s.blurEnabled,
      blurVisible: s.blurVisible,
      blurType: s.blurType,
      blur: s.blur,
    })

    try {
      webview.executeJavaScript(`
        (function() {
          const map = window.__layersElements;
          if (!map || !(map instanceof Map)) return { success: false, error: 'No element map' };
          const el = map.get(${elementNumber});
          if (!el) return { success: false, error: 'Element not found' };
          const s = ${payload};

          if (typeof s.className === 'string') {
            el.className = s.className;
          }

          // Apply attribute/dataset overrides from the Properties section
          const nextAttrs = (s.attributeOverrides && typeof s.attributeOverrides === 'object') ? s.attributeOverrides : {};
          const prevAttrKeys = Array.isArray(el.__clusoAttrOverrideKeys) ? el.__clusoAttrOverrideKeys : [];
          for (const k of prevAttrKeys) {
            if (!(k in nextAttrs)) {
              try { el.removeAttribute(k); } catch (e) {}
            }
          }
          const appliedAttrKeys = [];
          for (const k in nextAttrs) {
            if (!Object.prototype.hasOwnProperty.call(nextAttrs, k)) continue;
            const v = String(nextAttrs[k] ?? '');
            try {
              if (v === '') el.removeAttribute(k);
              else el.setAttribute(k, v);
              appliedAttrKeys.push(k);
            } catch (e) {}
          }
          el.__clusoAttrOverrideKeys = appliedAttrKeys;

          const nextDataset = (s.datasetOverrides && typeof s.datasetOverrides === 'object') ? s.datasetOverrides : {};
          const prevDataKeys = Array.isArray(el.__clusoDataOverrideKeys) ? el.__clusoDataOverrideKeys : [];
          for (const k of prevDataKeys) {
            if (!(k in nextDataset)) {
              try { delete el.dataset[k]; } catch (e) {}
            }
          }
          const appliedDataKeys = [];
          for (const k in nextDataset) {
            if (!Object.prototype.hasOwnProperty.call(nextDataset, k)) continue;
            const v = String(nextDataset[k] ?? '');
            try {
              if (v === '') delete el.dataset[k];
              else el.dataset[k] = v;
              appliedDataKeys.push(k);
            } catch (e) {}
          }
          el.__clusoDataOverrideKeys = appliedDataKeys;

          // Ensure Google fonts are loaded (document-scoped)
          try {
            const families = Array.isArray(s.googleFonts) ? s.googleFonts : [];
            for (const fam of families) {
              const family = String(fam || '').trim();
              if (!family) continue;
              const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const id = 'cluso-google-font-' + slug;
              if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
                link.href = 'https://fonts.googleapis.com/css2?family=' + familyParam + ':wght@100;200;300;400;500;600;700;800;900&display=swap';
                document.head.appendChild(link);
              }
            }
          } catch (e) {}

          // Ensure @font-face rules exist for project/local fonts (document-scoped)
          try {
            const faces = Array.isArray(s.fontFaces) ? s.fontFaces : [];
            let styleEl = document.getElementById('cluso-font-faces');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'cluso-font-faces';
              document.head.appendChild(styleEl);
            }
            const seen = new Set();
            const rules = [];
            for (const face of faces) {
              if (!face) continue;
              const family = String(face.family || '').trim();
              const srcUrl = String(face.srcUrl || '').trim();
              if (!family || !srcUrl) continue;
              const key = family + '|' + srcUrl;
              if (seen.has(key)) continue;
              seen.add(key);
              const fmt = String(face.format || '').trim();
              const fmtPart = fmt ? (' format(\\'' + fmt.replace(/'/g, '') + '\\')') : '';
              rules.push("@font-face{font-family:'" + family.replace(/'/g, "\\\\'") + "';src:url('" + srcUrl.replace(/'/g, "\\\\'") + "')" + fmtPart + ";font-display:swap;}");
            }
            styleEl.textContent = rules.join('\\n');
          } catch (e) {}

          el.style.width = s.width + 'px';
          el.style.height = s.height + 'px';
          el.style.transform = 'translate(' + s.x + 'px, ' + s.y + 'px) rotate(' + s.rotation + 'deg) scale(' + (s.scaleX || 1) + ',' + (s.scaleY || 1) + ')';

          el.style.display = s.display;
          if (s.display === 'flex') {
            el.style.flexDirection = s.flexDirection;
            el.style.justifyContent = s.justifyContent;
            el.style.alignItems = s.alignItems;
          }

          el.style.gap = s.gap + 'px';
          el.style.padding = s.padding + 'px';

          el.style.overflow = s.overflow;
          el.style.boxSizing = s.boxSizing;

          el.style.backgroundColor = s.backgroundColor;
          el.style.opacity = String((s.opacity || 0) / 100);
          el.style.borderRadius = s.borderRadius + 'px';

          el.style.borderWidth = (s.borderWidth || 0) + 'px';
          el.style.borderStyle = s.borderStyle || (s.borderWidth ? 'solid' : 'none');
          el.style.borderColor = s.borderColor || '';

          el.style.color = s.color || '';
          el.style.fontFamily = s.fontFamily || '';
          el.style.fontSize = (s.fontSize || 0) ? (s.fontSize + 'px') : '';
          el.style.fontWeight = s.fontWeight ? String(s.fontWeight) : '';
          el.style.lineHeight = (s.lineHeight || 0) ? (s.lineHeight + 'px') : '';
          el.style.letterSpacing = (s.letterSpacing || 0) ? (s.letterSpacing + 'px') : '';
          el.style.textAlign = s.textAlign || '';

          if (s.shadowEnabled && s.shadowVisible) {
            const inset = (s.shadowType === 'inner') ? 'inset ' : '';
            el.style.boxShadow = inset + (s.shadowX || 0) + 'px ' + (s.shadowY || 0) + 'px ' + (s.shadowBlur || 0) + 'px ' + (s.shadowSpread || 0) + 'px ' + (s.shadowColor || 'rgba(0,0,0,0.25)');
          } else {
            el.style.boxShadow = 'none';
          }

          if (s.blurEnabled && s.blurVisible && (s.blur || 0) > 0) {
            if (s.blurType === 'backdrop') {
              el.style.backdropFilter = 'blur(' + s.blur + 'px)';
              el.style.filter = '';
            } else {
              el.style.filter = 'blur(' + s.blur + 'px)';
              el.style.backdropFilter = '';
            }
          } else {
            el.style.filter = '';
            el.style.backdropFilter = '';
          }

          // Apply custom CSS overrides (e.g., from the CSS inspector tab)
          const nextOverrides = (s.cssOverrides && typeof s.cssOverrides === 'object') ? s.cssOverrides : {};
          const prevKeys = Array.isArray(el.__clusoCssOverrideKeys) ? el.__clusoCssOverrideKeys : [];
          for (const k of prevKeys) {
            if (!(k in nextOverrides)) {
              el.style.removeProperty(k);
            }
          }
          const appliedKeys = [];
          for (const k in nextOverrides) {
            if (!Object.prototype.hasOwnProperty.call(nextOverrides, k)) continue;
            const v = String(nextOverrides[k] ?? '').trim();
            if (!v) {
              el.style.removeProperty(k);
              continue;
            }
            el.style.setProperty(k, v);
            appliedKeys.push(k);
          }
          el.__clusoCssOverrideKeys = appliedKeys;

          return { success: true };
        })()
      `)
    } catch (e) {
      console.warn('[Properties] Failed to apply styles:', e)
    }
  }, [selectedLayerElementNumberRef, activeTabIdRef, webviewRefs, elementStylesRef])

  const queueApplyElementStyles = useCallback(() => {
    if (applyElementStylesTimerRef.current) {
      window.clearTimeout(applyElementStylesTimerRef.current)
    }
    applyElementStylesTimerRef.current = window.setTimeout(flushApplyElementStyles, 120)
  }, [flushApplyElementStyles])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (applyElementStylesTimerRef.current) {
        window.clearTimeout(applyElementStylesTimerRef.current)
        applyElementStylesTimerRef.current = null
      }
    }
  }, [])

  const handleElementStyleChange = useCallback((key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => {
    setElementStyles(prev => {
      const next = { ...prev, [key]: value } as ElementStyles
      elementStylesRef.current = next
      return next
    })
    queueApplyElementStyles()
  }, [queueApplyElementStyles, setElementStyles, elementStylesRef])

  // Handle get_page_elements tool - scans page for interactive elements
  const handleGetPageElements = useCallback(async (category?: string, showBadges: boolean = true): Promise<string> => {
    console.log('[AI] Getting page elements, category:', category, 'showBadges:', showBadges)
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview || !isWebviewReady) {
      return 'Error: Webview not ready'
    }

    const scanCode = `
      (function() {
        const category = ${category ? JSON.stringify(category.toLowerCase()) : 'null'};
        const showBadges = ${showBadges};

        // Clear previous badges
        if (showBadges) {
          document.querySelectorAll('.element-number-badge').forEach(b => b.remove());
        }

        // Get scope - if focused element exists, scan its children; otherwise scan whole page
        const focusedElement = window.__focusedElement;
        const scope = focusedElement || document.body;
        const scopeDesc = focusedElement ? 'within focused element' : 'on page';

        // Category filters
        const categoryFilters = {
          'buttons': ['button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]'],
          'links': ['a[href]'],
          'inputs': ['input:not([type="button"]):not([type="submit"])', 'textarea', 'select'],
          'text': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'],
          'images': ['img', 'svg', '[role="img"]'],
          'navigation': ['nav', 'header', 'footer', '[role="navigation"]'],
          'forms': ['form'],
          'lists': ['ul', 'ol', 'li'],
          'interactive': ['button', 'a', 'input', 'select', 'textarea', '[role="button"]', '[onclick]', '[tabindex]'],
        };

        let selector = '*';
        if (category && categoryFilters[category]) {
          selector = categoryFilters[category].join(', ');
        }

        const allElements = Array.from(scope.querySelectorAll(selector));
        const results = [];
        const numberedElements = [];

        for (const el of allElements) {
          // Skip invisible elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          // Skip cluso UI elements
          if (el.closest && el.closest('[data-cluso-ui="1"]')) continue;

          const tagName = el.tagName.toLowerCase();

          // Get meaningful text
          let text = '';
          if (tagName === 'input') {
            text = el.value || el.placeholder || el.getAttribute('aria-label') || '';
          } else if (tagName === 'img') {
            text = el.alt || el.getAttribute('aria-label') || '';
          } else {
            text = (el.innerText || '').substring(0, 100).trim();
          }

          const elementNumber = results.length + 1;
          numberedElements.push(el);

          results.push({
            number: elementNumber,
            tag: tagName.toUpperCase(),
            text: text.substring(0, 80) || '[no text]',
            id: el.id || undefined,
            classes: el.className ? String(el.className).split(' ').slice(0, 3).join(' ') : undefined,
          });

          // Limit to 50 elements
          if (results.length >= 50) break;
        }

        // Store for highlighting
        window.__numberedElements = numberedElements;

        // Add badges if requested
        if (showBadges) {
          numberedElements.forEach((el, i) => {
            const badge = document.createElement('div');
            badge.className = 'element-number-badge';
            badge.setAttribute('data-cluso-ui', '1');
            badge.textContent = String(i + 1);
            badge.style.cssText = 'position:absolute;background:#3b82f6;color:white;font-size:10px;font-weight:bold;padding:1px 4px;border-radius:3px;z-index:99999;pointer-events:none;';
            const rect = el.getBoundingClientRect();
            badge.style.top = (rect.top + window.scrollY - 15) + 'px';
            badge.style.left = (rect.left + window.scrollX) + 'px';
            document.body.appendChild(badge);
          });
        }

        // Format output
        let output = 'Found ' + results.length + ' elements ' + scopeDesc + ':\\n\\n';
        for (const r of results) {
          let line = r.number + '. <' + r.tag + '>';
          if (r.id) line += ' #' + r.id;
          if (r.classes) line += ' .' + r.classes.replace(/ /g, '.');
          if (r.text && r.text !== '[no text]') line += ' "' + r.text + '"';
          output += line + '\\n';
        }

        if (results.length === 50) {
          output += '\\n(Limited to 50 elements. Use category filter or focus_element to narrow scope.)';
        }

        return output;
      })()
    `

    try {
      const result = await webview.executeJavaScript(scanCode) as string
      console.log('[AI] Page elements result:', result.substring(0, 200))
      return result
    } catch (err) {
      console.error('[AI] Get page elements error:', err)
      return `Error: ${(err as Error).message}`
    }
  }, [isWebviewReady, activeTabId, webviewRefs])

  return {
    // AI element handlers
    handleAiElementSelect,
    handleExecuteCode,
    handleConfirmSelection,
    handleHighlightByNumber,

    // Focus handlers
    handleClearFocus,
    handleSetViewport,
    handleSwitchTab,
    handleFindElementByText,

    // DOM navigation handlers
    handleSelectParent,
    handleSelectChildren,
    handleSelectSiblings,
    handleSelectAllMatching,

    // Drill-down handlers
    handleStartDrillSelection,
    handleDrillInto,
    handleDrillBack,
    handleDrillForward,
    handleExitDrillMode,

    // Layers handlers
    handleRefreshLayers,
    handleRefreshLayersRef,
    handleTreeNodeSelect,
    handleTreeNodeSelectRef,

    // Element style handlers
    handleElementStyleChange,
    flushApplyElementStyles,
    queueApplyElementStyles,

    // Page elements handler
    handleGetPageElements,
  }
}
