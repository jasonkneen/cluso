/**
 * Thinking Popover Hook
 *
 * Handles click-outside behavior for the thinking level popover.
 *
 * Extracted from App.tsx to centralize popover logic.
 */

import { useEffect } from 'react'
import type { UseThinkingPopoverOptions } from './types'

/**
 * Hook for managing thinking popover click-outside behavior
 *
 * Closes the popover when clicking outside of it.
 * Uses data attribute to identify the popover element.
 *
 * @param options - Configuration options for thinking popover
 */
export function useThinkingPopover(options: UseThinkingPopoverOptions): void {
  const { showThinkingPopover, setShowThinkingPopover } = options

  useEffect(() => {
    if (!showThinkingPopover) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-thinking-popover]')) {
        setShowThinkingPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showThinkingPopover, setShowThinkingPopover])
}
