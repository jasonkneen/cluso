/**
 * Window Appearance Hook
 *
 * Applies Electron window appearance settings.
 *
 * Extracted from App.tsx to centralize window appearance logic.
 */

import { useEffect } from 'react'
import type { UseWindowAppearanceOptions } from './types'

/**
 * Hook for applying window appearance settings
 *
 * Sends appearance settings to Electron main process.
 * Only runs in Electron environment.
 *
 * @param options - Configuration options for window appearance
 */
export function useWindowAppearance(options: UseWindowAppearanceOptions): void {
  const { transparencyEnabled, windowOpacity, windowBlur } = options

  useEffect(() => {
    const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI?.isElectron
    if (!isElectronEnv || !window.electronAPI?.window?.setAppearance) return
    window.electronAPI.window.setAppearance({
      transparencyEnabled: !!transparencyEnabled,
      opacity: windowOpacity,
      blur: windowBlur,
    }).catch((err: unknown) => {
      console.warn('[App] Failed to apply window appearance:', err)
    })
  }, [transparencyEnabled, windowOpacity, windowBlur])
}
