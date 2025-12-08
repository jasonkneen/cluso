import React, { useState, useEffect } from 'react'

type FeatureStatus = 'yes' | 'no' | 'partial' | 'hidden'

interface FeatureData {
  others: FeatureStatus
  cluso: FeatureStatus
}

interface FeatureSettings {
  features: Record<string, FeatureData>
}

interface FeatureRow {
  id: string
  label: string
  category?: string
}

const featureRows: FeatureRow[] = [
  // Getting Started
  { id: 'getting-started', label: 'Getting Started', category: 'header' },
  { id: 'no-login-required', label: 'No login required' },
  { id: 'free-for-life-edition', label: 'Free for life edition' },
  { id: 'pro-edition', label: 'Pro edition' },
  { id: 'pro-cloud-features', label: 'Pro cloud features' },

  // Element Selection & Context
  { id: 'element-selection', label: 'Element Selection & Context *', category: 'header' },
  { id: 'select-elements-as-context-chips', label: 'Select elements as context "chips"' },
  { id: 'capture-screenshots-with-context-chips', label: 'Capture screenshots with context chips' },
  { id: 'move-elements-visually-with-context', label: 'Move elements visually with context' },
  { id: 'source-file-location-mapping', label: 'Source file location mapping' },

  // Console & Debugging
  { id: 'console-debugging', label: 'Console & Debugging *', category: 'header' },
  { id: 'show-web-console-in-app', label: 'Show web console in-app' },
  { id: 'select-console-entries-as-context', label: 'Select console entries as context' },
  { id: 'pre-fetch-error-solutions-automatically', label: 'Pre-fetch error solutions automatically' },

  // Search & Indexing
  { id: 'search-indexing', label: 'Search & Indexing *', category: 'header' },
  { id: 'instant-file-search-with-local-mgrep-indexing', label: 'Instant file search with local mgrep indexing' },
  { id: 'semantic-code-search-with-embeddings', label: 'Semantic code search with embeddings' },
  { id: 'auto-updating-indexes-on-file-changes', label: 'Auto-updating indexes on file changes' },

  // Code Editing & Updates
  { id: 'code-editing', label: 'Code Editing & Updates *', category: 'header' },
  { id: 'instant-code-updates-with-specialized-local-models', label: 'Instant code updates with specialized local models' },
  { id: 'live-dom-css-patching-with-preview', label: 'Live DOM/CSS patching with preview' },
  { id: 'patch-approval-workflow-accept-reject', label: 'Patch approval workflow (accept/reject)' },
  { id: 'backups-and-recovery', label: 'Backups and recovery' },

  // Voice Control
  { id: 'voice-control', label: 'Voice Control *', category: 'header' },
  { id: 'voice-select-elements', label: 'Voice select elements' },
  { id: 'voice-changes-and-approvals', label: 'Voice changes and approvals' },
  { id: 'real-time-voice-streaming-gemini-live', label: 'Real-time voice streaming (Gemini Live)' },
  { id: 'voice-session-logs-learnings', label: 'Voice session logs & learnings' },

  // MCP & Advanced Tooling
  { id: 'mcp-tooling', label: 'MCP & Advanced Tooling *', category: 'header' },
  { id: 'smart-mcp-tooling', label: 'Smart MCP tooling' },
  { id: 'mcp-host-server-integration', label: 'MCP host/server integration' },
  { id: 'lsp-integration-hover-completion-go-to-def', label: 'LSP integration (hover, completion, go-to-def)' },

  // AI Models & Collaboration
  { id: 'ai-models', label: 'AI Models & Collaboration *', category: 'header' },
  { id: 'multi-model-support-claude-gemini-gpt', label: 'Multi-model support (Claude, Gemini, GPT)' },
  { id: 'fast-orchestration-model', label: 'Fast orchestration model' },
  { id: 'context-optimization', label: 'Context optimization' },
  { id: 'knowledge-base', label: 'Knowledge base' },
  { id: 'adaptive-learning', label: 'Adaptive learning' },
  { id: 'steering-questions', label: 'Steering questions' },
  { id: 'multi-instance-collaboration', label: 'Multi-instance collaboration' },
  { id: 'multi-window-project-support', label: 'Multi-window project support' },

  // Project & File Management
  { id: 'project-management', label: 'Project & File Management *', category: 'header' },
  { id: 'built-in-file-explorer-with-autocomplete', label: 'Built-in file explorer with autocomplete' },
  { id: 'git-integration-branch-commit-stash', label: 'Git integration (branch, commit, stash)' },
  { id: 'kanban-board-todo-list', label: 'Kanban board & todo list' },
  { id: 'device-preview-presets-iphone-ipad-etc', label: 'Device preview presets (iPhone, iPad, etc.)' },

  // Privacy & Data
  { id: 'privacy-data', label: 'Privacy & Data *', category: 'header' },
  { id: '100-local-processing-option', label: '100% local processing option' },
  { id: 'bring-your-own-api-keys', label: 'Bring your own API keys' },
  { id: 'no-data-leaves-your-machine-byok-mode', label: 'No data leaves your machine (BYOK mode)' },
]

