import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { TreeNode } from './ComponentTree'
import { LayersPanel } from './LayersPanel'
import { PropertiesPanel } from './PropertiesPanel'
import type { ElementStyles } from '../types/elementStyles'

export type SelectedElementSourceSnippet = {
  filePath: string
  displayPath: string
  startLine: number
  focusLine: number
  language: string
  code: string
} | null

interface LeftSidebarProps {
  width: number
  isDarkMode: boolean
  panelBg: string
  panelBorder: string

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
  projectPath?: string | null
  classNames?: string[] | null
  sourceSnippet?: SelectedElementSourceSnippet
}

const STORAGE_KEY = 'cluso-left-sidebar-tree-height'

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  width,
  isDarkMode,
  panelBg,
  panelBorder,
  treeData,
  selectedId,
  onSelect,
  onRefresh,
  isLoading,
  selectedElementName,
  selectedElementNumber,
  styles,
  onStyleChange,
  computedStyles,
  attributes,
  dataset,
  fontFamilies,
  projectPath,
  classNames,
  sourceSnippet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [treeHeight, setTreeHeight] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const val = raw ? Number.parseInt(raw, 10) : 340
    return Number.isFinite(val) ? val : 340
  })
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const clampTreeHeight = useCallback((next: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const total = rect?.height ?? 800
    const minTree = 180
    const minProps = 240
    const maxTree = Math.max(minTree, total - minProps)
    return Math.max(minTree, Math.min(maxTree, next))
  }, [])

  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary) return
    e.preventDefault()
    e.stopPropagation()

    dragStateRef.current = { startY: e.clientY, startHeight: treeHeight }

    const handleMove = (ev: PointerEvent) => {
      const drag = dragStateRef.current
      if (!drag) return
      const next = drag.startHeight + (ev.clientY - drag.startY)
      setTreeHeight(clampTreeHeight(next))
    }

    const handleUp = () => {
      dragStateRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      window.removeEventListener('blur', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    window.addEventListener('blur', handleUp)
  }, [clampTreeHeight, treeHeight])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(treeHeight))
  }, [treeHeight])

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full flex-shrink-0 rounded-xl shadow-sm border overflow-hidden"
      style={{ width, backgroundColor: panelBg, borderColor: panelBorder }}
    >
      <div className="flex-shrink-0 min-h-0" style={{ height: treeHeight }}>
        <LayersPanel
          width={width}
          treeData={treeData}
          selectedId={selectedId}
          onSelect={onSelect}
          onRefresh={onRefresh}
          isDarkMode={isDarkMode}
          panelBg={panelBg}
          panelBorder={panelBorder}
          isLoading={isLoading}
          embedded
          className="h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div
        className={[
          'h-2 cursor-row-resize flex-shrink-0 flex items-center justify-center border-y',
          isDarkMode ? 'bg-neutral-900/50 hover:bg-neutral-900' : 'bg-stone-100 hover:bg-stone-200',
        ].join(' ')}
        style={{ borderColor: panelBorder }}
        onPointerDown={handleDividerPointerDown}
        title="Drag to resize panels"
      >
        <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-300'}`} />
      </div>

      <div className="flex-1 min-h-0">
        <PropertiesPanel
          styles={styles}
          onChange={onStyleChange}
          isDarkMode={isDarkMode}
          panelBg={panelBg}
          panelBorder={panelBorder}
          embedded
          selectedElementName={selectedElementName ?? null}
          selectedElementNumber={selectedElementNumber ?? null}
          computedStyles={computedStyles ?? null}
          attributes={attributes ?? null}
          dataset={dataset ?? null}
          fontFamilies={fontFamilies ?? null}
          projectPath={projectPath ?? null}
          classNames={classNames ?? null}
          sourceSnippet={sourceSnippet ?? null}
        />
      </div>
    </div>
  )
}

export default LeftSidebar
