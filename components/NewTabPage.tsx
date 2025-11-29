import React, { useState, useEffect } from 'react'
import { Folder, Clock, Settings, ChevronRight } from 'lucide-react'

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
  lastOpened?: Date
}

interface NewTabPageProps {
  onOpenProject: (path: string) => void
  onOpenUrl: (url: string) => void
  isDarkMode: boolean
  recentProjects?: RecentProject[]
}

export function NewTabPage({
  onOpenProject,
  onOpenUrl,
  isDarkMode,
  recentProjects = []
}: NewTabPageProps) {
  const [urlInput, setUrlInput] = useState('')

  // Mock recent projects if none provided
  const projects: RecentProject[] = recentProjects.length > 0 ? recentProjects : [
    { name: 'finwise', path: '~/inspector-dot-com' },
    { name: 'finwise-landing-page', path: '~/finwise-landing-page' },
    { name: 'app', path: '~/This,-But-Meme-Remix-App-codebase' },
    { name: 'barista', path: '~/barista' },
    { name: 'Soundly Audio', path: '~/Documents/Soundly' },
  ]

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

  return (
    <div className={`flex-1 flex flex-col items-center pt-20 px-8 ${
      isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-stone-900'
    }`}>
      {/* Logo and Title */}
      <div className="flex items-center gap-3 mb-2">
        <ClusoLogo className="w-12 h-12" />
        <h1 className="text-4xl font-semibold tracking-tight">Cluso</h1>
      </div>

      {/* Subtitle */}
      <div className={`text-sm mb-10 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
        <span className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'}>Pro</span>
        <span className="mx-2">·</span>
        <button className={`hover:underline ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
          Settings
        </button>
      </div>

      {/* Open Project Card */}
      <button
        onClick={() => {
          // TODO: Open folder picker dialog
          console.log('Open project picker')
        }}
        className={`
          w-64 p-6 rounded-xl border-2 border-dashed mb-12 text-left
          transition-colors group
          ${isDarkMode
            ? 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/50'
            : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
          }
        `}
      >
        <Folder
          size={24}
          className={`mb-3 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}
        />
        <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
          Open project
        </span>
      </button>

      {/* Recent Projects Section */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-sm font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
            Recent projects
          </h2>
          <button className={`text-sm ${isDarkMode ? 'text-neutral-500 hover:text-neutral-400' : 'text-stone-400 hover:text-stone-600'}`}>
            View all ({projects.length})
          </button>
        </div>

        {/* Project List */}
        <div className="space-y-1">
          {projects.map((project, index) => (
            <button
              key={index}
              onClick={() => onOpenProject(project.path)}
              className={`
                w-full flex items-center justify-between px-3 py-3 rounded-lg
                transition-colors text-left group
                ${isDarkMode
                  ? 'hover:bg-neutral-800'
                  : 'hover:bg-stone-50'
                }
              `}
            >
              <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                {project.name}
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
                {project.path}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick URL Input (hidden at bottom) */}
      <form onSubmit={handleUrlSubmit} className="mt-auto mb-8 w-full max-w-md">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL to inspect..."
          className={`
            w-full px-4 py-2 text-sm rounded-full border
            focus:outline-none focus:ring-2 focus:ring-blue-500/20
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