const defaultFeatures: Record<string, FeatureData> = {
  'no-login-required': { others: 'no', cluso: 'yes' },
  'free-for-life-edition': { others: 'no', cluso: 'yes' },
  'pro-edition': { others: 'yes', cluso: 'yes' },
  'pro-cloud-features': { others: 'partial', cluso: 'yes' },
  'select-elements-as-context-chips': { others: 'partial', cluso: 'yes' },
  'capture-screenshots-with-context-chips': { others: 'partial', cluso: 'yes' },
  'move-elements-visually-with-context': { others: 'partial', cluso: 'yes' },
  'source-file-location-mapping': { others: 'no', cluso: 'yes' },
  'show-web-console-in-app': { others: 'no', cluso: 'yes' },
  'select-console-entries-as-context': { others: 'partial', cluso: 'yes' },
  'pre-fetch-error-solutions-automatically': { others: 'no', cluso: 'yes' },
  'instant-file-search-with-local-mgrep-indexing': { others: 'no', cluso: 'yes' },
  'semantic-code-search-with-embeddings': { others: 'no', cluso: 'yes' },
  'auto-updating-indexes-on-file-changes': { others: 'no', cluso: 'yes' },
  'instant-code-updates-with-specialized-local-models': { others: 'no', cluso: 'yes' },
  'live-dom-css-patching-with-preview': { others: 'partial', cluso: 'yes' },
  'patch-approval-workflow-accept-reject': { others: 'partial', cluso: 'yes' },
  'backups-and-recovery': { others: 'no', cluso: 'yes' },
  'voice-select-elements': { others: 'no', cluso: 'yes' },
  'voice-changes-and-approvals': { others: 'no', cluso: 'yes' },
  'real-time-voice-streaming-gemini-live': { others: 'no', cluso: 'yes' },
  'voice-session-logs-learnings': { others: 'no', cluso: 'yes' },
  'smart-mcp-tooling': { others: 'no', cluso: 'yes' },
  'mcp-host-server-integration': { others: 'no', cluso: 'yes' },
  'lsp-integration-hover-completion-go-to-def': { others: 'partial', cluso: 'yes' },
  'multi-model-support-claude-gemini-gpt': { others: 'partial', cluso: 'yes' },
  'fast-orchestration-model': { others: 'no', cluso: 'yes' },
  'context-optimization': { others: 'no', cluso: 'yes' },
  'knowledge-base': { others: 'no', cluso: 'yes' },
  'adaptive-learning': { others: 'no', cluso: 'yes' },
  'steering-questions': { others: 'no', cluso: 'yes' },
  'multi-instance-collaboration': { others: 'no', cluso: 'yes' },
  'multi-window-project-support': { others: 'no', cluso: 'yes' },
  'built-in-file-explorer-with-autocomplete': { others: 'partial', cluso: 'yes' },
  'git-integration-branch-commit-stash': { others: 'partial', cluso: 'yes' },
  'kanban-board-todo-list': { others: 'no', cluso: 'yes' },
  'device-preview-presets-iphone-ipad-etc': { others: 'partial', cluso: 'yes' },
  '100-local-processing-option': { others: 'no', cluso: 'yes' },
  'bring-your-own-api-keys': { others: 'partial', cluso: 'yes' },
  'no-data-leaves-your-machine-byok-mode': { others: 'no', cluso: 'yes' },
}

const statusOrder: FeatureStatus[] = ['yes', 'no', 'partial', 'hidden']

const CheckIcon = () => (
  <span className="check-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </span>
)

const XIcon = () => (
  <span className="x-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  </span>
)

const PartialIcon = () => (
  <span className="partial-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12h14"/>
    </svg>
  </span>
)

const HiddenIcon = () => (
  <span className="hidden-icon" style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(100, 100, 100, 0.15)',
    color: '#666',
  }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  </span>
)

const StatusIcon: React.FC<{ status: FeatureStatus }> = ({ status }) => {
  switch (status) {
    case 'yes': return <CheckIcon />
    case 'no': return <XIcon />
    case 'partial': return <PartialIcon />
    case 'hidden': return <HiddenIcon />
  }
}

