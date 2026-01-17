/**
 * Floating Chat Sync Hook
 *
 * Handles auto-showing floating chat when element is selected.
 * Extracted from App.tsx lines 1020-1024.
 */

import { useEffect } from 'react'

interface SelectedElement {
  tagName?: string
  xpath?: string
}

interface UseFloatingChatSyncOptions {
  selectedElement: SelectedElement | null
  isSidebarOpen: boolean
  setShowElementChat: (show: boolean) => void
}

/**
 * Hook for syncing floating chat with element selection
 *
 * Auto-shows floating chat when an element is selected and sidebar is closed.
 */
export function useFloatingChatSync({
  selectedElement,
  isSidebarOpen,
  setShowElementChat,
}: UseFloatingChatSyncOptions): void {
  useEffect(() => {
    if (selectedElement && !isSidebarOpen) {
      setShowElementChat(true)
    }
  }, [selectedElement, isSidebarOpen, setShowElementChat])
}
