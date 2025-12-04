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
  // ============ LIGHT THEMES ============
  // Solarized Light
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    description: 'Precision colors - light variant',
    colors: {
      background: '#fdf6e3',
      foreground: '#657b83',
      primary: '#268bd2',
      secondary: '#d33682',
      accent: '#2aa198',
      border: '#eee8d5',
      success: '#859900',
      error: '#dc322f',
      warning: '#b58900',
      info: '#268bd2',
    },
  },
  // GitHub Light
  {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'GitHub light mode theme',
    colors: {
      background: '#ffffff',
      foreground: '#24292f',
      primary: '#0969da',
      secondary: '#8250df',
      accent: '#1b7c83',
      border: '#d0d7de',
      success: '#1a7f37',
      error: '#cf222e',
      warning: '#9a6700',
      info: '#0969da',
    },
  },
  // One Light
  {
    id: 'one-light',
    name: 'One Light',
    description: 'Atom One Light theme',
    colors: {
      background: '#fafafa',
      foreground: '#383a42',
      primary: '#4078f2',
      secondary: '#a626a4',
      accent: '#0184bc',
      border: '#e5e5e6',
      success: '#50a14f',
      error: '#e45649',
      warning: '#c18401',
      info: '#4078f2',
    },
  },
  // Catppuccin Latte
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    description: 'Soothing pastel theme - light variant',
    colors: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      primary: '#1e66f5',
      secondary: '#ea76cb',
      accent: '#179299',
      border: '#ccd0da',
      success: '#40a02b',
      error: '#d20f39',
      warning: '#df8e1d',
      info: '#1e66f5',
    },
  },
  // Rose Pine Dawn
  {
    id: 'rose-pine-dawn',
    name: 'Rose Pine Dawn',
    description: 'All natural pine - light variant',
    colors: {
      background: '#faf4ed',
      foreground: '#575279',
      primary: '#56949f',
      secondary: '#d7827e',
      accent: '#907aa9',
      border: '#f2e9e1',
      success: '#286983',
      error: '#b4637a',
      warning: '#ea9d34',
      info: '#56949f',
    },
  },
  // Nord Light
  {
    id: 'nord-light',
    name: 'Nord Light',
    description: 'Arctic color palette - light variant',
    colors: {
      background: '#eceff4',
      foreground: '#2e3440',
      primary: '#5e81ac',
      secondary: '#b48ead',
      accent: '#88c0d0',
      border: '#d8dee9',
      success: '#a3be8c',
      error: '#bf616a',
      warning: '#ebcb8b',
      info: '#5e81ac',
    },
  },
  // Gruvbox Light
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    description: 'Retro groove - light variant',
    colors: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      primary: '#458588',
      secondary: '#b16286',
      accent: '#689d6a',
      border: '#ebdbb2',
      success: '#98971a',
      error: '#cc241d',
      warning: '#d79921',
      info: '#458588',
    },
  },
]

export function getTheme(themeId: string): AppTheme {
  return APP_THEMES.find((theme) => theme.id === themeId) || APP_THEMES[0]
}

export function applyThemeToDocument(theme: AppTheme): void {
  const root = document.documentElement

  // Check if dark mode is enabled (via .dark class on the root or body)
  // Only check the app's dark mode state, not system preference
  const isDarkMode = root.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    document.querySelector('.dark') !== null

  // System default: use default dark/light colors based on system preference
  if (theme.id === 'system-default') {
    root.removeAttribute('data-theme')
    // Set default colors based on dark/light mode
    if (isDarkMode) {
      root.style.setProperty('--color-background', '#171717') // neutral-900
      root.style.setProperty('--color-foreground', '#f5f5f5') // neutral-100
      root.style.setProperty('--color-primary', '#3b82f6') // blue-500
      root.style.setProperty('--color-secondary', '#8b5cf6') // violet-500
      root.style.setProperty('--color-accent', '#06b6d4') // cyan-500
      root.style.setProperty('--color-border', '#404040') // neutral-700
      root.style.setProperty('--color-success', '#22c55e') // green-500
      root.style.setProperty('--color-error', '#ef4444') // red-500
      root.style.setProperty('--color-warning', '#f59e0b') // amber-500
      root.style.setProperty('--color-info', '#3b82f6') // blue-500
      root.style.setProperty('--color-panel', '#262626') // slightly lighter than bg
      root.style.setProperty('--color-muted', '#a3a3a3') // muted text
    } else {
      root.style.setProperty('--color-background', '#d6d3d1') // stone-300 - matches title bar
      root.style.setProperty('--color-foreground', '#171717') // neutral-900
      root.style.setProperty('--color-primary', '#2563eb') // blue-600
      root.style.setProperty('--color-secondary', '#7c3aed') // violet-600
      root.style.setProperty('--color-accent', '#0891b2') // cyan-600
      root.style.setProperty('--color-border', '#e7e5e4') // stone-200
      root.style.setProperty('--color-success', '#16a34a') // green-600
      root.style.setProperty('--color-error', '#dc2626') // red-600
      root.style.setProperty('--color-warning', '#d97706') // amber-600
      root.style.setProperty('--color-info', '#2563eb') // blue-600
      root.style.setProperty('--color-panel', '#ffffff') // white panels in light mode
      root.style.setProperty('--color-muted', '#78716c') // muted text
    }
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

  // Detect if this is a dark or light theme based on background luminance
  const bgLuminance = getLuminance(colors.background)
  const isDarkTheme = bgLuminance < 0.5

  // Derived colors for panels and muted text
  // For dark themes: panels should be LIGHTER than background (background is darker)
  // For light themes: panels should be same or slightly darker than background
  if (isDarkTheme) {
    // Dark theme: panels are significantly lighter for clear contrast
    root.style.setProperty('--color-panel', adjustBrightness(colors.background, 25))
  } else {
    // Light theme: panels can be same or slightly lighter
    root.style.setProperty('--color-panel', adjustBrightness(colors.background, 3))
  }
  // Muted: foreground at reduced intensity
  root.style.setProperty('--color-muted', adjustBrightness(colors.foreground, isDarkTheme ? -30 : 30))

  // Set data attribute for CSS targeting
  root.setAttribute('data-theme', theme.id)
}

// Helper function to get luminance of a hex color (0-1 scale)
function getLuminance(hex: string): number {
  hex = hex.replace(/^#/, '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Helper function to adjust hex color brightness
function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.min(255, Math.max(0, Math.round(r + (r * percent / 100))))
  g = Math.min(255, Math.max(0, Math.round(g + (g * percent / 100))))
  b = Math.min(255, Math.max(0, Math.round(b + (b * percent / 100))))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
