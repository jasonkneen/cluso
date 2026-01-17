/**
 * Auto Textarea Resize Hook
 *
 * Automatically resizes textarea based on content.
 *
 * Extracted from App.tsx to centralize textarea resize logic.
 */

import { useEffect } from 'react'
import type { UseAutoTextareaResizeOptions } from './types'

/**
 * Hook for auto-resizing textarea
 *
 * Adjusts textarea height based on scrollHeight.
 * Clamps to maxHeight to prevent infinite growth.
 *
 * @param options - Configuration options for auto-resize
 */
export function useAutoTextareaResize(options: UseAutoTextareaResizeOptions): void {
  const { input, textareaRef, maxHeight = 144 } = options

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
    }
  }, [input, textareaRef, maxHeight])
}
