/**
 * Scroll Effects Hook
 *
 * Handles auto-scroll behavior and scroll-to-bottom detection for chat messages.
 * Extracted from App.tsx lines 4977-5022.
 */

import { useEffect } from 'react'
import type { ChatMessage } from '../chat/types'

interface UseScrollEffectsOptions {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  isAutoScrollEnabled: boolean
  setIsAutoScrollEnabled: (enabled: boolean) => void
  setShowScrollToBottom: (show: boolean) => void
  messagesEndRef: React.RefObject<HTMLDivElement>
  messagesContainerRef: React.RefObject<HTMLDivElement>
  /** Ref to track if user is scrolling (from App.tsx) */
  isUserScrollingRef: React.MutableRefObject<boolean>
}

/**
 * Hook for managing chat scroll behavior
 *
 * Handles auto-scrolling during streaming and detecting user scroll events.
 */
export function useScrollEffects({
  messages,
  isStreaming,
  streamingContent,
  isAutoScrollEnabled,
  setIsAutoScrollEnabled,
  setShowScrollToBottom,
  messagesEndRef,
  messagesContainerRef,
  isUserScrollingRef,
}: UseScrollEffectsOptions): void {

  // Scroll to bottom of chat (respects auto-scroll setting)
  // Also scrolls during streaming content updates
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (!isAutoScrollEnabled && (messages.length > 0 || isStreaming)) {
      // Show scroll-to-bottom button when new messages arrive and auto-scroll is off
      setShowScrollToBottom(true)
    }
  }, [messages, isAutoScrollEnabled, streamingContent, isStreaming, messagesEndRef, setShowScrollToBottom])

  // Handle scroll events to detect manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    let scrollTimeout: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      // Mark that user is scrolling
      isUserScrollingRef.current = true
      clearTimeout(scrollTimeout)

      // Check if user is near the bottom (within 100px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100

      if (isNearBottom) {
        // User scrolled to bottom, re-enable auto-scroll
        setIsAutoScrollEnabled(true)
        setShowScrollToBottom(false)
      } else {
        // User scrolled up, disable auto-scroll and show button
        setIsAutoScrollEnabled(false)
        setShowScrollToBottom(true)
      }

      // Reset user scrolling flag after scroll stops
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [messagesContainerRef, setIsAutoScrollEnabled, setShowScrollToBottom, isUserScrollingRef])
}
