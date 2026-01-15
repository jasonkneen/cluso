/**
 * App Providers
 *
 * Centralizes all React context providers for the application.
 * Makes it easy to add/remove providers and keeps index.tsx clean.
 */

import React from 'react'
import { ThemeProvider } from '../hooks/useTheme'
import { ControlRegistryProvider } from './ui/controllable'

interface AppProvidersProps {
  children: React.ReactNode
}

/**
 * Wraps all application context providers in a single component.
 *
 * Provider order matters! Dependencies flow from outer to inner:
 * - ThemeProvider: Provides theme context (dark/light mode)
 * - ControlRegistryProvider: Provides controllable UI registry
 *
 * Future providers can be added here:
 * - SettingsProvider (when migrating settings to context)
 * - ChatProvider (when migrating chat state to context)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ControlRegistryProvider>
        {children}
      </ControlRegistryProvider>
    </ThemeProvider>
  )
}
