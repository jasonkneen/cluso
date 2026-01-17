/**
 * Textarea Types
 *
 * Type definitions for textarea auto-resize functionality.
 */

export interface UseAutoTextareaResizeOptions {
  input: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
  maxHeight?: number
}
