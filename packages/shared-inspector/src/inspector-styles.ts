/**
 * Inspector CSS Styles
 *
 * CSS styles for the visual overlay system used in element inspection.
 * These styles are injected into the page to create hover, selection,
 * and screenshot overlays.
 */

/**
 * CSS styles for inspector overlays
 */
export const INSPECTOR_OVERLAY_STYLES = `
/* Animated overlay for inspector/screenshot hover and selection */
#cluso-hover-overlay {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #3b82f6;
  border-radius: 8px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
  z-index: 999998;
  opacity: 0;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
#cluso-hover-overlay.visible {
  opacity: 1;
}
#cluso-hover-overlay.screenshot-mode {
  border-color: #9333ea;
  box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.15);
  background-color: rgba(147, 51, 234, 0.05);
}
#cluso-hover-overlay.move-mode {
  border-color: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
}

#cluso-selection-overlay {
  position: fixed;
  pointer-events: none;
  border: 3px solid #3b82f6;
  border-radius: 8px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(59, 130, 246, 0.3);
  z-index: 999999;
  opacity: 0;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
#cluso-selection-overlay.visible {
  opacity: 1;
}

/* Rectangle drag selection */
#cluso-rect-selection {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #3b82f6;
  border-radius: 4px;
  background-color: rgba(59, 130, 246, 0.1);
  z-index: 999997;
  display: none;
}
#cluso-rect-selection.screenshot-mode {
  border-color: #9333ea;
  background-color: rgba(147, 51, 234, 0.1);
}

/* Legacy class support */
.inspector-selected-target {
  position: relative !important;
  z-index: 9999 !important;
}

.screenshot-hover-target {
  cursor: camera !important;
}

.element-number-badge {
  position: absolute;
  bottom: -10px;
  right: -10px;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: rgba(59, 130, 246, 0.85) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  color: white !important;
  border-radius: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.3) inset !important;
  z-index: 10001 !important;
  pointer-events: none !important;
}
.element-number-badge::before {
  content: '';
}

/* Drag-drop glow effect for selected elements */
.inspector-drag-over {
  outline: 3px solid #22c55e !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.5), 0 0 40px 10px rgba(34, 197, 94, 0.3) !important;
  transition: all 0.15s ease-out !important;
}

.drop-zone-label {
  position: fixed !important;
  padding: 8px 16px !important;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
  color: white !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  z-index: 100000 !important;
  pointer-events: none !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  animation: dropLabelPulse 1s ease-in-out infinite !important;
}

@keyframes dropLabelPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.95; }
}

.drop-zone-label::before {
  content: '📥' !important;
  font-size: 16px !important;
}
`

/**
 * Color constants for different inspector modes
 */
export const INSPECTOR_COLORS = {
  /** Inspector mode - blue */
  inspector: {
    primary: '#3b82f6',
    shadow: 'rgba(59, 130, 246, 0.15)',
    background: 'rgba(59, 130, 246, 0.05)',
  },
  /** Screenshot mode - purple */
  screenshot: {
    primary: '#9333ea',
    shadow: 'rgba(147, 51, 234, 0.15)',
    background: 'rgba(147, 51, 234, 0.05)',
  },
  /** Move mode - amber */
  move: {
    primary: '#f59e0b',
    shadow: 'rgba(245, 158, 11, 0.15)',
    background: 'rgba(245, 158, 11, 0.05)',
  },
  /** Drop zone - green */
  drop: {
    primary: '#22c55e',
    shadow: 'rgba(34, 197, 94, 0.5)',
    background: 'rgba(34, 197, 94, 0.1)',
  },
} as const

export type InspectorMode = keyof typeof INSPECTOR_COLORS
