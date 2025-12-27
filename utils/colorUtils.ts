/**
 * Color Utility Functions
 *
 * Helper functions for color manipulation including luminance calculation
 * and brightness adjustment for theme variations.
 */

/**
 * Get luminance of a hex color (0-1 scale).
 * Uses the relative luminance formula from WCAG.
 */
export function getLuminance(hex: string): number {
  hex = hex.replace(/^#/, '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Adjust hex color brightness for theme variations.
 * @param hex - Hex color string (with or without #)
 * @param percent - Percentage to adjust (-100 to 100)
 * @returns Adjusted hex color string
 */
export function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.min(255, Math.max(0, Math.round(r + (r * percent / 100))))
  g = Math.min(255, Math.max(0, Math.round(g + (g * percent / 100))))
  b = Math.min(255, Math.max(0, Math.round(b + (b * percent / 100))))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
