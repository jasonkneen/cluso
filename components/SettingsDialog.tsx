import React, { useState, useEffect } from 'react'
import {
  X,
  Settings,
  Monitor,
  Cpu,
  Brain,
  Plug,
  ChevronRight,
  Sun,
  Moon,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Key,
  Sparkles,
  Zap,
  Terminal,
  Globe,
  Wrench,
  RefreshCw,
  AlertCircle,
  Play,
  Square,
  Palette,
  Server,
} from 'lucide-react'
import { debugLog } from '../utils/debug'
import { FastApplySettings } from './FastApplySettings'
import { useTheme } from '../hooks/useTheme'

type SettingsSection = 'general' | 'display' | 'providers' | 'models' | 'mcp' | 'themes' | 'pro'

export interface Provider {
  id: string
  name: string
  apiKey: string
  enabled: boolean
  verified?: boolean
  verifying?: boolean
}

export interface SettingsModel {
  id: string
  name: string
  provider: string
  enabled: boolean
}

export type MCPTransportType = 'stdio' | 'sse'

export interface MCPStdioTransport {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface MCPSSETransport {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export type MCPTransport = MCPStdioTransport | MCPSSETransport

export interface MCPServerConnection {
  id: string
  name: string
  type: 'mcp'
  transport: MCPTransport
  enabled: boolean
  timeout?: number
  // Runtime state (not persisted)
  status?: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
  toolCount?: number
}

// Legacy connection type for backwards compatibility
export interface LegacyConnection {
  id: string
  name: string
  type: 'api' | 'websocket'
  url: string
  enabled: boolean
}

export type Connection = MCPServerConnection | LegacyConnection

export type FontSize = 'small' | 'medium' | 'large'

export interface AppSettings {
  autoConnect: boolean
  sendAnalytics: boolean
  fontSize: FontSize
  showLineNumbers: boolean
  providers: Provider[]
  models: SettingsModel[]
  connections: Connection[]
  // Claude Code OAuth state
  claudeCodeAuthenticated?: boolean
  claudeCodeExpiresAt?: number | null
  // Codex OAuth state (OpenAI ChatGPT Plus/Pro)
  codexAuthenticated?: boolean
  codexExpiresAt?: number | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoConnect: true,
  sendAnalytics: false,
  fontSize: 'medium',
  showLineNumbers: true,
  providers: [
    { id: 'google', name: 'Google AI (Gemini)', apiKey: '', enabled: true },
    { id: 'openai', name: 'OpenAI', apiKey: '', enabled: false },
    { id: 'anthropic', name: 'Anthropic', apiKey: '', enabled: false },
  ],
  models: [
    // Claude Code OAuth models (recommended for Agent SDK)
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'claude-code', enabled: true },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'claude-code', enabled: true },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude-code', enabled: true },
    // Claude legacy API models
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', enabled: false },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', enabled: false },
    // OpenAI models
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: false },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', enabled: false },
    // Codex OAuth models (ChatGPT Plus/Pro)
    { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'codex', enabled: false },
    { id: 'gpt-5.1-mini', name: 'GPT-5.1 Mini', provider: 'codex', enabled: false },
    { id: 'gpt-5.1-nano', name: 'GPT-5.1 Nano', provider: 'codex', enabled: false },
    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'codex', enabled: false },
    // Google Gemini models
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', provider: 'google', enabled: true },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', enabled: true },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', enabled: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', enabled: true },
  ],
  connections: [
    {
      id: '1',
      name: 'Example SSE Server',
      type: 'mcp',
      transport: { type: 'sse', url: 'http://localhost:3001' },
      enabled: false,
    },
  ],
}

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Settings size={18} /> },
  { id: 'display', label: 'Display', icon: <Monitor size={18} /> },
  { id: 'providers', label: 'Providers', icon: <Cpu size={18} /> },
  { id: 'models', label: 'Models', icon: <Brain size={18} /> },
  { id: 'mcp', label: 'MCP Servers', icon: <Server size={18} /> },
  { id: 'themes', label: 'Themes', icon: <Palette size={18} /> },
  { id: 'pro', label: 'Pro Features', icon: <Zap size={18} /> },
]

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

