/**
 * File Browser Panel Feature Module
 *
 * Exports file browser panel overlay state management and types.
 * This handles the panel stack/navigation for the file browser overlay.
 * See features/files for general file browser state (directory, search, etc.)
 */

export { useFileBrowserPanelState } from './useFileBrowserPanelState'
export type { UseFileBrowserPanelStateReturn } from './useFileBrowserPanelState'
export type {
  FileBrowserPanel,
  FileBrowserItem,
  FileBrowserPanelState,
  FileBrowserPanelStateSetters,
} from './types'
