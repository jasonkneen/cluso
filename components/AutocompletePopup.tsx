/**
 * AutocompletePopup Component
 * Displays LSP completion suggestions with keyboard navigation
 * Supports filtering and virtual scrolling for long lists
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Zap } from 'lucide-react'
import type { LSPCompletionItem } from '../hooks/useElectronLSP'

interface AutocompletePopupProps {
  items: LSPCompletionItem[]
  position: { x: number; y: number } | null
  isVisible: boolean
  filterText?: string
  onSelect: (item: LSPCompletionItem) => void
  onDismiss: () => void
}

/**
 * LSP completion kind to icon mapping
 * https://microsoft.github.io/language-server-protocol/specifications/specification-current/#completionItemKind
 */
const COMPLETION_KIND_ICONS: Record<number, { label: string; color: string }> = {
  1: { label: 'Text', color: 'text-gray-400' },
  2: { label: 'Method', color: 'text-blue-400' },
  3: { label: 'Function', color: 'text-blue-400' },
  4: { label: 'Constructor', color: 'text-green-400' },
  5: { label: 'Field', color: 'text-amber-400' },
  6: { label: 'Variable', color: 'text-amber-400' },
  7: { label: 'Class', color: 'text-green-400' },
  8: { label: 'Interface', color: 'text-green-400' },
  9: { label: 'Module', color: 'text-purple-400' },
  10: { label: 'Property', color: 'text-amber-400' },
  11: { label: 'Unit', color: 'text-gray-400' },
  12: { label: 'Value', color: 'text-gray-400' },
  13: { label: 'Enum', color: 'text-green-400' },
  14: { label: 'Keyword', color: 'text-red-400' },
  15: { label: 'Snippet', color: 'text-pink-400' },
  16: { label: 'Color', color: 'text-cyan-400' },
  17: { label: 'Reference', color: 'text-gray-400' },
  18: { label: 'Folder', color: 'text-blue-300' },
  19: { label: 'EnumMember', color: 'text-green-400' },
  20: { label: 'Constant', color: 'text-red-400' },
  21: { label: 'Struct', color: 'text-green-400' },
  22: { label: 'Event', color: 'text-pink-400' },
  23: { label: 'Operator', color: 'text-red-400' },
  24: { label: 'TypeParameter', color: 'text-cyan-400' },
}

/**
 * Get icon info for a completion kind
 */
function getKindInfo(kind?: number) {
  if (!kind || !COMPLETION_KIND_ICONS[kind]) {
    return { label: 'Unknown', color: 'text-gray-400' }
  }
  return COMPLETION_KIND_ICONS[kind]
}

/**
 * Filter completion items based on filter text
 */
function filterItems(items: LSPCompletionItem[], filterText: string): LSPCompletionItem[] {
  if (!filterText) return items

  const lowerFilter = filterText.toLowerCase()
  return items.filter((item) => {
    const filterField = item.filterText || item.label
    return filterField.toLowerCase().includes(lowerFilter)
  })
}

/**
 * Highlight matching text in label
 */
function HighlightMatch({
  text,
  match,
}: {
  text: string
  match: string
}): JSX.Element {
  if (!match) return <>{text}</>

  const lowerMatch = match.toLowerCase()
  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(lowerMatch)

  if (index === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-amber-500/30 text-amber-200 font-semibold">
        {text.slice(index, index + match.length)}
      </span>
      {text.slice(index + match.length)}
    </>
  )
}

export const AutocompletePopup: React.FC<AutocompletePopupProps> = ({
  items,
  position,
  isVisible,
  filterText = '',
  onSelect,
  onDismiss,
}) => {
  const popupRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter items
  const filteredItems = useMemo(() => filterItems(items, filterText), [items, filterText])

  // Update selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  // Position popup
  useEffect(() => {
    if (!isVisible || !position || !popupRef.current) return

    const gap = 4
    let top = position.y + gap
    let left = position.x

    // Measure popup
    const rect = popupRef.current.getBoundingClientRect()
    const popupWidth = rect.width
    const popupHeight = rect.height

    // Adjust for viewport bounds
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Horizontal adjustment
    if (left + popupWidth > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - popupWidth - 10)
    }

    // Vertical adjustment
    if (top + popupHeight > viewportHeight - 10) {
      top = Math.max(10, position.y - popupHeight - gap)
    }

    setPopupPos({ top, left })
  }, [isVisible, position])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return

    const items = listRef.current.querySelectorAll('[data-index]')
    const selectedItem = items[selectedIndex] as HTMLElement
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i < filteredItems.length - 1 ? i + 1 : i))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i > 0 ? i - 1 : i))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex])
            onDismiss()
          }
          break
        case 'Escape':
          e.preventDefault()
          onDismiss()
          break
      }
    },
    [filteredItems, selectedIndex, onSelect, onDismiss]
  )

  if (!isVisible || !popupPos || filteredItems.length === 0) {
    return null
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-sm min-w-80"
      style={{
        top: `${popupPos.top}px`,
        left: `${popupPos.left}px`,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700/50">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Suggestions ({filteredItems.length})
        </span>
      </div>

      {/* Items list */}
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto custom-scrollbar"
        role="listbox"
      >
        {filteredItems.map((item, index) => {
          const kindInfo = getKindInfo(item.kind)
          const isSelected = index === selectedIndex

          return (
            <button
              key={`${item.label}-${index}`}
              data-index={index}
              onClick={() => {
                onSelect(item)
                onDismiss()
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-amber-600/40 border-l-2 border-amber-500'
                  : 'hover:bg-gray-800/50 border-l-2 border-transparent'
              }`}
              role="option"
              aria-selected={isSelected}
            >
              {/* Icon */}
              <span className={`flex-shrink-0 text-sm ${kindInfo.color}`}>
                <Zap size={14} />
              </span>

              {/* Label and detail */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-100 truncate">
                  <HighlightMatch text={item.label} match={filterText} />
                </div>
                {item.detail && (
                  <div className="text-xs text-gray-500 truncate">{item.detail}</div>
                )}
              </div>

              {/* Hint icon */}
              {isSelected && (
                <ChevronRight size={16} className="flex-shrink-0 text-amber-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-900/50">
        <div className="text-xs text-gray-500 text-center">
          <span>↑↓ Navigate • Enter Select • Esc Close</span>
        </div>
      </div>
    </div>
  )
}
