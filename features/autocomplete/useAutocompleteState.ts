import { useState, useCallback } from 'react'

export interface ContextChip {
  name: string
  type: 'include' | 'exclude'
}

export interface AutocompleteState {
  // Slash Command State (/ commands)
  showCommandAutocomplete: boolean
  setShowCommandAutocomplete: (show: boolean) => void
  commandSearchQuery: string
  setCommandSearchQuery: (query: string) => void

  // Context Chips State (+ for include, - for exclude)
  contextChips: ContextChip[]
  setContextChips: React.Dispatch<React.SetStateAction<ContextChip[]>>
  recentContextChips: ContextChip[]
  setRecentContextChips: React.Dispatch<React.SetStateAction<ContextChip[]>>
  showChipAutocomplete: boolean
  setShowChipAutocomplete: (show: boolean) => void
  chipSearchQuery: string
  setChipSearchQuery: (query: string) => void
  chipSearchType: 'include' | 'exclude'
  setChipSearchType: (type: 'include' | 'exclude') => void

  // Shared autocomplete index (used by both file and command autocomplete)
  autocompleteIndex: number
  setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>

  // Helper to reset autocomplete state
  resetAutocomplete: () => void
}

export function useAutocompleteState(): AutocompleteState {
  // Slash Command State (/ commands)
  const [commandSearchQuery, setCommandSearchQuery] = useState('')
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false)

  // Context Chips State (+ for include, - for exclude)
  // +aisdk = include context, -gpt-4 = exclude/negative context
  const [contextChips, setContextChips] = useState<ContextChip[]>([])
  const [recentContextChips, setRecentContextChips] = useState<ContextChip[]>([])
  const [showChipAutocomplete, setShowChipAutocomplete] = useState(false)
  const [chipSearchQuery, setChipSearchQuery] = useState('')
  const [chipSearchType, setChipSearchType] = useState<'include' | 'exclude'>('include')

  // Shared autocomplete index
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const resetAutocomplete = useCallback(() => {
    setShowCommandAutocomplete(false)
    setCommandSearchQuery('')
    setShowChipAutocomplete(false)
    setChipSearchQuery('')
    setAutocompleteIndex(0)
  }, [])

  return {
    // Slash Command State
    showCommandAutocomplete,
    setShowCommandAutocomplete,
    commandSearchQuery,
    setCommandSearchQuery,

    // Context Chips State
    contextChips,
    setContextChips,
    recentContextChips,
    setRecentContextChips,
    showChipAutocomplete,
    setShowChipAutocomplete,
    chipSearchQuery,
    setChipSearchQuery,
    chipSearchType,
    setChipSearchType,

    // Shared autocomplete index
    autocompleteIndex,
    setAutocompleteIndex,

    // Helper
    resetAutocomplete,
  }
}
