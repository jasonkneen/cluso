import React, { useState, useCallback, useEffect } from 'react'
import { FileTree, FileNode } from './FileTree'
import { CodeEditor } from './CodeEditor'
import { X, Save } from 'lucide-react'

interface FilePanelProps {
  width: number
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  projectPath?: string | null
  onClose?: () => void
  initialFilePath?: string
  initialLine?: number
}

export const FilePanel: React.FC<FilePanelProps> = ({
  width,
  isDarkMode,
  panelBg,
  panelBorder,
  projectPath,
  onClose,
  initialFilePath,
  initialLine
}) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(initialFilePath || null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isEditorMode, setIsEditorMode] = useState(!!initialFilePath)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [treeHeight, setTreeHeight] = useState(340)

  // Debug logging
  useEffect(() => {
    console.log('[FilePanel] Props received:', { projectPath, initialFilePath, initialLine })
  }, [projectPath, initialFilePath, initialLine])

  // Load initial file if provided
  useEffect(() => {
    if (initialFilePath && projectPath) {
      handleFileSelect(initialFilePath)
    }
  }, [initialFilePath, projectPath])

  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFilePath(filePath)
    setIsEditorMode(true)

    // Load file content via Electron API
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.files?.readFile) {
        throw new Error('File API not available')
      }

      const result = await electronAPI.files.readFile(filePath)

      if (!result.success) {
        throw new Error(result.error || 'Failed to read file')
      }

      setFileContent(result.content)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to load file:', error)
      setFileContent(`// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setFileContent(value)
      setHasUnsavedChanges(true)
    }
  }, [])

  const handleSave = useCallback(async (value: string) => {
    if (!selectedFilePath) return

    // Save file via Electron API
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.files?.writeFile) {
        throw new Error('File API not available')
      }

      const result = await electronAPI.files.writeFile(selectedFilePath, value)

      if (!result.success) {
        throw new Error(result.error || 'Failed to save file')
      }

      setHasUnsavedChanges(false)
      console.log('File saved successfully:', selectedFilePath)
      // TODO: Show success toast notification
    } catch (error) {
      console.error('Failed to save file:', error)
      // TODO: Show error toast notification
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [selectedFilePath])

  const handleBackToTree = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?')
      if (!confirmed) return
    }
    setIsEditorMode(false)
    setSelectedFilePath(null)
  }

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 rounded-xl shadow-sm border overflow-hidden"
      style={{ width, backgroundColor: panelBg, borderColor: panelBorder }}
    >
      {/* Header */}
      <div
        className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0"
        style={{ borderColor: panelBorder }}
      >
        <div className="flex items-center gap-2">
          {isEditorMode && (
            <button
              onClick={handleBackToTree}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                isDarkMode
                  ? 'hover:bg-neutral-700 text-neutral-300'
                  : 'hover:bg-stone-200 text-stone-600'
              }`}
              title="Back to file tree"
            >
              ← Files
            </button>
          )}
          <h3 className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
            {isEditorMode ? 'Code Editor' : 'Files'}
          </h3>
          {hasUnsavedChanges && (
            <span className="text-xs text-orange-500">●</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditorMode && selectedFilePath && (
            <button
              onClick={() => handleSave(fileContent)}
              disabled={!hasUnsavedChanges}
              className={`p-1 rounded transition-colors ${
                hasUnsavedChanges
                  ? isDarkMode
                    ? 'hover:bg-neutral-700 text-blue-400'
                    : 'hover:bg-stone-200 text-blue-600'
                  : isDarkMode
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-stone-300 cursor-not-allowed'
              }`}
              title="Save (Cmd+S)"
            >
              <Save size={14} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors ${
                isDarkMode
                  ? 'hover:bg-neutral-700 text-neutral-400'
                  : 'hover:bg-stone-200 text-stone-500'
              }`}
              title="Close file panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isEditorMode && selectedFilePath ? (
          <CodeEditor
            filePath={selectedFilePath}
            content={fileContent}
            onChange={handleContentChange}
            onSave={handleSave}
            isDarkMode={isDarkMode}
            initialLine={initialLine}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <FileTree
              rootPath={projectPath || undefined}
              selectedPath={selectedFilePath}
              onSelectFile={handleFileSelect}
              isDarkMode={isDarkMode}
            />
          </div>
        )}
      </div>

      {/* Footer info */}
      {isEditorMode && selectedFilePath && (
        <div
          className="h-6 border-t flex items-center px-3 text-xs flex-shrink-0"
          style={{ borderColor: panelBorder }}
        >
          <span className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'}>
            {selectedFilePath.split('/').pop()}
          </span>
          {hasUnsavedChanges && (
            <span className="ml-2 text-orange-500">Modified</span>
          )}
        </div>
      )}
    </div>
  )
}

export default FilePanel
