/**
 * Tool Types
 *
 * Type definitions for tool calls and handlers used by both
 * the Electron app and Chrome extension.
 */

/**
 * Tool arguments passed from AI model
 */
export interface ToolArgs {
  html?: string
  selector?: string
  reasoning?: string
  code?: string
  description?: string
  confirmed?: boolean
  elementNumber?: number
  category?: string
  filePath?: string
  path?: string
  searchCode?: string
  replaceCode?: string
  action?: string
  url?: string
  target?: string
  itemNumber?: number
  name?: string
  reason?: string
  mode?: string
  type?: string
  // Text search args
  searchText?: string
  elementType?: string
}

/**
 * Tool call from AI model
 */
export interface ToolCall {
  id: string
  name: string
  args: ToolArgs
}

/**
 * Response from tool execution to send back to AI
 */
export interface ToolResponse {
  result?: string
  error?: string
  [key: string]: unknown
}

/**
 * Handler callbacks for tool execution
 * Each handler corresponds to a specific tool capability
 */
export interface ToolHandlers {
  onCodeUpdate?: (code: string) => void
  onElementSelect?: (selector: string, reasoning?: string) => void
  onExecuteCode?: (code: string, description: string) => void
  onConfirmSelection?: (confirmed: boolean, elementNumber?: number) => void
  onGetPageElements?: (category?: string) => Promise<string>
  onPatchSourceFile?: (
    filePath: string,
    searchCode: string,
    replaceCode: string,
    description: string
  ) => Promise<{ success: boolean; error?: string }>
  onListFiles?: (path?: string) => Promise<string>
  onReadFile?: (filePath: string) => Promise<string>
  onClickElement?: (selector: string) => Promise<{ success: boolean; error?: string }>
  onNavigate?: (action: string, url?: string) => Promise<{ success: boolean; error?: string }>
  onScroll?: (target: string) => Promise<{ success: boolean; error?: string }>
  onOpenItem?: (itemNumber: number) => Promise<string>
  onOpenFile?: (name?: string, path?: string) => Promise<string>
  onOpenFolder?: (name?: string, itemNumber?: number) => Promise<string>
  onBrowserBack?: () => string
  onCloseBrowser?: () => string
  onApproveChange?: (reason?: string) => void
  onRejectChange?: (reason?: string) => void
  onUndoChange?: (reason?: string) => void
  onHighlightByNumber?: (
    elementNumber: number
  ) => Promise<{ success: boolean; element?: Record<string, unknown>; error?: string }>
  onClearFocus?: () => Promise<{ success: boolean }>
  onSetViewport?: (mode: 'mobile' | 'tablet' | 'desktop') => Promise<{ success: boolean }>
  onSwitchTab?: (type: 'browser' | 'kanban' | 'todos' | 'notes') => Promise<{ success: boolean }>
  onFindElementByText?: (
    searchText: string,
    elementType?: string
  ) => Promise<{
    success: boolean
    matches?: Array<{ elementNumber: number; text: string; tagName: string }>
    error?: string
  }>
}

/**
 * Function type for sending tool responses
 */
export type SendToolResponse = (id: string, name: string, response: ToolResponse) => void

/**
 * Individual tool handler function type
 */
export type ToolHandler = (
  call: ToolCall,
  handlers: ToolHandlers,
  sendResponse: SendToolResponse
) => void | Promise<void>
