import React from 'react'
import { X, AlertTriangle, Trash2 } from 'lucide-react'
import { ErrorSolutionBadge } from './ErrorSolutionBadge'
import type { DetectedError } from '../hooks/useErrorPrefetch'

interface ErrorSolutionPanelProps {
  errors: DetectedError[]
  isVisible: boolean
  onToggle?: () => void
  onRemoveError?: (errorId: string) => void
  onSearchForSolution?: (errorId: string) => void
  onClearAll?: () => void
}

/**
 * Panel component showing all detected errors with their solutions
 */
export const ErrorSolutionPanel: React.FC<ErrorSolutionPanelProps> = ({
  errors,
  isVisible,
  onToggle,
  onRemoveError,
  onSearchForSolution,
  onClearAll,
}) => {
  const errorCount = errors.length
  const criticalCount = errors.filter(e => e.isCritical).length
  const solvedCount = errors.filter(e => e.solution).length

  if (!isVisible || errorCount === 0) {
    return null
  }

  return (
    <div className="error-solution-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-title">
          <AlertTriangle size={18} />
          <span className="title-text">Error Solutions</span>
          <span className="error-badge">
            {criticalCount > 0 && <span className="critical-count">{criticalCount}</span>}
            {errorCount}
          </span>
        </div>

        <div className="header-actions">
          {solvedCount > 0 && (
            <span className="solved-indicator">
              ✓ {solvedCount} solved
            </span>
          )}
          {onClearAll && errorCount > 0 && (
            <button
              className="action-button clear"
              onClick={onClearAll}
              title="Clear all errors"
            >
              <Trash2 size={16} />
            </button>
          )}
          {onToggle && (
            <button className="close-button" onClick={onToggle} title="Close panel">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Error List */}
      <div className="error-list">
        {errors.map(error => (
          <div key={error.id} className="error-item">
            {/* Error Info */}
            <div className="error-header">
              <span className="error-icon">{error.icon}</span>
              <div className="error-info">
                <span className="error-category">{error.category.toUpperCase()}</span>
                <span className="error-time">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {error.isCritical && (
                <span className="critical-indicator" title="Critical error">!</span>
              )}
            </div>

            {/* Error Message */}
            <div className="error-message">
              <code>{error.message.substring(0, 200)}</code>
              {error.message.length > 200 && <span>...</span>}
            </div>

            {/* Solution Badge */}
            <ErrorSolutionBadge
              error={error}
              onRemove={onRemoveError}
              onSearch={onSearchForSolution}
            />
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      {errorCount > 0 && (
        <div className="panel-footer">
          <div className="footer-stats">
            <span className="stat">
              <span className="stat-label">Critical:</span>
              <span className="stat-value">{criticalCount}</span>
            </span>
            <span className="stat">
              <span className="stat-label">Warnings:</span>
              <span className="stat-value">{errorCount - criticalCount}</span>
            </span>
            <span className="stat">
              <span className="stat-label">Solved:</span>
              <span className="stat-value">{solvedCount}</span>
            </span>
          </div>
        </div>
      )}

      <style>{`
        .error-solution-panel {
          position: fixed;
          bottom: 0;
          right: 0;
          width: 100%;
          max-width: 600px;
          max-height: 500px;
          background: white;
          border-top: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
          border-radius: 12px 12px 0 0;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          z-index: 50;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-radius: 12px 12px 0 0;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .header-title svg {
          color: #ef4444;
        }

        .title-text {
          flex: 1;
        }

        .error-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          position: relative;
        }

        .critical-count {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .solved-indicator {
          font-size: 12px;
          color: #10b981;
          font-weight: 600;
          padding: 4px 8px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 4px;
        }

        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s;
        }

        .action-button:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #1f2937;
        }

        .action-button.clear:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .close-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s;
        }

        .close-button:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #1f2937;
        }

        .error-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          gap: 12px;
          display: flex;
          flex-direction: column;
        }

        .error-list::-webkit-scrollbar {
          width: 8px;
        }

        .error-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .error-list::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }

        .error-list::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        .error-item {
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: all 0.15s;
        }

        .error-item:hover {
          background: #ffffff;
          border-color: #d1d5db;
        }

        .error-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .error-icon {
          font-size: 16px;
          line-height: 1;
        }

        .error-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .error-category {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          padding: 2px 6px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }

        .error-time {
          font-size: 11px;
          color: #9ca3af;
        }

        .critical-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: #dc2626;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
        }

        .error-message {
          padding: 8px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .error-message code {
          font-family: "Monaco", "Menlo", monospace;
          font-size: 11px;
          color: #374151;
          word-break: break-all;
          white-space: pre-wrap;
        }

        .panel-footer {
          padding: 12px 16px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 0 0 12px 12px;
        }

        .footer-stats {
          display: flex;
          gap: 16px;
          font-size: 12px;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stat-label {
          color: #6b7280;
          font-weight: 500;
        }

        .stat-value {
          color: #1f2937;
          font-weight: 600;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .error-solution-panel {
            max-width: 100%;
            max-height: 60vh;
          }

          .header-title {
            font-size: 14px;
          }

          .error-list {
            padding: 12px;
          }

          .error-item {
            padding: 10px;
          }
        }
      `}</style>
    </div>
  )
}
