/**
 * Misc Effects Types
 *
 * Type definitions for miscellaneous effect hooks.
 */

export interface UseUrlSyncOptions {
  activeTabId: string
  activeTabUrl: string | undefined
  setUrlInput: (url: string) => void
}

export interface UseDarkModePersistOptions {
  isDarkMode: boolean
}

export interface UseInspectorThinkingOptions {
  isInspectorActive: boolean
  selectedModel: { id: string }
  thinkingLevel: string
  preInspectorSettingsRef: React.MutableRefObject<{
    model: { id: string }
    thinkingLevel: string
  } | null>
  setThinkingLevel: (level: string) => void
}

export interface UseAutoShowElementChatOptions {
  selectedElement: unknown
  isSidebarOpen: boolean
  setShowElementChat: (show: boolean) => void
}

export interface UseConnectionStateOptions {
  isAIInitialized: boolean
  connectionState: string
  setConnectionState: (state: string) => void
}

export interface UsePreviewResetOptions {
  pendingDOMApprovalId: string | undefined
  pendingChangeCode: string | undefined
  setIsPreviewingOriginal: (previewing: boolean) => void
}

export interface UseLayersStaleOptions {
  activeTabUrl: string | undefined
  layersTreeStaleRef: React.MutableRefObject<boolean>
}

export interface UseSidebarElementChatOptions {
  isSidebarOpen: boolean
  setShowElementChat: (show: boolean) => void
}
