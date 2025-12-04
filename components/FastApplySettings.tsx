import React, { useState, useEffect } from 'react'
import {
  Zap,
  Download,
  Trash2,
  Check,
  Loader2,
  HardDrive,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

type ModelVariant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'F16'

interface ModelInfo {
  variant: ModelVariant
  file: string
  size: number
  quality: string
  memory: number
  description: string
  downloaded: boolean
  path?: string
}

interface FastApplyStatus {
  ready: boolean
  activeModel: ModelVariant | null
  modelLoaded: boolean
  downloadedModels: ModelVariant[]
  storageDir: string
}

interface DownloadProgress {
  variant: ModelVariant
  downloaded: number
  total: number
  percent: number
  speed: number
  eta: number
}

interface FastApplySettingsProps {
  isDarkMode: boolean
  isPro?: boolean // Whether user has Pro access
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

export function FastApplySettings({ isDarkMode, isPro = true }: FastApplySettingsProps) {
  const [status, setStatus] = useState<FastApplyStatus | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<ModelVariant | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [deleting, setDeleting] = useState<ModelVariant | null>(null)
  const [toggling, setToggling] = useState(false)

  // Load initial status and models
  useEffect(() => {
    loadData()

    // Subscribe to download progress events
    const unsubProgress = window.electronAPI?.fastApply?.onProgress((progress) => {
      setDownloadProgress(progress)
    })

    const unsubLoaded = window.electronAPI?.fastApply?.onModelLoaded(() => {
      loadData()
    })

    const unsubUnloaded = window.electronAPI?.fastApply?.onModelUnloaded(() => {
      loadData()
    })

    return () => {
      unsubProgress?.()
      unsubLoaded?.()
      unsubUnloaded?.()
    }
  }, [])

  const loadData = async () => {
    if (!window.electronAPI?.fastApply) {
      setError('Fast Apply is only available in the desktop app')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const [statusResult, modelsResult] = await Promise.all([
        window.electronAPI.fastApply.getStatus(),
        window.electronAPI.fastApply.listModels(),
      ])
      setStatus(statusResult)
      // Handle wrapped response from IPC handler
      // modelsResult can be { success: boolean, models: [...] } or just an array
      const modelsList = modelsResult?.models || (Array.isArray(modelsResult) ? modelsResult : [])
      setModels(modelsList)

      // Check for error in models response
      if (modelsResult && !modelsResult.success && modelsResult.error) {
        setError(modelsResult.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Fast Apply status')
      // Reset to safe defaults on error
      setModels([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (variant: ModelVariant) => {
    console.log('[FastApplySettings] handleDownload called for:', variant)

    // Guard against concurrent downloads
    if (downloading !== null) {
      console.log('[FastApplySettings] Already downloading, ignoring click')
      return
    }

    if (!window.electronAPI?.fastApply) {
      console.error('[FastApplySettings] fastApply API not available')
      setError('Fast Apply API not available')
      return
    }

    try {
      setDownloading(variant)
      setDownloadProgress(null)
      setError(null)

      console.log('[FastApplySettings] Calling download IPC...')
      const result = await window.electronAPI.fastApply.download(variant)
      console.log('[FastApplySettings] Download result:', result)

      if (!result.success) {
        console.error('[FastApplySettings] Download failed:', result.error)
        setError(result.error || 'Download failed')
      } else {
        console.log('[FastApplySettings] Download succeeded, path:', result.path)
      }
      await loadData()
    } catch (err) {
      console.error('[FastApplySettings] Download exception:', err)
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(null)
      setDownloadProgress(null)
    }
  }

  const handleCancel = async () => {
    if (!window.electronAPI?.fastApply) return
    await window.electronAPI.fastApply.cancel()
    setDownloading(null)
    setDownloadProgress(null)
  }

  const handleDelete = async (variant: ModelVariant) => {
    if (!window.electronAPI?.fastApply) return

    try {
      setDeleting(variant)
      const result = await window.electronAPI.fastApply.delete(variant)
      if (!result.success) {
        setError(result.error || 'Delete failed')
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const handleSetActive = async (variant: ModelVariant) => {
    if (!window.electronAPI?.fastApply) return

    try {
      setError(null)

      // Set the model as active (doesn't load it - use toggle for that)
      const result = await window.electronAPI.fastApply.setModel(variant)
      if (!result.success) {
        setError(result.error || 'Failed to set model')
        return
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set model')
    }
  }

  const handleUnload = async () => {
    if (!window.electronAPI?.fastApply) return

    try {
      await window.electronAPI.fastApply.unload()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unload model')
    }
  }

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-xl border ${
          isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
              <Zap size={24} className="text-yellow-500" />
            </div>
            <div>
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                Fast Apply - Pro Feature
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                Instant local code merging with AI
              </p>
            </div>
          </div>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
            Upgrade to Pro to unlock Fast Apply - a local AI model that merges code changes in ~500ms,
            completely offline after downloading. No API costs, complete privacy.
          </p>
          <button
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:from-yellow-600 hover:to-orange-600 transition-all"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`animate-spin ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`} size={32} />
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
        <div className="flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    )
  }

  const handleToggle = async () => {
    if (!window.electronAPI?.fastApply || toggling) return;

    setToggling(true);
    try {
      if (status?.ready) {
        // Turn off - unload the model
        await window.electronAPI.fastApply.unload();
      } else if (status?.activeModel) {
        // Turn on - load the model
        await window.electronAPI.fastApply.load();
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle Fast Apply');
    } finally {
      setToggling(false);
    }
  };

  const canToggle = status?.activeModel && !toggling;
  const isOn = status?.ready;

  // Check if currently downloading any model
  const isDownloadingAny = downloading !== null && downloadProgress !== null

  return (
    <div className="space-y-6">
      {/* Header with Toggle - shows Ready status or Download progress */}
      <div className={`p-4 rounded-xl border ${
        isDownloadingAny
          ? isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
          : isOn
            ? isDarkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
            : isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-stone-50 border-stone-200'
      }`}>
        {isDownloadingAny ? (
          /* Download progress view */
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                  <Download size={20} className="text-blue-500" />
                </div>
                <div>
                  <h4 className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                    Downloading {downloadProgress.variant}...
                  </h4>
                  <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDarkMode ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                Cancel
              </button>
            </div>
            <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-700' : 'bg-blue-200'}`}>
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-end mt-2">
              <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                {formatSpeed(downloadProgress.speed)} - {formatEta(downloadProgress.eta)} remaining
              </span>
            </div>
          </div>
        ) : (
          /* Normal status view */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                isOn
                  ? isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                  : isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'
              }`}>
                <Zap size={20} className={isOn ? 'text-green-500' : isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
              </div>
              <div>
                <h4 className={`font-medium ${isOn ? 'text-green-500' : isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                  {isOn ? 'Ready' : 'Fast Apply'}
                </h4>
                <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                  {!status?.activeModel
                    ? 'Download a model to enable'
                    : isOn
                      ? `${status.activeModel} loaded`
                      : `${status.activeModel} available`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle Switch */}
              <button
                onClick={handleToggle}
                disabled={!canToggle}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                  !canToggle
                    ? isDarkMode ? 'bg-neutral-700 cursor-not-allowed' : 'bg-stone-200 cursor-not-allowed'
                    : isOn
                      ? 'bg-green-500'
                      : isDarkMode ? 'bg-neutral-600 hover:bg-neutral-500' : 'bg-stone-300 hover:bg-stone-400'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 flex items-center justify-center ${
                    isOn ? 'left-[22px]' : 'left-0.5'
                  } ${
                    toggling
                      ? 'bg-white/80'
                      : 'bg-white shadow-sm'
                  }`}
                >
                  {toggling && <Loader2 size={12} className="animate-spin text-neutral-500" />}
                </div>
              </button>
              {/* Refresh button */}
              <button
                onClick={loadData}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'hover:bg-neutral-700 text-neutral-400'
                    : 'hover:bg-stone-200 text-stone-500'
                }`}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Models list */}
      <div>
        <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
          Available Models
        </h3>
        <div className="space-y-2">
          {(models || []).map((model) => {
            const isDownloading = downloading === model.variant && downloadProgress
            return (
              <div
                key={model.variant}
                className={`p-4 rounded-xl border transition-colors ${
                  isDownloading
                    ? isDarkMode ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-300 bg-blue-50'
                    : status?.activeModel === model.variant
                      ? isDarkMode ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50'
                      : isDarkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Show download progress instead of normal content when downloading */}
                {isDownloading ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                        Downloading {model.variant}...
                      </span>
                      <button
                        onClick={handleCancel}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                          isDarkMode ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-700' : 'bg-blue-200'}`}>
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                        {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
                      </span>
                      <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                        {formatSpeed(downloadProgress.speed)} - {formatEta(downloadProgress.eta)} remaining
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                          {model.variant}
                        </span>
                        {model.downloaded && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                          }`}>
                            Downloaded
                          </span>
                        )}
                        {status?.activeModel === model.variant && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                            Active
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                        {model.description}
                      </p>
                      <div className={`flex items-center gap-4 mt-2 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                        <span className="flex items-center gap-1">
                          <HardDrive size={12} />
                          {model.size} MB
                        </span>
                        <span>Quality: {model.quality}</span>
                        <span>RAM: ~{model.memory} MB</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {model.downloaded ? (
                        <>
                          {status?.activeModel !== model.variant && (
                            <button
                              onClick={() => handleSetActive(model.variant)}
                              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              Select
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(model.variant)}
                            disabled={deleting === model.variant}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode
                                ? 'hover:bg-red-500/20 text-neutral-400 hover:text-red-400'
                                : 'hover:bg-red-100 text-stone-400 hover:text-red-600'
                            } ${deleting === model.variant ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {deleting === model.variant ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDownload(model.variant)}
                          disabled={downloading !== null}
                          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            downloading !== null
                              ? 'opacity-50 cursor-not-allowed bg-neutral-800 text-neutral-500'
                              : isDarkMode
                                ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                          }`}
                        >
                          <Download size={14} />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Storage info */}
      {status?.storageDir && (
        <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
          <p>Models stored in: {status.storageDir}</p>
        </div>
      )}
    </div>
  )
}
