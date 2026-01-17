/**
 * Terminal Feature Types
 *
 * Type definitions for ghostty-web terminal panel integration.
 */

/**
 * Terminal instance containing xterm-like terminal and addons
 */
export interface TerminalInstance {
  term: {
    cols?: number
    rows?: number
    write: (data: string) => void
    onData: (callback: (data: string) => void) => void
    onResize: (callback: (size: { cols: number; rows: number }) => void) => void
    dispose?: () => void
  }
  fitAddon: {
    fit?: () => void
  }
  ws?: WebSocket
}

/**
 * Options for useTerminalPanel hook
 */
export interface UseTerminalPanelOptions {
  /** Current console panel tab selection */
  consolePanelTab: string
  /** Whether dark mode is active */
  isDarkMode: boolean
  /** PTY WebSocket port */
  ptyPort: number | null
  /** Current console panel height (for resize handling) */
  consoleHeight: number
}

/**
 * Return type for useTerminalPanel hook
 */
export interface UseTerminalPanelReturn {
  /** Ref to attach to terminal container element */
  terminalContainerRef: React.RefObject<HTMLDivElement | null>
  /** Current terminal instance (for external access if needed) */
  terminalInstance: TerminalInstance | null
}
