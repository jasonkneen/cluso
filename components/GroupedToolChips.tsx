import React, { useState, useMemo, useCallback } from 'react'
import { Loader2, Check, X, ChevronDown } from 'lucide-react'
import { groupConsecutiveTools, type ToolCallItem } from '../utils/toolGrouping'

// ============================================================================
// GroupedToolChips Component - Groups consecutive same-type tool calls
// e.g., [grep x3] instead of [grep] [grep] [grep]
// ============================================================================

interface GroupedToolChipsProps {
  toolCalls: ToolCallItem[]
  isDarkMode: boolean
  isStreaming?: boolean
}

export function GroupedToolChips({
  toolCalls,
  isDarkMode,
  isStreaming = false,
}: GroupedToolChipsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupConsecutiveTools(toolCalls), [toolCalls])

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  const getChipStyle = (status: string, isGroup = false) => {
    if (status === 'running') {
      return isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
    }
    if (status === 'error') {
      return isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
    }
    return isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {groups.map((group, groupIdx) => {
        const groupKey = `${group.name}-${groupIdx}`
        const isExpanded = expandedGroups.has(groupKey)
        const showGrouped = group.count > 1 && !isExpanded

        if (showGrouped) {
          // Render grouped chip: [read_file x3]
          const groupStatus = group.hasRunning ? 'running' : group.hasError ? 'error' : 'complete'
          return (
            <button
              key={groupKey}
              onClick={() => toggleGroup(groupKey)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer hover:opacity-80 ${getChipStyle(groupStatus, true)}`}
              title={`Click to expand ${group.count} ${group.name} calls`}
            >
              {group.hasRunning && <Loader2 size={10} className="animate-spin" />}
              {!group.hasRunning && !group.hasError && <Check size={10} />}
              {!group.hasRunning && group.hasError && <X size={10} />}
              <span className="font-mono">{group.name}</span>
              <span className={`text-[9px] px-1 rounded ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                ×{group.count}
              </span>
            </button>
          )
        }

        // Render individual chips (either single tool or expanded group)
        return (
          <React.Fragment key={groupKey}>
            {group.count > 1 && isExpanded && (
              <button
                onClick={() => toggleGroup(groupKey)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all cursor-pointer ${
                  isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                }`}
                title="Collapse group"
              >
                <ChevronDown size={8} />
              </button>
            )}
            {group.tools.map((tool, idx) => (
              <div
                key={tool.id || `${groupKey}-${idx}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${getChipStyle(tool.status)}`}
              >
                {tool.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                {(tool.status === 'done' || tool.status === 'complete' || tool.status === 'success') && <Check size={10} />}
                {tool.status === 'error' && <X size={10} />}
                <span className="font-mono">{tool.name}</span>
              </div>
            ))}
          </React.Fragment>
        )
      })}
    </div>
  )
}
