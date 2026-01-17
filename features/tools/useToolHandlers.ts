/**
 * Tool Handlers Hook
 *
 * Centralizes AI tool handlers extracted from App.tsx.
 * Handles browser interaction tools (click, navigate, scroll),
 * source file patching, code updates, and voice approval actions.
 */

import { useCallback } from 'react'
import { fileService } from '../../services/FileService'
import type { Message } from '../../types'
import type { SelectedElement } from '../../types'
import { playUndoSound } from '../../utils/audio'

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
 * Dependencies required by tool handlers
 */
export interface UseToolHandlersDeps {
  // Webview access - use RefObject for compatibility
  webviewRefs: React.RefObject<Map<string, WebviewElement>>
  activeTabId: string
  isWebviewReady: boolean

  // State setters
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>

  // Selected element ref for targeted updates
  selectedElementRef: React.RefObject<SelectedElement | null>

  // Pending change state for approval handlers
  pendingChange: {
    code: string
    undoCode: string
    description: string
    source?: string
  } | null

  // Approval action handlers
  handleApproveChange: () => void
  handleRejectChange: () => Promise<void>
}

/**
 * Return type for the tool handlers hook
 */
export interface UseToolHandlersReturn {
  // Source file patching
  handlePatchSourceFile: (
    filePath: string,
    searchCode: string,
    replaceCode: string,
    description: string
  ) => Promise<{ success: boolean; error?: string }>

  // Browser interaction tools
  handleClickElement: (selector: string) => Promise<{ success: boolean; error?: string }>
  handleNavigate: (action: string, url?: string) => Promise<{ success: boolean; error?: string }>
  handleScroll: (target: string) => Promise<{ success: boolean; error?: string }>

  // HTML/code update from AI
  handleCodeUpdate: (html: string) => void

  // Voice approval handlers
  handleVoiceApprove: (reason?: string) => void
  handleVoiceReject: (reason?: string) => void
  handleVoiceUndo: (reason?: string) => void
}

/**
 * Hook for AI tool handlers
 *
 * Extracts and centralizes tool handlers from App.tsx.
 * Handles browser interaction tools, source file patching,
 * code updates, and voice approval actions.
 */
