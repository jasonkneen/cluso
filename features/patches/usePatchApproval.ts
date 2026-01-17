/**
 * Patch Approval Hook
 *
 * Manages source patch approval/rejection workflow.
 */

import { useCallback } from 'react'
import type { SourcePatch } from '../../types'

export interface UsePatchApprovalDeps {
  currentPatchIndex: number
  setCurrentPatchIndex: React.Dispatch<React.SetStateAction<number>>
  pendingPatches: SourcePatch[]
  setPendingPatches: React.Dispatch<React.SetStateAction<SourcePatch[]>>
  setIsApprovalDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export interface UsePatchApprovalReturn {
  handleApprovePatch: (patch: SourcePatch) => void
  handleRejectPatch: (patch: SourcePatch) => void
  handleEditPatch: (patch: SourcePatch) => void
  showPatchApprovalDialog: (patches: SourcePatch[]) => void
}

export function usePatchApproval(deps: UsePatchApprovalDeps): UsePatchApprovalReturn {
  const {
    currentPatchIndex,
    setCurrentPatchIndex,
    pendingPatches,
    setPendingPatches,
    setIsApprovalDialogOpen,
  } = deps

  const handleApprovePatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Approved patch:', patch.filePath);
    // Move to next patch
    const nextIndex = currentPatchIndex + 1;
    if (nextIndex < pendingPatches.length) {
      setCurrentPatchIndex(nextIndex);
    } else {
      // All patches approved
      setPendingPatches([]);
      setCurrentPatchIndex(0);
      setIsApprovalDialogOpen(false);
    }
  }, [currentPatchIndex, pendingPatches.length, setCurrentPatchIndex, setPendingPatches, setIsApprovalDialogOpen])

  const handleRejectPatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Rejected patch:', patch.filePath);
    // Remove rejected patch and move to next
    const updatedPatches = pendingPatches.filter((_, i) => i !== currentPatchIndex);
    setPendingPatches(updatedPatches);
    if (updatedPatches.length > 0) {
      setCurrentPatchIndex(Math.min(currentPatchIndex, updatedPatches.length - 1));
    } else {
      setCurrentPatchIndex(0);
      setIsApprovalDialogOpen(false);
    }
  }, [currentPatchIndex, pendingPatches, setPendingPatches, setCurrentPatchIndex, setIsApprovalDialogOpen])

  const handleEditPatch = useCallback((_patch: SourcePatch) => {
    console.log('[PatchApproval] Edit requested for patch:', _patch.filePath);
    // TODO: Open editor with patch content
    // For now, just close the dialog
    setIsApprovalDialogOpen(false);
  }, [setIsApprovalDialogOpen])

  // Function to show patch approval dialog with patches
  const showPatchApprovalDialog = useCallback((patches: SourcePatch[]) => {
    setPendingPatches(patches);
    setCurrentPatchIndex(0);
    setIsApprovalDialogOpen(true);
  }, [setPendingPatches, setCurrentPatchIndex, setIsApprovalDialogOpen])

  return {
    handleApprovePatch,
    handleRejectPatch,
    handleEditPatch,
    showPatchApprovalDialog,
  }
}
