/**
 * Sidebar Chat Sync Hook
 *
 * Handles resetting element chat when sidebar opens.
 * Extracted from App.tsx lines 4968-4972.
 */

import { useEffect } from 'react'

interface UseSidebarChatSyncOptions {
  isSidebarOpen: boolean
  setShowElementChat: (show: boolean) => void
}

/**
 * Hook for syncing sidebar state with element chat
 *
 * Closes floating element chat when sidebar opens.
 */
export function useSidebarChatSync({
  isSidebarOpen,
  setShowElementChat,
}: UseSidebarChatSyncOptions): void {
  useEffect(() => {
    if (isSidebarOpen) {
      setShowElementChat(false)
    }
  }, [isSidebarOpen, setShowElementChat])
}
