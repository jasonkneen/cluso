import React from 'react'

interface StashDialogProps {
  isDarkMode: boolean
  stashMessage: string
  onStashMessageChange: (message: string) => void
  onClose: () => void
  onStash: (message: string) => void
}

export function StashDialog({
  isDarkMode,
  stashMessage,
  onStashMessageChange,
  onClose,
  onStash,
}: StashDialogProps): React.ReactElement {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>
      <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96 rounded-xl shadow-2xl p-5 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'}`}>
        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-stone-900'}`}>Stash Changes</h3>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
          This will temporarily save your uncommitted changes. You can restore them later with "stash pop".
        </p>
        <input
          type="text"
          value={stashMessage}
          onChange={(e) => onStashMessageChange(e.target.value)}
          placeholder="Optional stash message..."
          className={`w-full text-sm px-3 py-2 rounded-lg border mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-stone-50 border-stone-200'}`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onStash(stashMessage)
            }
            if (e.key === 'Escape') {
              onClose()
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-100 text-stone-600'}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onStash(stashMessage)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
          >
            Stash Changes
          </button>
        </div>
      </div>
    </>
  )
}
