import { Message, SelectedElement } from '../types'

export interface TabState {
  id: string
  title: string
  url: string
  favicon?: string

  // Project mapping - used to resolve source file paths
  projectPath?: string

  // Browser state
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean

  // Chat state
  messages: Message[]
  selectedElement: SelectedElement | null
  screenshotElement: SelectedElement | null
  capturedScreenshot: string | null

  // Logs
  logs: string[]

  // Pending changes
  pendingChange: {
    code: string
    undoCode: string
    description: string
  } | null

  // AI selection
  aiSelectedElement: {
    selector: string
    reasoning: string
    count?: number
    elements?: SelectedElement[]
  } | null
}

export function createNewTab(id?: string): TabState {
  return {
    id: id || `tab-${Date.now()}`,
    title: 'Cluso',
    url: '',
    favicon: undefined,

    canGoBack: false,
    canGoForward: false,
    isLoading: false,

    messages: [],
    selectedElement: null,
    screenshotElement: null,
    capturedScreenshot: null,

    logs: [],
    pendingChange: null,
    aiSelectedElement: null,
  }
}
