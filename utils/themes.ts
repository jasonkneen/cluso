// Application themes and color definitions

export const DEFAULT_THEME_ID = 'system-default'

export interface AppTheme {
  id: string
  name: string
  description: string
  colors?: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    border: string
    success: string
    error: string
    warning: string
    info: string
  }
}

export const APP_THEMES: AppTheme[] = [
  // System Default (no custom theme)
  {
    id: 'system-default',
    name: 'System Default',
    description: 'Use system light/dark mode preferences',
  },
  // Tokyo Night
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'A dark theme inspired by Tokyo',
    colors: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      primary: '#7aa2f7',
      secondary: '#bb9af7',
      accent: '#7dcfff',
      border: '#3b3f5c',
      success: '#9ece6a',
      error: '#f7768e',
      warning: '#e0af68',
      info: '#7aa2f7',
    },
  },
  // Dracula
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'A dark theme with vibrant colors',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      primary: '#bd93f9',
      secondary: '#ff79c6',
      accent: '#8be9fd',
      border: '#44475a',
      success: '#50fa7b',
      error: '#ff5555',
      warning: '#f1fa8c',
      info: '#8be9fd',
    },
  },
  // Nord
  {
    id: 'nord',
    name: 'Nord',
    description: 'An arctic, north-bluish color palette',
    colors: {
      background: '#2e3440',
      foreground: '#d8dee9',
      primary: '#81a1c1',
      secondary: '#b48ead',
      accent: '#88c0d0',
      border: '#3b4252',
      success: '#a3be8c',
      error: '#bf616a',
      warning: '#ebcb8b',
      info: '#81a1c1',
    },
  },
  // Gruvbox Dark
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    description: 'Retro groove color scheme',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      primary: '#458588',
      secondary: '#b16286',
      accent: '#689d6a',
      border: '#3c3836',
      success: '#98971a',
      error: '#cc241d',
      warning: '#d79921',
      info: '#458588',
    },
  },
  // One Dark
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Atom One Dark theme',
    colors: {
      background: '#282c34',
      foreground: '#abb2bf',
      primary: '#61afef',
      secondary: '#c678dd',
      accent: '#56b6c2',
      border: '#3e4451',
      success: '#98c379',
      error: '#e06c75',
      warning: '#e5c07b',
      info: '#61afef',
    },
  },
  // Catppuccin Mocha
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Soothing pastel theme',
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      primary: '#89b4fa',
      secondary: '#f5c2e7',
      accent: '#94e2d5',
      border: '#313244',
      success: '#a6e3a1',
      error: '#f38ba8',
      warning: '#f9e2af',
      info: '#89b4fa',
    },
  },
  // Solarized Dark
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Precision colors for machines and people',
    colors: {
      background: '#002b36',
      foreground: '#839496',
      primary: '#268bd2',
      secondary: '#d33682',
      accent: '#2aa198',
      border: '#073642',
      success: '#859900',
      error: '#dc322f',
      warning: '#b58900',
      info: '#268bd2',
    },
  },
  // Monokai Pro
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    description: 'Professional monochrome-inspired theme',
    colors: {
      background: '#2d2a2e',
      foreground: '#fcfcfa',
      primary: '#fc9867',
      secondary: '#ab9df2',
      accent: '#78dce8',
      border: '#403e41',
      success: '#a9dc76',
      error: '#ff6188',
      warning: '#ffd866',
      info: '#fc9867',
    },
  },
  // GitHub Dark
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'GitHub dark mode theme',
    colors: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      primary: '#58a6ff',
      secondary: '#bc8cff',
      accent: '#39c5cf',
      border: '#30363d',
      success: '#3fb950',
      error: '#f85149',
      warning: '#d29922',
      info: '#58a6ff',
    },
  },
  // Synthwave '84
  {
    id: 'synthwave-84',
    name: "Synthwave '84",
    description: 'Neon retro future theme',
    colors: {
      background: '#262335',
      foreground: '#ffffff',
      primary: '#03edf9',
      secondary: '#ff7edb',
      accent: '#03edf9',
      border: '#614d85',
      success: '#72f1b8',
      error: '#fe4450',
      warning: '#fede5d',
      info: '#03edf9',
    },
  },
  // Everforest Dark
  {
    id: 'everforest-dark',
    name: 'Everforest Dark',
    description: 'Comfortable green-based color palette',
    colors: {
      background: '#2b3339',
      foreground: '#d4be98',
      primary: '#7fbbb3',
      secondary: '#d699b6',
      accent: '#83c092',
      border: '#374145',
      success: '#83c092',
      error: '#e68183',
      warning: '#dbc77d',
      info: '#7fbbb3',
    },
  },
  // Rose Pine Moon
  {
    id: 'rose-pine-moon',
    name: 'Rose Pine Moon',
    description: 'All natural pine, faux fur and a bit of soho vibes',
    colors: {
      background: '#232136',
      foreground: '#e0def4',
      primary: '#9ccfd8',
      secondary: '#f5bde6',
      accent: '#ebbcba',
      border: '#393552',
      success: '#90c695',
      error: '#eb6f92',
      warning: '#f6c177',
      info: '#9ccfd8',
    },
  },
]

export function getTheme(themeId: string): AppTheme {
  return APP_THEMES.find((theme) => theme.id === themeId) || APP_THEMES[0]
}

export function applyThemeToDocument(theme: AppTheme): void {
  const root = document.documentElement

  // System default: remove custom theme and use system preferences
  if (theme.id === 'system-default') {
    root.removeAttribute('data-theme')
    // Remove custom properties
    root.style.removeProperty('--color-background')
    root.style.removeProperty('--color-foreground')
    root.style.removeProperty('--color-primary')
    root.style.removeProperty('--color-secondary')
    root.style.removeProperty('--color-accent')
    root.style.removeProperty('--color-border')
    root.style.removeProperty('--color-success')
    root.style.removeProperty('--color-error')
    root.style.removeProperty('--color-warning')
    root.style.removeProperty('--color-info')
    return
  }

  const { colors } = theme

  if (!colors) {
    root.removeAttribute('data-theme')
    return
  }

  // Set CSS custom properties for theme colors
  root.style.setProperty('--color-background', colors.background)
  root.style.setProperty('--color-foreground', colors.foreground)
  root.style.setProperty('--color-primary', colors.primary)
  root.style.setProperty('--color-secondary', colors.secondary)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-border', colors.border)
  root.style.setProperty('--color-success', colors.success)
  root.style.setProperty('--color-error', colors.error)
  root.style.setProperty('--color-warning', colors.warning)
  root.style.setProperty('--color-info', colors.info)

  // Set data attribute for CSS targeting
  root.setAttribute('data-theme', theme.id)
}
