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
  Play,
  ScrollText,
  ChevronDown,
  ChevronUp,
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
  isActive?: boolean
}

interface ProjectStatus extends MgrepStatus {
  projectPath: string
  isActive: boolean
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Track indexing progress per project
interface IndexingProgress {
  phase: 'scanning' | 'indexing'
  current: number
  total: number
  currentFile?: string
}

export function CodeIndexSettings({ isDarkMode, projectPath }: CodeIndexSettingsProps) {
  // Multi-project state
  const [allProjects, setAllProjects] = useState<ProjectStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null) // projectPath being acted on

  // Indexing progress per project
  const [indexingProgress, setIndexingProgress] = useState<Record<string, IndexingProgress>>({})

  // Test search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchProject, setSearchProject] = useState<string>('') // Which project to search
  const [searchMode, setSearchMode] = useState<'both' | 'grep' | 'semantic'>('both')
  const [searching, setSearching] = useState(false)

  // Results for each search type
  const [semanticResults, setSemanticResults] = useState<SearchResult[] | null>(null)
  const [grepResults, setGrepResults] = useState<Array<{ file: string; line: number; content: string }> | null>(null)

  // Timing for comparison
  const [semanticTime, setSemanticTime] = useState<number | null>(null)
  const [grepTime, setGrepTime] = useState<number | null>(null)

