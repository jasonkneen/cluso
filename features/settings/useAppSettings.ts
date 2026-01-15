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
  // Settings state
  settings: AppSettings
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  settingsRef: React.MutableRefObject<AppSettings>

  // Computed values
  availableModels: AvailableModel[]
  configuredProviders: Provider[]

  // Actions
  updateProvider: (providerId: string, updates: Partial<Provider>) => void
  updateModel: (modelId: string, updates: Partial<SettingsModel>) => void
  resetSettings: () => void
}

/**
 * Load settings from localStorage with defaults
 */
function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // Ensure arrays are merged correctly
        providers: parsed.providers?.length
          ? parsed.providers
          : DEFAULT_SETTINGS.providers,
        models: parsed.models?.length
          ? parsed.models
          : DEFAULT_SETTINGS.models,
        connections: parsed.connections || DEFAULT_SETTINGS.connections,
      }
    }
  } catch (e) {
    console.warn('[Settings] Failed to load from localStorage:', e)
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
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  // Keep a ref for sync access
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // Persist to localStorage when settings change
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Compute available models based on provider configuration
  const availableModels = useMemo(() => {
    return settings.models.map(settingsModel => {
      const provider = settings.providers.find(p => p.id === settingsModel.provider)
      const isClaudeCode = settingsModel.provider === 'claude-code'
      const isCodex = settingsModel.provider === 'codex'

      const isAvailable = isClaudeCode
        ? !!settings.claudeCodeAuthenticated
        : isCodex
          ? !!settings.codexAuthenticated
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
    settings.models,
    settings.providers,
    settings.claudeCodeAuthenticated,
    settings.codexAuthenticated,
  ])

  // Get configured (enabled with API key) providers
  const configuredProviders = useMemo(() => {
    return settings.providers
      .filter(p => p.enabled && p.apiKey)
      .map(p => ({
        id: p.id,
        apiKey: p.apiKey,
        name: p.name,
        enabled: p.enabled,
      }))
  }, [settings.providers])

  // Action: Update a specific provider
  const updateProvider = useCallback((providerId: string, updates: Partial<Provider>) => {
    setSettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === providerId ? { ...p, ...updates } : p
      ),
    }))
  }, [])

  // Action: Update a specific model
  const updateModel = useCallback((modelId: string, updates: Partial<SettingsModel>) => {
    setSettings(prev => ({
      ...prev,
      models: prev.models.map(m =>
        m.id === modelId ? { ...m, ...updates } : m
      ),
    }))
  }, [])

  // Action: Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    settings,
    setSettings,
    settingsRef,
    availableModels,
    configuredProviders,
    updateProvider,
    updateModel,
    resetSettings,
  }
}
