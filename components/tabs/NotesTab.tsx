import React, { useRef, useCallback, useEffect } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Image, Heading1, Heading2, Quote, Code, Undo, Redo } from 'lucide-react'

interface NotesTabProps {
  content: string
  isDarkMode: boolean
  onUpdateContent: (content: string) => void
}

export function NotesTab({ content, isDarkMode, onUpdateContent }: NotesTabProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '<p></p>'
    }
  }, [])

  // Save content with debounce
  const handleInput = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (editorRef.current) {
        onUpdateContent(editorRef.current.innerHTML)
      }
    }, 500)
  }, [onUpdateContent])

  // Execute formatting command
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }, [])

  // Handle paste - strip formatting for plain text
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Allow images to be pasted with data
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = items[i].getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const img = document.createElement('img')
            img.src = event.target?.result as string
            img.style.maxWidth = '100%'
            img.style.height = 'auto'
            img.style.borderRadius = '8px'
            img.style.margin = '8px 0'

            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              range.deleteContents()
              range.insertNode(img)
              range.setStartAfter(img)
              range.collapse(true)
              selection.removeAllRanges()
              selection.addRange(range)
            }
            handleInput()
          }
          reader.readAsDataURL(blob)
        }
        return
      }
    }
  }, [handleInput])

  // Handle drop for images
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          execCommand('insertImage', event.target?.result as string)
          handleInput()
        }
        reader.readAsDataURL(files[i])
      }
    }
  }, [execCommand, handleInput])

  // Insert link
  const handleInsertLink = useCallback(() => {
    const url = prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }, [execCommand])

  // Toolbar button
  const ToolbarButton = ({ icon: Icon, command, value, title }: {
    icon: React.ComponentType<{ size: number }>;
    command: string;
    value?: string;
    title: string
  }) => (
    <button
      onClick={() => execCommand(command, value)}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isDarkMode
          ? 'hover:bg-neutral-700 text-neutral-300'
          : 'hover:bg-stone-200 text-stone-600'
      }`}
    >
      <Icon size={16} />
    </button>
  )

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-100'}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-1 px-4 py-2 border-b ${
        isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-stone-200 bg-white'
      }`}>
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Undo} command="undo" title="Undo" />
          <ToolbarButton icon={Redo} command="redo" title="Redo" />
        </div>

        <div className={`w-px h-5 mx-2 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`} />

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => execCommand('formatBlock', 'h1')}
            title="Heading 1"
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Heading1 size={16} />
          </button>
          <button
            onClick={() => execCommand('formatBlock', 'h2')}
            title="Heading 2"
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Heading2 size={16} />
          </button>
        </div>

        <div className={`w-px h-5 mx-2 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`} />

        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Bold} command="bold" title="Bold (Cmd+B)" />
          <ToolbarButton icon={Italic} command="italic" title="Italic (Cmd+I)" />
          <ToolbarButton icon={Underline} command="underline" title="Underline (Cmd+U)" />
        </div>

        <div className={`w-px h-5 mx-2 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`} />

        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={List} command="insertUnorderedList" title="Bullet List" />
          <ToolbarButton icon={ListOrdered} command="insertOrderedList" title="Numbered List" />
          <button
            onClick={() => execCommand('formatBlock', 'blockquote')}
            title="Quote"
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Quote size={16} />
          </button>
          <button
            onClick={() => execCommand('formatBlock', 'pre')}
            title="Code Block"
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Code size={16} />
          </button>
        </div>

        <div className={`w-px h-5 mx-2 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`} />

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleInsertLink}
            title="Insert Link"
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Link2 size={16} />
          </button>
          <label
            title="Insert Image"
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-700 text-neutral-300'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
          >
            <Image size={16} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    execCommand('insertImage', event.target?.result as string)
                    handleInput()
                  }
                  reader.readAsDataURL(file)
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      {/* Editor */}
      <div className={`flex-1 overflow-y-auto ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`}>
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`min-h-full p-6 outline-none prose max-w-none ${
            isDarkMode ? 'prose-invert' : ''
          }`}
          style={{
            // Custom prose styling
            lineHeight: 1.75,
          }}
          suppressContentEditableWarning
        />
      </div>

      {/* Status bar */}
      <div className={`px-4 py-1.5 text-xs border-t ${
        isDarkMode ? 'border-neutral-700 text-neutral-500 bg-neutral-800' : 'border-stone-200 text-stone-400 bg-white'
      }`}>
        Drop images here or use the toolbar to insert
      </div>

      <style>{`
        .prose h1 {
          font-size: 2em;
          font-weight: 700;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .prose h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
        }
        .prose p {
          margin: 0.5em 0;
        }
        .prose ul, .prose ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .prose li {
          margin: 0.25em 0;
        }
        .prose blockquote {
          border-left: 4px solid ${isDarkMode ? '#525252' : '#d1d5db'};
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: ${isDarkMode ? '#a3a3a3' : '#6b7280'};
        }
        .prose pre {
          background: ${isDarkMode ? '#262626' : '#f3f4f6'};
          padding: 1em;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1em 0;
          font-family: monospace;
          font-size: 0.9em;
        }
        .prose img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1em 0;
        }
        .prose a {
          color: #3b82f6;
          text-decoration: underline;
        }
        .prose a:hover {
          color: #2563eb;
        }
      `}</style>
    </div>
  )
}
