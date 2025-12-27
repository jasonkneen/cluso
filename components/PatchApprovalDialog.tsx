/**
 * Patch Approval Dialog Component
 *
 * Visual diff and approval interface for code changes.
 * Features:
 * - Side-by-side diff visualization
 * - Syntax highlighting for code
 * - Accept/Reject/Edit buttons
 * - Keyboard shortcuts: ⌘Y (accept), ⌘N (reject), ⌘E (edit)
 * - File path and change summary
 * - Smooth animations
 */

import React, { useState, useEffect, useCallback } from 'react'
import { SourcePatch } from '../utils/generateSourcePatch'
import { generateDiff, PatchDiff, recordApprovalDecision } from '../utils/patchApprovalUtils'
import { CodeBlock } from '@/components/ai-elements/code-block'
import { Check, X, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { getFileLanguage } from '../utils/getFileLanguage'
import type { BundledLanguage } from 'shiki'

interface PatchApprovalDialogProps {
  patch: SourcePatch | null
  onApprove: (patch: SourcePatch) => void
  onReject: (patch: SourcePatch) => void
  onEdit: (patch: SourcePatch) => void
  projectPath?: string
  isOpen: boolean
  totalPatches?: number
  currentPatchIndex?: number
}

/**
 * Renders a side-by-side diff view with syntax highlighting
 */
const SideBySideDiff: React.FC<{
  before: string
  after: string
  language: BundledLanguage
}> = ({ before, after, language }) => {
  return (
    <div className="grid grid-cols-2 gap-4 min-h-[200px] max-h-[500px]">
      {/* Before Section */}
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-hidden flex flex-col">
        <div className="bg-neutral-800/80 px-4 py-2 border-b border-neutral-700">
          <h3 className="text-sm font-semibold text-neutral-300">Before</h3>
        </div>
        <div className="flex-1 overflow-auto">
          <CodeBlock
            code={before}
            language={language}
            showLineNumbers
            isDarkMode
            className="!bg-transparent !p-0 text-sm"
          />
        </div>
      </div>

      {/* After Section */}
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-hidden flex flex-col">
        <div className="bg-neutral-800/80 px-4 py-2 border-b border-neutral-700">
          <h3 className="text-sm font-semibold text-neutral-300">After</h3>
        </div>
        <div className="flex-1 overflow-auto">
          <CodeBlock
            code={after}
            language={language}
            showLineNumbers
            isDarkMode
            className="!bg-transparent !p-0 text-sm"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Renders an inline diff with added/removed lines highlighted
 */
const InlineDiff: React.FC<{
  diff: PatchDiff
  language: BundledLanguage
}> = ({ diff, language }) => {
  const lines = diff.diffs.map(([type, text]) => {
    const content = text.split('\n').filter(l => l)
    return content.map(line => ({
      type,
      text: line
    }))
  }).flat()

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-auto max-h-[500px]">
      <div className="text-sm font-mono">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-4 py-1 ${
              line.type === 1
                ? 'bg-green-900/20 text-green-200'
                : line.type === -1
                ? 'bg-red-900/20 text-red-200'
                : 'text-neutral-400'
            }`}
          >
            <span className="mr-3 text-neutral-600">
              {line.type === 1 ? '+' : line.type === -1 ? '-' : ' '}
            </span>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export const PatchApprovalDialog: React.FC<PatchApprovalDialogProps> = ({
  patch,
  onApprove,
  onReject,
  onEdit,
  projectPath = 'default',
  isOpen,
  totalPatches = 0,
  currentPatchIndex = 0
}) => {
  const [showInline, setShowInline] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const diff = patch ? generateDiff(patch.originalContent, patch.patchedContent) : null
  const language: BundledLanguage = patch ? getFileLanguage(patch.filePath) : 'plaintext'

  // Define callbacks BEFORE useEffect to avoid stale closure bugs
  const handleApprove = useCallback(() => {
    if (!patch) return
    setIsAnimating(true)
    recordApprovalDecision(projectPath, patch.filePath, 'accept', 'code-change')
    setTimeout(() => {
      onApprove(patch)
      setIsAnimating(false)
    }, 300)
  }, [patch, onApprove, projectPath])

  const handleReject = useCallback(() => {
    if (!patch) return
    setIsAnimating(true)
    recordApprovalDecision(projectPath, patch.filePath, 'reject', 'code-change')
    setTimeout(() => {
      onReject(patch)
      setIsAnimating(false)
    }, 300)
  }, [patch, onReject, projectPath])

  const handleEdit = useCallback(() => {
    if (!patch) return
    setIsAnimating(true)
    recordApprovalDecision(projectPath, patch.filePath, 'edit', 'code-change')
    setTimeout(() => {
      onEdit(patch)
      setIsAnimating(false)
    }, 300)
  }, [patch, onEdit, projectPath])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !patch) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘Y or Ctrl+Y = Accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        handleApprove()
      }
      // ⌘N or Ctrl+N = Reject
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleReject()
      }
      // ⌘E or Ctrl+E = Edit
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        handleEdit()
      }
      // ESC = Reject (common cancel pattern)
      if (e.key === 'Escape') {
        e.preventDefault()
        handleReject()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, patch, handleApprove, handleReject, handleEdit])

  if (!isOpen || !patch || !diff) {
    return null
  }

  const fileName = patch.filePath.split('/').pop() || 'unknown'
  const fileSize = patch.patchedContent.length
  const linesChanged = diff.diffs.filter(([type]) => type !== 0).length

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col transition-all duration-300 ${
          isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Header */}
        <div className="border-b border-neutral-700 bg-neutral-800/50 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Review Code Change
            </h2>
            <p className="text-sm text-neutral-400">
              File: <code className="bg-neutral-800 px-2 py-1 rounded">{patch.filePath}</code>
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {linesChanged} lines changed • {fileSize} bytes
              {totalPatches > 1 && ` • Patch ${currentPatchIndex + 1} of ${totalPatches}`}
            </p>
          </div>

          {/* Patch Counter */}
          {totalPatches > 1 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400">
                {currentPatchIndex + 1}/{totalPatches}
              </div>
              <p className="text-xs text-neutral-500">remaining patches</p>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="border-b border-neutral-700 bg-neutral-900/30 px-6 py-2 flex items-center gap-2">
          <button
            onClick={() => setShowInline(false)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              !showInline
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setShowInline(true)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showInline
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Inline
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-6">
          {showInline ? (
            <InlineDiff diff={diff} language={language} />
          ) : (
            <SideBySideDiff
              before={patch.originalContent}
              after={patch.patchedContent}
              language={language}
            />
          )}
        </div>

        {/* Footer with Action Buttons */}
        <div className="border-t border-neutral-700 bg-neutral-800/50 px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            <p>⌘Y = Accept • ⌘N = Reject • ⌘E = Edit • ESC = Reject</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReject}
              className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors flex items-center gap-2 font-medium"
            >
              <X className="w-4 h-4" />
              Reject
            </button>

            <button
              onClick={handleEdit}
              className="px-4 py-2 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors flex items-center gap-2 font-medium"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>

            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-green-600/30"
            >
              <Check className="w-4 h-4" />
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
