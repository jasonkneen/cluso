import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

export interface LayoutNode {
  id: string
  width: number
  height: number
  linkedToId?: string
}

export interface LayoutResult {
  id: string
  x: number
  y: number
}

// ELK layout options for different arrangements
export type LayoutDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'

export interface LayoutOptions {
  direction?: LayoutDirection
  spacing?: number
  nodeSpacing?: number
}

export async function calculateLayout(
  nodes: LayoutNode[],
  options: LayoutOptions = {}
): Promise<LayoutResult[]> {
  const {
    direction = 'RIGHT',
    spacing = 80,
    nodeSpacing = 40,
  } = options

  // Build ELK graph
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map(node => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: nodes
      .filter(node => node.linkedToId)
      .map(node => ({
        id: `edge-${node.linkedToId}-${node.id}`,
        sources: [node.linkedToId!],
        targets: [node.id],
      })),
  }

  try {
    const layout = await elk.layout(graph)

    return (layout.children || []).map(child => ({
      id: child.id,
      x: child.x ?? 0,
      y: child.y ?? 0,
    }))
  } catch (error) {
    console.error('[elkLayout] Layout calculation failed:', error)
    return []
  }
}

// Calculate bounding box of all nodes
export function calculateBoundingBox(
  nodes: Array<{ x: number; y: number; width: number; height: number }>
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

// Calculate zoom and pan to fit all nodes in view
export function calculateFitView(
  nodes: Array<{ x: number; y: number; width: number; height: number }>,
  containerWidth: number,
  containerHeight: number,
  padding: number = 50,
  minScale: number = 0.25,
  maxScale: number = 2
): { scale: number; panX: number; panY: number } {
  if (nodes.length === 0) {
    return { scale: 1, panX: 0, panY: 0 }
  }

  const bbox = calculateBoundingBox(nodes)

  // Add padding
  const contentWidth = bbox.width + padding * 2
  const contentHeight = bbox.height + padding * 2

  // Calculate scale to fit
  const scaleX = containerWidth / contentWidth
  const scaleY = containerHeight / contentHeight
  const scale = Math.min(Math.max(Math.min(scaleX, scaleY), minScale), maxScale)

  // Calculate pan to center
  const scaledWidth = bbox.width * scale
  const scaledHeight = bbox.height * scale
  const panX = (containerWidth - scaledWidth) / 2 - bbox.minX * scale
  const panY = (containerHeight - scaledHeight) / 2 - bbox.minY * scale

  return { scale, panX, panY }
}
