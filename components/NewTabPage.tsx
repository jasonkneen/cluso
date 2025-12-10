import React, { useState, useEffect, useCallback } from 'react'
import { Folder, Clock, X, Plus, Pencil, Check, Server } from 'lucide-react'
import { debugLog } from '../utils/debug'
import { apiClient } from '../services/apiClient'

// Check if running in Electron mode
const isElectronMode = () => typeof window !== 'undefined' && window.electronAPI?.isElectron === true

// Check if running in web mode (not Electron)
const isWebMode = () => typeof window !== 'undefined' && !isElectronMode()

// API URL for web mode
const getApiUrl = () => {
  // In web mode, the API is at the same origin as the page
  return window.location.origin
}

// Cluso logo SVG component
function ClusoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
    >
      {/* Magnifying glass circle */}
      <circle
        cx="42"
        cy="42"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
      {/* Handle */}
      <line
        x1="64"
        y1="64"
        x2="90"
        y2="90"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Eye in the glass */}
      <circle cx="42" cy="42" r="12" fill="currentColor" />
      <circle cx="47" cy="38" r="4" fill="white" />
    </svg>
  )
}

export interface RecentProject {
  name: string
  path: string
  port?: number // dev server port
  lastOpened: number // timestamp
}

const STORAGE_KEY = 'cluso-recent-projects'
const MAX_RECENT_PROJECTS = 10

// Helper to load recent projects from localStorage
function loadRecentProjects(): RecentProject[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    debugLog.general.error('Failed to load recent projects:', e)
  }
  return []
}

// Helper to save recent projects to localStorage
function saveRecentProjects(projects: RecentProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch (e) {
    debugLog.general.error('Failed to save recent projects:', e)
  }
}

// Add or update a project in the recent list
export function addToRecentProjects(name: string, path: string, port?: number): void {
  const projects = loadRecentProjects()
  // Get existing port if updating
  const existing = projects.find(p => p.path === path)
  // Remove if already exists
  const filtered = projects.filter(p => p.path !== path)
  // Add to front with updated timestamp, preserve port if not provided
  const updated = [
    { name, path, port: port ?? existing?.port, lastOpened: Date.now() },
    ...filtered
  ].slice(0, MAX_RECENT_PROJECTS)
  saveRecentProjects(updated)
}

// Get a recent project by path
export function getRecentProject(path: string): RecentProject | undefined {
  return loadRecentProjects().find(p => p.path === path)
}

// Remove a project from recent list
export function removeFromRecentProjects(path: string): void {
  const projects = loadRecentProjects()
  const filtered = projects.filter(p => p.path !== path)
  saveRecentProjects(filtered)
}

// Update a project in the recent list
export function updateRecentProject(originalPath: string, updates: Partial<RecentProject>): void {
  const projects = loadRecentProjects()
  const updated = projects.map(p =>
    p.path === originalPath ? { ...p, ...updates, lastOpened: Date.now() } : p
  )
  saveRecentProjects(updated)
}

interface NewTabPageProps {
  onOpenProject: (path: string, name: string) => void
  onOpenUrl: (url: string) => void
  isDarkMode: boolean
  lockedProjectPath?: string | null  // If set, this window is locked to this project
}

// Declare electronAPI type
declare global {
  interface Window {
    electronAPI?: {
      dialog: {
        openFolder: () => Promise<{ success: boolean; canceled?: boolean; data?: { path: string; name: string } }>
      }
      window: {
        openProject: (path: string, name: string) => Promise<{ success: boolean; action: string; windowId: number; alreadyOpen: boolean }>
        isProjectOpen: (path: string) => Promise<{ isOpen: boolean; windowId: number | null }>
        focus: (windowId: number) => Promise<{ success: boolean }>
      }
    }
  }
}

