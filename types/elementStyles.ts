export type ElementDisplay = 'block' | 'flex' | 'grid'

export interface ElementStyles {
  x: number
  y: number
  width: number
  height: number
  rotation: number

  display: ElementDisplay
  flexDirection: 'row' | 'column'
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  alignItems: 'flex-start' | 'center' | 'flex-end'

  gap: number
  padding: number

  backgroundColor: string
  opacity: number // 0-100
  borderRadius: number
}

export const DEFAULT_ELEMENT_STYLES: ElementStyles = {
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  rotation: 0,

  display: 'block',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',

  gap: 0,
  padding: 0,

  backgroundColor: '#000000',
  opacity: 100,
  borderRadius: 0,
}

