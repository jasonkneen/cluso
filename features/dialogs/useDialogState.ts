/**
 * Dialog State Hook
 *
 * Manages dialog/modal visibility state for:
 * - Settings dialog
 * - Mgrep onboarding dialog
 */

import { useState } from 'react'

export interface DialogState {
  // Settings dialog
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void

  // Mgrep onboarding dialog
  showMgrepOnboarding: boolean
  setShowMgrepOnboarding: (show: boolean) => void
}

export function useDialogState(): DialogState {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showMgrepOnboarding, setShowMgrepOnboarding] = useState(false)

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    showMgrepOnboarding,
    setShowMgrepOnboarding,
  }
}
