import React, { useState, useEffect } from 'react'
import { Folder, Clock, X, Plus } from 'lucide-react'

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
    console.error('Failed to load recent projects:', e)
  }
  return []
}

// Helper to save recent projects to localStorage
function saveRecentProjects(projects: RecentProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch (e) {
    console.error('Failed to save recent projects:', e)
  }
}

// Add or update a project in the recent list
export function addToRecentProjects(name: string, path: string): void {
  const projects = loadRecentProjects()
  // Remove if already exists
  const filtered = projects.filter(p => p.path !== path)
  // Add to front with updated timestamp
  const updated = [
    { name, path, lastOpened: Date.now() },
    ...filtered
  ].slice(0, MAX_RECENT_PROJECTS)
  saveRecentProjects(updated)
}

// Remove a project from recent list
export function removeFromRecentProjects(path: string): void {
  const projects = loadRecentProjects()
  const filtered = projects.filter(p => p.path !== path)
  saveRecentProjects(filtered)
}

interface NewTabPageProps {
  onOpenProject: (path: string, name: string) => void
  onOpenUrl: (url: string) => void
  isDarkMode: boolean
}

// Declare electronAPI type
declare global {
  interface Window {
    electronAPI?: {
      dialog: {
        openFolder: () => Promise<{ success: boolean; canceled?: boolean; data?: { path: string; name: string } }>
      }
    }
  }
}

export function NewTabPage({
  onOpenProject,
  onOpenUrl,
  isDarkMode
}: NewTabPageProps) {
  const [urlInput, setUrlInput] = useState('')
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])

  // Load recent projects on mount
  useEffect(() => {
    setRecentProjects(loadRecentProjects())
  }, [])

  const handleOpenFolder = async () => {
    if (window.electronAPI?.dialog) {
      const result = await window.electronAPI.dialog.openFolder()
      if (result.success && result.data) {
        const { path, name } = result.data
        addToRecentProjects(name, path)
        setRecentProjects(loadRecentProjects())
        onOpenProject(path, name)
      }
    } else {
      console.warn('Folder picker not available (not in Electron)')
    }
  }

  const handleProjectClick = (project: RecentProject) => {
    addToRecentProjects(project.name, project.path)
    setRecentProjects(loadRecentProjects())
    onOpenProject(project.path, project.name)
  }

  const handleRemoveProject = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    removeFromRecentProjects(path)
    setRecentProjects(loadRecentProjects())
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
      <p className={`text-sm mb-10 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
        AI-Powered Browser Dev Tools
      </p>

      {/* Open Project Card */}
      <button
        onClick={handleOpenFolder}
        className={`
          w-72 p-6 rounded-xl border-2 border-dashed mb-10 text-left
          transition-all duration-200 group
          ${isDarkMode
            ? 'border-neutral-700 hover:border-blue-500/50 hover:bg-blue-500/5'
            : 'border-stone-200 hover:border-blue-500/50 hover:bg-blue-50/50'
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
              Open Project
            </span>
            <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
              Select a local folder
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
              <button
                key={project.path}
                onClick={() => handleProjectClick(project)}
                className={`
                  w-full flex items-center justify-between px-4 py-3
                  transition-colors text-left group
                  ${index !== recentProjects.length - 1 ? (isDarkMode ? 'border-b border-neutral-800' : 'border-b border-stone-100') : ''}
                  ${isDarkMode
                    ? 'hover:bg-neutral-800/50'
                    : 'hover:bg-stone-50'
                  }
                `}
              >
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
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
                    {formatLastOpened(project.lastOpened)}
                  </span>
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
              </button>
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
