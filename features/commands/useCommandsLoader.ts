/**
 * Commands Loader Hook
 *
 * Handles loading available prompts and directory files on mount.
 * Extracted from App.tsx lines 3117-3130.
 */

import { useEffect } from 'react'
import { fileService } from '../../services/FileService'

interface Command {
  name: string
  prompt: string
}

interface DirectoryFile {
  name: string
  isDirectory: boolean
  path?: string
}

interface UseCommandsLoaderOptions {
  isElectron: boolean
  setAvailableCommands: React.Dispatch<React.SetStateAction<Command[]>>
  setDirectoryFiles: React.Dispatch<React.SetStateAction<DirectoryFile[]>>
}

/**
 * Hook for loading commands and directory files
 *
 * Loads available prompts and directory listing on mount.
 */
export function useCommandsLoader({
  isElectron,
  setAvailableCommands,
  setDirectoryFiles,
}: UseCommandsLoaderOptions): void {
  useEffect(() => {
    if (!isElectron) return

    fileService.listPrompts().then(result => {
      if (result.success && result.data) {
        setAvailableCommands(result.data.map(name => ({ name, prompt: '' })))
      }
    })

    fileService.listDirectory().then(result => {
      if (result.success && result.data) {
        console.log('[Files] Loaded directory:', result.data.length, 'files')
        setDirectoryFiles(result.data)
      }
    })
  }, [isElectron, setAvailableCommands, setDirectoryFiles])
}
