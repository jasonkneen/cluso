/**
 * Window Appearance Hook
 *
 * Handles applying Electron window appearance settings (transparency, opacity, blur).
 * Extracted from App.tsx lines 1224-1234.
 */

import { useEffect } from 'react'

interface UseWindowAppearanceOptions {
  transparencyEnabled?: boolean
  windowOpacity: number
  windowBlur: number
}

/**
 * Hook for applying window appearance settings
 *
 * Syncs appearance settings to Electron window whenever they change.
 */
export function useWindowAppearance({
  transparencyEnabled,
  windowOpacity,
  windowBlur,
}: UseWindowAppearanceOptions): void {
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
