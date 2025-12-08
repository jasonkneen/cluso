import React, { useState } from 'react'
import { ChevronDown, AlertCircle, Search, Lightbulb, X, AlertTriangle } from 'lucide-react'
import type { DetectedError } from '../hooks/useErrorPrefetch'

interface ErrorSolutionBadgeProps {
  error: DetectedError
  onRemove?: (errorId: string) => void
  onSearch?: (errorId: string) => void
}

/**
 * Badge component that displays on error entries in console
 * Shows solution availability and allows expanding for details
 */
export const ErrorSolutionBadge: React.FC<ErrorSolutionBadgeProps> = ({
  error,
  onRemove,
  onSearch,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasSolution = !!error.solution
  const isSearching = error.isSearching

  return (
    <div className="error-solution-badge-container">
      {/* Main Badge */}
      <div className={`error-solution-badge ${error.isCritical ? 'critical' : 'warning'}`}>
        {/* Icon */}
        <span className="badge-icon">
          {error.isCritical ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
        </span>

        {/* Status Text */}
        <span className="badge-text">
          {hasSolution ? (
            <>
              <Lightbulb size={12} className="inline mr-1" />
              Solution available
            </>
          ) : isSearching ? (
            <>
              <Search size={12} className="inline mr-1 animate-spin" />
              Searching...
            </>
          ) : (
            'No solution found'
          )}
        </span>

        {/* Toggle Button */}
        {hasSolution && (
          <button
            className="badge-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Hide solution' : 'Show solution'}
          >
            <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Search Button */}
        {!hasSolution && !isSearching && onSearch && (
          <button
            className="badge-search"
            onClick={() => onSearch(error.id)}
            title="Search for solution"
          >
            <Search size={12} />
          </button>
        )}

        {/* Close Button */}
        {onRemove && (
          <button
            className="badge-close"
            onClick={() => onRemove(error.id)}
            title="Dismiss error"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Expanded Solution View */}
      {isExpanded && hasSolution && (
        <div className="error-solution-detail">
          <div className="solution-header">
            <span className="solution-source">
              {error.solution.source === 'cached' ? '💾 Cached' : '🔍 Found'}
            </span>
          </div>

          <div className="solution-text">{error.solution.text}</div>

          {error.solution.query && (
            <div className="solution-query">
              <span className="query-label">Search query:</span>
              <code className="query-code">{error.solution.query}</code>
            </div>
          )}

          {/* Action Buttons */}
          <div className="solution-actions">
            {typeof window !== 'undefined' && window.electronAPI?.openExternal && (
              <button
                className="action-button secondary"
                onClick={() => {
                  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(error.solution?.query || '')}`
                  window.electronAPI.openExternal(searchUrl)
                }}
              >
                Search Web
              </button>
            )}
            {onRemove && (
              <button className="action-button primary" onClick={() => onRemove(error.id)}>
                Got it
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .error-solution-badge-container {
          margin: 8px 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .error-solution-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease-out;
          border: 1px solid transparent;
        }

        .error-solution-badge.critical {
          background-color: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .error-solution-badge.warning {
          background-color: rgba(245, 158, 11, 0.1);
          color: #d97706;
          border-color: rgba(245, 158, 11, 0.3);
        }

        .error-solution-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .badge-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .badge-text {
          display: flex;
          align-items: center;
          flex: 1;
        }

        .badge-toggle,
        .badge-search,
        .badge-close {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          cursor: pointer;
          border: none;
          background: transparent;
          color: inherit;
          border-radius: 4px;
          transition: background-color 0.15s;
        }

        .badge-toggle:hover,
        .badge-search:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .badge-close:hover {
          background-color: rgba(239, 68, 68, 0.2);
          color: #dc2626;
        }

        .error-solution-detail {
          margin-top: 8px;
          padding: 12px;
          background-color: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          font-size: 12px;
          line-height: 1.5;
          color: rgba(0, 0, 0, 0.7);
        }

        .solution-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .solution-source {
          font-weight: 600;
          color: rgba(0, 0, 0, 0.8);
        }

        .solution-text {
          margin: 8px 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: rgba(0, 0, 0, 0.7);
        }

        .solution-query {
          margin: 8px 0;
          padding: 8px;
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
          font-family: "Monaco", "Menlo", monospace;
          font-size: 11px;
        }

        .query-label {
          display: block;
          font-weight: 600;
          margin-bottom: 4px;
          color: rgba(0, 0, 0, 0.6);
        }

        .query-code {
          display: block;
          padding: 4px;
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
          color: rgba(0, 0, 0, 0.8);
          break: break-all;
        }

        .solution-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          justify-content: flex-end;
        }

        .action-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-button.primary {
          background-color: rgba(59, 130, 246, 0.9);
          color: white;
        }

        .action-button.primary:hover {
          background-color: rgb(59, 130, 246);
          transform: translateY(-1px);
        }

        .action-button.secondary {
          background-color: rgba(0, 0, 0, 0.1);
          color: rgba(0, 0, 0, 0.7);
        }

        .action-button.secondary:hover {
          background-color: rgba(0, 0, 0, 0.2);
          transform: translateY(-1px);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
