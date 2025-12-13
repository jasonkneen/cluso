/**
 * Element selection and source mapping types
 * Extracted from ai-cluso/types.ts for shared use
 */

/**
 * Source location info for a React component
 */
export interface ComponentSource {
  name: string
  file: string
  line: number
  column: number
}

/**
 * Source info extracted from an element (React fiber or RSC)
 */
export interface ElementSourceInfo {
  sources: ComponentSource[]
  summary: string // e.g., "App.tsx (45-120)"
  isRSC?: boolean // True if source info came from RSC payload (Server Components)
  componentStack?: ReactComponentInfo[]
}

/**
 * React component info extracted from React fiber
 * Based on bippy/react-grab patterns
 */
export interface ReactComponentInfo {
  componentName: string | null
  fileName: string | null
  lineNumber: number | null
  columnNumber: number | null
  isServer?: boolean
}

/**
 * Selected element information from the DOM inspector
 */
export interface SelectedElement {
  tagName: string
  text?: string
  id?: string
  className?: string
  xpath?: string
  outerHTML?: string
  attributes?: Record<string, string>
  computedStyle?: {
    display?: string
    position?: string
    visibility?: string
    color?: string
    backgroundColor?: string
    fontSize?: string
  }
  sourceLocation?: ElementSourceInfo | null
  x?: number
  y?: number
  rect?: {
    top: number
    left: number
    width: number
    height: number
  }
  // Move mode - target position for repositioning
  targetPosition?: {
    x: number
    y: number
    width: number
    height: number
  }
  originalPosition?: {
    top: number
    left: number
    width: number
    height: number
  }
  // React fiber extraction (bippy-based) - rich component context
  componentStack?: ReactComponentInfo[]
  componentName?: string | null
  fileName?: string | null
  lineNumber?: number | null
  columnNumber?: number | null
  fullContext?: string | null // Formatted like react-grab output
  hasFiber?: boolean
}

/**
 * Element display type for styling
 */
export type ElementDisplay = 'block' | 'flex' | 'grid'

/**
 * Complete element styles for UI editor
 */
export interface ElementStyles {
  className: string
  cssOverrides: Record<string, string>
  attributeOverrides: Record<string, string>
  datasetOverrides: Record<string, string>

  googleFonts: string[]
  fontFaces: Array<{ family: string; srcUrl: string; format?: string }>

  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: 1 | -1
  scaleY: 1 | -1

  display: ElementDisplay
  flexDirection: 'row' | 'column'
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  alignItems: 'flex-start' | 'center' | 'flex-end'

  gap: number
  padding: number
  overflow: 'visible' | 'hidden'
  boxSizing: 'border-box' | 'content-box'

  backgroundColor: string
  opacity: number // 0-100
  borderRadius: number

  borderWidth: number
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted'
  borderColor: string

  color: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right' | 'justify'

  shadowEnabled: boolean
  shadowVisible: boolean
  shadowType: 'drop' | 'inner'
  shadowX: number
  shadowY: number
  shadowBlur: number
  shadowSpread: number
  shadowColor: string

  blurEnabled: boolean
  blurVisible: boolean
  blurType: 'layer' | 'backdrop'
  blur: number
}

/**
 * Default element styles
 */
export const DEFAULT_ELEMENT_STYLES: ElementStyles = {
  className: '',
  cssOverrides: {},
  attributeOverrides: {},
  datasetOverrides: {},
  googleFonts: [],
  fontFaces: [],

  x: 0,
  y: 0,
  width: 300,
  height: 200,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,

  display: 'block',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',

  gap: 0,
  padding: 0,
  overflow: 'visible',
  boxSizing: 'border-box',

  backgroundColor: '#000000',
  opacity: 100,
  borderRadius: 0,

  borderWidth: 0,
  borderStyle: 'none',
  borderColor: '#404040',

  color: '#ffffff',
  fontFamily: 'system-ui',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 0,
  letterSpacing: 0,
  textAlign: 'left',

  shadowEnabled: false,
  shadowVisible: true,
  shadowType: 'drop',
  shadowX: 0,
  shadowY: 0,
  shadowBlur: 0,
  shadowSpread: 0,
  shadowColor: 'rgba(0,0,0,0.25)',

  blurEnabled: false,
  blurVisible: true,
  blurType: 'layer',
  blur: 0,
}
