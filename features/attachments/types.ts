/**
 * Attachments Feature Types
 *
 * Type definitions for file attachments, logs, and drag-and-drop state.
 */

/**
 * Selected file for attachment (@ commands, context chips)
 */
export interface SelectedFile {
  /** File path (may include query params) */
  path: string
  /** File content */
  content: string
  /** Clean filename for display (no query params) */
  displayName?: string
  /** Element type, e.g., "Button", "Section", "Component" */
  elementType?: string
  /** Starting line number for code snippets */
  lineStart?: number
  /** Ending line number for code snippets */
  lineEnd?: number
}

/**
 * Attachment state managed by useAttachmentState hook
 */
export interface AttachmentState {
  /** Console/debug logs captured for attachment */
  logs: string[]
  /** Whether to attach logs to the next message */
  attachLogs: boolean
  /** Base64 encoded attached images */
  attachedImages: string[]
  /** Whether a file is being dragged over the drop zone */
  isDraggingOver: boolean
  /** Selected files for attachment */
  selectedFiles: SelectedFile[]
}

/**
 * Actions returned by useAttachmentState hook
 */
export interface AttachmentStateActions {
  setLogs: React.Dispatch<React.SetStateAction<string[]>>
  setAttachLogs: React.Dispatch<React.SetStateAction<boolean>>
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>
  setIsDraggingOver: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>
  /** Add a log entry */
  addLog: (log: string) => void
  /** Clear all logs */
  clearLogs: () => void
  /** Add an image attachment (base64) */
  addImage: (base64Image: string) => void
  /** Remove an image by index */
  removeImage: (index: number) => void
  /** Clear all attached images */
  clearImages: () => void
  /** Add a selected file */
  addSelectedFile: (file: SelectedFile) => void
  /** Remove a selected file by path */
  removeSelectedFile: (path: string) => void
  /** Clear all selected files */
  clearSelectedFiles: () => void
  /** Clear all attachments (logs, images, files) */
  clearAllAttachments: () => void
  /** Handle drag over for image upload */
  handleDragOver: (e: React.DragEvent) => void
  /** Handle drag leave for image upload */
  handleDragLeave: (e: React.DragEvent) => void
  /** Handle drop for image upload */
  handleDrop: (e: React.DragEvent) => void
}
