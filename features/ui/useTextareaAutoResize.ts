/**
 * Textarea Auto-Resize Hook
 *
 * Handles auto-resizing textarea based on content.
 * Extracted from App.tsx lines 3497-3503.
 */

import { useEffect } from 'react'

interface UseTextareaAutoResizeOptions {
  input: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
  maxHeight?: number
}

/**
 * Hook for auto-resizing textarea
 *
 * Automatically adjusts textarea height based on content, up to maxHeight.
 */
export function useTextareaAutoResize({
  input,
  textareaRef,
  maxHeight = 144,
}: UseTextareaAutoResizeOptions): void {
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
    }
  }, [input, textareaRef, maxHeight])
}
