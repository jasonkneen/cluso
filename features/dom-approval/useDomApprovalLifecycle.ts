/**
 * DOM Approval Lifecycle Hook
 *
 * Handles DOM approval lifecycle effects including:
 * - Auto-cancellation when a new approval supersedes an older one
 * - Telemetry initialization when a new approval appears
 * - Auto-cancellation on tab switch
 * - Auto-cancellation on element selection change
 *
 * Extracted from App.tsx lines 1435-1495.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { PendingDOMApproval } from '../patches/usePatchState'
import type { DomEditTelemetry, DomEditContext, DomEditTelemetryEvent } from './types'

interface WebviewElement {
  executeJavaScript: (code: string) => Promise<unknown>
}

interface UseApprovalLifecycleOptions {
  pendingDOMApproval: PendingDOMApproval | null
  activeTabId: string
  selectedElementXpath?: string
  isGeneratingSourcePatch: boolean
  cancelledApprovalsRef: React.MutableRefObject<Set<string>>
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
  clearDomApprovalPatchTimeout: (id: string) => void
}

const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
  return Date.now()
}

/**
 * Hook for managing DOM approval lifecycle
 *
 * Handles auto-cancellation, telemetry, and cleanup of pending DOM approvals.
 */
export function useDomApprovalLifecycle({
  pendingDOMApproval,
  activeTabId,
  selectedElementXpath,
  isGeneratingSourcePatch,
  cancelledApprovalsRef,
  webviewRefs,
  clearDomApprovalPatchTimeout,
}: UseApprovalLifecycleOptions) {
  // Telemetry tracking
  const domEditTelemetryRef = useRef<Record<string, DomEditTelemetry>>({})
  const domEditContextRef = useRef<DomEditContext | null>(null)
  const lastPendingDomApprovalRef = useRef<PendingDOMApproval | null>(null)

  // Ensure telemetry record exists
  const ensureDomTelemetry = useCallback((id: string, init?: Partial<DomEditTelemetry>) => {
    if (!domEditTelemetryRef.current[id]) {
      domEditTelemetryRef.current[id] = {
        id,
        createdAtMs: nowMs(),
        tabId: init?.tabId || String(activeTabId),
        elementXpath: init?.elementXpath,
        events: {},
      }
    }
    const existing = domEditTelemetryRef.current[id]
    domEditTelemetryRef.current[id] = {
      ...existing,
      ...init,
      events: { ...existing.events, ...(init?.events || {}) },
    }
  }, [activeTabId])

  // Mark a telemetry event
  const markDomTelemetry = useCallback((id: string, event: DomEditTelemetryEvent) => {
    ensureDomTelemetry(id)
    const telemetry = domEditTelemetryRef.current[id]
    if (!telemetry.events[event]) {
      telemetry.events[event] = nowMs()
    }
  }, [ensureDomTelemetry])

  // Finalize telemetry with summary
  const finalizeDomTelemetry = useCallback((id: string, outcome: 'accepted' | 'rejected' | 'cancelled') => {
    const telemetry = domEditTelemetryRef.current[id]
    if (!telemetry) return
    const e = telemetry.events
    const ms = (a?: number, b?: number) => (a !== undefined && b !== undefined) ? Math.round(b - a) : undefined

    const summary = {
      outcome,
      tabId: telemetry.tabId,
      xpath: telemetry.elementXpath,
      previewToPatchReadyMs: ms(e.preview_applied, e.patch_ready),
      patchGenMs: ms(e.patch_generation_started, e.patch_ready ?? e.patch_failed),
      acceptToWriteMs: ms(e.user_accept, e.source_write_succeeded ?? e.source_write_failed),
      createdToEndMs: ms(telemetry.createdAtMs, e.source_write_succeeded ?? e.source_write_failed ?? e.user_reject ?? e.auto_cancel ?? e.patch_failed),
    }

    console.log('[Telemetry][DOM Edit]', id, summary)
    cancelledApprovalsRef.current.delete(id)
    delete domEditTelemetryRef.current[id]
  }, [cancelledApprovalsRef])

  // Cancel a specific approval value
  const cancelDomApprovalValue = useCallback((
    approval: PendingDOMApproval,
    params: { tabIdForUndo: string; reason: 'superseded' | 'context_change' }
  ) => {
    const { tabIdForUndo, reason } = params
    const webview = webviewRefs.current.get(tabIdForUndo)

    console.log('[DOM Approval] Cancelling pending change:', { id: approval.id, reason })
    clearDomApprovalPatchTimeout(approval.id)
    markDomTelemetry(approval.id, 'auto_cancel')
    cancelledApprovalsRef.current.add(approval.id)
    if (approval.undoCode && webview) {
      webview.executeJavaScript(approval.undoCode)
    }
    finalizeDomTelemetry(approval.id, 'cancelled')
  }, [markDomTelemetry, finalizeDomTelemetry, clearDomApprovalPatchTimeout, cancelledApprovalsRef, webviewRefs])

  // Latest-wins: if a new DOM approval replaces an older pending one, auto-cancel the older preview
  useEffect(() => {
    const prev = lastPendingDomApprovalRef.current
    const next = pendingDOMApproval
    lastPendingDomApprovalRef.current = next

    if (!prev || !next) return
    if (prev.id === next.id) return
    if (prev.userApproved || isGeneratingSourcePatch) return

    // If telemetry wasn't initialized yet (e.g. rapid supersede), create a minimal record now.
    const ctx = domEditContextRef.current
    const tabIdForUndo = ctx?.id === prev.id
      ? ctx.tabId
      : (domEditTelemetryRef.current[prev.id]?.tabId || String(activeTabId))

    ensureDomTelemetry(prev.id, { tabId: tabIdForUndo, elementXpath: prev.element?.xpath })
    cancelDomApprovalValue(prev, { tabIdForUndo, reason: 'superseded' })
  }, [pendingDOMApproval?.id, isGeneratingSourcePatch, activeTabId, ensureDomTelemetry, cancelDomApprovalValue])

  // Initialize telemetry whenever a new pending DOM approval appears
  useEffect(() => {
    if (!pendingDOMApproval) {
      domEditContextRef.current = null
      return
    }
    domEditContextRef.current = {
      id: pendingDOMApproval.id,
      tabId: String(activeTabId),
      elementXpath: pendingDOMApproval.element?.xpath,
    }
    ensureDomTelemetry(pendingDOMApproval.id, {
      tabId: String(activeTabId),
      elementXpath: pendingDOMApproval.element?.xpath,
    })
    markDomTelemetry(pendingDOMApproval.id, 'preview_applied')
  }, [pendingDOMApproval?.id, activeTabId, ensureDomTelemetry, markDomTelemetry])

  // Auto-cancel an unapproved DOM edit if the user switches tabs
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (ctx.tabId === String(activeTabId)) return

    console.log('[DOM Approval] Auto-cancelling pending change due to tab switch:', { from: ctx.tabId, to: activeTabId })

    // Manual inline cancel to avoid needing cancelPendingDomApproval
    const webview = webviewRefs.current.get(ctx.tabId)
    clearDomApprovalPatchTimeout(pendingDOMApproval.id)
    markDomTelemetry(pendingDOMApproval.id, 'auto_cancel')
    cancelledApprovalsRef.current.add(pendingDOMApproval.id)
    if (pendingDOMApproval.undoCode && webview) {
      webview.executeJavaScript(pendingDOMApproval.undoCode)
    }
    finalizeDomTelemetry(pendingDOMApproval.id, 'cancelled')
  }, [activeTabId, pendingDOMApproval, webviewRefs, clearDomApprovalPatchTimeout, markDomTelemetry, cancelledApprovalsRef, finalizeDomTelemetry])

  // Auto-cancel if the user changes the selection to a different element
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (!ctx.elementXpath) return
    if (!selectedElementXpath) return
    if (selectedElementXpath === ctx.elementXpath) return

    console.log('[DOM Approval] Auto-cancelling pending change due to selection change:', { from: ctx.elementXpath, to: selectedElementXpath })

    // Manual inline cancel
    const webview = webviewRefs.current.get(ctx.tabId)
    clearDomApprovalPatchTimeout(pendingDOMApproval.id)
    markDomTelemetry(pendingDOMApproval.id, 'auto_cancel')
    cancelledApprovalsRef.current.add(pendingDOMApproval.id)
    if (pendingDOMApproval.undoCode && webview) {
      webview.executeJavaScript(pendingDOMApproval.undoCode)
    }
    finalizeDomTelemetry(pendingDOMApproval.id, 'cancelled')
  }, [selectedElementXpath, pendingDOMApproval, webviewRefs, clearDomApprovalPatchTimeout, markDomTelemetry, cancelledApprovalsRef, finalizeDomTelemetry])

  return {
    ensureDomTelemetry,
    markDomTelemetry,
    finalizeDomTelemetry,
    cancelDomApprovalValue,
    domEditContextRef,
    domEditTelemetryRef,
  }
}
