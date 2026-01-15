/**
 * Layers Panel Hook
 *
 * Manages state for the layers/component tree panel including:
 * - Tree data and selection
 * - Loading states
 * - Selected element tracking
 */

import { useState, useRef, useEffect } from 'react'
import type { TreeNode } from '../../components/ComponentTree'

export interface UseLayersPanelReturn {
  // Tree data state
  layersTreeData: TreeNode | null
  setLayersTreeData: React.Dispatch<React.SetStateAction<TreeNode | null>>
  layersTreeDataRef: React.MutableRefObject<TreeNode | null>

  // Selected node state
  selectedTreeNodeId: string | null
  setSelectedTreeNodeId: React.Dispatch<React.SetStateAction<string | null>>

  // Loading state
  isLayersLoading: boolean
  setIsLayersLoading: React.Dispatch<React.SetStateAction<boolean>>
  isLayersLoadingRef: React.MutableRefObject<boolean>

  // Selected layer element state
  selectedLayerElementNumber: number | null
  setSelectedLayerElementNumber: React.Dispatch<React.SetStateAction<number | null>>
  selectedLayerElementNumberRef: React.MutableRefObject<number | null>
  selectedLayerElementName: string | null
  setSelectedLayerElementName: React.Dispatch<React.SetStateAction<string | null>>

  // Stale tracking ref
  layersTreeStaleRef: React.MutableRefObject<boolean>
}

export function useLayersPanel(): UseLayersPanelReturn {
  // Tree data state
  const [layersTreeData, setLayersTreeData] = useState<TreeNode | null>(null)
  const layersTreeDataRef = useRef<TreeNode | null>(null)
  useEffect(() => { layersTreeDataRef.current = layersTreeData }, [layersTreeData])

  // Selected node state
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null)

  // Loading state
  const [isLayersLoading, setIsLayersLoading] = useState(false)
  const isLayersLoadingRef = useRef(false)
  useEffect(() => { isLayersLoadingRef.current = isLayersLoading }, [isLayersLoading])

  // Selected layer element state
  const [selectedLayerElementNumber, setSelectedLayerElementNumber] = useState<number | null>(null)
  const [selectedLayerElementName, setSelectedLayerElementName] = useState<string | null>(null)
  const selectedLayerElementNumberRef = useRef<number | null>(null)
  useEffect(() => { selectedLayerElementNumberRef.current = selectedLayerElementNumber }, [selectedLayerElementNumber])

  // Stale tracking ref
  const layersTreeStaleRef = useRef(false)

  return {
    layersTreeData,
    setLayersTreeData,
    layersTreeDataRef,
    selectedTreeNodeId,
    setSelectedTreeNodeId,
    isLayersLoading,
    setIsLayersLoading,
    isLayersLoadingRef,
    selectedLayerElementNumber,
    setSelectedLayerElementNumber,
    selectedLayerElementNumberRef,
    selectedLayerElementName,
    setSelectedLayerElementName,
    layersTreeStaleRef,
  }
}
