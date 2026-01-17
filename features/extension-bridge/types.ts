/**
 * Extension Bridge Types
 *
 * Type definitions for Chrome extension communication.
 */

export interface ExtensionChatRequest {
  requestId: string
  message: string
  elements: Array<{
    tagName: string
    label: string
    fullInfo?: Record<string, unknown>
  }>
  pageTitle: string
  pageUrl: string
}

export interface UseExtensionBridgeOptions {
  selectedModelRef: React.MutableRefObject<{ id: string }>
  setExtensionConnected: (connected: boolean) => void
}

export interface UseExtensionBridgeReturn {
  // Currently no return values needed
}
