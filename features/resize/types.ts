/**
 * Resize Feature Types
 *
 * Type definitions for sidebar and panel resize functionality.
 */

export interface UseSidebarResizeOptions {
  isResizing: boolean
  setIsResizing: (resizing: boolean) => void
  setSidebarWidth: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

export interface UseConsoleResizeOptions {
  isConsoleResizing: boolean
  setIsConsoleResizing: (resizing: boolean) => void
  setConsoleHeight: (height: number) => void
  consoleResizeStartY: React.MutableRefObject<number>
  consoleResizeStartHeight: React.MutableRefObject<number>
  minHeight?: number
  maxHeight?: number
}
