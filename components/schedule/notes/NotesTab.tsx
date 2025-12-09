import * as React from "react"
import { MinimalTiptapEditor } from "@/components/editor/minimal-tiptap"
import { cn } from "@/lib/utils"
import type { Content } from "@tiptap/react"

export interface NotesTabProps {
  content: string
  isDarkMode: boolean
  onUpdateContent: (content: string) => void
  className?: string
  placeholder?: string
}

export function NotesTab({
  content,
  isDarkMode,
  onUpdateContent,
  className,
  placeholder = "Start writing your notes...",
}: NotesTabProps) {
  // Handle content changes from the editor
  const handleChange = React.useCallback(
    (value: Content) => {
      // The editor outputs HTML by default
      if (typeof value === "string") {
        onUpdateContent(value)
      }
    },
    [onUpdateContent]
  )

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        isDarkMode ? "bg-neutral-900" : "bg-stone-50",
        className
      )}
    >
      <MinimalTiptapEditor
        value={content}
        onChange={handleChange}
        output="html"
        placeholder={placeholder}
        throttleDelay={500}
        className={cn(
          "flex-1 border-0 shadow-none rounded-none",
          isDarkMode && "dark"
        )}
        editorContentClassName={cn(
          "flex-1 overflow-y-auto p-6",
          isDarkMode ? "prose-invert" : ""
        )}
        editable={true}
        autofocus="end"
      />
    </div>
  )
}

export default NotesTab