export function useToolHandlers(deps: UseToolHandlersDeps): UseToolHandlersReturn {
  const {
    webviewRefs,
    activeTabId,
    isWebviewReady,
    setMessages,
    selectedElementRef,
    pendingChange,
    handleApproveChange,
    handleRejectChange,
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

  // Handle click_element tool - click on an element
  const handleClickElement = useCallback(
    async (selector: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[AI] Clicking element:', selector)
      const webview = webviewRefs.current.get(activeTabId)
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
      const webview = webviewRefs.current.get(activeTabId)
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
      const webview = webviewRefs.current.get(activeTabId)
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

  // Handle instant code updates from Gemini's update_ui tool
  // IMPORTANT: Only updates the selected element if one exists, not the entire page
  // NOTE: This uses outerHTML for DOM updates - the content is sanitized for dangerous patterns
  // before injection (script tags, javascript: URLs, event handlers) to mitigate XSS risks.
  const handleCodeUpdate = useCallback(
    (html: string) => {
      console.log('[InstantEdit] Applying HTML update to DOM')
      const webview = webviewRefs.current.get(activeTabId)
      if (!webview || !isWebviewReady) {
        console.warn('[InstantEdit] Webview not ready')
        return
      }

      // Validate HTML before injection - basic checks
      const trimmedHtml = html.trim()
      if (!trimmedHtml) {
        console.error('[InstantEdit] Empty HTML provided')
        return
      }

      // Check for obviously dangerous patterns (security sanitization)
      const dangerousPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/gi, // Script tags
        /javascript:/gi, // javascript: URLs
        /on\w+\s*=/gi, // Event handlers like onclick=
        /data:text\/html/gi, // Data URLs
      ]

      let sanitizedHtml = trimmedHtml
      let hadDangerousContent = false
      for (const pattern of dangerousPatterns) {
        if (pattern.test(sanitizedHtml)) {
          console.warn('[InstantEdit] Removed potentially dangerous content:', pattern)
          sanitizedHtml = sanitizedHtml.replace(pattern, '')
          hadDangerousContent = true
        }
      }

      // If we have a selected element, ONLY update that element
      // Otherwise, update the entire document (legacy behavior)
      const currentSelectedElement = selectedElementRef.current

      let injectCode: string
      if (currentSelectedElement?.xpath) {
        // Targeted update - only change the selected element via outerHTML
        console.log(
          '[InstantEdit] Targeted update for element:',
          currentSelectedElement.tagName,
          currentSelectedElement.xpath
        )
        injectCode = `
        (function() {
          try {
            const xpath = '${currentSelectedElement.xpath.replace(/'/g, "\\'")}';
            const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!el) {
              return { success: false, error: 'Selected element not found in DOM' };
            }
            // Update only the outerHTML of the selected element
            el.outerHTML = \`${sanitizedHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            return { success: true, message: 'Element updated', targeted: true };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `
      } else {
        // Full page update (only if no element selected) - replaces document content
        console.log('[InstantEdit] Full page update (no element selected)')
        injectCode = `
        (function() {
          try {
            // Replace entire document with new HTML via documentElement
            document.documentElement.outerHTML = \`${sanitizedHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            return { success: true, message: 'Page updated', targeted: false };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `
      }

      webview
        .executeJavaScript(injectCode)
        .then(
          (result: {
            success: boolean
            message?: string
            error?: string
            targeted?: boolean
          }) => {
            if (result?.success) {
              console.log('[InstantEdit] HTML applied to DOM successfully, targeted:', result.targeted)
              const updateType = result.targeted ? 'element' : 'page'
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'system',
                  content: hadDangerousContent
                    ? `\u2713 ${updateType} updated (unsafe content removed)`
                    : `\u2713 ${updateType} updated`,
                  timestamp: new Date(),
                },
              ])
            } else {
              console.error('[InstantEdit] Failed to apply HTML:', result?.error)
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'system',
                  content: `\u2717 Update failed: ${result?.error || 'Unknown error'}`,
                  timestamp: new Date(),
                },
              ])
            }
          }
        )
        .catch((err: Error) => {
          console.error('[InstantEdit] Error injecting HTML:', err)
        })
    },
    [isWebviewReady, activeTabId, webviewRefs, selectedElementRef, setMessages]
  )

  // Voice approval handlers that work with the existing pendingChange system
  const handleVoiceApprove = useCallback(
    (reason?: string) => {
      console.log('[Voice] User said approve:', reason)
      // Delegate to existing approve handler which handles the DOM/code execution
      handleApproveChange()
    },
    [handleApproveChange]
  )

  const handleVoiceReject = useCallback(
    (reason?: string) => {
      console.log('[Voice] User said reject:', reason)
      // Delegate to existing reject handler which undoes changes
      handleRejectChange()
    },
    [handleRejectChange]
  )

  const handleVoiceUndo = useCallback(
    (reason?: string) => {
      console.log('[Voice] User said undo:', reason)
      // For undo via voice, just trigger the reject handler (same effect)
      // This reverts to the last pending change state
      if (pendingChange) {
        handleRejectChange()
      } else {
        // If no pending change, could implement undo history here
        playUndoSound().catch((err) => console.error('[Audio] Undo sound error:', err))
        console.log('[Voice] No pending change to undo')
      }
    },
    [pendingChange, handleRejectChange]
  )

  return {
    // Source file patching
    handlePatchSourceFile,

    // Browser interaction tools
    handleClickElement,
    handleNavigate,
    handleScroll,

    // HTML/code update from AI
    handleCodeUpdate,

    // Voice approval handlers
    handleVoiceApprove,
    handleVoiceReject,
    handleVoiceUndo,
  }
}
