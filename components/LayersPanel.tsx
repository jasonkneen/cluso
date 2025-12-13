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
}: LayersPanelProps) => {
  return (
    <div
      className={`flex flex-col rounded-xl shadow-sm flex-shrink-0 border ${className || ''}`}
      style={{
        width,
        minWidth: 200,
        maxWidth: 400,
        backgroundColor: panelBg,
        borderColor: panelBorder,
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
          {isLoading ? (
            <div className={`flex items-center justify-center h-32 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              Scanning elements...
            </div>
          ) : (
            <ComponentTree
              data={treeData}
              selectedId={selectedId}
              onSelect={onSelect}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      </div>

      {/* Footer with element count */}
      {treeData && (
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
