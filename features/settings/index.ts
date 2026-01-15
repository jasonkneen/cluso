/**
 * Settings Feature Module
 *
 * Exports settings state management and utilities.
 */

export { useAppSettings } from './useAppSettings'
export type { UseAppSettingsReturn, AvailableModel } from './useAppSettings'

// Re-export types from SettingsDialog for convenience
export type {
  AppSettings,
  Provider,
  SettingsModel,
  Connection,
  MCPServerConnection,
} from '../../components/SettingsDialog'
export { DEFAULT_SETTINGS, getFontSizeValue } from '../../components/SettingsDialog'
