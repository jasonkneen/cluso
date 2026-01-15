/**
 * Layer Details State Hook
 *
 * Manages state for selected layer's detailed information including:
 * - Computed styles
 * - Attributes
 * - Dataset values
 * - Font families
 * - Class names
 */

import { useState } from 'react'

export interface UseLayerDetailsStateReturn {
  // Computed styles for the selected layer
  selectedLayerComputedStyles: Record<string, string> | null
  setSelectedLayerComputedStyles: React.Dispatch<React.SetStateAction<Record<string, string> | null>>

  // HTML attributes for the selected layer
  selectedLayerAttributes: Record<string, string> | null
  setSelectedLayerAttributes: React.Dispatch<React.SetStateAction<Record<string, string> | null>>

  // Dataset (data-*) attributes for the selected layer
  selectedLayerDataset: Record<string, string> | null
  setSelectedLayerDataset: React.Dispatch<React.SetStateAction<Record<string, string> | null>>

  // Font families used by the selected layer
  selectedLayerFontFamilies: string[] | null
  setSelectedLayerFontFamilies: React.Dispatch<React.SetStateAction<string[] | null>>

  // CSS class names on the selected layer
  selectedLayerClassNames: string[] | null
  setSelectedLayerClassNames: React.Dispatch<React.SetStateAction<string[] | null>>
}

export function useLayerDetailsState(): UseLayerDetailsStateReturn {
  const [selectedLayerComputedStyles, setSelectedLayerComputedStyles] = useState<Record<string, string> | null>(null)
  const [selectedLayerAttributes, setSelectedLayerAttributes] = useState<Record<string, string> | null>(null)
  const [selectedLayerDataset, setSelectedLayerDataset] = useState<Record<string, string> | null>(null)
  const [selectedLayerFontFamilies, setSelectedLayerFontFamilies] = useState<string[] | null>(null)
  const [selectedLayerClassNames, setSelectedLayerClassNames] = useState<string[] | null>(null)

  return {
    selectedLayerComputedStyles,
    setSelectedLayerComputedStyles,
    selectedLayerAttributes,
    setSelectedLayerAttributes,
    selectedLayerDataset,
    setSelectedLayerDataset,
    selectedLayerFontFamilies,
    setSelectedLayerFontFamilies,
    selectedLayerClassNames,
    setSelectedLayerClassNames,
  }
}
