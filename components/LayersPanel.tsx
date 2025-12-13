import { RefreshCw, Layers } from 'lucide-react'
import type { CSSProperties } from 'react'
import { ComponentTree, TreeNode } from './ComponentTree'

interface LayersPanelProps {
  width: number
  treeData: TreeNode | null
  selectedId: string | null
  onSelect: (node: TreeNode) => void
  onRefresh: () => void
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  isLoading?: boolean
  className?: string
  style?: CSSProperties
  embedded?: boolean
}

export const LayersPanel = ({
  width,
  treeData,
  selectedId,
  onSelect,
  onRefresh,
  isDarkMode,
  panelBg,
  panelBorder,
  isLoading = false,
  className,
  style,
  embedded = false,
}: LayersPanelProps) => {
  return (
    <div
      className={[
        'flex flex-col flex-shrink-0',
        embedded ? '' : 'rounded-xl shadow-sm border',
        className || '',
      ].join(' ')}
      style={{
        ...(embedded
          ? {
              backgroundColor: panelBg,
            }
          : {
              width,
              minWidth: 200,
              maxWidth: 400,
              backgroundColor: panelBg,
              borderColor: panelBorder,
            }),
        ...style,
      }}
    >
      {/* Header */}
      <div
        className="h-10 border-b flex items-center justify-between px-3"
        style={{ borderColor: panelBorder }}
      >
        <div className="flex items-center gap-2">
          <Layers className={`w-4 h-4 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`} />
          <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
            Layers
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            isDarkMode
              ? 'hover:bg-white/10 text-neutral-400 hover:text-neutral-200'
              : 'hover:bg-black/5 text-stone-500 hover:text-stone-700'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Refresh layers"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
          <ComponentTree
            data={treeData}
            selectedId={selectedId}
            onSelect={onSelect}
            isDarkMode={isDarkMode}
          />
        </div>
        {isLoading && (
          <div className="absolute inset-x-0 top-0 pointer-events-none">
            <div
              className={[
                'mx-2 mt-2 rounded-md px-2 py-1 text-xs border backdrop-blur',
                isDarkMode ? 'bg-black/30 text-neutral-300 border-white/10' : 'bg-white/70 text-stone-600 border-black/10',
              ].join(' ')}
            >
              Scanning elements…
            </div>
          </div>
        )}
      </div>

      {/* Footer with element count */}
      {treeData && !embedded && (
        <div
          className={`h-8 border-t flex items-center px-3 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}
          style={{ borderColor: panelBorder }}
        >
          {countElements(treeData)} elements
        </div>
      )}
    </div>
  )
}

// Helper to count total elements in tree
function countElements(node: TreeNode): number {
  let count = 1
  if (node.children) {
    for (const child of node.children) {
      count += countElements(child)
    }
  }
  return count
}

export default LayersPanel
