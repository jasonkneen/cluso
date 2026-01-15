import { useState, useRef, useCallback } from 'react'
import type { SourcePatch, SelectedElement } from '../../types'

/**
 * Pending UI Patch - stores patches that need user confirmation
 */
export interface PendingPatch {
  id: string
  filePath: string
  originalContent: string
  patchedContent: string
  description: string
  elementSelector?: string  // CSS selector for the modified element
  cssChanges?: Record<string, string>  // CSS property changes made
  undoCode?: string  // JavaScript to revert DOM changes
  applyCode?: string  // JavaScript to re-apply DOM changes
  generatedBy?: 'fast-apply' | 'gemini' | 'fast-path'  // Which method generated the patch
  durationMs?: number  // How long it took to generate
}

/**
 * Pending DOM Approval - stores DOM changes that need user approval before source patch
 */
export interface PendingDOMApproval {
  id: string
  element: SelectedElement
  cssChanges: Record<string, string>
  textChange?: string
  srcChange?: { oldSrc: string; newSrc: string }  // For image src replacement
  description: string
  undoCode: string
  applyCode: string
  userRequest: string
  patchStatus: 'preparing' | 'ready' | 'error'
  patch?: PendingPatch
  patchError?: string
  userApproved?: boolean  // Set to true when user clicks Accept, triggers auto-apply when patch is ready
}

/**
 * Return type for usePatchState hook
 */
export interface UsePatchStateReturn {
  // Pending Patch State
  pendingPatch: PendingPatch | null
  setPendingPatch: React.Dispatch<React.SetStateAction<PendingPatch | null>>
  isPreviewingPatchOriginal: boolean
  setIsPreviewingPatchOriginal: React.Dispatch<React.SetStateAction<boolean>>

  // DOM Approval State
  pendingDOMApproval: PendingDOMApproval | null
  setPendingDOMApproval: React.Dispatch<React.SetStateAction<PendingDOMApproval | null>>
  cancelledApprovalsRef: React.MutableRefObject<Set<string>>
  domApprovalPatchTimeoutsRef: React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>
  domApprovalPatchTimeoutTokensRef: React.MutableRefObject<Map<string, string>>
  isGeneratingSourcePatch: boolean
  setIsGeneratingSourcePatch: React.Dispatch<React.SetStateAction<boolean>>
  clearDomApprovalPatchTimeout: (approvalId: string) => void

  // Patch Approval Dialog State
  pendingPatches: SourcePatch[]
  setPendingPatches: React.Dispatch<React.SetStateAction<SourcePatch[]>>
  currentPatchIndex: number
  setCurrentPatchIndex: React.Dispatch<React.SetStateAction<number>>
  isApprovalDialogOpen: boolean
  setIsApprovalDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Hook to manage patch approval state
 * Extracts patch-related state from App.tsx for better organization
 */
export function usePatchState(): UsePatchStateReturn {
  // Pending UI Patch State - stores patches that need user confirmation
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null)
  const [isPreviewingPatchOriginal, setIsPreviewingPatchOriginal] = useState(false)

  // Pending DOM Approval State - stores DOM changes that need user approval before source patch
  const [pendingDOMApproval, setPendingDOMApproval] = useState<PendingDOMApproval | null>(null)
  const cancelledApprovalsRef = useRef<Set<string>>(new Set())
  // Per-approval timeout tracking to avoid false timeout logs after success/cancel
  const domApprovalPatchTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const domApprovalPatchTimeoutTokensRef = useRef<Map<string, string>>(new Map())
  const [isGeneratingSourcePatch, setIsGeneratingSourcePatch] = useState(false)

  const clearDomApprovalPatchTimeout = useCallback((approvalId: string) => {
    const handle = domApprovalPatchTimeoutsRef.current.get(approvalId)
    if (handle) {
      clearTimeout(handle)
      domApprovalPatchTimeoutsRef.current.delete(approvalId)
    }
    domApprovalPatchTimeoutTokensRef.current.delete(approvalId)
  }, [])

  // Patch Approval Dialog State
  const [pendingPatches, setPendingPatches] = useState<SourcePatch[]>([])
  const [currentPatchIndex, setCurrentPatchIndex] = useState(0)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)

  return {
    // Pending Patch State
    pendingPatch,
    setPendingPatch,
    isPreviewingPatchOriginal,
    setIsPreviewingPatchOriginal,

    // DOM Approval State
    pendingDOMApproval,
    setPendingDOMApproval,
    cancelledApprovalsRef,
    domApprovalPatchTimeoutsRef,
    domApprovalPatchTimeoutTokensRef,
    isGeneratingSourcePatch,
    setIsGeneratingSourcePatch,
    clearDomApprovalPatchTimeout,

    // Patch Approval Dialog State
    pendingPatches,
    setPendingPatches,
    currentPatchIndex,
    setCurrentPatchIndex,
    isApprovalDialogOpen,
    setIsApprovalDialogOpen,
  }
}
