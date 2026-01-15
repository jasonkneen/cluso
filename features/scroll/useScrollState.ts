/**
 * Scroll State Management Hook
 *
 * Centralizes scroll-related state management extracted from App.tsx.
 * Handles auto-scroll and scroll-to-bottom button visibility.
 */

import { useState, useCallback } from 'react'
import type { ScrollState, ScrollStateActions } from './types'

export interface UseScrollStateReturn extends ScrollState, ScrollStateActions {}

/**
 * Hook for managing scroll state
 *
 * Extracts and centralizes scroll state management from App.tsx.
 * Provides state and actions for auto-scroll and scroll-to-bottom button.
 */
export function useScrollState(): UseScrollStateReturn {
  // Auto-scroll state - enabled by default
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  // Scroll-to-bottom button visibility
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  // Action: Enable auto-scroll and hide button
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled(true)
    setShowScrollToBottom(false)
  }, [])

  // Action: Disable auto-scroll
  const disableAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled(false)
  }, [])

  // Action: Show the scroll-to-bottom button
  const showScrollButton = useCallback(() => {
    setShowScrollToBottom(true)
  }, [])

  // Action: Hide the scroll-to-bottom button
  const hideScrollButton = useCallback(() => {
    setShowScrollToBottom(false)
  }, [])

  return {
    // State
    isAutoScrollEnabled,
    showScrollToBottom,
    // Setters
    setIsAutoScrollEnabled,
    setShowScrollToBottom,
    // Actions
    enableAutoScroll,
    disableAutoScroll,
    showScrollButton,
    hideScrollButton,
  }
}
