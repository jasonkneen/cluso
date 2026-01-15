/**
 * File Browser Panel State Hook
 *
 * Manages the file browser overlay panel state extracted from App.tsx.
 * Handles the panel stack for navigation, visibility, and base path.
 * Includes refs for avoiding stale closures in callbacks.
 */

import { useState, useRef, useEffect } from 'react'
import type {
  FileBrowserPanel,
  FileBrowserPanelState,
  FileBrowserPanelStateSetters,
} from './types'

export interface UseFileBrowserPanelStateReturn
  extends FileBrowserPanelState,
    FileBrowserPanelStateSetters {
  /** Ref to current stack (avoids stale closures in callbacks) */
  fileBrowserStackRef: React.MutableRefObject<FileBrowserPanel[]>
  /** Ref to current visibility (avoids stale closures in callbacks) */
  fileBrowserVisibleRef: React.MutableRefObject<boolean>
  /** Push a new panel onto the stack */
  pushPanel: (panel: FileBrowserPanel) => void
  /** Pop the top panel from the stack */
  popPanel: () => void
  /** Clear all panels and hide the browser */
  closeBrowser: () => void
  /** Open the browser with initial panel */
  openBrowser: (panel: FileBrowserPanel, basePath?: string) => void
}

/**
 * Hook for managing file browser panel overlay state
 *
 * Extracts and centralizes file browser panel state management from App.tsx.
 * Provides state, setters, refs (for callbacks), and convenience actions.
 */
export function useFileBrowserPanelState(): UseFileBrowserPanelStateReturn {
  // Panel stack state
  const [fileBrowserStack, setFileBrowserStack] = useState<FileBrowserPanel[]>([])
  const [fileBrowserVisible, setFileBrowserVisible] = useState(false)
  const [fileBrowserBasePath, setFileBrowserBasePath] = useState<string>('')

  // Refs for avoiding stale closures in Gemini session callbacks
  const fileBrowserStackRef = useRef<FileBrowserPanel[]>([])
  const fileBrowserVisibleRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => {
    fileBrowserStackRef.current = fileBrowserStack
    fileBrowserVisibleRef.current = fileBrowserVisible
  }, [fileBrowserStack, fileBrowserVisible])

  // Action: Push a new panel onto the stack
  const pushPanel = (panel: FileBrowserPanel) => {
    setFileBrowserStack((prev) => [...prev, panel])
  }

  // Action: Pop the top panel from the stack
  const popPanel = () => {
    setFileBrowserStack((prev) => {
      if (prev.length <= 1) {
        // If only one panel left, close the browser
        setFileBrowserVisible(false)
        return []
      }
      return prev.slice(0, -1)
    })
  }

  // Action: Clear all panels and hide the browser
  const closeBrowser = () => {
    setFileBrowserStack([])
    setFileBrowserVisible(false)
  }

  // Action: Open the browser with initial panel
  const openBrowser = (panel: FileBrowserPanel, basePath?: string) => {
    setFileBrowserStack([panel])
    setFileBrowserVisible(true)
    if (basePath !== undefined) {
      setFileBrowserBasePath(basePath)
    }
  }

  return {
    // State
    fileBrowserStack,
    fileBrowserVisible,
    fileBrowserBasePath,
    // Setters
    setFileBrowserStack,
    setFileBrowserVisible,
    setFileBrowserBasePath,
    // Refs
    fileBrowserStackRef,
    fileBrowserVisibleRef,
    // Actions
    pushPanel,
    popPanel,
    closeBrowser,
    openBrowser,
  }
}
