/**
 * Change Approval Handlers Hook
 *
 * Handles approve/reject callbacks for pending changes extracted from App.tsx.
 * Includes both manual approval and voice-triggered approval handlers.
 */

import { useCallback } from 'react'
import { playApprovalSound, playRejectionSound, playUndoSound } from '../../utils/audio'
import type { PendingChange } from './types'
import type { Message } from '../../types'

/** WebviewElement interface for undo execution */
interface WebviewElement {
  executeJavaScript: (code: string) => Promise<unknown>
  reload: () => void
}

export interface UseChangeApprovalHandlersOptions {
  /** Current pending change */
  pendingChange: PendingChange | null
  /** Set pending change */
  setPendingChange: (change: PendingChange | null) => void
  /** Set messages */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  /** Current active tab ID */
  activeTabId: string
  /** Ref to webview elements map */
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
}

export interface UseChangeApprovalHandlersReturn {
  /** Approve pending code change - already applied, just confirm */
  handleApproveChange: () => void
  /** Reject pending code change - undo and clear */
  handleRejectChange: () => Promise<void>
  /** Voice approval handler */
  handleVoiceApprove: (reason?: string) => void
  /** Voice rejection handler */
  handleVoiceReject: (reason?: string) => void
  /** Voice undo handler */
  handleVoiceUndo: (reason?: string) => void
}

/**
 * Hook for change approval handlers
 *
 * Extracts and centralizes change approval logic from App.tsx.
 */
export function useChangeApprovalHandlers({
  pendingChange,
  setPendingChange,
  setMessages,
  activeTabId,
  webviewRefs,
}: UseChangeApprovalHandlersOptions): UseChangeApprovalHandlersReturn {
  // Approve pending code change - already applied, just confirm
  const handleApproveChange = useCallback(() => {
    console.log('[Exec] Changes confirmed')
    setPendingChange(null)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content: 'Changes confirmed.',
        timestamp: new Date(),
      },
    ])
    // Play approval sound for voice confirmation feedback
    playApprovalSound().catch((err) =>
      console.error('[Audio] Approval sound error:', err)
    )
  }, [setPendingChange, setMessages])

  // Reject pending code change - undo and clear
  const handleRejectChange = useCallback(async () => {
    const webview = webviewRefs.current.get(activeTabId)
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
        webview.reload()
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'system',
            content: 'Changes discarded. Page reloaded to restore state.',
            timestamp: new Date(),
          },
        ])
      } catch (e) {
        console.error('[Exec] Failed to reload:', e)
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: 'Changes discarded.',
          timestamp: new Date(),
        },
      ])
    }

    setPendingChange(null)
    // Play rejection sound for voice confirmation feedback
    playRejectionSound().catch((err) =>
      console.error('[Audio] Rejection sound error:', err)
    )
  }, [pendingChange, activeTabId, webviewRefs, setPendingChange, setMessages])

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
    handleApproveChange,
    handleRejectChange,
    handleVoiceApprove,
    handleVoiceReject,
    handleVoiceUndo,
  }
}