export function SettingsDialog({
  isOpen,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  settings,
  onSettingsChange,
}: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const { currentTheme, setTheme, themes } = useTheme()

  // OAuth state
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [awaitingOAuthCode, setAwaitingOAuthCode] = useState<{ mode: 'max' | 'console', createKey: boolean } | null>(null)
  const [oauthCode, setOauthCode] = useState('')
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<{ authenticated: boolean; expiresAt: number | null }>({
    authenticated: false,
    expiresAt: null
  })
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [apiTestLoading, setApiTestLoading] = useState(false)

  // Codex OAuth state (OpenAI ChatGPT Plus/Pro)
  const [codexStatus, setCodexStatus] = useState<{ authenticated: boolean; expiresAt: number | null }>({
    authenticated: false,
    expiresAt: null
  })
  const [codexLoading, setCodexLoading] = useState(false)
  const [codexTestResult, setCodexTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [codexTestLoading, setCodexTestLoading] = useState(false)

  // MCP Discovery state
  interface DiscoveredServer {
    name: string
    source: string
    config: {
      type: string
      command?: string
      args?: string[]
      url?: string
    }
    transport: MCPStdioTransport | MCPSSETransport
    tools: { name: string; displayName: string; description?: string }[] | null
    error: string | null
  }
  const [discoveredServers, setDiscoveredServers] = useState<Record<string, DiscoveredServer>>({})
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [disabledServers, setDisabledServers] = useState<Set<string>>(new Set())

  // Check Claude Code OAuth status on mount and when dialog opens
  useEffect(() => {
    if (isOpen && window.electronAPI?.oauth) {
      window.electronAPI.oauth.getStatus().then(status => {
        setClaudeCodeStatus(status)
        // Update settings with OAuth status
        if (status.authenticated !== settings.claudeCodeAuthenticated) {
          onSettingsChange({
            ...settings,
            claudeCodeAuthenticated: status.authenticated,
            claudeCodeExpiresAt: status.expiresAt,
            // Enable ALL Claude Code provider models if authenticated
            models: settings.models.map(m =>
              m.provider === 'claude-code' ? { ...m, enabled: status.authenticated } : m
            )
          })
        }
      })
    }
    // Also check Codex OAuth status
    if (isOpen && window.electronAPI?.codex) {
      window.electronAPI.codex.getStatus().then(status => {
        setCodexStatus(status)
        // Update settings with Codex OAuth status
        if (status.authenticated !== settings.codexAuthenticated) {
          onSettingsChange({
            ...settings,
            codexAuthenticated: status.authenticated,
            codexExpiresAt: status.expiresAt,
            // Enable ALL Codex provider models if authenticated
            models: settings.models.map(m =>
              m.provider === 'codex' ? { ...m, enabled: status.authenticated } : m
            )
          })
        }
      })
    }

    // Auto-discover MCP servers when dialog opens
    if (isOpen && window.electronAPI?.mcp?.discover) {
      discoverMcpServers()
    }
  }, [isOpen])

  // Discover MCP servers from Claude Desktop, project, etc.
  const discoverMcpServers = async () => {
    if (!window.electronAPI?.mcp?.discover) return

    setIsDiscovering(true)
    try {
      // Get project path from files API if available
      let projectPath = undefined
      if (window.electronAPI?.files?.getCwd) {
        try {
          const result = await window.electronAPI.files.getCwd()
          if (result?.path) projectPath = result.path
        } catch {}
      }

      const result = await window.electronAPI.mcp.discover(projectPath)
      if (result.success && result.discovered) {
        setDiscoveredServers(result.discovered)
        console.log('Discovered MCP servers:', result.discovered)
      }
    } catch (err) {
      console.error('Failed to discover MCP servers:', err)
    } finally {
      setIsDiscovering(false)
    }
  }

  // Toggle server enabled/disabled
  const toggleServerEnabled = (serverName: string) => {
    setDisabledServers(prev => {
      const next = new Set(prev)
      if (next.has(serverName)) {
        next.delete(serverName)
      } else {
        next.add(serverName)
      }
      return next
    })
  }

  if (!isOpen) return null

  const updateSettings = (partial: Partial<AppSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  const toggleProviderApiKey = (id: string) => {
    setShowApiKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const updateProviderApiKey = (id: string, apiKey: string) => {
    updateSettings({
      providers: settings.providers.map(p =>
        p.id === id ? { ...p, apiKey, verified: false } : p
      )
    })
  }

  const toggleProviderEnabled = (id: string) => {
    updateSettings({
      providers: settings.providers.map(p =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      )
    })
  }

  const verifyProviderApiKey = async (id: string) => {
    const provider = settings.providers.find(p => p.id === id)
    if (!provider?.apiKey) return

    // Set verifying state
    updateSettings({
      providers: settings.providers.map(p =>
        p.id === id ? { ...p, verifying: true, verified: false } : p
      )
    })

    try {
      let isValid = false

      if (id === 'google') {
        // Verify Google AI API key
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`
        )
        isValid = response.ok
      } else if (id === 'openai') {
        // Verify OpenAI API key
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${provider.apiKey}` }
        })
        isValid = response.ok
      } else if (id === 'anthropic') {
        // Anthropic doesn't have a simple verify endpoint, so we'll just check format
        isValid = provider.apiKey.startsWith('sk-ant-')
      }

      updateSettings({
        providers: settings.providers.map(p =>
          p.id === id ? { ...p, verifying: false, verified: isValid } : p
        )
      })
    } catch {
      updateSettings({
        providers: settings.providers.map(p =>
          p.id === id ? { ...p, verifying: false, verified: false } : p
        )
      })
    }
  }

  // OAuth handlers
  const startOAuthLogin = async (mode: 'max' | 'console', createKey: boolean) => {
    if (!window.electronAPI?.oauth) {
      setOauthError('OAuth is only available in the desktop app')
      return
    }

    setOauthLoading(true)
    setOauthError(null)

    try {
      const result = await window.electronAPI.oauth.startLogin(mode)
      if (result.success) {
        // Check if OAuth completed automatically via callback server
        if (result.autoCompleted) {
          // OAuth flow completed automatically - update status
          if (result.mode === 'api-key' && result.apiKey) {
            // Update Anthropic provider with the new API key
            updateSettings({
              providers: settings.providers.map(p =>
                p.id === 'anthropic' ? { ...p, apiKey: result.apiKey!, verified: true, enabled: true } : p
              )
            })
          } else if (result.mode === 'oauth') {
            // Update Claude Code status
            const status = await window.electronAPI.oauth.getStatus()
            setClaudeCodeStatus(status)
            updateSettings({
              claudeCodeAuthenticated: true,
              claudeCodeExpiresAt: status.expiresAt,
              // Enable ALL Claude Code provider models
              models: settings.models.map(m =>
                m.provider === 'claude-code' ? { ...m, enabled: true } : m
              )
            })
          }
          // Don't show manual code entry dialog
          setAwaitingOAuthCode(null)
          setOauthCode('')
        } else {
          // Fallback to manual code entry (shouldn't happen with callback server)
          setAwaitingOAuthCode({ mode, createKey })
          setOauthCode('')
        }
      } else {
        setOauthError(result.error || 'Failed to start OAuth flow')
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setOauthLoading(false)
    }
  }

  const completeOAuthLogin = async () => {
    if (!window.electronAPI?.oauth || !awaitingOAuthCode) return

    setOauthLoading(true)
    setOauthError(null)

    try {
      const result = await window.electronAPI.oauth.completeLogin(oauthCode, awaitingOAuthCode.createKey)
      if (result.success) {
        if (result.mode === 'api-key' && result.apiKey) {
          // Update Anthropic provider with the new API key
          updateSettings({
            providers: settings.providers.map(p =>
              p.id === 'anthropic' ? { ...p, apiKey: result.apiKey!, verified: true, enabled: true } : p
            )
          })
        } else if (result.mode === 'oauth') {
          // Update Claude Code status
          const status = await window.electronAPI.oauth.getStatus()
          setClaudeCodeStatus(status)
          updateSettings({
            claudeCodeAuthenticated: true,
            claudeCodeExpiresAt: status.expiresAt,
            // Enable ALL Claude Code provider models
            models: settings.models.map(m =>
              m.provider === 'claude-code' ? { ...m, enabled: true } : m
            )
          })
        }
        setAwaitingOAuthCode(null)
        setOauthCode('')
      } else {
        setOauthError(result.error || 'Failed to complete OAuth flow')
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setOauthLoading(false)
    }
  }

  const cancelOAuthFlow = async () => {
    if (window.electronAPI?.oauth) {
      await window.electronAPI.oauth.cancel()
    }
    setAwaitingOAuthCode(null)
    setOauthCode('')
    setOauthError(null)
  }

  const logoutClaudeCode = async () => {
    if (!window.electronAPI?.oauth) return

    try {
      await window.electronAPI.oauth.logout()
      setClaudeCodeStatus({ authenticated: false, expiresAt: null })
      updateSettings({
        claudeCodeAuthenticated: false,
        claudeCodeExpiresAt: null,
        // Disable ALL Claude Code provider models
        models: settings.models.map(m =>
          m.provider === 'claude-code' ? { ...m, enabled: false } : m
        )
      })
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Test API call directly (bypasses AI SDK)
  const testApiCall = async () => {
    if (!window.electronAPI?.oauth?.testApi) return

    setApiTestLoading(true)
    setApiTestResult(null)

    try {
      const result = await window.electronAPI.oauth.testApi()
      if (result.success) {
        setApiTestResult({ success: true, message: 'API call succeeded!' })
        debugLog.general.log('API Test Response:', result.response)
      } else {
        setApiTestResult({ success: false, message: result.error || 'API call failed' })
        debugLog.general.log('API Test Error:', result.error)
      }
    } catch (err) {
      setApiTestResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setApiTestLoading(false)
    }
  }

  // Codex OAuth handlers
  const startCodexLogin = async () => {
    if (!window.electronAPI?.codex) {
      setOauthError('Codex OAuth is only available in the desktop app')
      return
    }

    setCodexLoading(true)
    setOauthError(null)

    try {
      const result = await window.electronAPI.codex.startLogin()
      if (result.success) {
        // Check if OAuth completed automatically via callback server
        if (result.autoCompleted) {
          // OAuth flow completed automatically - update status
          const status = await window.electronAPI.codex.getStatus()
          setCodexStatus(status)
          updateSettings({
            codexAuthenticated: true,
            codexExpiresAt: status.expiresAt,
            // Enable ALL Codex provider models
            models: settings.models.map(m =>
              m.provider === 'codex' ? { ...m, enabled: true } : m
            )
          })
        }
      } else {
        setOauthError(result.error || 'Failed to start Codex OAuth flow')
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCodexLoading(false)
    }
  }

  const logoutCodex = async () => {
    if (!window.electronAPI?.codex) return

    try {
      await window.electronAPI.codex.logout()
      setCodexStatus({ authenticated: false, expiresAt: null })
      updateSettings({
        codexAuthenticated: false,
        codexExpiresAt: null,
        // Disable ALL Codex provider models
        models: settings.models.map(m =>
          m.provider === 'codex' ? { ...m, enabled: false } : m
        )
      })
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Test Codex API call directly
  const testCodexApiCall = async () => {
    if (!window.electronAPI?.codex?.testApi) return

    setCodexTestLoading(true)
    setCodexTestResult(null)

    try {
      const result = await window.electronAPI.codex.testApi()
      if (result.success) {
        setCodexTestResult({ success: true, message: 'Codex API call succeeded!' })
        debugLog.general.log('Codex API Test Response:', result.response)
      } else {
        setCodexTestResult({ success: false, message: result.error || 'Codex API call failed' })
        debugLog.general.log('Codex API Test Error:', result.error)
      }
    } catch (err) {
      setCodexTestResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setCodexTestLoading(false)
    }
  }

  const toggleModelEnabled = (id: string) => {
    updateSettings({
      models: settings.models.map(m =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
    })
  }

  const toggleConnectionEnabled = (id: string) => {
    updateSettings({
      connections: settings.connections.map(c =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      )
    })
  }

  const removeConnection = (id: string) => {
    updateSettings({
      connections: settings.connections.filter(c => c.id !== id)
    })
  }

  const getProviderName = (providerId: string) => {
    if (providerId === 'claude-code') return 'Claude Code (OAuth)'
    if (providerId === 'codex') return 'Codex (ChatGPT Plus/Pro)'
    const provider = settings.providers.find(p => p.id === providerId)
    return provider?.name || providerId
  }

  const isProviderEnabled = (providerId: string) => {
    const provider = settings.providers.find(p => p.id === providerId)
    return provider?.enabled && !!provider?.apiKey
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Startup
              </h3>
              <label className="flex items-center justify-between py-2">
                <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
                  Auto-connect on launch
                </span>
                <button
                  onClick={() => updateSettings({ autoConnect: !settings.autoConnect })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    settings.autoConnect
                      ? 'bg-blue-500'
                      : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.autoConnect ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`} />

            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Privacy
              </h3>
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
                    Send anonymous usage data
                  </span>
                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                    Help improve Cluso by sharing anonymous analytics
                  </p>
                </div>
                <button
                  onClick={() => updateSettings({ sendAnalytics: !settings.sendAnalytics })}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${
                    settings.sendAnalytics
                      ? 'bg-blue-500'
                      : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.sendAnalytics ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`} />

            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Data
              </h3>
              <button
                className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Clear all local data
              </button>
            </div>
          </div>
        )

      case 'display':
        return (
          <div className="space-y-6">
            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Theme
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => isDarkMode && onToggleDarkMode()}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    !isDarkMode
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  <Sun size={24} className={!isDarkMode ? 'text-blue-500' : 'text-neutral-400'} />
                  <span className={`text-sm font-medium ${!isDarkMode ? 'text-blue-600' : 'text-neutral-400'}`}>
                    Light
                  </span>
                </button>
                <button
                  onClick={() => !isDarkMode && onToggleDarkMode()}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    isDarkMode
                      ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <Moon size={24} className={isDarkMode ? 'text-blue-400' : 'text-stone-400'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-stone-400'}`}>
                    Dark
                  </span>
                </button>
              </div>
            </div>

            <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`} />

            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Font Size
              </h3>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSettings({ fontSize: size })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      settings.fontSize === size
                        ? 'bg-blue-500 text-white'
                        : isDarkMode
                          ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                    style={{ fontSize: FONT_SIZE_MAP[size] }}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
              <p className={`text-xs mt-2 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                Affects chat messages and code blocks
              </p>
            </div>

            <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`} />

            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Code Editor
              </h3>
              <label className="flex items-center justify-between py-2">
                <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
                  Show line numbers
                </span>
                <button
                  onClick={() => updateSettings({ showLineNumbers: !settings.showLineNumbers })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    settings.showLineNumbers
                      ? 'bg-blue-500'
                      : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.showLineNumbers ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        )

      case 'providers':
        return (
          <div className="space-y-4">
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              Configure API providers for AI models. Add your API keys to enable different providers.
            </p>

            {/* OAuth Error Display */}
            {oauthError && (
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
              }`}>
                <div className="flex items-center gap-2">
                  <XCircle size={16} />
                  <span className="text-sm">{oauthError}</span>
                  <button
                    onClick={() => setOauthError(null)}
                    className="ml-auto"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* OAuth Code Input (shown when awaiting code) */}
            {awaitingOAuthCode && (
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Key size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Enter OAuth Code
                  </span>
                </div>
                <p className={`text-xs mb-3 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  A browser window opened. After authorizing, copy the code and paste it here.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={oauthCode}
                    onChange={(e) => setOauthCode(e.target.value)}
                    placeholder="Paste authorization code..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-neutral-700 border-neutral-600 text-neutral-200 placeholder-neutral-500'
                        : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'
                    } border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                  />
                  <button
                    onClick={completeOAuthLogin}
                    disabled={!oauthCode || oauthLoading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      !oauthCode
                        ? isDarkMode
                          ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                          : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-purple-500 text-white hover:bg-purple-600'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {oauthLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Complete
                  </button>
                  <button
                    onClick={cancelOAuthFlow}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {settings.providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`p-4 rounded-xl border ${
                    isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        provider.enabled && provider.apiKey
                          ? 'bg-green-500/10 text-green-500'
                          : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                      }`}>
                        <Cpu size={16} />
                      </div>
                      <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                        {provider.name}
                      </span>
                      {provider.verified && (
                        <CheckCircle size={16} className="text-green-500" />
                      )}
                    </div>
                    <button
                      onClick={() => toggleProviderEnabled(provider.id)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        provider.enabled
                          ? 'bg-green-500'
                          : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          provider.enabled ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showApiKeys[provider.id] ? 'text' : 'password'}
                        value={provider.apiKey}
                        onChange={(e) => updateProviderApiKey(provider.id, e.target.value)}
                        placeholder="Enter API key..."
                        className={`w-full px-3 py-2 pr-10 rounded-lg text-sm ${
                          isDarkMode
                            ? 'bg-neutral-700 border-neutral-600 text-neutral-200 placeholder-neutral-500'
                            : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'
                        } border focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                      />
                      <button
                        onClick={() => toggleProviderApiKey(provider.id)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
                          isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600'
                        }`}
                      >
                        {showApiKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      onClick={() => verifyProviderApiKey(provider.id)}
                      disabled={!provider.apiKey || provider.verifying}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        !provider.apiKey
                          ? isDarkMode
                            ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          : provider.verified
                            ? 'bg-green-500/10 text-green-500'
                            : isDarkMode
                              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {provider.verifying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : provider.verified ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                      {provider.verifying ? 'Verifying' : provider.verified ? 'Verified' : 'Verify'}
                    </button>
                  </div>

                  {/* OAuth button for Anthropic provider */}
                  {provider.id === 'anthropic' && window.electronAPI?.oauth && (
                    <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
                      <button
                        onClick={() => startOAuthLogin('console', true)}
                        disabled={oauthLoading || !!awaitingOAuthCode}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          oauthLoading || awaitingOAuthCode
                            ? isDarkMode
                              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                              : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                        }`}
                      >
                        {oauthLoading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                        Get API Key via OAuth
                      </button>
                      <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                        Use your Anthropic Console account to create an API key
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Claude Code OAuth Section */}
            {window.electronAPI?.oauth && (
              <>
                <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'} my-4`} />

                <div className={`p-4 rounded-xl border ${
                  claudeCodeStatus.authenticated
                    ? isDarkMode ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50'
                    : isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        claudeCodeStatus.authenticated
                          ? 'bg-purple-500/20 text-purple-500'
                          : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                      }`}>
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                          Claude Code
                        </span>
                        <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          Use Claude with your Pro/Max subscription
                        </p>
                      </div>
                    </div>
                    {claudeCodeStatus.authenticated && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-purple-500" />
                        <span className={`text-xs ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                          Connected
                        </span>
                      </div>
                    )}
                  </div>

                  {claudeCodeStatus.authenticated ? (
                    <div className="space-y-3">
                      {claudeCodeStatus.expiresAt && (
                        <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          Token expires: {new Date(claudeCodeStatus.expiresAt).toLocaleString()}
                        </p>
                      )}
                      {/* Test API Button */}
                      <button
                        onClick={testApiCall}
                        disabled={apiTestLoading}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          apiTestLoading
                            ? isDarkMode
                              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {apiTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Test API Call (Direct)
                      </button>
                      {apiTestResult && (
                        <p className={`text-xs ${
                          apiTestResult.success
                            ? isDarkMode ? 'text-green-400' : 'text-green-600'
                            : isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`}>
                          {apiTestResult.message}
                        </p>
                      )}
                      <button
                        onClick={logoutClaudeCode}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isDarkMode
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <LogOut size={14} />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startOAuthLogin('max', false)}
                      disabled={oauthLoading || !!awaitingOAuthCode}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        oauthLoading || awaitingOAuthCode
                          ? isDarkMode
                            ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          : isDarkMode
                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {oauthLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                      Login with Claude Pro/Max
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Codex OAuth Section (OpenAI ChatGPT Plus/Pro) */}
            {window.electronAPI?.codex && (
              <>
                <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'} my-4`} />

                <div className={`p-4 rounded-xl border ${
                  codexStatus.authenticated
                    ? isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'
                    : isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        codexStatus.authenticated
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                      }`}>
                        <Zap size={16} />
                      </div>
                      <div>
                        <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                          Codex
                        </span>
                        <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          Use ChatGPT with your Plus/Pro subscription
                        </p>
                      </div>
                    </div>
                    {codexStatus.authenticated && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-500" />
                        <span className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Connected
                        </span>
                      </div>
                    )}
                  </div>

                  {codexStatus.authenticated ? (
                    <div className="space-y-3">
                      {codexStatus.expiresAt && (
                        <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          Token expires: {new Date(codexStatus.expiresAt).toLocaleString()}
                        </p>
                      )}
                      {/* Test Codex API Button */}
                      <button
                        onClick={testCodexApiCall}
                        disabled={codexTestLoading}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          codexTestLoading
                            ? isDarkMode
                              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {codexTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Test API Call (Direct)
                      </button>
                      {codexTestResult && (
                        <p className={`text-xs ${
                          codexTestResult.success
                            ? isDarkMode ? 'text-green-400' : 'text-green-600'
                            : isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`}>
                          {codexTestResult.message}
                        </p>
                      )}
                      <button
                        onClick={logoutCodex}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isDarkMode
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <LogOut size={14} />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startCodexLogin}
                      disabled={codexLoading}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        codexLoading
                          ? isDarkMode
                            ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          : isDarkMode
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {codexLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                      Login with ChatGPT Plus/Pro
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )

      case 'models':
        return (
          <div className="space-y-4">
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              Select which models are available in the model picker. Models require their provider to be configured.
            </p>

            {/* Group models by provider */}
            {['google', 'openai', 'anthropic', 'claude-code', 'codex'].map((providerId) => {
              const providerModels = settings.models.filter(m => m.provider === providerId)
              if (providerModels.length === 0) return null
              const providerEnabled = providerId === 'claude-code'
                ? claudeCodeStatus.authenticated
                : providerId === 'codex'
                  ? codexStatus.authenticated
                  : isProviderEnabled(providerId)

              return (
                <div key={providerId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                      {getProviderName(providerId)}
                    </h4>
                    {!providerEnabled && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {providerId === 'claude-code' || providerId === 'codex' ? 'Login with OAuth first' : 'Configure API key first'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {providerModels.map((model) => (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                        } ${!providerEnabled ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            model.enabled && providerEnabled
                              ? 'bg-blue-500/10 text-blue-500'
                              : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                          }`}>
                            <Brain size={16} />
                          </div>
                          <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                            {model.name}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleModelEnabled(model.id)}
                          disabled={!providerEnabled}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            model.enabled && providerEnabled
                              ? 'bg-blue-500'
                              : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                          } ${!providerEnabled ? 'cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              model.enabled && providerEnabled ? 'left-5' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )

      case 'mcp':
        return (
          <div className="space-y-4">
            {/* Header with Add button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                  MCP Servers
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                  Connect to Model Context Protocol servers for extended AI capabilities
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Refresh Discovery Button */}
                <button
                  onClick={discoverMcpServers}
                  disabled={isDiscovering}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  } ${isDiscovering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw size={14} className={isDiscovering ? 'animate-spin' : ''} />
                  {isDiscovering ? 'Discovering...' : 'Refresh'}
                </button>
                {/* Add Server Button */}
                <button
                  onClick={() => {
                    const newId = `mcp_${Date.now()}`
                    const newConnection: MCPServerConnection = {
                      id: newId,
                      name: 'New MCP Server',
                      type: 'mcp',
                      transport: { type: 'stdio', command: 'npx', args: ['-y', '@your/mcp-server'] },
                      enabled: false,
                      status: 'disconnected',
                    }
                    updateSettings({
                      connections: [...settings.connections, newConnection],
                    })
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                      : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  }`}
                >
                  <Plus size={14} />
                  Add Server
                </button>
              </div>
            </div>

            {/* Discovered Servers Section */}
            {Object.keys(discoveredServers).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    Discovered Servers ({Object.keys(discoveredServers).length})
                  </p>
                </div>
                {Object.entries(discoveredServers).map(([key, server]) => {
                  const baseName = server.name
                  const isServerEnabled = !disabledServers.has(baseName)
                  const isStdio = server.config.type === 'stdio'

                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-xl border transition-opacity ${
                        isServerEnabled
                          ? isDarkMode
                            ? 'border-blue-500/30 bg-blue-500/5'
                            : 'border-blue-200 bg-blue-50/50'
                          : isDarkMode
                            ? 'border-neutral-700 bg-neutral-800/30 opacity-60'
                            : 'border-stone-200 bg-stone-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                              {baseName}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${
                              isDarkMode
                                ? 'bg-neutral-700 text-neutral-300'
                                : 'bg-stone-200 text-stone-600'
                            }`}>
                              {server.source}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isStdio
                                ? isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                                : isDarkMode ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {isStdio ? 'STDIO' : 'SSE'}
                            </span>
                          </div>
                          <p className={`mt-1 text-xs truncate ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                            {isStdio
                              ? `${server.config.command}${server.config.args?.length ? ` ${server.config.args.join(' ')}` : ''}`
                              : server.config.url
                            }
                          </p>
                          {/* Tool chips */}
                          {server.tools && server.tools.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {server.tools.slice(0, 5).map((tool) => (
                                <span
                                  key={tool.name}
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    isDarkMode
                                      ? 'bg-neutral-700 text-neutral-400'
                                      : 'bg-stone-200 text-stone-500'
                                  }`}
                                  title={tool.description}
                                >
                                  {tool.displayName}
                                </span>
                              ))}
                              {server.tools.length > 5 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  isDarkMode
                                    ? 'bg-neutral-700 text-neutral-400'
                                    : 'bg-stone-200 text-stone-500'
                                }`}>
                                  +{server.tools.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                          {server.error && (
                            <p className={`mt-1 text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                              {server.error}
                            </p>
                          )}
                        </div>
                        {/* Enable/Disable toggle */}
                        <button
                          onClick={() => toggleServerEnabled(baseName)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            isServerEnabled
                              ? 'bg-blue-500'
                              : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              isServerEnabled ? 'left-5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Configured Servers Section Header */}
            {settings.connections.filter(c => c.type === 'mcp').length > 0 && (
              <p className={`text-sm font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                Configured Servers ({settings.connections.filter(c => c.type === 'mcp').length})
              </p>
            )}

            {/* MCP Server List */}
            <div className="space-y-3">
              {settings.connections.filter(c => c.type === 'mcp').map((connection) => {
                // Handle legacy connections that don't have transport property
                const legacyConn = connection as LegacyConnection & { url?: string }
                let mcpConn: MCPServerConnection
                if (!('transport' in connection) && legacyConn.url) {
                  // Migrate legacy connection to new format
                  mcpConn = {
                    ...connection,
                    type: 'mcp',
                    transport: { type: 'sse', url: legacyConn.url },
                  } as MCPServerConnection
                } else if (!('transport' in connection)) {
                  // Skip invalid connections
                  return null
                } else {
                  mcpConn = connection as MCPServerConnection
                }
                const isStdio = mcpConn.transport.type === 'stdio'
                const statusColor = mcpConn.status === 'connected' ? 'green'
                  : mcpConn.status === 'connecting' ? 'yellow'
                  : mcpConn.status === 'error' ? 'red'
                  : 'neutral'

                return (
                  <div
                    key={mcpConn.id}
                    className={`p-4 rounded-xl border ${
                      isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          mcpConn.status === 'connected'
                            ? 'bg-green-500/10 text-green-500'
                            : mcpConn.status === 'connecting'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : mcpConn.status === 'error'
                            ? 'bg-red-500/10 text-red-500'
                            : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                        }`}>
                          {isStdio ? <Terminal size={16} /> : <Globe size={16} />}
                        </div>
                        <div>
                          <input
                            type="text"
                            value={mcpConn.name}
                            onChange={(e) => {
                              updateSettings({
                                connections: settings.connections.map(c =>
                                  c.id === mcpConn.id ? { ...c, name: e.target.value } : c
                                ),
                              })
                            }}
                            className={`font-medium bg-transparent border-none outline-none ${
                              isDarkMode ? 'text-neutral-200' : 'text-stone-800'
                            }`}
                          />
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isStdio
                                ? isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                                : isDarkMode ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {isStdio ? 'STDIO' : 'SSE'}
                            </span>
                            {mcpConn.status && mcpConn.status !== 'disconnected' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                statusColor === 'green' ? isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
                                : statusColor === 'yellow' ? isDarkMode ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
                                : statusColor === 'red' ? isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                                : ''
                              }`}>
                                {mcpConn.status === 'connecting' && <Loader2 size={10} className="animate-spin" />}
                                {mcpConn.status === 'connected' && <CheckCircle size={10} />}
                                {mcpConn.status === 'error' && <AlertCircle size={10} />}
                                {mcpConn.status}
                              </span>
                            )}
                            {mcpConn.toolCount !== undefined && mcpConn.status === 'connected' && (
                              <span className={`text-xs flex items-center gap-1 ${
                                isDarkMode ? 'text-neutral-500' : 'text-stone-400'
                              }`}>
                                <Wrench size={10} />
                                {mcpConn.toolCount} tools
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Connect/Disconnect/Cancel Button */}
                        {window.electronAPI?.mcp && (
                          <button
                            onClick={async () => {
                              const mcp = window.electronAPI?.mcp
                              if (!mcp) return

                              if (mcpConn.status === 'connected' || mcpConn.status === 'connecting') {
                                // Disconnect or Cancel
                                await mcp.disconnect(mcpConn.id)
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id ? { ...c, status: 'disconnected', toolCount: undefined, error: undefined } : c
                                  ) as Connection[],
                                })
                                {mcpConn.toolCount} tools
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Connect/Disconnect/Cancel Button */}
                        {window.electronAPI?.mcp && (
                          <button
                            onClick={async () => {
                              const mcp = window.electronAPI?.mcp
                              if (!mcp) return

                              if (mcpConn.status === 'connected' || mcpConn.status === 'connecting') {
                                // Disconnect or Cancel
                                await mcp.disconnect(mcpConn.id)
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id ? { ...c, status: 'disconnected', toolCount: undefined, error: undefined } : c
                                  ) as Connection[],
                                })
                              } else {
                                // Connect
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id ? { ...c, status: 'connecting', error: undefined } : c
                                  ) as Connection[],
                                })
                                try {
                                  const result = await mcp.connect({
                                    id: mcpConn.id,
                                    name: mcpConn.name,
                                    transport: mcpConn.transport,
                                    enabled: true,
                                  })
                                  if (result.success) {
                                    const toolsResult = await mcp.listTools(mcpConn.id)
                                    updateSettings({
                                      connections: settings.connections.map(c =>
                                        c.id === mcpConn.id
                                          ? { ...c, status: 'connected', toolCount: toolsResult.tools?.length || 0, error: undefined }
                                          : c
                                      ) as Connection[],
                                    })
                                  } else {
                                    updateSettings({
                                      connections: settings.connections.map(c =>
                                        c.id === mcpConn.id ? { ...c, status: 'error', error: result.error } : c
                                      ) as Connection[],
                                    })
                                  }
                                } catch (err) {
                                  updateSettings({
                                    connections: settings.connections.map(c =>
                                      c.id === mcpConn.id ? { ...c, status: 'error', error: err instanceof Error ? err.message : 'Connection failed' } : c
                                    ) as Connection[],
                                  })
                                }
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              mcpConn.status === 'connected' || mcpConn.status === 'connecting'
                                ? isDarkMode
                                  ? 'text-red-400 hover:bg-red-500/10'
                                  : 'text-red-500 hover:bg-red-50'
                                : isDarkMode
                                  ? 'text-green-400 hover:bg-green-500/10'
                                  : 'text-green-500 hover:bg-green-50'
                            }`}
                            title={mcpConn.status === 'connected' ? 'Disconnect' : mcpConn.status === 'connecting' ? 'Cancel' : 'Connect'}
                          >
                            {mcpConn.status === 'connecting' ? (
                              <XCircle size={14} />
                            ) : mcpConn.status === 'connected' ? (
                              <Square size={14} />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => removeConnection(mcpConn.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDarkMode
                              ? 'text-neutral-500 hover:bg-red-500/10 hover:text-red-400'
                              : 'text-stone-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => toggleConnectionEnabled(mcpConn.id)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            mcpConn.enabled
                              ? 'bg-purple-500'
                              : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              mcpConn.enabled ? 'left-5' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Error Message */}
                    {mcpConn.error && (
                      <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
                        isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                      }`}>
                        {mcpConn.error}
                      </div>
                    )}

                    {/* Transport Config */}
                    <div className={`space-y-2 p-3 rounded-lg ${
                      isDarkMode ? 'bg-neutral-900/50' : 'bg-white'
                    }`}>
                      {/* Transport Type Selector */}
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => {
                            updateSettings({
                              connections: settings.connections.map(c =>
                                c.id === mcpConn.id
                                  ? { ...c, transport: { type: 'stdio', command: 'npx', args: ['-y', '@your/mcp-server'] } }
                                  : c
                              ) as Connection[],
                            })
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            isStdio
                              ? isDarkMode
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                              : isDarkMode
                                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
                                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <Terminal size={14} />
                          stdio
                        </button>
                        <button
                          onClick={() => {
                            updateSettings({
                              connections: settings.connections.map(c =>
                                c.id === mcpConn.id
                                  ? { ...c, transport: { type: 'sse', url: 'http://localhost:3001' } }
                                  : c
                              ) as Connection[],
                            })
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            !isStdio
                              ? isDarkMode
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-orange-100 text-orange-700 border border-orange-200'
                              : isDarkMode
                                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
                                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <Globe size={14} />
                          SSE/HTTP
                        </button>
                      </div>

                      {/* Stdio Config */}
                      {isStdio && (
                        <>
                          <div>
                            <label className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                              Command
                            </label>
                            <input
                              type="text"
                              value={(mcpConn.transport as MCPStdioTransport).command}
                              onChange={(e) => {
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id
                                      ? { ...c, transport: { ...mcpConn.transport, command: e.target.value } }
                                      : c
                                  ) as Connection[],
                                })
                              }}
                              placeholder="npx, node, python, etc."
                              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                                isDarkMode
                                  ? 'bg-neutral-800 border-neutral-700 text-neutral-200 placeholder-neutral-500'
                                  : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
                              } border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                            />
                          </div>
                          <div>
                            <label className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                              Arguments (one per line)
                            </label>
                            <textarea
                              value={(mcpConn.transport as MCPStdioTransport).args?.join('\n') || ''}
                              onChange={(e) => {
                                const args = e.target.value.split('\n').filter(a => a.trim())
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id
                                      ? { ...c, transport: { ...mcpConn.transport, args } }
                                      : c
                                  ) as Connection[],
                                })
                              }}
                              placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/allowed"
                              rows={3}
                              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm font-mono ${
                                isDarkMode
                                  ? 'bg-neutral-800 border-neutral-700 text-neutral-200 placeholder-neutral-500'
                                  : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
                              } border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                            />
                          </div>
                        </>
                      )}

                      {/* SSE Config */}
                      {!isStdio && (
                        <>
                          <div>
                            <label className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                              Server URL
                            </label>
                            <input
                              type="text"
                              value={(mcpConn.transport as MCPSSETransport).url}
                              onChange={(e) => {
                                updateSettings({
                                  connections: settings.connections.map(c =>
                                    c.id === mcpConn.id
                                      ? { ...c, transport: { ...mcpConn.transport, url: e.target.value } }
                                      : c
                                  ) as Connection[],
                                })
                              }}
                              placeholder="http://localhost:3001"
                              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                                isDarkMode
                                  ? 'bg-neutral-800 border-neutral-700 text-neutral-200 placeholder-neutral-500'
                                  : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
                              } border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                            />
                          </div>
                          <div>
                            <label className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                              Headers (JSON)
                            </label>
                            <input
                              type="text"
                              value={JSON.stringify((mcpConn.transport as MCPSSETransport).headers || {})}
                              onChange={(e) => {
                                try {
                                  const headers = JSON.parse(e.target.value || '{}')
                                  updateSettings({
                                    connections: settings.connections.map(c =>
                                      c.id === mcpConn.id
                                        ? { ...c, transport: { ...mcpConn.transport, headers } }
                                        : c
                                    ) as Connection[],
                                  })
                                } catch {
                                  // Invalid JSON, ignore
                                }
                              }}
                              placeholder='{"Authorization": "Bearer token"}'
                              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm font-mono ${
                                isDarkMode
                                  ? 'bg-neutral-800 border-neutral-700 text-neutral-200 placeholder-neutral-500'
                                  : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
                              } border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                            />
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                              Optional auth headers for remote servers
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {settings.connections.filter(c => c.type === 'mcp').length === 0 && (
                <div className={`text-center py-8 rounded-xl border-2 border-dashed ${
                  isDarkMode ? 'border-neutral-700 text-neutral-500' : 'border-stone-200 text-stone-400'
                }`}>
                  <Plug size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No MCP servers configured</p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-600' : 'text-stone-300'}`}>
                    Add a server to extend AI capabilities with custom tools
                  </p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className={`p-3 rounded-lg ${
              isDarkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
            }`}>
              <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <strong>MCP (Model Context Protocol)</strong> servers extend AI capabilities with custom tools.
                Use <strong>stdio</strong> for local servers (npx, node, python) or <strong>SSE</strong> for remote HTTP servers.
              </p>
            </div>
          </div>
        )

      case 'themes':
        return (
          <div className="space-y-6">
            <div>
              <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                Application Theme
              </h3>
              <p className={`text-xs mb-4 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                Choose a color theme for the application. Themes change the overall look and feel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => {
                const isSelected = currentTheme.id === theme.id
                const previewBg = theme.colors?.background || (isDarkMode ? '#1a1b26' : '#ffffff')
                const previewFg = theme.colors?.foreground || (isDarkMode ? '#c0caf5' : '#1a1a1a')
                const previewPrimary = theme.colors?.primary || '#7aa2f7'
                const previewAccent = theme.colors?.accent || '#7dcfff'

                return (
                  <button
                    key={theme.id}
                    onClick={() => setTheme(theme.id)}
                    className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : isDarkMode
                          ? 'border-neutral-700 hover:border-neutral-600'
                          : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {/* Theme Preview */}
                    <div
                      className="h-16 rounded-lg mb-2 relative overflow-hidden"
                      style={{ backgroundColor: previewBg }}
                    >
                      {/* Preview elements */}
                      <div className="absolute inset-2 flex flex-col gap-1">
                        <div
                          className="h-2 w-3/4 rounded"
                          style={{ backgroundColor: previewFg, opacity: 0.8 }}
                        />
                        <div
                          className="h-2 w-1/2 rounded"
                          style={{ backgroundColor: previewPrimary }}
                        />
                        <div className="flex gap-1 mt-auto">
                          <div
                            className="h-3 w-8 rounded"
                            style={{ backgroundColor: previewPrimary }}
                          />
                          <div
                            className="h-3 w-6 rounded"
                            style={{ backgroundColor: previewAccent }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Theme Info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                          {theme.name}
                        </span>
                        <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          {theme.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Info Box */}
            <div className={`p-3 rounded-lg ${
              isDarkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
            }`}>
              <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <strong>Tip:</strong> Select "System Default" to automatically follow your system's light/dark mode preference.
              </p>
            </div>
          </div>
        )

      case 'pro':
        return (
          <FastApplySettings isDarkMode={isDarkMode} isPro={true} />
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-3xl h-[600px] rounded-2xl shadow-2xl flex overflow-hidden ${
          isDarkMode ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        {/* Sidebar */}
        <div className={`w-52 flex-shrink-0 border-r ${
          isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className={`p-4 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              Settings
            </h2>
          </div>

          <nav className="p-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  activeSection === section.id
                    ? isDarkMode
                      ? 'bg-neutral-700 text-white'
                      : 'bg-stone-200 text-stone-900'
                    : isDarkMode
                      ? 'text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200'
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                }`}
              >
                {section.icon}
                <span className="text-sm font-medium">{section.label}</span>
                {activeSection === section.id && (
                  <ChevronRight size={14} className="ml-auto" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-neutral-700' : 'border-stone-200'
          }`}>
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h3>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'hover:bg-neutral-700 text-neutral-400'
                  : 'hover:bg-stone-100 text-stone-500'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to get font size CSS value
export function getFontSizeValue(fontSize: FontSize): string {
  return FONT_SIZE_MAP[fontSize]
}