  // Activity log state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-49), { timestamp: new Date(), type, message }])
  }

  // Load initial status and reload when projectPath changes
  useEffect(() => {
    loadStatus()
    addLog('info', 'Code Index settings loaded')

    // Subscribe to mgrep events
    const unsubEvent = window.electronAPI?.mgrep?.onEvent((event) => {
      console.log('[CodeIndexSettings] *** mgrep event received ***', event.type, event)
      const projName = event.projectPath ? event.projectPath.split('/').pop() : 'unknown'

      // Update progress state for live updates on card
      if (event.projectPath) {
        switch (event.type) {
          case 'scanning-start':
            setIndexingProgress(prev => ({
              ...prev,
              [event.projectPath!]: { phase: 'scanning', current: 0, total: 0 }
            }))
            break
          case 'scanning-complete':
            setIndexingProgress(prev => ({
              ...prev,
              [event.projectPath!]: { phase: 'scanning', current: event.filesFound || 0, total: event.filesFound || 0 }
            }))
            break
          case 'indexing-start':
            setIndexingProgress(prev => ({
              ...prev,
              [event.projectPath!]: { phase: 'indexing', current: 0, total: event.totalFiles || 0 }
            }))
            break
          case 'indexing-progress':
            setIndexingProgress(prev => ({
              ...prev,
              [event.projectPath!]: {
                phase: 'indexing',
                current: event.current || 0,
                total: event.total || 0,
                currentFile: event.currentFile
              }
            }))
            break
          case 'indexing-complete':
          case 'error':
            // Clear progress when done
            setIndexingProgress(prev => {
              const next = { ...prev }
              delete next[event.projectPath!]
              return next
            })
            break
        }
      }

      switch (event.type) {
        case 'ready':
          addLog('success', `[${projName}] Index ready`)
          break
        case 'scanning-start':
          addLog('info', `[${projName}] Scanning project files...`)
          break
        case 'scanning-complete':
          addLog('info', `[${projName}] Found ${event.filesFound || 0} files to index`)
          break
        case 'indexing-start':
          addLog('info', `[${projName}] Indexing started (${event.totalFiles || 0} files)`)
          break
        case 'indexing-progress':
          // Don't log every progress event to avoid spam
          break
        case 'indexing-complete':
          addLog('success', `[${projName}] Indexing complete: ${event.totalChunks || event.chunksIndexed || 0} chunks`)
          break
        case 'file-indexed':
          // Don't log every file to avoid spam
          break
        case 'stats-updated':
          addLog('success', `[${projName}] Stats updated: ${event.stats?.totalFiles || 0} files, ${event.stats?.totalChunks || 0} chunks`)
          break
        case 'error':
          addLog('error', `[${projName}] Error: ${event.error}`)
          break
        default:
          addLog('event', `[${projName}] ${event.type}`)
      }

      if (['ready', 'indexing-complete', 'indexing-start', 'scanning-complete', 'stats-updated'].includes(event.type)) {
        loadStatus()
      }
    })

    return () => {
      unsubEvent?.()
    }
  }, [projectPath])

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  // Set default search project when projects load
  useEffect(() => {
    if (allProjects.length > 0 && !searchProject) {
      const ready = allProjects.find(p => p.ready)
      if (ready) {
        setSearchProject(ready.projectPath)
      }
    }
  }, [allProjects, searchProject])

  const loadStatus = async () => {
    if (!window.electronAPI?.mgrep) {
      setError('Code Index is only available in the desktop app')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const allResult = await window.electronAPI.mgrep.getAllProjectsStatus()
      if (allResult.success && allResult.projects) {
        setAllProjects(allResult.projects)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load status'
      setError(msg)
      addLog('error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async (targetPath: string) => {
    if (!window.electronAPI?.mgrep) return

    try {
      setActionInProgress(targetPath)
      setError(null)
      addLog('info', `Initializing index for: ${targetPath.split('/').pop()}`)

      const result = await window.electronAPI.mgrep.initialize(targetPath)
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
      setActionInProgress(null)
    }
  }

  const handleClearIndex = async (targetPath: string) => {
    if (!window.electronAPI?.mgrep) return

    try {
      setActionInProgress(targetPath)
      setError(null)
      addLog('info', `Clearing index for: ${targetPath.split('/').pop()}`)

      const result = await window.electronAPI.mgrep.clearIndex(targetPath)
      if (result.success) {
        addLog('success', 'Index cleared')
        setSemanticResults(null)
        setGrepResults(null)
        setSemanticTime(null)
        setGrepTime(null)
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
      setActionInProgress(null)
    }
  }

  const handleResync = async (targetPath: string) => {
    if (!window.electronAPI?.mgrep) return

    try {
      setActionInProgress(targetPath)
      setError(null)
      addLog('info', `Re-syncing index for: ${targetPath.split('/').pop()}`)

      // Fire and forget - progress events will update the UI
      window.electronAPI.mgrep.resync(targetPath).then(result => {
        if (!result.success) {
          addLog('error', result.error || 'Resync failed')
        }
        loadStatus()
      }).catch(err => {
        addLog('error', err instanceof Error ? err.message : 'Resync failed')
      })

      // Don't wait - let progress events update UI
      setActionInProgress(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resync'
      setError(msg)
      addLog('error', msg)
      setActionInProgress(null)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !searchProject) return

    try {
      setSearching(true)
      setSemanticResults(null)
      setGrepResults(null)
      setSemanticTime(null)
      setGrepTime(null)

      const projName = searchProject.split('/').pop()
      addLog('info', `Searching "${searchQuery}" in ${projName} (${searchMode})`)

      // Run searches based on mode
      if (searchMode === 'both') {
        // Parallel search with timing
        const [semanticResult, grepResult] = await Promise.all([
          (async () => {
            if (!window.electronAPI?.mgrep) return null
            const start = performance.now()
            try {
              const result = await window.electronAPI.mgrep.search(searchQuery, { limit: 5, projectPath: searchProject })
              const time = performance.now() - start
              setSemanticTime(time)
              if (result.success && result.results) {
                setSemanticResults(result.results)
                return { success: true, count: result.results.length, time }
              }
              return { success: false, error: result.error }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : 'Failed' }
            }
          })(),
          (async () => {
            if (!window.electronAPI?.files?.searchInFiles) return null
            const start = performance.now()
            try {
              const result = await window.electronAPI.files.searchInFiles(searchQuery, searchProject, { maxResults: 5 })
              const time = performance.now() - start
              setGrepTime(time)
              if (result.success && result.data) {
                setGrepResults(result.data)
                return { success: true, count: result.data.length, time }
              }
              return { success: false, error: result.error }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : 'Failed' }
            }
          })(),
        ])

        if (semanticResult?.success && grepResult?.success) {
          const speedup = (grepResult.time / semanticResult.time).toFixed(2)
          addLog('success', `Semantic: ${semanticResult.count} results (${semanticResult.time.toFixed(0)}ms) | Grep: ${grepResult.count} results (${grepResult.time.toFixed(0)}ms) | ${speedup}x`)
        }
      } else if (searchMode === 'semantic') {
        // Semantic search only
        if (!window.electronAPI?.mgrep) return
        const start = performance.now()
        const result = await window.electronAPI.mgrep.search(searchQuery, { limit: 5, projectPath: searchProject })
        const time = performance.now() - start
        setSemanticTime(time)

        if (result.success && result.results) {
          setSemanticResults(result.results)
          addLog('success', `Found ${result.results.length} semantic results (${time.toFixed(0)}ms)`)
        } else {
          addLog('error', result.error || 'Search failed')
        }
      } else if (searchMode === 'grep') {
        // Grep search only
        if (!window.electronAPI?.files?.searchInFiles) return
        const start = performance.now()
        const result = await window.electronAPI.files.searchInFiles(searchQuery, searchProject, { maxResults: 5 })
        const time = performance.now() - start
        setGrepTime(time)

        if (result.success && result.data) {
          setGrepResults(result.data)
          addLog('success', `Found ${result.data.length} grep results (${time.toFixed(0)}ms)`)
        } else {
          addLog('error', result.error || 'Search failed')
        }
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

  const readyProjects = allProjects.filter(p => p.ready)
  const hasCurrentProject = projectPath && !allProjects.find(p => p.projectPath === projectPath)

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Search Section */}
      {readyProjects.length > 0 && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
          <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
            <Search size={14} className="text-blue-500" />
            Test Search
          </h4>

          {/* Search Mode Tabs */}
          <div className="flex gap-2 mb-3">
            {['both', 'semantic', 'grep'].map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode as typeof searchMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  searchMode === mode
                    ? 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                }`}
              >
                {mode === 'both' ? 'Both' : mode === 'semantic' ? 'Cluso (AI)' : 'Grep'}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-2">
            {/* Project selector */}
            <select
              value={searchProject}
              onChange={(e) => setSearchProject(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-600 text-white'
                  : 'bg-white border-stone-300 text-stone-900'
              }`}
            >
              {readyProjects.map((proj) => (
                <option key={proj.projectPath} value={proj.projectPath}>
                  {proj.projectPath.split('/').pop()}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchMode === 'grep' ? 'Search with grep...' : 'Search by meaning...'}
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
          {searchMode === 'both' && (semanticResults || grepResults) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* Semantic Results Column */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    Cluso (AI Semantic)
                  </span>
                  {semanticTime && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                      {semanticTime.toFixed(0)}ms
                    </span>
                  )}
                </div>
                {semanticResults && semanticResults.length > 0 ? (
                  <div className="space-y-2">
                    {semanticResults.map((result, i) => (
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
                          {result.content.slice(0, 150)}{result.content.length > 150 ? '...' : ''}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                    No semantic results
                  </p>
                )}
              </div>

              {/* Grep Results Column */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    Grep (Keyword)
                  </span>
                  {grepTime && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                      {grepTime.toFixed(0)}ms
                    </span>
                  )}
                </div>
                {grepResults && grepResults.length > 0 ? (
                  <div className="space-y-2">
                    {grepResults.map((result, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg text-xs ${
                          isDarkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-white border border-stone-200'
                        }`}
                      >
                        <div className="mb-1">
                          <span className={`font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            {result.file.split('/').pop()}:{result.line}
                          </span>
                        </div>
                        <pre className={`whitespace-pre-wrap font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                          {result.content.slice(0, 150)}{result.content.length > 150 ? '...' : ''}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                    No grep results
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Single column results for semantic-only mode */}
          {searchMode === 'semantic' && semanticResults && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Cluso (AI Semantic) - {semanticResults.length} results
                </span>
                {semanticTime && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                    {semanticTime.toFixed(0)}ms
                  </span>
                )}
              </div>
              {semanticResults.length > 0 ? (
                <div className="space-y-2">
                  {semanticResults.map((result, i) => (
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
              ) : (
                <p className={`text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                  No results found
                </p>
              )}
            </div>
          )}

          {/* Single column results for grep-only mode */}
          {searchMode === 'grep' && grepResults && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  Grep (Keyword) - {grepResults.length} results
                </span>
                {grepTime && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                    {grepTime.toFixed(0)}ms
                  </span>
                )}
              </div>
              {grepResults.length > 0 ? (
                <div className="space-y-2">
                  {grepResults.map((result, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-xs ${
                        isDarkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-white border border-stone-200'
                      }`}
                    >
                      <div className="mb-1">
                        <span className={`font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {result.file.split('/').pop()}:{result.line}
                        </span>
                      </div>
                      <pre className={`whitespace-pre-wrap font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                        {result.content.slice(0, 200)}{result.content.length > 200 ? '...' : ''}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                  No results found
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current Project (if not indexed) */}
      {hasCurrentProject && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full bg-neutral-500`} />
              <div>
                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                  {projectPath?.split('/').pop()}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    current
                  </span>
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                  Not indexed
                </div>
              </div>
            </div>
            <button
              onClick={() => handleInitialize(projectPath!)}
              disabled={actionInProgress === projectPath}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                actionInProgress === projectPath
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
              }`}
            >
              {actionInProgress === projectPath ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              Initialize
            </button>
          </div>
        </div>
      )}

      {/* Indexed Projects */}
      {allProjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Indexed Projects
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-500'}`}>
                {allProjects.length}
              </span>
            </div>
            <button
              onClick={loadStatus}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'
              }`}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {allProjects.map((proj) => {
            const projName = proj.projectPath.split('/').pop() || proj.projectPath
            const isCurrentProject = proj.projectPath === projectPath
            const isActing = actionInProgress === proj.projectPath
            const progress = indexingProgress[proj.projectPath]
            const hasProgress = !!progress

            return (
              <div
                key={proj.projectPath}
                className={`p-4 rounded-xl border ${
                  isCurrentProject
                    ? isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                    : isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      hasProgress || proj.indexing
                        ? 'bg-blue-500 animate-pulse'
                        : proj.ready
                          ? 'bg-green-500'
                          : 'bg-neutral-500'
                    }`} />
                    <div>
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                        {projName}
                        {isCurrentProject && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                          }`}>
                            current
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                        {hasProgress
                          ? progress.phase === 'scanning'
                            ? `Scanning... ${progress.total > 0 ? `${progress.total} files found` : ''}`
                            : `Indexing ${progress.current}/${progress.total} files`
                          : proj.indexing
                            ? 'Indexing...'
                            : proj.ready
                              ? 'Ready'
                              : proj.error || 'Not initialized'}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {(hasProgress || proj.indexing) && (
                      <Loader2 size={14} className="text-blue-500 animate-spin" />
                    )}
                    {!proj.ready && !proj.indexing && (
                      <button
                        onClick={() => handleInitialize(proj.projectPath)}
                        disabled={isActing}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          isActing
                            ? 'opacity-50 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                        }`}
                      >
                        {isActing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Initialize
                      </button>
                    )}
                    {proj.ready && (
                      <>
                        <button
                          onClick={() => handleResync(proj.projectPath)}
                          disabled={isActing || proj.indexing || hasProgress}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            isActing || proj.indexing || hasProgress
                              ? 'opacity-50 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                          }`}
                        >
                          <RefreshCw size={12} />
                          Resync
                        </button>
                        <button
                          onClick={() => handleClearIndex(proj.projectPath)}
                          disabled={isActing || proj.indexing || hasProgress}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            isActing || proj.indexing || hasProgress
                              ? 'opacity-50 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          <Trash2 size={12} />
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress indicator */}
                {hasProgress && (
                  <div className="mb-3">
                    {progress.phase === 'scanning' ? (
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 flex-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`}>
                          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" style={{ width: '100%' }} />
                        </div>
                        <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                          Scanning{progress.total > 0 ? ` (${progress.total} files)` : '...'}
                        </span>
                      </div>
                    ) : progress.total > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {progress.currentFile?.split('/').pop() || 'Processing...'}
                          </span>
                          <span className={`text-xs font-mono ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                            {Math.round((progress.current / progress.total) * 100)}%
                          </span>
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`}>
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Loader2 size={12} className="text-blue-500 animate-spin" />
                        <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                          Preparing...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats (inline) */}
                {proj.stats && !hasProgress && (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <FileCode2 size={12} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                      <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-600'}>
                        {proj.stats.totalFiles.toLocaleString()} files
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FolderSearch size={12} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                      <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-600'}>
                        {proj.stats.totalChunks.toLocaleString()} chunks
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Database size={12} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
                      <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-600'}>
                        {formatBytes(proj.stats.databaseSize)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* No projects */}
      {allProjects.length === 0 && !hasCurrentProject && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-500" />
            <span className={`text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
              Open a project folder to enable code indexing
            </span>
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
