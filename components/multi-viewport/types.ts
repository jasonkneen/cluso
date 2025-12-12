// Multi-viewport system types

export interface DevicePreset {
  id: string
  name: string
  width: number
  height: number
  type: 'mobile' | 'tablet' | 'desktop'
}

// Window types - device viewports or internal app windows
export type WindowType = 'device' | 'kanban' | 'todo' | 'notes'

export interface Viewport {
  id: string
  windowType: WindowType // Type of window
  devicePresetId?: string // Only for device type
  orientation?: 'portrait' | 'landscape' // Only for device type
  displayWidth?: number // Custom display width (for resizing)
  displayHeight?: number // Custom display height
  x?: number // Position on canvas
  y?: number // Position on canvas
  // Linked window support
  linkedToViewportId?: string // ID of the viewport this window is linked to
}

export interface ViewportItemProps {
  viewport: Viewport
  preset: DevicePreset
  url: string
  isExpanded: boolean
  isDarkMode: boolean
  isElectron: boolean
  webviewPreloadPath?: string
  cardWidth?: number // Width of the card container
  // Primary/sync navigation props
  isPrimary?: boolean // This viewport controls navigation for all others
  onSetPrimary?: () => void // Make this viewport the primary
  onNavigate?: (url: string) => void // Called when this viewport navigates (if primary)
  // Inspector props
  isInspectorActive?: boolean
  isScreenshotActive?: boolean
  isMoveActive?: boolean
  onInspectorHover?: (element: unknown, rect: unknown, viewportId: string) => void
  onInspectorSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onScreenshotSelect?: (element: unknown, rect: unknown, viewportId: string) => void
  onConsoleLog?: (level: string, message: string, viewportId: string) => void
  // Actions
  onExpand: () => void
  onCollapse: () => void
  onRemove: () => void
  onOrientationToggle: () => void
  onResize?: (width: number, height: number) => void
  dragHandleProps?: Record<string, unknown>
  // Linked window creation
  onAddLinkedWindow?: (windowType: 'kanban' | 'todo' | 'notes') => void
}

// Device presets - exported for reuse
export const DEVICE_PRESETS: DevicePreset[] = [
  // Mobile devices
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, type: 'mobile' },
  { id: 'iphone-14', name: 'iPhone 14', width: 390, height: 844, type: 'mobile' },
  { id: 'iphone-14-pro-max', name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'mobile' },
  { id: 'iphone-15-pro', name: 'iPhone 15 Pro', width: 393, height: 852, type: 'mobile' },
  { id: 'samsung-galaxy-s21', name: 'Samsung Galaxy S21', width: 360, height: 800, type: 'mobile' },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, type: 'mobile' },
  // Tablet devices
  { id: 'ipad-mini', name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
  { id: 'ipad-air', name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
  { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194, type: 'tablet' },
  { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet' },
  { id: 'surface-pro-7', name: 'Surface Pro 7', width: 912, height: 1368, type: 'tablet' },
  { id: 'galaxy-tab-s7', name: 'Galaxy Tab S7', width: 800, height: 1280, type: 'tablet' },
  // Desktop (no specific dimensions, uses full width)
  { id: 'desktop', name: 'Desktop', width: 1920, height: 1080, type: 'desktop' },
  { id: 'desktop-hd', name: 'Desktop HD', width: 1280, height: 720, type: 'desktop' },
  { id: 'desktop-4k', name: 'Desktop 4K', width: 2560, height: 1440, type: 'desktop' },
]

export const getPresetById = (id: string): DevicePreset | undefined =>
  DEVICE_PRESETS.find(p => p.id === id)

export const getPresetsByType = (type: 'mobile' | 'tablet' | 'desktop'): DevicePreset[] =>
  DEVICE_PRESETS.filter(p => p.type === type)
