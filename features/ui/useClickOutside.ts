/**
 * Click Outside Hook
 *
 * Generic hook for handling click-outside to close popovers.
 * Extracted from App.tsx lines 4661-4673.
 */

import { useEffect } from 'react'

interface UseClickOutsideOptions {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  selector: string
}

/**
 * Hook for handling click-outside to close popovers
 *
 * @param isOpen - Whether the popover is currently open
 * @param setIsOpen - Function to close the popover
 * @param selector - CSS selector for the popover element (e.g., '[data-thinking-popover]')
 */
export function useClickOutside({
  isOpen,
  setIsOpen,
  selector,
}: UseClickOutsideOptions): void {
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest(selector)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, setIsOpen, selector])
}