export const FeatureComparison: React.FC = () => {
  const [features, setFeatures] = useState<Record<string, FeatureData>>(defaultFeatures)
  const [isDevMode, setIsDevMode] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Check if we're in dev mode (localhost)
  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    setIsDevMode(isDev)
  }, [])

  // Load settings from JSON
  useEffect(() => {
    fetch('/feature-comparison.json')
      .then(res => res.json())
      .then((data: FeatureSettings) => {
        if (data.features) {
          setFeatures(prev => ({ ...prev, ...data.features }))
        }
      })
      .catch(err => {
        console.log('Using default feature settings:', err)
      })
  }, [])

  const cycleStatus = (featureId: string, column: 'others' | 'cluso') => {
    if (!isDevMode) return

    setFeatures(prev => {
      const current = prev[featureId]?.[column] || 'no'
      const currentIndex = statusOrder.indexOf(current)
      const nextIndex = (currentIndex + 1) % statusOrder.length
      const nextStatus = statusOrder[nextIndex]

      return {
        ...prev,
        [featureId]: {
          ...prev[featureId],
          [column]: nextStatus,
        },
      }
    })
    setHasChanges(true)
  }

  const saveSettings = async () => {
    setSaveStatus('saving')
    const data: FeatureSettings = { features }

    try {
      // In dev mode, we'll copy to clipboard and show instructions
      // since we can't write directly to the file system from browser
      const json = JSON.stringify(data, null, 2)
      await navigator.clipboard.writeText(json)
      setSaveStatus('saved')
      setHasChanges(false)

      // Show alert with instructions
      alert('Settings copied to clipboard!\n\nPaste into:\nwebsite/public/feature-comparison.json')

      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const getFeatureData = (id: string): FeatureData => {
    return features[id] || { others: 'no', cluso: 'yes' }
  }

  // Filter out hidden rows for non-dev mode
  const visibleRows = featureRows.filter(row => {
    if (row.category === 'header') return true
    const data = getFeatureData(row.id)
    if (!isDevMode && (data.others === 'hidden' && data.cluso === 'hidden')) {
      return false
    }
    return true
  })

  return (
    <section className="comparison" id="comparison">
      <div className="comparison-container">
        <div className="section-header">
          <p className="section-label">Why Cluso?</p>
          <h2 className="section-title">Built different from the ground up</h2>
          <p className="section-subtitle">
            See how Cluso compares to other inspector tools
          </p>
        </div>

        {isDevMode && (
          <div style={{
            background: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid var(--accent)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🛠️</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Admin Mode</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Click icons to cycle: Yes → No → Partial → Hidden
              </span>
            </div>
            <button
              onClick={saveSettings}
              disabled={!hasChanges || saveStatus === 'saving'}
              style={{
                background: hasChanges ? 'var(--accent)' : 'var(--bg-card)',
                color: hasChanges ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {saveStatus === 'saving' ? 'Copying...' :
               saveStatus === 'saved' ? 'Copied!' :
               saveStatus === 'error' ? 'Error!' :
               hasChanges ? 'Copy Changes' : 'No Changes'}
            </button>
          </div>
        )}

        <table className="comparison-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th className="others-header">Others</th>
              <th className="cluso-header">Cluso</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              if (row.category === 'header') {
                return (
                  <tr key={row.id} className="category-row">
                    <td colSpan={3}>{row.label}</td>
                  </tr>
                )
              }

              const data = getFeatureData(row.id)
              const showOthers = isDevMode || data.others !== 'hidden'
              const showCluso = isDevMode || data.cluso !== 'hidden'

              return (
                <tr key={row.id} style={
                  (data.others === 'hidden' && data.cluso === 'hidden')
                    ? { opacity: 0.4, background: 'rgba(100, 100, 100, 0.1)' }
                    : undefined
                }>
                  <td>{row.label}</td>
                  <td
                    onClick={() => cycleStatus(row.id, 'others')}
                    style={isDevMode ? { cursor: 'pointer' } : undefined}
                    title={isDevMode ? `Click to change (current: ${data.others})` : undefined}
                  >
                    {showOthers && <StatusIcon status={data.others} />}
                  </td>
                  <td
                    onClick={() => cycleStatus(row.id, 'cluso')}
                    style={isDevMode ? { cursor: 'pointer' } : undefined}
                    title={isDevMode ? `Click to change (current: ${data.cluso})` : undefined}
                  >
                    {showCluso && <StatusIcon status={data.cluso} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
          * Some features may be Pro only. Final feature tiers TBD.
        </p>
      </div>
    </section>
  )
}

export default FeatureComparison
