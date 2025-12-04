import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2, XCircle, Globe, ChevronRight, AlertCircle, Sparkles } from 'lucide-react'

interface SetupStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  message?: string
  detail?: string
}

interface TechChip {
  name: string
  color: string
  icon?: string
}

interface ProjectInfo {
  name: string
  path: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  framework?: string
  devCommand?: string
  port?: number
  hasNodeModules?: boolean
  techStack: TechChip[]
}

interface ProjectSetupFlowProps {
  projectPath: string
  projectName: string
  initialPort?: number // Use saved port if available
  isDarkMode: boolean
  onComplete: (url: string, port: number) => void
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

// Tech stack detection with colors
const TECH_DETECTION: Record<string, { name: string; color: string }> = {
  'react': { name: 'React', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  'next': { name: 'Next.js', color: 'bg-white/10 text-white border-white/20' },
  'vue': { name: 'Vue', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'svelte': { name: 'Svelte', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'vite': { name: 'Vite', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'typescript': { name: 'TypeScript', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'tailwindcss': { name: 'Tailwind', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  '@remix-run/react': { name: 'Remix', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  'astro': { name: 'Astro', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'express': { name: 'Express', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  'prisma': { name: 'Prisma', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  'drizzle-orm': { name: 'Drizzle', color: 'bg-lime-500/20 text-lime-400 border-lime-500/30' },
  'zod': { name: 'Zod', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  '@tanstack/react-query': { name: 'React Query', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'zustand': { name: 'Zustand', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'framer-motion': { name: 'Framer', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  'three': { name: 'Three.js', color: 'bg-white/10 text-white border-white/20' },
  '@react-three/fiber': { name: 'R3F', color: 'bg-white/10 text-white border-white/20' },
  'electron': { name: 'Electron', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  '@google/generative-ai': { name: 'Gemini', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  '@anthropic-ai/sdk': { name: 'Claude SDK', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'openai': { name: 'OpenAI', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'langchain': { name: 'LangChain', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  '@vercel/ai': { name: 'Vercel AI', color: 'bg-white/10 text-white border-white/20' },
  'ai': { name: 'AI SDK', color: 'bg-white/10 text-white border-white/20' },
  'supabase': { name: 'Supabase', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  '@supabase/supabase-js': { name: 'Supabase', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'firebase': { name: 'Firebase', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'stripe': { name: 'Stripe', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'playwright': { name: 'Playwright', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'vitest': { name: 'Vitest', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  'jest': { name: 'Jest', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  '@trpc/server': { name: 'tRPC', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'hono': { name: 'Hono', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'elysia': { name: 'Elysia', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  'socket.io': { name: 'Socket.io', color: 'bg-white/10 text-white border-white/20' },
  'graphql': { name: 'GraphQL', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  'mongoose': { name: 'MongoDB', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'redis': { name: 'Redis', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'ioredis': { name: 'Redis', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// Special file detections (files in project root)
const FILE_DETECTION: Record<string, { name: string; color: string }> = {
  'CLAUDE.md': { name: 'Claude Ready', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'claude.md': { name: 'Claude Ready', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'AGENTS.md': { name: 'AI Agents', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'agents.md': { name: 'AI Agents', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  '.cursorrules': { name: 'Cursor', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  '.cursorignore': { name: 'Cursor', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'docker-compose.yml': { name: 'Docker', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'docker-compose.yaml': { name: 'Docker', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'Dockerfile': { name: 'Docker', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  '.github': { name: 'GitHub Actions', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  'turbo.json': { name: 'Turborepo', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'nx.json': { name: 'Nx', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'vercel.json': { name: 'Vercel', color: 'bg-white/10 text-white border-white/20' },
  'netlify.toml': { name: 'Netlify', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  'fly.toml': { name: 'Fly.io', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'railway.json': { name: 'Railway', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  '.env': { name: 'Env Config', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  '.env.local': { name: 'Local Env', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  'biome.json': { name: 'Biome', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  '.prettierrc': { name: 'Prettier', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  'prettier.config.js': { name: 'Prettier', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  '.eslintrc': { name: 'ESLint', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  '.eslintrc.js': { name: 'ESLint', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'eslint.config.js': { name: 'ESLint', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'wrangler.toml': { name: 'Cloudflare', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  '.wrangler': { name: 'Cloudflare', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'convex': { name: 'Convex', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'sanity.config.ts': { name: 'Sanity', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'contentlayer.config.ts': { name: 'Contentlayer', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'mdx-components.tsx': { name: 'MDX', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  'schema.prisma': { name: 'Prisma', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  'drizzle.config.ts': { name: 'Drizzle', color: 'bg-lime-500/20 text-lime-400 border-lime-500/30' },
  '.claude': { name: 'Claude Config', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'mcp.json': { name: 'MCP', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  '.mcp': { name: 'MCP', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  'storybook': { name: 'Storybook', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  '.storybook': { name: 'Storybook', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  'cypress': { name: 'Cypress', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'cypress.config.ts': { name: 'Cypress', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'playwright.config.ts': { name: 'Playwright', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'k8s': { name: 'Kubernetes', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'kubernetes': { name: 'Kubernetes', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'terraform': { name: 'Terraform', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'pulumi': { name: 'Pulumi', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

const PACKAGE_MANAGER_CHIPS: Record<string, { name: string; color: string }> = {
  'bun': { name: 'Bun', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'pnpm': { name: 'pnpm', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'yarn': { name: 'Yarn', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'npm': { name: 'npm', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// Default ports by framework
const DEFAULT_PORTS: Record<string, number> = {
  'Vite': 5173,
  'Next.js': 3000,
  'Create React App': 3000,
  'Remix': 3000,
  'Astro': 4321,
  'Vue': 5173,
  'Svelte': 5173,
}

export function ProjectSetupFlow({
  projectPath,
  projectName,
  initialPort,
  isDarkMode,
  onComplete,
  onCancel
}: ProjectSetupFlowProps) {
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: 'scan', label: 'Scanning project', status: 'pending' },
    { id: 'deps', label: 'Analyzing dependencies', status: 'pending' },
    { id: 'port', label: 'Detecting port', status: 'pending' },
  ])
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: projectName,
    path: projectPath,
    techStack: []
  })
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [visibleChips, setVisibleChips] = useState<TechChip[]>([])

  const updateStep = useCallback((id: string, update: Partial<SetupStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...update } : step
    ))
  }, [])

  // Animate chips appearing one by one (with deduplication safeguard)
  const animateChips = useCallback((chips: TechChip[]) => {
    // Dedupe chips by name before animating
    const seen = new Set<string>()
    const uniqueChips = chips.filter(chip => {
      if (seen.has(chip.name)) return false
      seen.add(chip.name)
      return true
    })

    setVisibleChips([])
    uniqueChips.forEach((chip, index) => {
      setTimeout(() => {
        setVisibleChips(prev => [...prev, chip])
      }, index * 150) // Stagger by 150ms
    })
  }, [])

  const runSetup = useCallback(async () => {
    const api = window.electronAPI?.files
    if (!api) {
      setError('File system access not available')
      return
    }

    // Step 1: Scan project folder
    updateStep('scan', { status: 'running' })
    await new Promise(r => setTimeout(r, 200))

    const dirResult = await api.listDirectory(projectPath)
    if (!dirResult.success || !dirResult.data) {
      updateStep('scan', { status: 'error', message: 'Could not read directory' })
      setError('Failed to read project directory')
      return
    }

    const files = dirResult.data.map(f => f.name)
    updateStep('scan', { status: 'success', message: `${files.length} files` })

    // Step 2: Analyze dependencies
    updateStep('deps', { status: 'running' })
    await new Promise(r => setTimeout(r, 200))

    const packagePath = `${projectPath}/package.json`
    const pkgResult = await api.readFile(packagePath)

    if (!pkgResult.success || !pkgResult.data) {
      updateStep('deps', { status: 'error', message: 'No package.json' })
      setError('No package.json found')
      return
    }

    try {
      const pkg = JSON.parse(pkgResult.data)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const info: ProjectInfo = {
        ...projectInfo,
        techStack: []
      }

      // Detect tech stack - use Set to track added chip names
      const detectedTech: TechChip[] = []
      const addedChipNames = new Set<string>()

      const addChip = (name: string, color: string) => {
        if (!addedChipNames.has(name)) {
          detectedTech.push({ name, color })
          addedChipNames.add(name)
        }
      }

      for (const [depName, techInfo] of Object.entries(TECH_DETECTION)) {
        if (deps[depName]) {
          addChip(techInfo.name, techInfo.color)
        }
      }

      // Check for TypeScript config files
      if (files.includes('tsconfig.json')) {
        addChip(TECH_DETECTION['typescript'].name, TECH_DETECTION['typescript'].color)
      }

      // Detect special files
      for (const [fileName, fileInfo] of Object.entries(FILE_DETECTION)) {
        if (files.includes(fileName)) {
          addChip(fileInfo.name, fileInfo.color)
        }
      }

      // Detect package manager from lockfiles
      let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm'
      if (files.includes('bun.lockb') || files.includes('bun.lock')) {
        packageManager = 'bun'
      } else if (files.includes('pnpm-lock.yaml')) {
        packageManager = 'pnpm'
      } else if (files.includes('yarn.lock')) {
        packageManager = 'yarn'
      }

      // Add package manager chip
      const pmChip = PACKAGE_MANAGER_CHIPS[packageManager]
      addChip(pmChip.name, pmChip.color)

      info.packageManager = packageManager
      info.hasNodeModules = files.includes('node_modules')
      info.techStack = detectedTech

      // Detect framework for port defaulting
      if (deps['next']) info.framework = 'Next.js'
      else if (deps['@remix-run/react']) info.framework = 'Remix'
      else if (deps['vite']) info.framework = 'Vite'
      else if (deps['react-scripts']) info.framework = 'Create React App'
      else if (deps['vue']) info.framework = 'Vue'
      else if (deps['svelte']) info.framework = 'Svelte'
      else if (deps['astro']) info.framework = 'Astro'

      // Find dev command
      const scripts = pkg.scripts || {}
      let devCommand = ''
      if (scripts.dev) devCommand = 'dev'
      else if (scripts.start) devCommand = 'start'
      else if (scripts.serve) devCommand = 'serve'
      else if (scripts.develop) devCommand = 'develop'

      if (devCommand) {
        info.devCommand = `${packageManager}${packageManager === 'npm' ? ' run' : ''} ${devCommand}`
      }

      setProjectInfo(info)
      animateChips(detectedTech)

      updateStep('deps', {
        status: 'success',
        message: `${detectedTech.length} technologies`
      })

      // Step 3: Detect port
      updateStep('port', { status: 'running' })
      await new Promise(r => setTimeout(r, 300))

      let port = 3000 // Default fallback

      // Try to detect port from config files
      if (files.includes('vite.config.ts') || files.includes('vite.config.js')) {
        const viteConfigPath = files.includes('vite.config.ts')
          ? `${projectPath}/vite.config.ts`
          : `${projectPath}/vite.config.js`
        const viteResult = await api.readFile(viteConfigPath)
        if (viteResult.success && viteResult.data) {
          const portMatch = viteResult.data.match(/port:\s*(\d+)/)
          if (portMatch) {
            port = parseInt(portMatch[1])
            updateStep('port', {
              status: 'success',
              message: `Port ${port}`,
              detail: 'from vite.config'
            })
            setProjectInfo(prev => ({ ...prev, port }))
            setIsComplete(true)
            return
          }
        }
      }

      // Check next.config for port
      if (files.includes('next.config.js') || files.includes('next.config.mjs')) {
        const nextConfigPath = files.includes('next.config.mjs')
          ? `${projectPath}/next.config.mjs`
          : `${projectPath}/next.config.js`
        const nextResult = await api.readFile(nextConfigPath)
        if (nextResult.success && nextResult.data) {
          const portMatch = nextResult.data.match(/port:\s*(\d+)/)
          if (portMatch) {
            port = parseInt(portMatch[1])
            updateStep('port', {
              status: 'success',
              message: `Port ${port}`,
              detail: 'from next.config'
            })
            setProjectInfo(prev => ({ ...prev, port }))
            setIsComplete(true)
            return
          }
        }
      }

      // Use framework default port
      if (info.framework && DEFAULT_PORTS[info.framework]) {
        port = DEFAULT_PORTS[info.framework]
        updateStep('port', {
          status: 'success',
          message: `Port ${port}`,
          detail: `${info.framework} default`
        })
      } else {
        updateStep('port', {
          status: 'success',
          message: `Port ${port}`,
          detail: 'default'
        })
      }

      setProjectInfo(prev => ({ ...prev, port }))
      setIsComplete(true)

    } catch (e) {
      updateStep('deps', { status: 'error', message: 'Invalid package.json' })
      setError('Could not parse package.json')
    }
  }, [projectPath, projectName, updateStep, animateChips])

  useEffect(() => {
    if (!hasRun) {
      setHasRun(true)
      runSetup()
    }
  }, [hasRun, runSetup])

  const handleLaunch = () => {
    // User-specified port (from edit) takes priority over auto-detected port
    const port = initialPort || projectInfo.port || 3000
    const url = `http://localhost:${port}`
    onComplete(url, port)
  }

  const getStepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'pending':
        return <Circle size={14} className="text-neutral-600" />
      case 'running':
        return <Loader2 size={14} className="text-blue-400 animate-spin" />
      case 'success':
        return <CheckCircle2 size={14} className="text-emerald-400" />
      case 'error':
        return <XCircle size={14} className="text-red-400" />
      case 'skipped':
        return <Circle size={14} className="text-neutral-700" />
    }
  }

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-8 min-h-full ${
      isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-stone-900'
    }`}>

      {/* Project Name */}
      <h1 className="text-2xl font-semibold mb-2">{projectName}</h1>
      <p className={`text-xs font-mono mb-6 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
        {projectPath}
      </p>

      {/* Tech Stack Chips */}
      <div className="flex flex-wrap justify-center content-start gap-2 mb-8 h-[80px] max-w-md overflow-hidden">
        {visibleChips.map((chip, index) => (
          <span
            key={`${chip.name}-${index}`}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-full border
              animate-in fade-in zoom-in-95 duration-200
              ${chip.color}
            `}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {chip.name}
          </span>
        ))}
      </div>

      {/* Steps Panel */}
      <div className={`w-full max-w-md rounded-2xl p-6 mb-8 ${
        isDarkMode ? 'bg-neutral-800/50 border border-neutral-700/50' : 'bg-stone-50 border border-stone-200'
      }`}>
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-4"
            >
              <div className="flex-shrink-0">
                {getStepIcon(step.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${
                  step.status === 'pending'
                    ? 'text-neutral-500'
                    : step.status === 'error'
                    ? 'text-red-400'
                    : (isDarkMode ? 'text-neutral-200' : 'text-stone-700')
                }`}>
                  {step.label}
                </div>
              </div>
              {step.message && (
                <div className={`text-xs ${
                  step.status === 'error'
                    ? 'text-red-400'
                    : 'text-neutral-500'
                }`}>
                  {step.message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 max-w-sm w-full ${
          isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
        }`}>
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
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
              flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              transition-colors
              ${isDarkMode
                ? 'bg-white text-neutral-900 hover:bg-neutral-200'
                : 'bg-stone-800 text-white hover:bg-stone-700'
              }
            `}
          >
            <Globe size={14} />
            <span>Open in Browser</span>
          </button>
        )}
      </div>

      {/* Port info subtle hint */}
      {isComplete && (
        <p className={`mt-4 text-xs ${isDarkMode ? 'text-neutral-600' : 'text-stone-400'}`}>
          localhost:{initialPort || projectInfo.port || 3000}
        </p>
      )}
    </div>
  )
}
