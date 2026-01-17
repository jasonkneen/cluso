/**
 * Tool Execution Hook
 *
 * Centralizes AI tool execution handlers extracted from App.tsx.
 * Handles file operations (list, read, patch), browser interaction (click, navigate, scroll),
 * and selector agent context priming.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/FileService'
import type { Message } from '../../types'

// WebView element interface for browser interaction
export interface WebviewElement {
  getURL: () => string
  canGoBack: () => boolean
  canGoForward: () => boolean
  send: (channel: string, ...args: unknown[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeJavaScript: (code: string) => Promise<any>
  contentWindow?: Window
  loadURL: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
}

/**
 * Dependencies required by tool execution handlers
 */
export interface UseToolExecutionDeps {
  // Webview access
  webviewRefs: React.RefObject<Map<string, WebviewElement>>
  activeTabId: string
  isWebviewReady: boolean

  // State setters
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>

  // Selector agent state for priming
  selectorAgentActive: boolean

  // Page elements handler (from useSelectionHandlers)
  handleGetPageElements: (category?: string, showBadges?: boolean) => Promise<string>

  // Prime selector context (from useSelectorAgent)
  primeSelectorContext: (context: {
    pageElements: string
    pageUrl: string
    pageTitle: string
  }) => Promise<boolean>
}

/**
 * Return type for the tool execution hook
 */
export interface UseToolExecutionReturn {
  // File operations
  handlePatchSourceFile: (
    filePath: string,
    searchCode: string,
    replaceCode: string,
    description: string
  ) => Promise<{ success: boolean; error?: string }>
  handleListFiles: (path?: string) => Promise<string>
  handleReadFile: (filePath: string) => Promise<string>

  // Browser interaction tools
  handleClickElement: (selector: string) => Promise<{ success: boolean; error?: string }>
  handleNavigate: (action: string, url?: string) => Promise<{ success: boolean; error?: string }>
  handleScroll: (target: string) => Promise<{ success: boolean; error?: string }>

  // Selector agent context
  primeAgentWithPageContext: () => Promise<void>
}

/**
 * Hook for AI tool execution handlers
 *
 * Extracts and centralizes tool execution handlers from App.tsx.
 * Handles file operations, browser interaction tools, and selector agent priming.
 */
export function useToolExecution(deps: UseToolExecutionDeps): UseToolExecutionReturn {
  const {
    webviewRefs,
    activeTabId,
    isWebviewReady,
    setMessages,
    selectorAgentActive,
    handleGetPageElements,
    primeSelectorContext,
  } = deps

  // Handle patch_source_file tool - writes changes to actual source files
  const handlePatchSourceFile = useCallback(
    async (
      filePath: string,
      searchCode: string,
      replaceCode: string,
      description: string
    ): Promise<{ success: boolean; error?: string }> => {
      console.log('[AI] Patching source file:', filePath, description)

      const patchResult = await fileService.patchFileBySearch({
        filePath,
        searchCode,
        replaceCode,
        description,
      })

      if (!patchResult.success) {
        return { success: false, error: patchResult.error || `Failed to patch file: ${filePath}` }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `\u2713 Patched ${filePath}: ${description}`,
          timestamp: new Date(),
        },
      ])

      return { success: true }
    },
    [setMessages]
  )

  // Handle list_files tool - list files in a directory
  const handleListFiles = useCallback(async (path?: string): Promise<string> => {
    console.log('[AI] Listing files:', path)
    try {
      const result = await fileService.listDirectory(path)
      if (result.success && result.data) {
        const formatted = result.data
          .map((f) => `${f.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'} ${f.name}${f.isDirectory ? '/' : ''}`)
          .join('\n')
        return formatted || 'Empty directory'
      }
      return 'Error: ' + (result.error || 'Could not list directory')
    } catch (err) {
      return 'Error: ' + (err as Error).message
    }
  }, [])

  // Handle read_file tool - read a file's contents
  const handleReadFile = useCallback(async (filePath: string): Promise<string> => {
    console.log('[AI] Reading file:', filePath)
    try {
      const result = await fileService.readFile(filePath, { truncateAt: 10000 })
      if (result.success && result.data) return result.data
      return 'Error: ' + (result.error || 'Could not read file')
    } catch (err) {
      return 'Error: ' + (err as Error).message
    }
  }, [])

  // Handle click_element tool - click on an element
  const handleClickElement = useCallback(
    async (selector: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[AI] Clicking element:', selector)
      const webview = webviewRefs.current?.get(activeTabId)
      if (!webview || !isWebviewReady) {
        return { success: false, error: 'Webview not ready' }
      }
      try {
        const code = `
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (el) {
            el.click();
            return { success: true };
          }
          return { success: false, error: 'Element not found' };
        })()
      `
        const result = (await webview.executeJavaScript(code)) as {
          success: boolean
          error?: string
        }
        return result
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    },
    [isWebviewReady, activeTabId, webviewRefs]
  )

  // Handle navigate tool - browser navigation
  const handleNavigate = useCallback(
    async (action: string, url?: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[AI] Navigating:', action, url)
      const webview = webviewRefs.current?.get(activeTabId)
      if (!webview) {
        return { success: false, error: 'Webview not available' }
      }
      try {
        switch (action) {
          case 'back':
            webview.goBack()
            break
          case 'forward':
            webview.goForward()
            break
          case 'reload':
            webview.reload()
            break
          case 'goto':
            if (url) {
              webview.loadURL(url)
            } else {
              return { success: false, error: 'URL required for goto action' }
            }
            break
          default:
            return { success: false, error: `Unknown action: ${action}` }
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    },
    [activeTabId, webviewRefs]
  )

  // Handle scroll tool - scroll the page
  const handleScroll = useCallback(
    async (target: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[AI] Scrolling to:', target)
      const webview = webviewRefs.current?.get(activeTabId)
      if (!webview || !isWebviewReady) {
        return { success: false, error: 'Webview not ready' }
      }
      try {
        let code: string
        if (target === 'top') {
          code = `window.scrollTo({ top: 0, behavior: 'smooth' }); true;`
        } else if (target === 'bottom') {
          code = `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); true;`
        } else {
          // Assume it's a selector
          code = `
          (function() {
            const el = document.querySelector('${target.replace(/'/g, "\\'")}');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return true;
            }
            return false;
          })()
        `
        }
        const result = await webview.executeJavaScript(code)
        return { success: !!result }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    },
    [isWebviewReady, activeTabId, webviewRefs]
  )

  // Prime selector agent with page context when page elements are fetched
  const primeAgentWithPageContext = useCallback(async () => {
    if (!selectorAgentActive) return

    // Pass false for showBadges - we just need the data, not visual badges
    const pageElements = await handleGetPageElements('all', false)
    if (pageElements && !pageElements.startsWith('Error')) {
      const webview = webviewRefs.current?.get(activeTabId)
      const pageUrl = webview
        ? ((await webview.executeJavaScript('window.location.href').catch(() => '')) as string)
        : ''
      const pageTitle = webview
        ? ((await webview.executeJavaScript('document.title').catch(() => '')) as string)
        : ''

      await primeSelectorContext({
        pageElements,
        pageUrl,
        pageTitle,
      })
      console.log('[SelectorAgent] Context primed')
    }
  }, [selectorAgentActive, handleGetPageElements, primeSelectorContext, activeTabId, webviewRefs])

  return {
    // File operations
    handlePatchSourceFile,
    handleListFiles,
    handleReadFile,

    // Browser interaction tools
    handleClickElement,
    handleNavigate,
    handleScroll,

    // Selector agent context
    primeAgentWithPageContext,
  }
}
