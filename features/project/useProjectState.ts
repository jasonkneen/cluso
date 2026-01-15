/**
 * Project State Management Hook
 *
 * Centralizes project-related state management extracted from App.tsx.
 * Handles window locking, project setup flow, and directory navigation.
 */

import { useState, useCallback } from 'react'
import type {
  SetupProject,
  DirectoryStack,
  ProjectState,
  ProjectStateActions,
} from './types'

export interface UseProjectStateReturn extends ProjectState, ProjectStateActions {}

/**
 * Hook for managing project state
 *
 * Extracts and centralizes project state management from App.tsx.
 * Provides state and actions for:
 * - Window-level project locking (multi-window isolation)
 * - Project setup flow
 * - Directory navigation stack for file browser
 */
export function useProjectState(): UseProjectStateReturn {
  // Window state - for multi-window project locking
  const [windowId, setWindowId] = useState<number | null>(null)
  const [lockedProjectPath, setLockedProjectPath] = useState<string | null>(null)
  const [lockedProjectName, setLockedProjectName] = useState<string | null>(null)

  // Project setup flow state
  const [setupProject, setSetupProject] = useState<SetupProject | null>(null)

  // Directory navigation stack for file browser (@ commands)
  const [directoryStack, setDirectoryStack] = useState<DirectoryStack>([])

  // Action: Lock window to a specific project
  const lockProject = useCallback((path: string, name: string) => {
    setLockedProjectPath(path)
    setLockedProjectName(name)
  }, [])

  // Action: Clear project lock (unlock window)
  const unlockProject = useCallback(() => {
    setLockedProjectPath(null)
    setLockedProjectName(null)
  }, [])

  // Action: Start project setup flow
  const startSetup = useCallback((path: string, name: string, port?: number) => {
    setSetupProject({ path, name, port })
  }, [])

  // Action: Complete project setup flow
  const completeSetup = useCallback(() => {
    setSetupProject(null)
  }, [])

  // Action: Cancel project setup flow
  const cancelSetup = useCallback(() => {
    setSetupProject(null)
  }, [])

  // Action: Push directory onto navigation stack
  const pushDirectory = useCallback((dir: string) => {
    setDirectoryStack(prev => [...prev, dir])
  }, [])

  // Action: Pop directory from navigation stack
  const popDirectory = useCallback((): string | undefined => {
    let poppedDir: string | undefined
    setDirectoryStack(prev => {
      const newStack = [...prev]
      poppedDir = newStack.pop()
      return newStack
    })
    return poppedDir
  }, [])

  // Action: Clear directory navigation stack
  const clearDirectoryStack = useCallback(() => {
    setDirectoryStack([])
  }, [])

  return {
    // State
    windowId,
    lockedProjectPath,
    lockedProjectName,
    setupProject,
    directoryStack,
    // Setters
    setWindowId,
    setLockedProjectPath,
    setLockedProjectName,
    setSetupProject,
    setDirectoryStack,
    // Actions
    lockProject,
    unlockProject,
    startSetup,
    completeSetup,
    cancelSetup,
    pushDirectory,
    popDirectory,
    clearDirectoryStack,
  }
}
