import React, { useEffect } from 'react'
import { FileTree } from './FileTree'

interface FilePanelProps {
  width: number
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  projectPath?: string | null
  selectedFilePath?: string | null
  onSelectFile?: (path: string) => void
}

export const FilePanel: React.FC<FilePanelProps> = ({
  width,
  isDarkMode,
  panelBg,
  panelBorder,
  projectPath,
  selectedFilePath,
  onSelectFile
}) => {
  // Debug logging
  useEffect(() => {
    console.log('[FilePanel] Props received:', { projectPath, selectedFilePath })
  }, [projectPath, selectedFilePath])

  return (
    <div className="h-full overflow-y-auto">
      <FileTree
        rootPath={projectPath || undefined}
        selectedPath={selectedFilePath || null}
        onSelectFile={onSelectFile}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

export default FilePanel
