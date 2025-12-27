/**
 * Webview Messaging Utility
 *
 * Provides a consistent pattern for postMessage communication with webview iframes.
 * Handles message sending, response listening, and timeout cleanup.
 */

import { WEBVIEW_MESSAGE_TIMEOUT_MS } from './constants'

/**
 * Default timeout for webview messages in milliseconds
 */
export const DEFAULT_WEBVIEW_TIMEOUT = WEBVIEW_MESSAGE_TIMEOUT_MS

/**
 * Get target origin for postMessage from a URL.
 * Returns the origin (protocol + host) or '*' for special URLs.
 */
export function getTargetOrigin(url: string | undefined): string {
  if (!url) return '*'
  try {
    // Handle special protocols that don't have origins
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('javascript:')) {
      return '*'
    }
    const parsed = new URL(url)
    return parsed.origin
  } catch {
    // If URL parsing fails, fall back to wildcard
    return '*'
  }
}

interface WebviewMessageOptions<TRequest, TResponse> {
  /** The webview iframe element */
  webview: HTMLIFrameElement
  /** URL of the webview for target origin */
  webviewUrl?: string
  /** Message type to send */
  requestType: string
  /** Expected response message type */
  responseType: string
  /** Additional payload to send with the message */
  payload?: TRequest
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number
  /** Error message to use on timeout */
  timeoutError?: string
  /** Transform the successful response data */
  transformResponse?: (data: MessageEvent['data']) => TResponse
  /** Assume success on timeout (for fire-and-forget operations) */
  successOnTimeout?: boolean
}

interface WebviewMessageResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Send a message to a webview iframe and wait for a response.
 * Handles the common pattern of:
 * 1. Adding message event listener
 * 2. Sending postMessage
 * 3. Waiting for response or timeout
 * 4. Cleaning up listener
 */
export function sendWebviewMessage<TRequest = unknown, TResponse = unknown>(
  options: WebviewMessageOptions<TRequest, TResponse>
): Promise<WebviewMessageResult<TResponse>> {
  const {
    webview,
    webviewUrl,
    requestType,
    responseType,
    payload,
    timeout = DEFAULT_WEBVIEW_TIMEOUT,
    timeoutError = `Timeout waiting for ${responseType}`,
    transformResponse,
    successOnTimeout = false,
  } = options

  return new Promise((resolve) => {
    const handleResponse = (event: MessageEvent) => {
      if (event.data?.type === responseType) {
        window.removeEventListener('message', handleResponse)

        if (event.data.success) {
          const data = transformResponse ? transformResponse(event.data) : event.data
          resolve({ success: true, data })
        } else {
          resolve({
            success: false,
            error: event.data.error || `Failed: ${requestType}`,
          })
        }
      }
    }

    window.addEventListener('message', handleResponse)

    // Build message with type and optional payload
    const message = payload !== undefined
      ? { type: requestType, ...payload }
      : { type: requestType }

    webview.contentWindow?.postMessage(message, getTargetOrigin(webviewUrl))

    setTimeout(() => {
      window.removeEventListener('message', handleResponse)
      if (successOnTimeout) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: timeoutError })
      }
    }, timeout)
  })
}
