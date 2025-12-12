import React, { useMemo, memo } from 'react'
import { Viewport } from '../types'

interface ConnectionLinesProps {
  viewports: Viewport[]
  isDarkMode: boolean
}

// Memoized connection line component
const ConnectionLine = memo(function ConnectionLine({
  sourceX,
  sourceY,
  targetX,
  targetY,
  isDarkMode,
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  isDarkMode: boolean
}) {
  const controlOffset = Math.min(Math.abs(targetX - sourceX) / 2, 50)
  const strokeColor = isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)'
  const dotColor = isDarkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.4)'

  return (
    <g>
      <path
        d={`M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`}
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="4 4"
        fill="none"
      />
      <circle cx={sourceX} cy={sourceY} r={3} fill={dotColor} />
      <circle cx={targetX} cy={targetY} r={3} fill={dotColor} />
    </g>
  )
})

export const ConnectionLines = memo(function ConnectionLines({ viewports, isDarkMode }: ConnectionLinesProps) {
  // Memoize connection calculations
  const connections = useMemo(() => {
    return viewports
      .filter(v => v.linkedToViewportId)
      .map(linkedWindow => {
        const sourceViewport = viewports.find(v => v.id === linkedWindow.linkedToViewportId)
        if (!sourceViewport) return null

        // Source: right edge center
        const sourceX = (sourceViewport.x ?? 0) + (sourceViewport.displayWidth ?? 400)
        const sourceY = (sourceViewport.y ?? 0) + (sourceViewport.displayHeight ?? 250) / 2

        // Target: left edge center
        const targetX = linkedWindow.x ?? 0
        const targetY = (linkedWindow.y ?? 0) + (linkedWindow.displayHeight ?? 300) / 2

        return {
          id: `${sourceViewport.id}-${linkedWindow.id}`,
          sourceX,
          sourceY,
          targetX,
          targetY,
        }
      })
      .filter(Boolean) as { id: string; sourceX: number; sourceY: number; targetX: number; targetY: number }[]
  }, [viewports])

  if (connections.length === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        overflow: 'visible',
        zIndex: 0,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      {connections.map(conn => (
        <ConnectionLine
          key={conn.id}
          sourceX={conn.sourceX}
          sourceY={conn.sourceY}
          targetX={conn.targetX}
          targetY={conn.targetY}
          isDarkMode={isDarkMode}
        />
      ))}
    </svg>
  )
})
