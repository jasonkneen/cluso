import { useCallback, useRef, useEffect } from 'react'
import type { SourcePatch, SelectedElement, Message } from '../../types'
import type { PendingPatch, PendingDOMApproval, UsePatchStateReturn } from './usePatchState'
import { generateSourcePatch } from '../../utils/generateSourcePatch'
import type { ProviderConfig } from '../../hooks/useAIChat'
import type { AppSettings } from '../../components/SettingsDialog'
import { fileService } from '../../services/FileService'
import type { EditedFile } from '../files'

/**
 * Telemetry event types for DOM edit tracking
 */
export type DomEditTelemetryEvent =
  | 'preview_applied'
  | 'patch_generation_started'
  | 'patch_ready'
  | 'patch_failed'
  | 'user_accept'
  | 'user_reject'
  | 'auto_cancel'
  | 'source_write_started'
  | 'source_write_succeeded'
  | 'source_write_failed'

/**
 * Telemetry data for a single DOM edit operation
 */
export type DomEditTelemetry = {
  id: string
  createdAtMs: number
  tabId: string
  elementXpath?: string
  events: Partial<Record<DomEditTelemetryEvent, number>>
}

/**
 * Model info needed for patch generation
 */
interface ModelInfo {
  id: string
}

/**
 * Type for prepareDomPatch function
 */
export type PrepareDomPatchFn = (
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
) => void

/**
 * Dependencies required by usePatchHandlers
 */
export interface PatchHandlerDeps {
  // State from usePatchState
  patchState: UsePatchStateReturn

  // Active tab info
  activeTabId: string

  // Selected element
  selectedElement: SelectedElement | null

  // Refs for webviews
  webviewRefs: React.MutableRefObject<Map<string, HTMLElement>>

  // Model configuration
  selectedModelRef: React.MutableRefObject<ModelInfo>
  providerConfigsRef: React.MutableRefObject<ProviderConfig[]>
  appSettingsRef: React.MutableRefObject<AppSettings>
  selectedModel: ModelInfo

  // Message handling
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>

  // Pending change (for clearing pill toolbar)
  setPendingChange: React.Dispatch<React.SetStateAction<unknown>>

  // File editing tracker - use ref for late binding
  addEditedFileRef: React.MutableRefObject<(file: Omit<EditedFile, 'timestamp'>) => void>
}

/**
 * Return type for usePatchHandlers hook
 */
export interface UsePatchHandlersReturn {
  // Telemetry functions
  ensureDomTelemetry: (id: string, init?: Partial<DomEditTelemetry>) => void
  markDomTelemetry: (id: string, event: DomEditTelemetryEvent) => void
  finalizeDomTelemetry: (id: string, outcome: 'accepted' | 'rejected' | 'cancelled') => void

  // Cancellation functions
  cancelDomApprovalValue: (
    approval: PendingDOMApproval,
    params: { tabIdForUndo: string; reason: 'superseded' | 'context_change' }
  ) => void
  cancelPendingDomApproval: (reason: 'superseded' | 'context_change') => void

  // Patch preparation
  prepareDomPatch: PrepareDomPatchFn
  prepareDomPatchRef: React.MutableRefObject<PrepareDomPatchFn>

  // Approval handlers
  handleAcceptDOMApproval: () => Promise<void>
  handleRejectDOMApproval: () => void

  // Patch dialog handlers
  handleApprovePatch: (patch: SourcePatch) => void
  handleRejectPatch: (patch: SourcePatch) => void
  handleEditPatch: (patch: SourcePatch) => void
  showPatchApprovalDialog: (patches: SourcePatch[]) => void

  // Refs for telemetry
  domEditTelemetryRef: React.MutableRefObject<Record<string, DomEditTelemetry>>
  domEditContextRef: React.MutableRefObject<{ id: string; tabId: string; elementXpath?: string } | null>
}

/**
 * Helper function to get current timestamp in ms
 */
const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
  return Date.now()
}

/**
 * Hook to manage DOM patching handlers
 * Extracts patch-related handlers from App.tsx for better organization
 */
