/**
 * Extension Bridge Hook
 *
 * Handles communication with Chrome extension for chat requests.
 * Manages connection status polling and chat request handling.
 *
 * Extracted from App.tsx to centralize extension communication logic.
 */

import { useEffect } from 'react'
import type { UseExtensionBridgeOptions, ExtensionChatRequest } from './types'

/**
 * Hook for managing Chrome extension communication
 *
 * Sets up listeners for extension chat requests and polls connection status.
 * Handles AI SDK generation for responding to extension queries.
 *
 * @param options - Configuration options for extension bridge
 */
export function useExtensionBridge(options: UseExtensionBridgeOptions): void {
  const { selectedModelRef, setExtensionConnected } = options

  useEffect(() => {
    if (!window.electronAPI?.extensionBridge) return

    // Check initial connection status and poll periodically
    const checkStatus = async () => {
      try {
        const status = await window.electronAPI.extensionBridge?.getStatus()
        setExtensionConnected(status?.connected ?? false)
      } catch {
        setExtensionConnected(false)
      }
    }

    checkStatus()
    const statusInterval = setInterval(checkStatus, 5000) // Check every 5 seconds

    const handleChatRequest = async (request: ExtensionChatRequest) => {
      console.log('[ExtensionBridge] Chat request:', request.requestId, request.message)
      setExtensionConnected(true) // If we receive a request, we're connected

      try {
        // Build context from selected elements
        const elementContext = request.elements.length > 0
          ? `\n\nSelected elements:\n${request.elements.map(el =>
              `- ${el.tagName} (${el.label})${el.fullInfo ? `: ${JSON.stringify(el.fullInfo)}` : ''}`
            ).join('\n')}`
          : ''

        const pageContext = `Page: ${request.pageTitle} (${request.pageUrl})`

        // Use aiSdk.generate if available
        if (window.electronAPI.aiSdk?.generate) {
          const result = await window.electronAPI.aiSdk.generate({
            messages: [{
              role: 'user',
              content: `${request.message}\n\n${pageContext}${elementContext}`
            }],
            modelId: selectedModelRef.current.id, // Use selected model, not hardcoded Gemini
            providers: {}, // Providers are loaded from settings in the main process
            system: 'You are Cluso, a helpful AI assistant for web development. The user is inspecting elements on a web page and may ask questions about them or request changes. Keep responses concise.',
          })

          if (result.success && result.text) {
            await window.electronAPI.extensionBridge?.sendChatResponse(request.requestId, result.text)
            console.log('[ExtensionBridge] Response sent for:', request.requestId)
          } else {
            await window.electronAPI.extensionBridge?.sendChatResponse(request.requestId, undefined, result.error || 'Failed to generate response')
          }
        } else {
          // Fallback: return a helpful message
          await window.electronAPI.extensionBridge?.sendChatResponse(
            request.requestId,
            `I received your message about ${request.elements.length} element(s) on "${request.pageTitle}". AI generation is not currently available.`
          )
        }
      } catch (err) {
        console.error('[ExtensionBridge] Chat error:', err)
        await window.electronAPI.extensionBridge?.sendChatResponse(
          request.requestId,
          undefined,
          err instanceof Error ? err.message : 'Unknown error'
        )
      }
    }

    const unsubscribe = window.electronAPI.extensionBridge.onChatRequest(handleChatRequest)
    console.log('[ExtensionBridge] Chat request listener registered')

    return () => {
      unsubscribe?.()
      clearInterval(statusInterval)
    }
  }, [selectedModelRef, setExtensionConnected])
}
