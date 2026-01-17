/**
 * Project Setup Hook
 *
 * Manages project opening and setup flow handlers.
 */

import { useCallback } from 'react'

export interface SetupProject {
  path: string
  name: string
  port?: number
}

export interface UseProjectSetupDeps {
  lockedProjectPath: string | null
  setLockedProjectPath: React.Dispatch<React.SetStateAction<string | null>>
  setLockedProjectName: React.Dispatch<React.SetStateAction<string | null>>
  setSetupProject: React.Dispatch<React.SetStateAction<SetupProject | null>>
  setupProject: SetupProject | null
  updateCurrentTab: (updates: { url?: string; title?: string; projectPath?: string }) => void
  getRecentProject: (projectPath: string) => { port?: number } | undefined
  addToRecentProjects: (name: string, path: string, port: number) => void
}

export interface UseProjectSetupReturn {
  handleOpenProject: (projectPath: string, projectName: string) => Promise<void>
  handleSetupComplete: (url: string, port: number) => void
  handleSetupCancel: () => void
  handleOpenUrl: (url: string) => void
}

export function useProjectSetup(deps: UseProjectSetupDeps): UseProjectSetupReturn {
  const {
    lockedProjectPath,
    setLockedProjectPath,
    setLockedProjectName,
    setSetupProject,
    setupProject,
    updateCurrentTab,
    getRecentProject,
    addToRecentProjects,
  } = deps

  // Handle opening a project from new tab page - triggers setup flow
  const handleOpenProject = useCallback(async (projectPath: string, projectName: string) => {
    console.log('Starting project setup flow:', projectPath, projectName);

    // Lock this window to the project (if not already locked)
    if (!lockedProjectPath && window.electronAPI?.window) {
      const lockResult = await window.electronAPI.window.lockProject(projectPath, projectName);
      if (lockResult.success) {
        setLockedProjectPath(projectPath);
        setLockedProjectName(projectName);
        console.log(`[Window] Locked to project: ${projectPath}`);
      } else if (lockResult.error?.includes('already open in another window')) {
        // Focus the other window instead
        if (lockResult.existingWindowId) {
          await window.electronAPI.window.focus(lockResult.existingWindowId);
        }
        return; // Don't open project in this window
      }
    }

    // Get saved port from recent projects
    const recent = getRecentProject(projectPath);
    setSetupProject({ path: projectPath, name: projectName, port: recent?.port });
  }, [lockedProjectPath, setLockedProjectPath, setLockedProjectName, setSetupProject, getRecentProject])

  // Handle setup flow completion - actually opens the browser
  const handleSetupComplete = useCallback((url: string, port: number) => {
    if (setupProject) {
      updateCurrentTab({ url, title: setupProject.name, projectPath: setupProject.path });
      // Save port to recent projects
      addToRecentProjects(setupProject.name, setupProject.path, port);
      // URL input is synced via useEffect when tab.url changes
      setSetupProject(null);
    }
  }, [setupProject, updateCurrentTab, addToRecentProjects, setSetupProject])

  // Handle setup flow cancel - go back to new tab page
  const handleSetupCancel = useCallback(() => {
    setSetupProject(null);
  }, [setSetupProject])

  // Handle opening a URL from new tab page
  const handleOpenUrl = useCallback((url: string) => {
    updateCurrentTab({ url, title: new URL(url).hostname });
    // URL input is synced via useEffect when tab.url changes
  }, [updateCurrentTab])

  return {
    handleOpenProject,
    handleSetupComplete,
    handleSetupCancel,
    handleOpenUrl,
  }
}
