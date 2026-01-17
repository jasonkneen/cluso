/**
 * Misc Effects Hooks
 *
 * Collection of small effect hooks extracted from App.tsx.
 */

import { useEffect } from 'react'
import type {
  UseUrlSyncOptions,
  UseDarkModePersistOptions,
  UseInspectorThinkingOptions,
  UseAutoShowElementChatOptions,
  UseConnectionStateOptions,
  UsePreviewResetOptions,
  UseLayersStaleOptions,
  UseSidebarElementChatOptions,
} from './types'

/**
 * Sync URL input when switching tabs
 */
export function useUrlSync(options: UseUrlSyncOptions): void {
  const { activeTabId, activeTabUrl, setUrlInput } = options

  useEffect(() => {
    setUrlInput(activeTabUrl || '')
  }, [activeTabId, activeTabUrl, setUrlInput])
}

/**
 * Persist dark mode preference to localStorage
 */
export function useDarkModePersist(options: UseDarkModePersistOptions): void {
  const { isDarkMode } = options

  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode))
  }, [isDarkMode])
}

/**
 * Disable thinking mode when inspector is active
 */
export function useInspectorThinking(options: UseInspectorThinkingOptions): void {
  const {
    isInspectorActive,
    selectedModel,
    thinkingLevel,
    preInspectorSettingsRef,
    setThinkingLevel,
  } = options

  useEffect(() => {
    if (isInspectorActive) {
      preInspectorSettingsRef.current = {
        model: selectedModel,
        thinkingLevel: thinkingLevel,
      }

      if (thinkingLevel !== 'off') {
        console.log('[Inspector] Disabling thinking mode')
        setThinkingLevel('off')
      }
    } else if (preInspectorSettingsRef.current) {
      console.log('[Inspector] Restoring previous thinking level:', preInspectorSettingsRef.current.thinkingLevel)
      setThinkingLevel(preInspectorSettingsRef.current.thinkingLevel)
      preInspectorSettingsRef.current = null
    }
  }, [isInspectorActive, selectedModel, thinkingLevel, preInspectorSettingsRef, setThinkingLevel])
}

/**
 * Auto-show floating chat when element is selected
 */
export function useAutoShowElementChat(options: UseAutoShowElementChatOptions): void {
  const { selectedElement, isSidebarOpen, setShowElementChat } = options

  useEffect(() => {
    if (selectedElement && !isSidebarOpen) {
      setShowElementChat(true)
    }
  }, [selectedElement, isSidebarOpen, setShowElementChat])
}

/**
 * Update connection state when AI SDK initializes
 */
export function useConnectionState(options: UseConnectionStateOptions): void {
  const { isAIInitialized, connectionState, setConnectionState } = options

  useEffect(() => {
    if (isAIInitialized && connectionState === 'disconnected') {
      setConnectionState('idle')
    }
  }, [isAIInitialized, connectionState, setConnectionState])
}

/**
 * Reset preview state when approval changes
 */
export function usePreviewReset(options: UsePreviewResetOptions): void {
  const { pendingDOMApprovalId, pendingChangeCode, setIsPreviewingOriginal } = options

  useEffect(() => {
    setIsPreviewingOriginal(false)
  }, [pendingDOMApprovalId, pendingChangeCode, setIsPreviewingOriginal])
}

/**
 * Mark Layers tree stale on navigation changes
 */
export function useLayersStale(options: UseLayersStaleOptions): void {
  const { activeTabUrl, layersTreeStaleRef } = options

  useEffect(() => {
    if (activeTabUrl) layersTreeStaleRef.current = true
  }, [activeTabUrl, layersTreeStaleRef])
}

/**
 * Reset element chat when sidebar opens
 */
export function useSidebarElementChat(options: UseSidebarElementChatOptions): void {
  const { isSidebarOpen, setShowElementChat } = options

  useEffect(() => {
    if (isSidebarOpen) {
      setShowElementChat(false)
    }
  }, [isSidebarOpen, setShowElementChat])
}
