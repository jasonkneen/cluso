import React, { useState, useEffect } from 'react'
import { Layers, FolderOpen } from 'lucide-react'
import { LeftSidebar } from './LeftSidebar'
import { FilePanel } from './FilePanel'
import type { TreeNode } from './ComponentTree'
import type { ElementStyles } from '../types/elementStyles'
import type { SelectedElementSourceSnippet } from '../features/selection'

interface TabbedLeftPanelProps {
  width: number
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  headerBg?: string

  // Layers panel props
  treeData: TreeNode | null
  selectedId: string | null
  onSelect: (node: TreeNode) => void
  onRefresh: () => void
  isLoading?: boolean
  selectedElementName?: string | null
  selectedElementNumber?: number | null
  styles: ElementStyles
  onStyleChange: (key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => void
  computedStyles?: Record<string, string> | null
  attributes?: Record<string, string> | null
  dataset?: Record<string, string> | null
  fontFamilies?: string[] | null
  classNames?: string[] | null
  sourceSnippet?: SelectedElementSourceSnippet

  // File panel props
  projectPath?: string | null
  selectedFilePath?: string | null
  onFileSelect?: (path: string) => void

  // Tab control
  defaultTab?: 'layers' | 'files'
  onTabChange?: (tab: 'layers' | 'files') => void
}

type TabType = 'layers' | 'files'

export const TabbedLeftPanel: React.FC<TabbedLeftPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>(props.defaultTab || 'layers')

  // Notify parent of tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    props.onTabChange?.(tab)
  }

  const {
    width,
    isDarkMode,
    panelBg,
    panelBorder,
    projectPath,
    selectedFilePath,
    onFileSelect,
  } = props

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 rounded-xl shadow-sm border overflow-hidden"
      style={{ width, backgroundColor: panelBg, borderColor: panelBorder }}
    >
      {/* Tab Header */}
      <div
        className="h-10 border-b flex items-center px-2 gap-1 flex-shrink-0"
        style={{ borderColor: panelBorder }}
      >
        <button
          onClick={() => handleTabChange('layers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            activeTab === 'layers'
              ? isDarkMode
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-blue-100 text-blue-700'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
          }`}
        >
          <Layers size={14} />
          <span>Layers</span>
        </button>

        {projectPath && (
          <button
            onClick={() => handleTabChange('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'files'
                ? isDarkMode
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-blue-100 text-blue-700'
                : isDarkMode
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
            }`}
          >
            <FolderOpen size={14} />
            <span>Files</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'layers' ? (
          <LeftSidebar {...props} />
        ) : (
          <FilePanel
            width={width}
            isDarkMode={isDarkMode}
            panelBg={panelBg}
            panelBorder={panelBorder}
            projectPath={projectPath}
            selectedFilePath={selectedFilePath}
            onSelectFile={onFileSelect}
          />
        )}
      </div>
    </div>
  )
}

export default TabbedLeftPanel
