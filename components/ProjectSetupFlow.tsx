import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2, XCircle, Play, Folder, Package, Terminal, Globe, ChevronRight, AlertCircle } from 'lucide-react'

interface SetupStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  message?: string
  detail?: string
}

interface ProjectInfo {
  name: string
  path: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  framework?: string
  devCommand?: string
  port?: number
  hasNodeModules?: boolean
}

interface ProjectSetupFlowProps {
  projectPath: string
  projectName: string
  isDarkMode: boolean
  onComplete: (url: string) => void
  onCancel: () => void
}

// Declare electronAPI types
declare global {
  interface Window {
    electronAPI?: {
      files: {
        readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>
        listDirectory: (path: string) => Promise<{ success: boolean; data?: Array<{ name: string; path: string; isDirectory: boolean }>; error?: string }>
      }
    }
  }
}

export function ProjectSetupFlow({
  projectPath,
  projectName,
  isDarkMode,
  onComplete,
  onCancel
}: ProjectSetupFlowProps) {
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: 'scan', label: 'Scanning project folder', status: 'pending' },
    { id: 'package', label: 'Reading package.json', status: 'pending' },
    { id: 'deps', label: 'Checking dependencies', status: 'pending' },
    { id: 'scripts', label: 'Finding dev command', status: 'pending' },
    { id: 'port', label: 'Detecting port', status: 'pending' },
  ])
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: projectName, path: projectPath })
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)

  const updateStep = useCallback((id: string, update: Partial<SetupStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...update } : step
    ))
  }, [])

  const runSetup = useCallback(async () => {
    const api = window.electronAPI?.files
    if (!api) {
      setError('File system access not available')
      return
    }

    // Step 1: Scan project folder
    updateStep('scan', { status: 'running' })
    await new Promise(r => setTimeout(r, 300))

    const dirResult = await api.listDirectory(projectPath)
    if (!dirResult.success || !dirResult.data) {
      updateStep('scan', { status: 'error', message: 'Could not read directory' })
      setError('Failed to read project directory')
      return
    }

    const files = dirResult.data.map(f => f.name)
    updateStep('scan', {
      status: 'success',
      message: `Found ${files.length} items`,
      detail: files.slice(0, 5).join(', ') + (files.length > 5 ? '...' : '')
    })

    // Step 2: Read package.json
    updateStep('package', { status: 'running' })
    await new Promise(r => setTimeout(r, 300))

    const packagePath = `${projectPath}/package.json`
    const pkgResult = await api.readFile(packagePath)

    if (!pkgResult.success || !pkgResult.data) {
      updateStep('package', { status: 'error', message: 'No package.json found' })
      // Try to continue anyway for non-Node projects
    } else {
      try {
        const pkg = JSON.parse(pkgResult.data)
        const info = { ...projectInfo }

        // Detect framework
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps['next']) info.framework = 'Next.js'
        else if (deps['@remix-run/react']) info.framework = 'Remix'
        else if (deps['vite']) info.framework = 'Vite'
        else if (deps['react-scripts']) info.framework = 'Create React App'
        else if (deps['vue']) info.framework = 'Vue'
        else if (deps['svelte']) info.framework = 'Svelte'
        else if (deps['astro']) info.framework = 'Astro'
        else if (deps['react']) info.framework = 'React'

        setProjectInfo(info)
        updateStep('package', {
          status: 'success',
          message: pkg.name || projectName,
          detail: info.framework ? `${info.framework} project` : 'Node.js project'
        })

        // Step 3: Check dependencies
        updateStep('deps', { status: 'running' })
        await new Promise(r => setTimeout(r, 300))

        const hasNodeModules = files.includes('node_modules')
        const lockFiles = files.filter(f =>
          f === 'package-lock.json' || f === 'yarn.lock' || f === 'pnpm-lock.yaml' || f === 'bun.lockb'
        )

        // Detect package manager
        let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm'
        if (files.includes('bun.lockb') || files.includes('bun.lock')) packageManager = 'bun'
        else if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm'
        else if (files.includes('yarn.lock')) packageManager = 'yarn'

        setProjectInfo(prev => ({ ...prev, packageManager, hasNodeModules }))

        if (hasNodeModules) {
          updateStep('deps', {
            status: 'success',
            message: 'Dependencies installed',
            detail: `Using ${packageManager}`
          })
        } else {
          updateStep('deps', {
            status: 'success',
            message: 'Dependencies not installed',
            detail: `Run: ${packageManager} install`
          })
        }

        // Step 4: Find dev command
        updateStep('scripts', { status: 'running' })
        await new Promise(r => setTimeout(r, 300))

        const scripts = pkg.scripts || {}
        let devCommand = ''
        if (scripts.dev) devCommand = 'dev'
        else if (scripts.start) devCommand = 'start'
        else if (scripts.serve) devCommand = 'serve'
        else if (scripts.develop) devCommand = 'develop'

        if (devCommand) {
          const fullCommand = `${packageManager}${packageManager === 'npm' ? ' run' : ''} ${devCommand}`
          setProjectInfo(prev => ({ ...prev, devCommand: fullCommand }))
          updateStep('scripts', {
            status: 'success',
            message: `Found "${devCommand}" script`,
            detail: fullCommand
          })
        } else {
          updateStep('scripts', {
            status: 'error',
            message: 'No dev script found',
            detail: 'Add "dev" or "start" to package.json scripts'
          })
        }

        // Step 5: Detect port
        updateStep('port', { status: 'running' })
        await new Promise(r => setTimeout(r, 300))

        // Try to detect port from common config files or defaults
        let port = 3000 // Default

        // Check for Vite config
        if (files.includes('vite.config.ts') || files.includes('vite.config.js')) {
          const viteConfigPath = files.includes('vite.config.ts')
            ? `${projectPath}/vite.config.ts`
            : `${projectPath}/vite.config.js`
          const viteResult = await api.readFile(viteConfigPath)
          if (viteResult.success && viteResult.data) {
            const portMatch = viteResult.data.match(/port:\s*(\d+)/)
            if (portMatch) port = parseInt(portMatch[1])
          }
        }

        // Next.js default is 3000
        if (info.framework === 'Next.js') port = 3000
        // CRA default is 3000
        if (info.framework === 'Create React App') port = 3000

        setProjectInfo(prev => ({ ...prev, port }))
        updateStep('port', {
          status: 'success',
          message: `Port ${port}`,
          detail: `http://localhost:${port}`
        })

        setIsComplete(true)

      } catch (e) {
        updateStep('package', { status: 'error', message: 'Invalid package.json' })
        setError('Could not parse package.json')
      }
    }
  }, [projectPath, projectName, updateStep])

  useEffect(() => {
    if (!hasRun) {
      setHasRun(true)
      runSetup()
    }
  }, [hasRun, runSetup])

  const handleLaunch = () => {
    const url = `http://localhost:${projectInfo.port || 3000}`
    onComplete(url)
  }

  const getStepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'pending':
        return <Circle size={18} className={isDarkMode ? 'text-neutral-600' : 'text-stone-300'} />
      case 'running':
        return <Loader2 size={18} className="text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle2 size={18} className="text-green-500" />
      case 'error':
        return <XCircle size={18} className="text-red-500" />
      case 'skipped':
        return <Circle size={18} className={isDarkMode ? 'text-neutral-700' : 'text-stone-200'} />
    }
  }

  return (
    <div className={`flex-1 flex flex-col items-center pt-12 px-8 min-h-full ${
      isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-stone-900'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
        }`}>
          <Folder size={20} className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{projectName}</h1>
          <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
            {projectPath}
          </p>
        </div>
      </div>

      {/* Framework badge */}
      {projectInfo.framework && (
        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${
          isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-stone-100 text-stone-600'
        }`}>
          {projectInfo.framework}
        </div>
      )}

      {/* Steps */}
      <div className="w-full max-w-md mt-10 space-y-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`
              flex items-start gap-3 p-3 rounded-lg transition-all
              ${step.status === 'running'
                ? (isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50')
                : ''
              }
            `}
          >
            <div className="mt-0.5">
              {getStepIcon(step.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${
                step.status === 'pending'
                  ? (isDarkMode ? 'text-neutral-500' : 'text-stone-400')
                  : (isDarkMode ? 'text-neutral-200' : 'text-stone-700')
              }`}>
                {step.label}
              </div>
              {step.message && (
                <div className={`text-xs mt-0.5 ${
                  step.status === 'error'
                    ? 'text-red-500'
                    : (isDarkMode ? 'text-neutral-400' : 'text-stone-500')
                }`}>
                  {step.message}
                </div>
              )}
              {step.detail && (
                <div className={`text-xs mt-0.5 font-mono ${
                  isDarkMode ? 'text-neutral-600' : 'text-stone-400'
                }`}>
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 max-w-md w-full ${
          isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
        }`}>
          <AlertCircle size={18} className="text-red-500 mt-0.5" />
          <div>
            <p className="text-sm text-red-500 font-medium">Setup Error</p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onCancel}
          className={`
            px-4 py-2 text-sm rounded-lg transition-colors
            ${isDarkMode
              ? 'text-neutral-400 hover:bg-neutral-800'
              : 'text-stone-500 hover:bg-stone-100'
            }
          `}
        >
          Cancel
        </button>

        {isComplete && (
          <button
            onClick={handleLaunch}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
              transition-all transform hover:scale-[1.02]
              bg-blue-500 hover:bg-blue-600 text-white
              shadow-lg shadow-blue-500/25
            `}
          >
            <Globe size={16} />
            Open in Browser
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Dev command hint */}
      {isComplete && projectInfo.devCommand && (
        <div className={`mt-6 p-4 rounded-lg max-w-md w-full ${
          isDarkMode ? 'bg-neutral-800/50' : 'bg-stone-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              Make sure your dev server is running:
            </span>
          </div>
          <code className={`block text-sm font-mono p-2 rounded ${
            isDarkMode ? 'bg-neutral-900 text-green-400' : 'bg-white text-green-600 border border-stone-200'
          }`}>
            cd {projectPath} && {projectInfo.devCommand}
          </code>
        </div>
      )}
    </div>
  )
}