export function usePatchHandlers(deps: PatchHandlerDeps): UsePatchHandlersReturn {
  const {
    patchState,
    activeTabId,
    selectedElement,
    webviewRefs,
    selectedModelRef,
    providerConfigsRef,
    appSettingsRef,
    selectedModel,
    setMessages,
    setPendingChange,
    addEditedFileRef,
  } = deps

  const {
    pendingDOMApproval,
    setPendingDOMApproval,
    cancelledApprovalsRef,
    domApprovalPatchTimeoutsRef,
    domApprovalPatchTimeoutTokensRef,
    isGeneratingSourcePatch,
    setIsGeneratingSourcePatch,
    clearDomApprovalPatchTimeout,
    pendingPatches,
    setPendingPatches,
    currentPatchIndex,
    setCurrentPatchIndex,
    setIsApprovalDialogOpen,
  } = patchState

  // Telemetry refs
  const domEditTelemetryRef = useRef<Record<string, DomEditTelemetry>>({})
  const domEditContextRef = useRef<{ id: string; tabId: string; elementXpath?: string } | null>(null)

  // Latest-wins tracking for superseded approvals
  const lastPendingDomApprovalRef = useRef<PendingDOMApproval | null>(null)

  // Ref for prepareDomPatch - allows late binding since it's defined later
  const prepareDomPatchRef = useRef<UsePatchHandlersReturn['prepareDomPatch']>((..._args) => {
    console.warn('[Patches] prepareDomPatch called before initialization')
  })

  // ============= Telemetry Functions =============

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

  const markDomTelemetry = useCallback((id: string, event: DomEditTelemetryEvent) => {
    ensureDomTelemetry(id)
    const telemetry = domEditTelemetryRef.current[id]
    if (!telemetry.events[event]) {
      telemetry.events[event] = nowMs()
    }
  }, [ensureDomTelemetry])

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

  // ============= Cancellation Functions =============

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
      ;(webview as unknown as Electron.WebviewTag).executeJavaScript(approval.undoCode)
    }
    finalizeDomTelemetry(approval.id, 'cancelled')
  }, [webviewRefs, clearDomApprovalPatchTimeout, markDomTelemetry, cancelledApprovalsRef, finalizeDomTelemetry])

  const cancelPendingDomApproval = useCallback((reason: 'superseded' | 'context_change') => {
    if (!pendingDOMApproval) return
    if (pendingDOMApproval.userApproved || isGeneratingSourcePatch) return

    const ctx = domEditContextRef.current
    const tabIdForUndo = ctx?.id === pendingDOMApproval.id ? ctx.tabId : String(activeTabId)
    cancelDomApprovalValue(pendingDOMApproval, { tabIdForUndo, reason })
    setPendingDOMApproval(null)
    setPendingChange(null)
  }, [pendingDOMApproval, isGeneratingSourcePatch, activeTabId, cancelDomApprovalValue, setPendingDOMApproval, setPendingChange])

  // ============= Effects for Auto-Cancellation =============

  // Latest-wins: if a new DOM approval replaces an older pending one, auto-cancel the older preview.
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

  // Initialize telemetry whenever a new pending DOM approval appears.
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

  // Auto-cancel an unapproved DOM edit if the user switches tabs.
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (ctx.tabId === String(activeTabId)) return

    console.log('[DOM Approval] Auto-cancelling pending change due to tab switch:', { from: ctx.tabId, to: activeTabId })
    cancelPendingDomApproval('context_change')
  }, [activeTabId, pendingDOMApproval, cancelPendingDomApproval])

  // Auto-cancel if the user changes the selection to a different element (keeps unapproved previews from lingering).
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (!ctx.elementXpath) return
    const selectedXpath = selectedElement?.xpath
    if (!selectedXpath) return
    if (selectedXpath === ctx.elementXpath) return

    console.log('[DOM Approval] Auto-cancelling pending change due to selection change:', { from: ctx.elementXpath, to: selectedXpath })
    cancelPendingDomApproval('context_change')
  }, [activeTabId, pendingDOMApproval, selectedElement?.xpath, cancelPendingDomApproval])

  // ============= Patch Preparation =============

  const prepareDomPatch = useCallback((
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
  ) => {
    // Ensure this approval id is not considered cancelled
    cancelledApprovalsRef.current.delete(approvalId)
    clearDomApprovalPatchTimeout(approvalId)
    markDomTelemetry(approvalId, 'patch_generation_started')
    console.log('='.repeat(60))
    console.log('[DOM Approval] === PREPARING SOURCE PATCH ===')
    console.log('[DOM Approval] Inputs:', {
      approvalId,
      elementTag: element.tagName,
      cssChanges: Object.keys(cssChanges).length > 0 ? cssChanges : 'none',
      projectPath: projectPath || 'NOT SET',
      hasSourceLocation: !!element.sourceLocation,
      sourceFile: element.sourceLocation?.sources?.[0]?.file || 'NONE',
      sourceLine: element.sourceLocation?.sources?.[0]?.line || 'NONE',
      userRequest: userRequest?.substring(0, 50),
      hasSrcChange: !!srcChange,
    })
    console.log('='.repeat(60))
    // Use refs to get current values (prevents stale closures during async operations)
    const providerConfig = { modelId: selectedModelRef.current.id, providers: providerConfigsRef.current }

    // Wrap in timeout to prevent indefinite hangs
    const patchPromise = generateSourcePatch({
      element,
      cssChanges,
      providerConfig,
      projectPath: projectPath || undefined,
      userRequest,
      textChange,
      srcChange,
      disableFastApply: appSettingsRef.current.clusoCloudEditsEnabled,
      morphApiKey: appSettingsRef.current.providers.find(p => p.id === 'morph')?.apiKey,
    })

    const timeoutToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    domApprovalPatchTimeoutTokensRef.current.set(approvalId, timeoutToken)

    const timeoutPromise = new Promise<null>((resolve) => {
      const handle = setTimeout(() => {
        // Ignore if superseded/cancelled/cleared.
        const currentToken = domApprovalPatchTimeoutTokensRef.current.get(approvalId)
        if (currentToken !== timeoutToken) return
        // Cleanup so it can't fire again.
        clearDomApprovalPatchTimeout(approvalId)
        console.log('[DOM Approval] Patch generation TIMED OUT after 30s', { approvalId })
        resolve(null)
      }, 30000)
      domApprovalPatchTimeoutsRef.current.set(approvalId, handle)
    })

    Promise.race([patchPromise, timeoutPromise])
      .then(patch => {
        clearDomApprovalPatchTimeout(approvalId)
        console.log('[DOM Approval] Patch generation completed:', { approvalId, success: !!patch })
        if (cancelledApprovalsRef.current.has(approvalId)) return
        markDomTelemetry(approvalId, patch ? 'patch_ready' : 'patch_failed')
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev
          if (cancelledApprovalsRef.current.has(approvalId)) return prev
          if (patch) {
            const patchPayload: PendingPatch = {
              id: `patch-${Date.now()}`,
              filePath: patch.filePath,
              originalContent: patch.originalContent,
              patchedContent: patch.patchedContent,
              description,
              elementSelector: element.xpath || undefined,
              cssChanges,
              undoCode,
              applyCode,
              generatedBy: patch.generatedBy,
              durationMs: patch.durationMs,
            }
            console.log('[DOM Approval] Patch ready:', { approvalId, filePath: patch.filePath, generatedBy: patch.generatedBy })
            const autoApproveFastPath =
              !!appSettingsRef.current.fastPathAutoApplyEnabled && patch.generatedBy === 'fast-path'
            return {
              ...prev,
              patchStatus: 'ready',
              patch: patchPayload,
              patchError: undefined,
              userApproved: prev.userApproved || autoApproveFastPath,
            } as PendingDOMApproval
          }
          console.warn('[DOM Approval] Patch generation returned null:', approvalId)
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: 'Could not generate source patch.' } as PendingDOMApproval
        })
      })
      .catch((error: unknown) => {
        clearDomApprovalPatchTimeout(approvalId)
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate source patch'
        console.error('[DOM Approval] Patch generation failed:', { approvalId, error: errorMessage })
        if (cancelledApprovalsRef.current.has(approvalId)) return
        markDomTelemetry(approvalId, 'patch_failed')
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev
          if (cancelledApprovalsRef.current.has(approvalId)) return prev
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: errorMessage } as PendingDOMApproval
        })
      })
      .finally(() => {
        clearDomApprovalPatchTimeout(approvalId)
      })
  }, [
    cancelledApprovalsRef,
    clearDomApprovalPatchTimeout,
    markDomTelemetry,
    selectedModelRef,
    providerConfigsRef,
    appSettingsRef,
    domApprovalPatchTimeoutTokensRef,
    domApprovalPatchTimeoutsRef,
    setPendingDOMApproval,
  ])

  // Update prepareDomPatch ref for late binding
  prepareDomPatchRef.current = prepareDomPatch

  // ============= Approval Handlers =============

  // Handle accepting DOM preview - generates source patch and auto-approves
  const handleAcceptDOMApproval = useCallback(async () => {
    if (!pendingDOMApproval) return
    if (cancelledApprovalsRef.current.has(pendingDOMApproval.id)) {
      console.log('[DOM Approval] Accept aborted - approval was cancelled:', pendingDOMApproval.id)
      return
    }

    // Patch generation timeout is only relevant while waiting; clear it once we move into accept flow.
    clearDomApprovalPatchTimeout(pendingDOMApproval.id)

    console.log('[DOM Approval] Accept clicked:', {
      id: pendingDOMApproval.id,
      status: pendingDOMApproval.patchStatus,
      hasPatch: !!pendingDOMApproval.patch,
      userApproved: pendingDOMApproval.userApproved,
    })

    // If still preparing, mark as user-approved so it auto-applies when ready
    if (pendingDOMApproval.patchStatus === 'preparing') {
      console.log('[DOM Approval] Patch still preparing, marking as user-approved for auto-apply')
      setPendingDOMApproval(prev => prev ? { ...prev, userApproved: true } : null)
      return
    }

    markDomTelemetry(pendingDOMApproval.id, 'user_accept')

    if (pendingDOMApproval.patchStatus === 'error' || !pendingDOMApproval.patch) {
      setMessages(prev => [...prev, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: pendingDOMApproval.patchError || 'Could not prepare a source patch for this change.',
        timestamp: new Date(),
      }])
      setPendingDOMApproval(null)
      setPendingChange(null)
      finalizeDomTelemetry(pendingDOMApproval.id, 'cancelled')
      return
    }

    const patch = pendingDOMApproval.patch
    setIsGeneratingSourcePatch(true)
    console.log('='.repeat(60))
    console.log('[DOM Approval] === USER APPROVED PATCH ===')
    console.log('[DOM Approval] Patch details:', {
      id: patch.id,
      filePath: patch.filePath,
      originalLength: patch.originalContent?.length || 0,
      patchedLength: patch.patchedContent?.length || 0,
      description: patch.description,
    })
    console.log('='.repeat(60))

    setMessages(prev => [...prev, {
      id: `msg-approved-${Date.now()}`,
      role: 'assistant',
      content: `Approved: ${pendingDOMApproval.description}. Updating source code...`,
      timestamp: new Date(),
      model: selectedModel.id,
      intent: 'ui_modify',
    }])

    try {
      // Verify content actually changed
      const contentChanged = patch.originalContent !== patch.patchedContent
      console.log('[DOM Approval] Content changed:', contentChanged)
      if (!contentChanged) {
        console.log('[DOM Approval] ⚠️ WARNING: Patch content is IDENTICAL to original!')
        console.log('[DOM Approval] This means the AI did not make any changes.')
      }
      console.log('[DOM Approval] Writing patch to disk:', patch.filePath)
      console.log('[DOM Approval] Original length:', patch.originalContent?.length || 0)
      console.log('[DOM Approval] Patched length:', patch.patchedContent?.length || 0)
      console.log('[DOM Approval] First 200 chars of patched content:', patch.patchedContent?.substring(0, 200))

      markDomTelemetry(pendingDOMApproval.id, 'source_write_started')
      const result = await fileService.writeFile(patch.filePath, patch.patchedContent)
      console.log('[DOM Approval] writeFile result:', result)

      // Verify the write by reading it back
      if (result.success) {
        const verifyResult = await fileService.readFileFull(patch.filePath)
        if (verifyResult.success) {
          const matches = verifyResult.data === patch.patchedContent
          console.log('[DOM Approval] Verification read-back:', matches ? '✅ MATCHES' : '❌ MISMATCH')
          if (!matches) {
            console.log('[DOM Approval] Expected length:', patch.patchedContent?.length)
            console.log('[DOM Approval] Actual length:', verifyResult.data?.length)
          }
        }
      }

      if (result.success) {
        markDomTelemetry(pendingDOMApproval.id, 'source_write_succeeded')
        console.log('[Source Patch] ✅ Applied successfully to:', patch.filePath)
        setMessages(prev => [...prev, {
          id: `msg-patch-${Date.now()}`,
          role: 'assistant',
          content: `Source code updated: ${patch.filePath.split('/').pop()}`,
          timestamp: new Date(),
        }])
        addEditedFileRef.current({
          path: patch.filePath,
          additions: 1,
          deletions: 1,
          undoCode: patch.undoCode,
        })
      } else {
        throw new Error(result.error || 'Failed to save file')
      }
    } catch (e) {
      markDomTelemetry(pendingDOMApproval.id, 'source_write_failed')
      console.error('[Source Patch] Failed:', e)
      setMessages(prev => [...prev, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: new Date(),
      }])
    }

    setIsGeneratingSourcePatch(false)
    setPendingDOMApproval(null)
    setPendingChange(null) // Clear pill toolbar too
    // Cleanup cancellation marker once lifecycle ends
    cancelledApprovalsRef.current.delete(pendingDOMApproval.id)
    finalizeDomTelemetry(pendingDOMApproval.id, 'accepted')
  }, [
    pendingDOMApproval,
    cancelledApprovalsRef,
    clearDomApprovalPatchTimeout,
    setPendingDOMApproval,
    markDomTelemetry,
    setMessages,
    setPendingChange,
    finalizeDomTelemetry,
    setIsGeneratingSourcePatch,
    selectedModel.id,
    addEditedFileRef,
  ])

  // Auto-apply when patch is ready and user has pre-approved
  useEffect(() => {
    if (pendingDOMApproval?.userApproved && pendingDOMApproval.patchStatus === 'ready' && pendingDOMApproval.patch) {
      console.log('[DOM Approval] Auto-applying: patch ready and user already approved')
      handleAcceptDOMApproval()
    }
  }, [pendingDOMApproval?.patchStatus, pendingDOMApproval?.userApproved, handleAcceptDOMApproval])

  // Handle rejecting DOM preview - reverts changes
  const handleRejectDOMApproval = useCallback(() => {
    if (!pendingDOMApproval) return

    clearDomApprovalPatchTimeout(pendingDOMApproval.id)

    markDomTelemetry(pendingDOMApproval.id, 'user_reject')
    cancelledApprovalsRef.current.add(pendingDOMApproval.id)
    const webview = webviewRefs.current.get(activeTabId)
    if (pendingDOMApproval.undoCode && webview) {
      ;(webview as unknown as Electron.WebviewTag).executeJavaScript(pendingDOMApproval.undoCode)
    }
    setPendingDOMApproval(null)
    setPendingChange(null) // Clear pill toolbar too
    finalizeDomTelemetry(pendingDOMApproval.id, 'rejected')
  }, [
    pendingDOMApproval,
    clearDomApprovalPatchTimeout,
    markDomTelemetry,
    cancelledApprovalsRef,
    webviewRefs,
    activeTabId,
    setPendingDOMApproval,
    setPendingChange,
    finalizeDomTelemetry,
  ])

  // ============= Patch Dialog Handlers =============

  const handleApprovePatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Approved patch:', patch.filePath)
    // Move to next patch
    const nextIndex = currentPatchIndex + 1
    if (nextIndex < pendingPatches.length) {
      setCurrentPatchIndex(nextIndex)
    } else {
      // All patches approved
      setPendingPatches([])
      setCurrentPatchIndex(0)
      setIsApprovalDialogOpen(false)
    }
  }, [currentPatchIndex, pendingPatches.length, setCurrentPatchIndex, setPendingPatches, setIsApprovalDialogOpen])

  const handleRejectPatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Rejected patch:', patch.filePath)
    // Remove rejected patch and move to next
    const updatedPatches = pendingPatches.filter((_, i) => i !== currentPatchIndex)
    setPendingPatches(updatedPatches)
    if (updatedPatches.length > 0) {
      setCurrentPatchIndex(Math.min(currentPatchIndex, updatedPatches.length - 1))
    } else {
      setCurrentPatchIndex(0)
      setIsApprovalDialogOpen(false)
    }
  }, [currentPatchIndex, pendingPatches, setPendingPatches, setCurrentPatchIndex, setIsApprovalDialogOpen])

  const handleEditPatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Edit requested for patch:', patch.filePath)
    // TODO: Open editor with patch content
    // For now, just close the dialog
    setIsApprovalDialogOpen(false)
  }, [setIsApprovalDialogOpen])

  // Function to show patch approval dialog with patches
  const showPatchApprovalDialog = useCallback((patches: SourcePatch[]) => {
    setPendingPatches(patches)
    setCurrentPatchIndex(0)
  }, [setPendingPatches, setCurrentPatchIndex])

  return {
    // Telemetry functions
    ensureDomTelemetry,
    markDomTelemetry,
    finalizeDomTelemetry,

    // Cancellation functions
    cancelDomApprovalValue,
    cancelPendingDomApproval,

    // Patch preparation
    prepareDomPatch,
    prepareDomPatchRef,

    // Approval handlers
    handleAcceptDOMApproval,
    handleRejectDOMApproval,

    // Patch dialog handlers
    handleApprovePatch,
    handleRejectPatch,
    handleEditPatch,
    showPatchApprovalDialog,

    // Refs for telemetry
    domEditTelemetryRef,
    domEditContextRef,
  }
}
