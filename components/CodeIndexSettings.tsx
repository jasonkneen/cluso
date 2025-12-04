import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  RefreshCw,
  Trash2,
  Loader2,
  HardDrive,
  AlertCircle,
  FileCode2,
  FolderSearch,
  Database,
  CheckCircle,
  Clock,
  Play,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'

interface IndexStats {
  totalFiles: number
  totalChunks: number
  totalEmbeddings: number
  databaseSize: number
  lastIndexedAt: string | null
}

interface MgrepStatus {
  ready: boolean
  indexing: boolean
  stats: IndexStats | null
  projectPath: string | null
  error: string | null
}

interface SearchResult {
  filePath: string
  chunkIndex: number
  content: string
  similarity: number
  metadata: {
    startLine: number
    endLine: number
    language: string
    functionName?: string
  }
}

interface LogEntry {
  timestamp: Date
  type: 'info' | 'success' | 'error' | 'event'
  message: string
}

interface CodeIndexSettingsProps {
  isDarkMode: boolean
  projectPath?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function CodeIndexSettings({ isDarkMode, projectPath }: CodeIndexSettingsProps) {
  const [status, setStatus] = useState<MgrepStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Test search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)

  // Activity log state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-49), { timestamp: new Date(), type, message }])
  }

  // Load initial status
  useEffect(() => {
    loadStatus()
    addLog('info', 'Code Index settings loaded')

    // Subscribe to mgrep events
    const unsubEvent = window.electronAPI?.mgrep?.onEvent((event) => {
      console.log('[CodeIndexSettings] mgrep event:', event)

      // Log the event
      switch (event.type) {
        case 'ready':
          addLog('success', 'Index ready')
          break
        case 'indexing-start':
          addLog('info', `Indexing started (${event.totalFiles || 0} files)`)
          break
        case 'indexing-progress':
          addLog('info', `Indexing progress: ${event.filesProcessed}/${event.totalFiles} files`)
          break
        case 'indexing-complete':
          addLog('success', `Indexing complete: ${event.chunksIndexed || 0} chunks indexed`)
          break
        case 'error':
          addLog('error', `Error: ${event.error}`)
          break
        default:
          addLog('event', `Event: ${event.type}`)
      }

      if (event.type === 'ready' || event.type === 'indexing-complete') {
        loadStatus()
      }
    })

    return () => {
      unsubEvent?.()
    }
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const loadStatus = async () => {
    if (!window.electronAPI?.mgrep) {
      setError('Code Index is only available in the desktop app')
      setLoading(false)
      addLog('error', 'mgrep API not available')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI.mgrep.getStatus()
      if (result.success && result.status) {
        setStatus(result.status)
        if (result.status.error) {
          setError(result.status.error)
        }
        addLog('info', `Status: ${result.status.ready ? 'Ready' : 'Not initialized'}`)
      } else {
        setError(result.error || 'Failed to get status')
        addLog('error', result.error || 'Failed to get status')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load status'
      setError(msg)
      addLog('error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    if (!window.electronAPI?.mgrep || !projectPath) {
      addLog('error', 'Cannot initialize: no project path')
      return
    }

    try {
      setInitializing(true)
      setError(null)
      addLog('info', `Initializing index for: ${projectPath}`)

      const result = await window.electronAPI.mgrep.initialize(projectPath)
      if (result.success) {
        addLog('success', 'Index initialized successfully')
      } else {
        setError(result.error || 'Failed to initialize')
        addLog('error', result.error || 'Failed to initialize')
      }
      await loadStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize'
      setError(msg)
      addLog('error', msg)
    } finally {
      setInitializing(false)
    }
  }

  const handleClearIndex = async () => {
    if (!window.electronAPI?.mgrep) return

    try {
      setClearing(true)
      setError(null)
      addLog('info', 'Clearing index...')

      const result = await window.electronAPI.mgrep.clearIndex()
      if (result.success) {
        addLog('success', 'Index cleared')
        setSearchResults(null)
      } else {
        setError(result.error || 'Failed to clear index')
        addLog('error', result.error || 'Failed to clear')
      }
      await loadStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear index'
      setError(msg)
      addLog('error', msg)
    } finally {
      setClearing(false)
    }
  }

  const handleSearch = async () => {
    if (!window.electronAPI?.mgrep || !searchQuery.trim()) return

    try {
      setSearching(true)
      setSearchResults(null)
      addLog('info', `Searching for: "${searchQuery}"`)

      const result = await window.electronAPI.mgrep.search(searchQuery, { limit: 5 })
      if (result.success && result.results) {
        setSearchResults(result.results)
        addLog('success', `Found ${result.results.length} results`)
      } else {
        addLog('error', result.error || 'Search failed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      addLog('error', msg)
    } finally {
      setSearching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`animate-spin ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`} size={32} />
      </div>
    )
  }

  const isReady = status?.ready
  const isIndexing = status?.indexing
  const stats = status?.stats

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className={`p-4 rounded-xl border ${
        isIndexing
          ? isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
          : isReady
            ? isDarkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
            : isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-stone-50 border-stone-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isIndexing
                ? isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                : isReady
                  ? isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                  : isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'
            }`}>
              {isIndexing ? (
                <Loader2 size={20} className="text-blue-500 animate-spin" />
              ) : (
                <Search size={20} className={isReady ? 'text-green-500' : isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
              )}
            </div>
            <div>
              <h4 className={`font-medium ${
                isIndexing
                  ? 'text-blue-500'
                  : isReady
                    ? 'text-green-500'
                    : isDarkMode ? 'text-white' : 'text-stone-900'
              }`}>
                {isIndexing ? 'Indexing...' : isReady ? 'Ready' : 'Code Index'}
              </h4>
              <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                {!status?.projectPath
                  ? 'No project indexed'
                  : isIndexing
                    ? 'Building semantic search index...'
                    : isReady
                      ? `Indexed: ${status.projectPath}`
                      : 'Click Initialize to enable semantic search'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={loadStatus}
              disabled={initializing || isIndexing}
              className={`p-2 rounded-lg transition-colors ${
                initializing || isIndexing
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode
                    ? 'hover:bg-neutral-700 text-neutral-400'
                    : 'hover:bg-stone-200 text-stone-500'
              }`}
              title="Refresh status"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Initialize Button (when not ready) */}
      {!isReady && !isIndexing && projectPath && (
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            initializing
              ? 'opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {initializing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Play size={18} />
          )}
          {initializing ? 'Initializing...' : 'Initialize Index'}
        </button>
      )}

      {/* No project path warning */}
      {!projectPath && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-500" />
            <span className={`text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
              Open a project folder to enable code indexing
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Test Search (when ready) */}
      {isReady && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
          <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
            <Zap size={14} className="text-yellow-500" />
            Test Search
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your code semantically..."
              className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-600 text-white placeholder-neutral-500'
                  : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
              }`}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                searching || !searchQuery.trim()
                  ? 'opacity-50 cursor-not-allowed bg-neutral-700 text-neutral-400'
                  : isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>

          {/* Search Results */}
          {searchResults && searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-xs ${
                    isDarkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-white border border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {result.filePath.split('/').pop()}:{result.metadata.startLine}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      result.similarity > 0.7
                        ? 'bg-green-500/20 text-green-400'
                        : result.similarity > 0.5
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-neutral-500/20 text-neutral-400'
                    }`}>
                      {(result.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <pre className={`whitespace-pre-wrap font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                    {result.content.slice(0, 200)}{result.content.length > 200 ? '...' : ''}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {searchResults && searchResults.length === 0 && (
            <p className={`mt-3 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
              No results found
            </p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileCode2 size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>Files</span>
            </div>
            <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              {stats.totalFiles.toLocaleString()}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FolderSearch size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>Chunks</span>
            </div>
            <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              {stats.totalChunks.toLocaleString()}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>Size</span>
            </div>
            <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              {formatBytes(stats.databaseSize)}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>Updated</span>
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              {formatDate(stats.lastIndexedAt)}
            </p>
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className={`rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`w-full p-4 flex items-center justify-between ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}
        >
          <div className="flex items-center gap-2">
            <ScrollText size={16} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
            <span className="text-sm font-medium">Activity Log</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-500'}`}>
              {logs.length}
            </span>
          </div>
          {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showLogs && (
          <div
            ref={logContainerRef}
            className={`px-4 pb-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1 ${
              isDarkMode ? 'text-neutral-400' : 'text-stone-600'
            }`}
          >
            {logs.length === 0 ? (
              <p className="text-center py-4 opacity-50">No activity yet</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className={isDarkMode ? 'text-neutral-600' : 'text-stone-400'}>
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span className={
                    log.type === 'success' ? 'text-green-500' :
                    log.type === 'error' ? 'text-red-500' :
                    log.type === 'event' ? 'text-purple-400' :
                    isDarkMode ? 'text-neutral-300' : 'text-stone-700'
                  }>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isReady && (
        <div className="flex justify-between items-center">
          <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
            Index: .mgrep-local/ | Models: ~/.cache/mgrep-local/
          </div>
          <button
            onClick={handleClearIndex}
            disabled={clearing || isIndexing}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
              clearing || isIndexing
                ? 'opacity-50 cursor-not-allowed'
                : isDarkMode
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
            }`}
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Clear Index
          </button>
        </div>
      )}

      {/* Features List */}
      <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>Features</h4>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>Local embeddings (no API costs)</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>Real-time indexing on file changes</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>Code-aware chunking (functions, classes)</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>Hybrid search (semantic + keyword boost)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