export function NewTabPage({
  onOpenProject,
  onOpenUrl,
  isDarkMode,
  lockedProjectPath
}: NewTabPageProps) {
  const [urlInput, setUrlInput] = useState('')
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [editingProject, setEditingProject] = useState<string | null>(null) // path of project being edited
  const [editForm, setEditForm] = useState<{ name: string; path: string; port: string }>({ name: '', path: '', port: '' })
  const [serverProject, setServerProject] = useState<{ cwd: string; name: string } | null>(null)
  const [webModeLoading, setWebModeLoading] = useState(false)

  // In web mode, fetch the current project from the server
  const fetchServerProject = useCallback(async () => {
    if (!isWebMode()) return

    setWebModeLoading(true)
    try {
      const result = await apiClient.get('/api/files/cwd')
      if (result.success && result.data) {
        setServerProject(result.data)
        debugLog.general.log('[WebMode] Server project:', result.data)
      }
    } catch (err) {
      debugLog.general.error('[WebMode] Failed to fetch server project:', err)
    } finally {
      setWebModeLoading(false)
    }
  }, [])

  // Helper to open project - handles multi-window logic
  const openProjectInWindow = async (path: string, name: string) => {
    // If this window is already locked to a project
    if (lockedProjectPath) {
      if (lockedProjectPath === path) {
        // Same project - just open it in this window
        onOpenProject(path, name)
        return
      }
      // Different project - must open in new window
      if (window.electronAPI?.window) {
        const result = await window.electronAPI.window.openProject(path, name)
        debugLog.general.log('Opened project in window:', result)
        // Don't call onOpenProject since it's in a different window
        return
      }
    }

    // This window is not locked yet - check if project is open elsewhere
    if (window.electronAPI?.window) {
      const { isOpen, windowId } = await window.electronAPI.window.isProjectOpen(path)
      if (isOpen && windowId !== null) {
        // Project is open in another window - focus it
        await window.electronAPI.window.focus(windowId)
        debugLog.general.log('Focused existing window for project:', path)
        return
      }
    }

    // Open project in this window (will lock it)
    onOpenProject(path, name)
  }

  // Load recent projects on mount and fetch server project in web mode
  useEffect(() => {
    setRecentProjects(loadRecentProjects())
    fetchServerProject()
  }, [fetchServerProject])

  const handleOpenFolder = async () => {
    if (window.electronAPI?.dialog) {
      const result = await window.electronAPI.dialog.openFolder()
      if (result.success && result.data) {
        const { path, name } = result.data
        addToRecentProjects(name, path)
        setRecentProjects(loadRecentProjects())
        await openProjectInWindow(path, name)
      }
    } else {
      debugLog.general.warn('Folder picker not available (not in Electron)')
    }
  }

  const handleProjectClick = async (project: RecentProject) => {
    addToRecentProjects(project.name, project.path)
    setRecentProjects(loadRecentProjects())
    await openProjectInWindow(project.path, project.name)
  }

  const handleRemoveProject = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    removeFromRecentProjects(path)
    setRecentProjects(loadRecentProjects())
  }

  const handleEditProject = (e: React.MouseEvent, project: RecentProject) => {
    e.stopPropagation()
    setEditingProject(project.path)
    setEditForm({
      name: project.name,
      path: project.path,
      port: project.port?.toString() || ''
    })
  }

  const handleSaveEdit = (e: React.MouseEvent, originalPath: string) => {
    e.stopPropagation()
    const portNum = editForm.port ? parseInt(editForm.port) : undefined
    updateRecentProject(originalPath, {
      name: editForm.name,
      path: editForm.path,
      port: portNum
    })
    setRecentProjects(loadRecentProjects())
    setEditingProject(null)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(null)
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (urlInput.trim()) {
      let url = urlInput.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url
      }
      onOpenUrl(url)
    }
  }

  const formatPath = (path: string) => {
    // Shorten home directory paths
    const home = process.env.HOME || process.env.USERPROFILE || ''
    if (path.startsWith(home)) {
      return '~' + path.slice(home.length)
    }
    return path
  }

  const formatLastOpened = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className={`flex-1 flex flex-col items-center pt-16 px-8 min-h-full ${
      isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-stone-900'
    }`}>
      {/* Logo and Title */}
      <div className="flex items-center gap-3 mb-2">
        <ClusoLogo className="w-12 h-12" />
        <h1 className="text-4xl font-semibold tracking-tight">Cluso</h1>
      </div>

      {/* Subtitle */}
      <p className={`text-sm mb-4 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
        AI-Powered Browser Dev Tools
      </p>

      {/* Locked Project Indicator */}
      {lockedProjectPath && (
        <div className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs
          ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}
        `}>
          <Folder size={12} />
          <span>Window locked to: {formatPath(lockedProjectPath)}</span>
        </div>
      )}

      {/* Web Mode: Server Project Card */}
      {isWebMode() && serverProject && (
        <button
          onClick={() => onOpenProject(serverProject.cwd, serverProject.name)}
          className={`
            w-72 p-6 rounded-xl border-2 mb-6 text-left
            transition-all duration-200 group
            ${isDarkMode
              ? 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20'
              : 'border-green-500/50 bg-green-50 hover:bg-green-100'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}
            `}>
              <Server
                size={20}
                className={`${isDarkMode ? 'text-green-400' : 'text-green-600'}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`block text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                {serverProject.name}
              </span>
              <span className={`block text-xs truncate ${isDarkMode ? 'text-green-400/60' : 'text-green-600/60'}`}>
                {formatPath(serverProject.cwd)}
              </span>
            </div>
          </div>
          <div className={`mt-3 text-xs ${isDarkMode ? 'text-green-400/80' : 'text-green-600/80'}`}>
            Click to open server project
          </div>
        </button>
      )}

      {/* Web Mode: Loading */}
      {isWebMode() && webModeLoading && (
        <div className={`w-72 p-6 rounded-xl border-2 border-dashed mb-6 text-center ${
          isDarkMode ? 'border-neutral-700 text-neutral-500' : 'border-stone-200 text-stone-400'
        }`}>
          Loading server project...
        </div>
      )}

      {/* Open Project Card - In Electron mode this opens folder picker, in web mode shows info */}
      <button
        onClick={isElectronMode() ? handleOpenFolder : undefined}
        disabled={!isElectronMode()}
        className={`
          w-72 p-6 rounded-xl border-2 border-dashed mb-10 text-left
          transition-all duration-200 group
          ${!isElectronMode()
            ? (isDarkMode ? 'border-neutral-800 opacity-50' : 'border-stone-200 opacity-50')
            : (isDarkMode
              ? 'border-neutral-700 hover:border-blue-500/50 hover:bg-blue-500/5'
              : 'border-stone-200 hover:border-blue-500/50 hover:bg-blue-50/50'
            )
          }
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            transition-colors
            ${isDarkMode
              ? 'bg-neutral-800 group-hover:bg-blue-500/20'
              : 'bg-stone-100 group-hover:bg-blue-100'
            }
          `}>
            <Plus
              size={20}
              className={`${isDarkMode ? 'text-neutral-400 group-hover:text-blue-400' : 'text-stone-500 group-hover:text-blue-600'}`}
            />
          </div>
          <div>
            <span className={`block text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
              {lockedProjectPath ? 'Open Project in New Window' : 'Open Project'}
            </span>
            <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              {!isElectronMode()
                ? 'Use cluso CLI with --cwd to open a project'
                : (lockedProjectPath ? 'Opens in separate window' : 'Select a local folder')
              }
            </span>
          </div>
        </div>
      </button>

      {/* Recent Projects Section */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'} />
            <h2 className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              Recent Projects
            </h2>
          </div>

          {/* Project List */}
          <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-neutral-800' : 'border-stone-200'}`}>
            {recentProjects.map((project, index) => (
              <div
                key={project.path}
                className={`
                  w-full px-4 py-3
                  transition-colors text-left
                  ${index !== recentProjects.length - 1 ? (isDarkMode ? 'border-b border-neutral-800' : 'border-b border-stone-100') : ''}
                  ${editingProject === project.path ? '' : 'cursor-pointer group'}
                  ${isDarkMode
                    ? 'hover:bg-neutral-800/50'
                    : 'hover:bg-stone-50'
                  }
                `}
                onClick={editingProject === project.path ? undefined : () => handleProjectClick(project)}
              >
                {editingProject === project.path ? (
                  /* Edit Mode */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Project name"
                        className={`flex-1 px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-white border-stone-200 text-stone-800'}`}
                      />
                      <input
                        type="number"
                        value={editForm.port}
                        onChange={(e) => setEditForm(f => ({ ...f, port: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Port"
                        className={`w-20 px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-white border-stone-200 text-stone-800'}`}
                      />
                    </div>
                    <input
                      type="text"
                      value={editForm.path}
                      onChange={(e) => setEditForm(f => ({ ...f, path: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Path"
                      className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-white border-stone-200 text-stone-800'}`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => handleSaveEdit(e, project.path)}
                        className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                      >
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Folder
                        size={18}
                        className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'}
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium truncate ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                          {project.name}
                        </span>
                        <span className={`block text-xs truncate ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
                          {formatPath(project.path)}
                          {project.port && <span className="ml-2 text-blue-500">:{project.port}</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
                        {formatLastOpened(project.lastOpened)}
                      </span>
                      <button
                        onClick={(e) => handleEditProject(e, project)}
                        className={`
                          opacity-0 group-hover:opacity-100 p-1 rounded
                          transition-opacity
                          ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-200'}
                        `}
                      >
                        <Pencil size={14} className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveProject(e, project.path)}
                        className={`
                          opacity-0 group-hover:opacity-100 p-1 rounded
                          transition-opacity
                          ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-200'}
                        `}
                      >
                        <X size={14} className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentProjects.length === 0 && (
        <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
          <Folder size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No recent projects</p>
          <p className="text-xs mt-1">Open a folder to get started</p>
        </div>
      )}

      {/* Quick URL Input */}
      <form onSubmit={handleUrlSubmit} className="mt-auto mb-8 w-full max-w-md pt-8">
        <div className={`text-xs text-center mb-2 ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
          Or enter a URL to inspect
        </div>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com"
          className={`
            w-full px-4 py-2.5 text-sm rounded-lg border
            focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50
            ${isDarkMode
              ? 'bg-neutral-800 border-neutral-700 text-neutral-200 placeholder-neutral-500'
              : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
            }
          `}
        />
      </form>
    </div>
  )
}
