/**
 * Editor Feature Types
 *
 * Type definitions for the code editor state management.
 */

/**
 * Editor state managed by useEditorState hook
 */
export interface EditorState {
  /** Whether the editor is currently visible/active */
  isEditorMode: boolean
  /** Path to the currently opened file */
  editorFilePath: string | null
  /** Content of the currently opened file */
  editorFileContent: string
  /** Initial line to scroll to when opening a file */
  editorInitialLine: number | undefined
  /** Whether there are unsaved changes in the editor */
  hasUnsavedEdits: boolean
}

/**
 * Actions returned by useEditorState hook
 */
export interface EditorStateActions {
  setIsEditorMode: React.Dispatch<React.SetStateAction<boolean>>
  setEditorFilePath: React.Dispatch<React.SetStateAction<string | null>>
  setEditorFileContent: React.Dispatch<React.SetStateAction<string>>
  setEditorInitialLine: React.Dispatch<React.SetStateAction<number | undefined>>
  setHasUnsavedEdits: React.Dispatch<React.SetStateAction<boolean>>
  /** Opens a file in the editor */
  openFile: (filePath: string, content: string, initialLine?: number) => void
  /** Closes the editor and resets state */
  closeEditor: () => void
  /** Marks the editor content as having unsaved changes */
  markUnsaved: () => void
  /** Marks the editor content as saved */
  markSaved: () => void
}
