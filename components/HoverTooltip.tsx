/**
 * HoverTooltip Component
 * Displays type information, documentation, and code examples on hover
 * Position tooltip near cursor with overflow handling
 */

import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { LSPHoverResult } from '../hooks/useElectronLSP'

interface HoverTooltipProps {
  data: LSPHoverResult | null
  position: { x: number; y: number } | null
  isVisible: boolean
  onDismiss: () => void
}

/**
 * Extract text content from LSP hover result
 * Handles string, MarkupContent, and arrays
 */
function extractContent(
  contents: string | { kind: 'plaintext' | 'markdown'; value: string } | Array<string | { kind: string; value: string }>
): string {
  if (typeof contents === 'string') {
    return contents
  }

  if (Array.isArray(contents)) {
    return contents
      .map((item) => (typeof item === 'string' ? item : item.value))
      .join('\n\n')
  }

  if (contents && typeof contents === 'object' && 'value' in contents) {
    return contents.value
  }

  return ''
}

/**
 * Format content with syntax highlighting for code blocks
 */
function FormatContent({ content }: { content: string }) {
  const parts = content.split(/(`{1,3}[\s\S]*?`{1,3})/g)

  return (
    <div className="space-y-2 text-sm">
      {parts.map((part, idx) => {
        // Single backtick inline code
        if (part.startsWith('`') && part.endsWith('`') && !part.includes('\n')) {
          return (
            <code
              key={idx}
              className="inline-block bg-black/40 text-amber-200 px-1.5 py-0.5 rounded font-mono text-xs"
            >
              {part.slice(1, -1)}
            </code>
          )
        }

        // Code block (triple backticks)
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n')
          const language = lines[0]?.match(/^(\w+)$/) ? lines[0] : null
          const code = language ? lines.slice(1).join('\n') : part.slice(3, -3)

          return (
            <pre
              key={idx}
              className="bg-black/60 text-amber-100 p-2 rounded overflow-x-auto font-mono text-xs"
            >
              <code>{code}</code>
            </pre>
          )
        }

        // Regular text
        return (
          <p key={idx} className="text-gray-300">
            {part}
          </p>
        )
      })}
    </div>
  )
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  data,
  position,
  isVisible,
  onDismiss,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  // Position tooltip and handle overflow
  useEffect(() => {
    if (!isVisible || !position || !tooltipRef.current) return

    // Initial position (below cursor)
    const gap = 8
    let top = position.y + gap
    let left = position.x

    // Measure tooltip
    const rect = tooltipRef.current.getBoundingClientRect()
    const tooltipWidth = rect.width
    const tooltipHeight = rect.height

    // Adjust for viewport bounds
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Horizontal adjustment
    if (left + tooltipWidth > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - tooltipWidth - 10)
    }

    // Vertical adjustment - show above if no room below
    if (top + tooltipHeight > viewportHeight - 10) {
      top = Math.max(10, position.y - tooltipHeight - gap)
    }

    setTooltipPos({ top, left })
  }, [isVisible, position])

  if (!isVisible || !data || !tooltipPos) {
    return null
  }

  const content = extractContent(data.contents)

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-sm"
      style={{
        top: `${tooltipPos.top}px`,
        left: `${tooltipPos.left}px`,
      }}
      onMouseLeave={onDismiss}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Type Information
        </span>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          aria-label="Close tooltip"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto custom-scrollbar">
        <FormatContent content={content} />
      </div>

      {/* Subtle arrow pointer */}
      <div className="absolute bottom-full left-4 -mb-1 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45" />
    </div>
  )
}
