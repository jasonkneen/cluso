/**
 * Theme Feature Types
 *
 * Type definitions for theme/dark mode state management.
 */

/**
 * Theme state managed by useThemeState hook
 */
export interface ThemeState {
  isDarkMode: boolean
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}
