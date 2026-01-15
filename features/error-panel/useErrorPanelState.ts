/**
 * Error Panel State Hook
 *
 * Manages visibility state for the error solution panel.
 */

import { useState, useCallback } from 'react'
import type { UseErrorPanelStateReturn } from './types'

export function useErrorPanelState(): UseErrorPanelStateReturn {
  const [isVisible, setIsVisible] = useState(false)

  const toggle = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  const show = useCallback(() => {
    setIsVisible(true)
  }, [])

  const hide = useCallback(() => {
    setIsVisible(false)
  }, [])

  return {
    isVisible,
    setIsVisible,
    toggle,
    show,
    hide,
  }
}
