/**
 * App Settings Hook
 *
 * Manages application settings state, persistence, and computed values.
 * Extracted from App.tsx to centralize settings management.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { AppSettings, Provider, SettingsModel } from '../../components/SettingsDialog'
import { DEFAULT_SETTINGS } from '../../components/SettingsDialog'

const STORAGE_KEY = 'cluso-settings'

export interface AvailableModel {
  id: string
  name: string
  Icon: React.ComponentType<{ className?: string }>
  provider: string
  available: boolean
}

export interface UseAppSettingsReturn {
  // Settings state (named to match App.tsx conventions)
  appSettings: AppSettings
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  appSettingsRef: React.MutableRefObject<AppSettings>

  // Computed values
  availableModels: AvailableModel[]
  configuredProviders: Provider[]

  // Actions
  updateProvider: (providerId: string, updates: Partial<Provider>) => void
  updateModel: (modelId: string, updates: Partial<SettingsModel>) => void
  resetSettings: () => void
}

/**
 * Load settings from localStorage with defaults and migrations
 */
function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)

      // Deep merge to handle new settings added over time
      // Merge models: keep stored models but add any new ones from defaults
      const storedModelIds = new Set((parsed.models || []).map((m: { id: string }) => m.id))
      const newModels = DEFAULT_SETTINGS.models.filter(m => !storedModelIds.has(m.id))
      const mergedModels = [...(parsed.models || []), ...newModels]

      // Merge providers: keep stored providers but add any new ones from defaults
      const storedProviderIds = new Set((parsed.providers || []).map((p: { id: string }) => p.id))
      const newProviders = DEFAULT_SETTINGS.providers.filter(p => !storedProviderIds.has(p.id))
      const mergedProviders = [...(parsed.providers || []), ...newProviders]

      // Migrate old connection format to new MCP transport format
      const migratedConnections = (parsed.connections || []).map((conn: Record<string, unknown>) => {
        // If connection has 'url' but no 'transport', migrate to new format
        if (conn.type === 'mcp' && conn.url && !conn.transport) {
          return {
            ...conn,
            transport: { type: 'sse', url: conn.url },
          }
        }
        return conn
      })

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        models: mergedModels,
        providers: mergedProviders,
        connections: migratedConnections,
      }
    }
  } catch (e) {
    console.error('[Settings] Failed to load from localStorage:', e)
  }
  return DEFAULT_SETTINGS
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('[Settings] Failed to save to localStorage:', e)
  }
}

/**
 * Hook for managing application settings
 *
 * Provides settings state, persistence, and computed values like available models.
 */
export function useAppSettings(): UseAppSettingsReturn {
  // Initialize from localStorage
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings)

  // Keep a ref for sync access (for callbacks with intentionally empty deps)
  const appSettingsRef = useRef(appSettings)
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // Persist to localStorage when settings change
  useEffect(() => {
    saveSettings(appSettings)
  }, [appSettings])

  // Compute available models based on provider configuration
  const availableModels = useMemo(() => {
    return appSettings.models.map(settingsModel => {
      const provider = appSettings.providers.find(p => p.id === settingsModel.provider)
      const isClaudeCode = settingsModel.provider === 'claude-code'
      const isCodex = settingsModel.provider === 'codex'

      const isAvailable = isClaudeCode
        ? !!appSettings.claudeCodeAuthenticated
        : isCodex
          ? !!appSettings.codexAuthenticated
          : provider?.enabled && !!provider?.apiKey

      return {
        id: settingsModel.id,
        name: settingsModel.name,
        provider: settingsModel.provider,
        available: isAvailable,
        Icon: () => null, // Icon component set at usage site
      }
    })
  }, [
    appSettings.models,
    appSettings.providers,
    appSettings.claudeCodeAuthenticated,
    appSettings.codexAuthenticated,
  ])

  // Get configured (enabled with API key) providers
  const configuredProviders = useMemo(() => {
    return appSettings.providers
      .filter(p => p.enabled && p.apiKey)
      .map(p => ({
        id: p.id,
        apiKey: p.apiKey,
        name: p.name,
        enabled: p.enabled,
      }))
  }, [appSettings.providers])

  // Action: Update a specific provider
  const updateProvider = useCallback((providerId: string, updates: Partial<Provider>) => {
    setAppSettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === providerId ? { ...p, ...updates } : p
      ),
    }))
  }, [])

  // Action: Update a specific model
  const updateModel = useCallback((modelId: string, updates: Partial<SettingsModel>) => {
    setAppSettings(prev => ({
      ...prev,
      models: prev.models.map(m =>
        m.id === modelId ? { ...m, ...updates } : m
      ),
    }))
  }, [])

  // Action: Reset to defaults
  const resetSettings = useCallback(() => {
    setAppSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    appSettings,
    setAppSettings,
    appSettingsRef,
    availableModels,
    configuredProviders,
    updateProvider,
    updateModel,
    resetSettings,
  }
}
