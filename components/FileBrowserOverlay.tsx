import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Folder,
  File,
  FileCode,
  FileText,
  Image,
  Globe,
  Palette,
  Settings,
} from 'lucide-react'
import type { FileBrowserPanel, FileBrowserItem } from '../features/file-browser'

interface FileBrowserOverlayProps {
  isDarkMode: boolean
  fileBrowserStack: FileBrowserPanel[]
  onBack: () => void
  onClose: () => void
  onOpenItem: (index: number) => void
}

function getFileIcon(name: string, isDir: boolean): React.ReactNode {
  if (isDir) return <Folder size={18} className="text-blue-400" />
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext))
    return <Image size={18} className="text-purple-400" />
  if (['ts', 'tsx'].includes(ext))
    return <FileCode size={18} className="text-blue-400" />
  if (['js', 'jsx'].includes(ext))
    return <FileCode size={18} className="text-yellow-400" />
  if (['css', 'scss', 'less'].includes(ext))
    return <Palette size={18} className="text-pink-400" />
  if (['json', 'yaml', 'yml', 'toml'].includes(ext))
    return <Settings size={18} className="text-orange-400" />
  if (['md', 'txt', 'mdx'].includes(ext))
    return <FileText size={18} className="text-neutral-400" />
  if (['html', 'htm'].includes(ext))
    return <Globe size={18} className="text-orange-400" />
  return <File size={18} className="text-neutral-500" />
}

export function FileBrowserOverlay({
  isDarkMode,
  fileBrowserStack,
  onBack,
  onClose,
  onOpenItem,
}: FileBrowserOverlayProps): React.ReactElement {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-md"
        onClick={onClose}
      />

      {/* Stacked Panels */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
        {fileBrowserStack.map((panel, index) => {
          const isActive = index === fileBrowserStack.length - 1
          const stackOffset = (fileBrowserStack.length - 1 - index) * 350

          return (
            <div
              key={`${panel.path}-${index}`}
              className={`absolute pointer-events-auto transition-all duration-500 ease-out backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden ${
                isDarkMode
                  ? 'bg-neutral-900/80 border-white/10'
                  : 'bg-white/80 border-black/10'
              }`}
              style={{
                width: panel.type === 'image' ? 'auto' : '480px',
                maxWidth: '90vw',
                maxHeight: '60vh',
                transform: isActive
                  ? 'translateX(0) scale(1)'
                  : `translateX(-${stackOffset}px) scale(0.95)`,
                opacity: isActive ? 1 : 0.4,
                zIndex: index,
              }}
            >
              {/* Header - Compact */}
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                isDarkMode ? 'border-white/10' : 'border-black/5'
              }`}>
                <button
                  onClick={onBack}
                  className={`p-1 rounded transition ${
                    isDarkMode ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'
                  }`}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                    {panel.title}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={`p-1 rounded transition ${
                    isDarkMode ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 44px)' }}>
                {panel.type === 'directory' && panel.items && (
                  <div className="py-1">
                    {panel.items.length === 0 ? (
                      <div className={`text-center py-6 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Empty folder
                      </div>
                    ) : (
                      panel.items.map((item, itemIndex) => (
                        <button
                          key={item.path}
                          onClick={() => onOpenItem(itemIndex + 1)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                            isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'
                          }`}
                        >
                          {/* Number badge */}
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'
                          }`}>
                            {itemIndex + 1}
                          </div>
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            {getFileIcon(item.name, item.isDirectory)}
                          </div>
                          {/* Name */}
                          <div className={`flex-1 min-w-0 text-sm truncate ${
                            isDarkMode ? 'text-white' : 'text-neutral-900'
                          }`}>
                            {item.name}
                          </div>
                          {/* Arrow for folders */}
                          {item.isDirectory && (
                            <ChevronRight size={16} className={isDarkMode ? 'text-neutral-600' : 'text-neutral-400'} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {panel.type === 'file' && panel.content && (
                  <pre className={`p-3 text-xs font-mono overflow-x-auto ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}>
                    {panel.content}
                  </pre>
                )}

                {panel.type === 'image' && (
                  <div className="p-3 flex items-center justify-center">
                    <img
                      src={`file://${panel.path}`}
                      alt={panel.title}
                      className="max-w-full max-h-[50vh] object-contain rounded"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Voice hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[102] pointer-events-none">
        <div className={`px-3 py-1.5 rounded-full text-xs backdrop-blur-xl ${
          isDarkMode ? 'bg-white/10 text-white/60' : 'bg-black/10 text-black/60'
        }`}>
          "open 3" / "open App.tsx" / "open src folder" / "go back" / "close"
        </div>
      </div>
    </>
  )
}
