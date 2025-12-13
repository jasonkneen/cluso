/**
 * Tool Router
 *
 * Provides a clean router pattern for handling AI tool calls.
 * Used by both the Electron app and Chrome extension.
 */

import { withTimeout, TIMEOUTS, TimeoutError } from './timeout'
import type {
  ToolCall,
  ToolResponse,
  ToolHandlers,
  ToolHandler,
  SendToolResponse,
} from './tool-types'

/**
 * Tool handlers registry
 */
const toolHandlerRegistry: Record<string, ToolHandler> = {
  update_ui: (call, handlers, sendResponse) => {
    const html = call.args.html
    if (handlers.onCodeUpdate && html) {
      handlers.onCodeUpdate(html)
    }
    sendResponse(call.id, call.name, { result: 'UI Updated Successfully' })
  },

  select_element: (call, handlers, sendResponse) => {
    const { selector, reasoning } = call.args
    if (handlers.onElementSelect && selector) {
      handlers.onElementSelect(selector, reasoning)
    }
    sendResponse(call.id, call.name, {
      result: 'Element selection requested',
      selector,
      reasoning,
    })
  },

  execute_code: (call, handlers, sendResponse) => {
    const { code, description } = call.args
    if (handlers.onExecuteCode && code) {
      handlers.onExecuteCode(code, description || '')
    }
    sendResponse(call.id, call.name, {
      result: 'Code executed successfully',
      description,
    })
  },

  confirm_selection: (call, handlers, sendResponse) => {
    const { confirmed, elementNumber } = call.args
    if (handlers.onConfirmSelection) {
      handlers.onConfirmSelection(!!confirmed, elementNumber)
    }
    sendResponse(call.id, call.name, {
      result: confirmed
        ? elementNumber
          ? `Element ${elementNumber} confirmed`
          : 'Selection confirmed'
        : 'Selection rejected',
    })
  },

  get_page_elements: async (call, handlers, sendResponse) => {
    const category = call.args.category || 'all'
    if (!handlers.onGetPageElements) {
      sendResponse(call.id, call.name, { error: 'get_page_elements handler not available' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onGetPageElements(category),
        TIMEOUTS.TOOL_CALL,
        'get_page_elements'
      )
      sendResponse(call.id, call.name, { result })
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to get page elements'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  patch_source_file: async (call, handlers, sendResponse) => {
    const { filePath, searchCode, replaceCode, description } = call.args
    if (!handlers.onPatchSourceFile) {
      sendResponse(call.id, call.name, {
        error: 'patch_source_file handler not available - file editing not supported',
      })
      return
    }
    if (!filePath || !searchCode || !replaceCode) {
      sendResponse(call.id, call.name, {
        error: 'Missing required arguments for patch_source_file',
      })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onPatchSourceFile(filePath, searchCode, replaceCode, description || ''),
        TIMEOUTS.TOOL_CALL,
        'patch_source_file'
      )
      sendResponse(
        call.id,
        call.name,
        result.success
          ? { result: `Successfully patched ${filePath}: ${description}` }
          : { error: result.error || 'Failed to patch file' }
      )
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to patch source file'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  list_files: async (call, handlers, sendResponse) => {
    const path = call.args.path || '.'
    if (!handlers.onListFiles) {
      sendResponse(call.id, call.name, { error: 'list_files not available' })
      return
    }
    try {
      const result = await withTimeout(handlers.onListFiles(path), TIMEOUTS.FILE_LIST, 'list_files')
      if (result === undefined || result === null) {
        sendResponse(call.id, call.name, { error: 'Directory listing returned no content' })
      } else {
        sendResponse(call.id, call.name, { result: String(result) })
      }
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to list files'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  read_file: async (call, handlers, sendResponse) => {
    const filePath = call.args.path ?? call.args.filePath
    if (!filePath) {
      sendResponse(call.id, call.name, { error: 'read_file requires a "path" argument' })
      return
    }
    if (!handlers.onReadFile) {
      sendResponse(call.id, call.name, { error: 'read_file not available' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onReadFile(filePath),
        TIMEOUTS.FILE_READ,
        'read_file'
      )
      if (result === undefined || result === null) {
        sendResponse(call.id, call.name, { error: 'File read returned no content' })
      } else {
        sendResponse(call.id, call.name, { result: String(result) })
      }
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to read file'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  click_element: async (call, handlers, sendResponse) => {
    const { selector } = call.args
    if (!handlers.onClickElement) {
      sendResponse(call.id, call.name, { error: 'click_element not available' })
      return
    }
    if (!selector) {
      sendResponse(call.id, call.name, { error: 'click_element requires a selector' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onClickElement(selector),
        TIMEOUTS.QUICK,
        'click_element'
      )
      sendResponse(
        call.id,
        call.name,
        result.success
          ? { result: `Clicked element: ${selector}` }
          : { error: result.error || 'Failed to click element' }
      )
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to click element'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  navigate: async (call, handlers, sendResponse) => {
    const { action, url } = call.args
    if (!handlers.onNavigate) {
      sendResponse(call.id, call.name, { error: 'navigate not available' })
      return
    }
    if (!action) {
      sendResponse(call.id, call.name, { error: 'navigate requires an action' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onNavigate(action, url),
        TIMEOUTS.TOOL_CALL,
        'navigate'
      )
      sendResponse(
        call.id,
        call.name,
        result.success
          ? { result: `Navigation: ${action}${url ? ' to ' + url : ''}` }
          : { error: result.error || 'Navigation failed' }
      )
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Navigation failed'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  scroll: async (call, handlers, sendResponse) => {
    const { target } = call.args
    if (!handlers.onScroll) {
      sendResponse(call.id, call.name, { error: 'scroll not available' })
      return
    }
    if (!target) {
      sendResponse(call.id, call.name, { error: 'scroll requires a target' })
      return
    }
    try {
      const result = await withTimeout(handlers.onScroll(target), TIMEOUTS.QUICK, 'scroll')
      sendResponse(
        call.id,
        call.name,
        result.success
          ? { result: `Scrolled to: ${target}` }
          : { error: result.error || 'Scroll failed' }
      )
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Scroll failed'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  open_item: async (call, handlers, sendResponse) => {
    const { itemNumber } = call.args
    if (!handlers.onOpenItem) {
      sendResponse(call.id, call.name, { error: 'open_item not available' })
      return
    }
    if (itemNumber === undefined) {
      sendResponse(call.id, call.name, { error: 'open_item requires itemNumber' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onOpenItem(itemNumber),
        TIMEOUTS.FILE_READ,
        'open_item'
      )
      sendResponse(call.id, call.name, { result: result ?? 'Item opened' })
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to open item'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  open_file: async (call, handlers, sendResponse) => {
    const { name, path } = call.args
    if (!handlers.onOpenFile) {
      sendResponse(call.id, call.name, { error: 'open_file not available' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onOpenFile(name, path),
        TIMEOUTS.FILE_READ,
        'open_file'
      )
      sendResponse(call.id, call.name, { result: result ?? 'File opened' })
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to open file'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  open_folder: async (call, handlers, sendResponse) => {
    const { name, itemNumber } = call.args
    if (!handlers.onOpenFolder) {
      sendResponse(call.id, call.name, { error: 'open_folder not available' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onOpenFolder(name, itemNumber),
        TIMEOUTS.FILE_LIST,
        'open_folder'
      )
      sendResponse(call.id, call.name, { result: result ?? 'Folder opened' })
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to open folder'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  browser_back: (call, handlers, sendResponse) => {
    if (!handlers.onBrowserBack) {
      sendResponse(call.id, call.name, { error: 'browser_back not available' })
      return
    }
    try {
      const result = handlers.onBrowserBack()
      sendResponse(call.id, call.name, { result: result ?? 'Navigated back' })
    } catch (err) {
      sendResponse(call.id, call.name, {
        error: err instanceof Error ? err.message : 'Failed to go back',
      })
    }
  },

  close_browser: (call, handlers, sendResponse) => {
    if (!handlers.onCloseBrowser) {
      sendResponse(call.id, call.name, { error: 'close_browser not available' })
      return
    }
    try {
      const result = handlers.onCloseBrowser()
      sendResponse(call.id, call.name, { result: result ?? 'Browser closed' })
    } catch (err) {
      sendResponse(call.id, call.name, {
        error: err instanceof Error ? err.message : 'Failed to close browser',
      })
    }
  },

  approve_change: (call, handlers, sendResponse) => {
    const { reason } = call.args
    if (handlers.onApproveChange) {
      handlers.onApproveChange(reason)
    }
    sendResponse(call.id, call.name, { result: 'Change approved' })
  },

  reject_change: (call, handlers, sendResponse) => {
    const { reason } = call.args
    if (handlers.onRejectChange) {
      handlers.onRejectChange(reason)
    }
    sendResponse(call.id, call.name, { result: 'Change rejected' })
  },

  undo_change: (call, handlers, sendResponse) => {
    const { reason } = call.args
    if (handlers.onUndoChange) {
      handlers.onUndoChange(reason)
    }
    sendResponse(call.id, call.name, { result: 'Change undone' })
  },

  highlight_element_by_number: async (call, handlers, sendResponse) => {
    const { elementNumber, description } = call.args
    if (!handlers.onHighlightByNumber) {
      sendResponse(call.id, call.name, { error: 'highlight_element_by_number not available' })
      return
    }
    if (elementNumber === undefined) {
      sendResponse(call.id, call.name, {
        error: 'highlight_element_by_number requires elementNumber',
      })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onHighlightByNumber(elementNumber),
        TIMEOUTS.QUICK,
        'highlight_element_by_number'
      )
      if (result.success) {
        const element = result.element as
          | { tagName?: string; text?: string }
          | undefined
        const elementInfo = element
          ? ` (${element.tagName}${element.text ? ': ' + element.text.substring(0, 30) : ''})`
          : ''
        sendResponse(call.id, call.name, {
          result: `Element ${elementNumber} highlighted${elementInfo}${description ? ': ' + description : ''}`,
        })
      } else {
        sendResponse(call.id, call.name, { error: result.error || 'Failed to highlight element' })
      }
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to highlight element'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  clear_focus: async (call, handlers, sendResponse) => {
    if (!handlers.onClearFocus) {
      sendResponse(call.id, call.name, { error: 'clear_focus not available' })
      return
    }
    try {
      await handlers.onClearFocus()
      sendResponse(call.id, call.name, {
        result: 'Focus cleared. Call get_page_elements() to see all elements.',
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear focus'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  set_viewport: async (call, handlers, sendResponse) => {
    if (!handlers.onSetViewport) {
      sendResponse(call.id, call.name, { error: 'set_viewport not available' })
      return
    }
    const mode = call.args.mode as 'mobile' | 'tablet' | 'desktop'
    if (!mode || !['mobile', 'tablet', 'desktop'].includes(mode)) {
      sendResponse(call.id, call.name, {
        error: 'Invalid mode. Use: mobile, tablet, or desktop',
      })
      return
    }
    try {
      await handlers.onSetViewport(mode)
      sendResponse(call.id, call.name, {
        result: `Viewport switched to ${mode} mode`,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to set viewport'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  switch_tab: async (call, handlers, sendResponse) => {
    if (!handlers.onSwitchTab) {
      sendResponse(call.id, call.name, { error: 'switch_tab not available' })
      return
    }
    const type = call.args.type as 'browser' | 'kanban' | 'todos' | 'notes'
    if (!type || !['browser', 'kanban', 'todos', 'notes'].includes(type)) {
      sendResponse(call.id, call.name, {
        error: 'Invalid type. Use: browser, kanban, todos, or notes',
      })
      return
    }
    try {
      await handlers.onSwitchTab(type)
      sendResponse(call.id, call.name, {
        result: `Switched to ${type} tab`,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to switch tab'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },

  find_element_by_text: async (call, handlers, sendResponse) => {
    const { searchText, elementType } = call.args
    if (!handlers.onFindElementByText) {
      sendResponse(call.id, call.name, { error: 'find_element_by_text not available' })
      return
    }
    if (!searchText) {
      sendResponse(call.id, call.name, { error: 'find_element_by_text requires searchText' })
      return
    }
    try {
      const result = await withTimeout(
        handlers.onFindElementByText(searchText, elementType),
        TIMEOUTS.TOOL_CALL,
        'find_element_by_text'
      )
      if (result.success && result.matches && result.matches.length > 0) {
        const matchList = result.matches
          .map(
            (m) =>
              `[${m.elementNumber}] <${m.tagName}> "${m.text.substring(0, 50)}${m.text.length > 50 ? '...' : ''}"`
          )
          .join('\n')
        sendResponse(call.id, call.name, {
          result: `Found ${result.matches.length} element(s) matching "${searchText}":\n${matchList}\n\nUse highlight_element_by_number to select one.`,
          matches: result.matches,
        })
      } else if (result.success && (!result.matches || result.matches.length === 0)) {
        sendResponse(call.id, call.name, {
          result: `No elements found matching "${searchText}". Try a different search term or use get_page_elements() to see all available elements.`,
        })
      } else {
        sendResponse(call.id, call.name, {
          error: result.error || 'Failed to search for elements',
        })
      }
    } catch (err) {
      const errorMsg =
        err instanceof TimeoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to find elements by text'
      sendResponse(call.id, call.name, { error: errorMsg })
    }
  },
}

/**
 * Dispatch a tool call to the appropriate handler (legacy fire-and-forget pattern)
 * @deprecated Use executeToolCall for async/await pattern
 */
export function dispatchToolCall(
  call: ToolCall,
  handlers: ToolHandlers,
  sendResponse: SendToolResponse
): void {
  const handler = toolHandlerRegistry[call.name]
  if (handler) {
    handler(call, handlers, sendResponse)
  } else {
    sendResponse(call.id, call.name, { error: `Unknown tool: ${call.name}` })
  }
}

/**
 * Execute a tool call and return the result (async/await pattern)
 * This is the preferred pattern that enables proper agentic loops
 */
export async function executeToolCall(
  call: ToolCall,
  handlers: ToolHandlers
): Promise<ToolResponse> {
  return new Promise((resolve) => {
    // Create a sendResponse that captures the result
    const captureResponse: SendToolResponse = (_id, _name, response) => {
      resolve(response)
    }

    const handler = toolHandlerRegistry[call.name]
    if (handler) {
      // Handle both sync and async handlers
      const result = handler(call, handlers, captureResponse)
      // If handler is async and returns a promise, we still rely on captureResponse
      // being called, but we also handle the case where it might throw
      if (result instanceof Promise) {
        result.catch((err) => {
          resolve({
            error: err instanceof Error ? err.message : 'Unknown error in tool handler',
          })
        })
      }
    } else {
      resolve({ error: `Unknown tool: ${call.name}` })
    }
  })
}

/**
 * Execute multiple tool calls and return all results
 * Executes in parallel by default for better performance
 */
export async function executeToolCalls(
  calls: ToolCall[],
  handlers: ToolHandlers,
  options: { parallel?: boolean } = {}
): Promise<Array<{ id: string; name: string; response: ToolResponse }>> {
  const { parallel = true } = options

  if (parallel) {
    const results = await Promise.all(
      calls.map(async (call) => ({
        id: call.id,
        name: call.name,
        response: await executeToolCall(call, handlers),
      }))
    )
    return results
  } else {
    const results: Array<{ id: string; name: string; response: ToolResponse }> = []
    for (const call of calls) {
      results.push({
        id: call.id,
        name: call.name,
        response: await executeToolCall(call, handlers),
      })
    }
    return results
  }
}

/**
 * Create a tool router with bound handlers
 */
export function createToolRouter(handlers: ToolHandlers) {
  return {
    dispatch: (call: ToolCall, sendResponse: SendToolResponse) => {
      dispatchToolCall(call, handlers, sendResponse)
    },
    execute: (call: ToolCall) => executeToolCall(call, handlers),
    executeAll: (calls: ToolCall[], options?: { parallel?: boolean }) =>
      executeToolCalls(calls, handlers, options),
    handlers,
  }
}

/**
 * Get list of available tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(toolHandlerRegistry)
}
