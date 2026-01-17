/**
 * Files Feature Module
 *
 * Exports file browser state management, file operations, and types.
 */

export { useFileBrowserState } from './useFileBrowserState'
export type {
  UseFileBrowserStateReturn,
  FileBrowserState,
  FileBrowserStateSetters,
  DirectoryFile,
  EditedFile,
} from './useFileBrowserState'
export { useEditedFilesOperations } from './useEditedFilesOperations'
export type {
  UseEditedFilesOperationsOptions,
  UseEditedFilesOperationsReturn,
} from './useEditedFilesOperations'
export { useFileSelectionHandlers } from './useFileSelectionHandlers'
export type {
  UseFileSelectionHandlersOptions,
  UseFileSelectionHandlersReturn,
  SelectedFile,
  ContextChip,
} from './useFileSelectionHandlers'
export { useFileHandlers } from './useFileHandlers'
export type {
  UseFileHandlersDeps,
  UseFileHandlersReturn,
  SelectedFileInfo,
} from './useFileHandlers'
