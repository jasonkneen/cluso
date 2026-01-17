/**
 * Audio Handlers Hook
 *
 * Encapsulates change approval/rejection handlers with audio feedback.
 * Plays confirmation sounds when user approves or rejects pending code changes.
 */

import { useCallback } from 'react'
import { playApprovalSound, playRejectionSound } from '../../utils/audio'
import type { Message } from '../../types'
import type { PendingChange } from '../changes/types'

/**
 * WebView element interface for browser interaction
 * Matches the interface from useToolHandlers
 */
export interface WebviewElement {
  getURL: () => string
  canGoBack: () => boolean
  canGoForward: () => boolean
  send: (channel: string, ...args: unknown[]) => void
  executeJavaScript: (code: string) => Promise<unknown>
  contentWindow?: Window
  loadURL: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
}

/**
 * Dependencies required by audio handlers
 */
export interface UseAudioHandlersDeps {
  /** Map of tab IDs to webview elements */
  webviewRefs: React.RefObject<Map<string, WebviewElement>>
  /** Currently active tab ID */
  activeTabId: string
  /** Current pending change awaiting approval */
  pendingChange: PendingChange | null
  /** Setter for pending change state */
  setPendingChange: React.Dispatch<React.SetStateAction<PendingChange | null>>
  /** Setter for messages state */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}

/**
 * Return type for the audio handlers hook
 */
export interface UseAudioHandlersReturn {
  /** Approve pending change with confirmation sound */
  handleApproveChange: () => void
  /** Reject pending change with rejection sound */
  handleRejectChange: () => Promise<void>
}

/**
 * Hook for change approval/rejection handlers with audio feedback
 *
 * Extracted from App.tsx to centralize audio-related change handlers.
 * Plays approval/rejection sounds as voice confirmation feedback.
 */
export function useAudioHandlers(deps: UseAudioHandlersDeps): UseAudioHandlersReturn {
  const {
    webviewRefs,
    activeTabId,
    pendingChange,
    setPendingChange,
    setMessages,
  } = deps

  // Approve pending code change - already applied, just confirm
  const handleApproveChange = useCallback(() => {
    console.log('[Exec] Changes confirmed')
    setPendingChange(null)
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: 'Changes confirmed.',
      timestamp: new Date()
    }])
    // Play approval sound for voice confirmation feedback
    playApprovalSound().catch(err => console.error('[Audio] Approval sound error:', err))
  }, [setPendingChange, setMessages])

  // Reject pending code change - undo and clear
  const handleRejectChange = useCallback(async () => {
    const webview = webviewRefs.current?.get(activeTabId)
    console.log('[Exec] Rejecting change, pendingChange:', pendingChange)
    console.log('[Exec] undoCode:', pendingChange?.undoCode)
    console.log('[Exec] webview:', !!webview)

    let undoSucceeded = false

    if (pendingChange?.undoCode && webview) {
      console.log('[Exec] Rejecting - running undo code:', pendingChange.undoCode)
      try {
        await webview.executeJavaScript(pendingChange.undoCode)
        console.log('[Exec] Undo executed successfully')
        undoSucceeded = true
      } catch (err) {
        console.error('[Exec] Undo error:', err)
      }
    } else {
      console.log('[Exec] No undo code available or no webview')
    }

    // If undo failed and we have a webview, reload the page as fallback
    if (!undoSucceeded && webview) {
      console.log('[Exec] Undo failed - reloading page as fallback')
      try {
        ;(webview as unknown as { reload: () => void }).reload()
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Changes discarded. Page reloaded to restore state.',
          timestamp: new Date()
        }])
      } catch (e) {
        console.error('[Exec] Failed to reload:', e)
      }
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Changes discarded.',
        timestamp: new Date()
      }])
    }

    setPendingChange(null)
    // Play rejection sound for voice confirmation feedback
    playRejectionSound().catch(err => console.error('[Audio] Rejection sound error:', err))
  }, [pendingChange, activeTabId, webviewRefs, setPendingChange, setMessages])

  return {
    handleApproveChange,
    handleRejectChange,
  }
}
