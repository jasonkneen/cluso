import React from 'react'
import { Loader2 } from 'lucide-react'

interface PendingPreview {
  additions: number
  deletions: number
  undoCode?: string
  applyCode?: string
}

interface PendingChangePreviewProps {
  isDarkMode: boolean
  pendingPreview: PendingPreview
  isGeneratingSourcePatch: boolean
  isPreviewingOriginal: boolean
  onSetPreviewingOriginal: (value: boolean) => void
  onShowOriginal: () => void
  onShowChange: () => void
  onReject: () => void
  onApprove: () => void
}

export function PendingChangePreview({
  isDarkMode,
  pendingPreview,
  isGeneratingSourcePatch,
  isPreviewingOriginal,
  onSetPreviewingOriginal,
  onShowOriginal,
  onShowChange,
  onReject,
  onApprove,
}: PendingChangePreviewProps): React.ReactElement {
  return (
    <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 rounded-full shadow-xl p-2 z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
      {/* Diff Stats */}
      <div className="flex items-center gap-1.5 px-2 text-xs font-mono">
        <span className="text-green-500">+{pendingPreview.additions}</span>
        <span className="text-red-500">-{pendingPreview.deletions}</span>
      </div>
      <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
      <button
        onMouseDown={() => {
          onShowOriginal()
          onSetPreviewingOriginal(true)
        }}
        onMouseUp={() => {
          onShowChange()
          onSetPreviewingOriginal(false)
        }}
        onMouseLeave={() => {
          if (!isPreviewingOriginal) return
          onShowChange()
          onSetPreviewingOriginal(false)
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-600'}`}
        title="Hold to see original"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
      <button
        onClick={onReject}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-900/20 text-neutral-400 hover:text-red-400' : 'hover:bg-red-50 text-neutral-600 hover:text-red-600'}`}
        title="Reject (Esc)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
      <button
        onClick={onApprove}
        disabled={isGeneratingSourcePatch}
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50 ${
          isGeneratingSourcePatch
            ? 'cursor-not-allowed'
            : (isDarkMode ? 'bg-neutral-100 text-neutral-900 hover:bg-white' : 'bg-neutral-900 text-white hover:bg-neutral-800')
        }`}
        title="Accept (Cmd+Enter)"
      >
        {isGeneratingSourcePatch ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        )}
      </button>
    </div>
  )
}
