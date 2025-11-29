import React, { useState } from 'react'
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
} from 'lucide-react'

type SettingsSection = 'general' | 'display' | 'providers' | 'models' | 'connections'

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

export interface Connection {
  id: string
  name: string
  type: 'mcp' | 'api' | 'websocket'
  url: string
  enabled: boolean
}

export type FontSize = 'small' | 'medium' | 'large'

export interface AppSettings {
  autoConnect: boolean
  sendAnalytics: boolean
  fontSize: FontSize
  showLineNumbers: boolean
  providers: Provider[]
  models: SettingsModel[]
  connections: Connection[]
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
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', provider: 'google', enabled: true },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', enabled: true },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', enabled: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', enabled: true },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: false },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', enabled: false },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', enabled: false },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', enabled: false },
  ],
  connections: [
    { id: '1', name: 'Local MCP Server', type: 'mcp', url: 'http://localhost:3001', enabled: false },
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
  { id: 'connections', label: 'Connections', icon: <Plug size={18} /> },
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
                </div>
              ))}
            </div>
          </div>
        )

      case 'models':
        return (
          <div className="space-y-4">
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              Select which models are available in the model picker. Models require their provider to be configured.
            </p>

            {/* Group models by provider */}
            {['google', 'openai', 'anthropic'].map((providerId) => {
              const providerModels = settings.models.filter(m => m.provider === providerId)
              const providerEnabled = isProviderEnabled(providerId)

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
                        Configure API key first
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

      case 'connections':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                Configure external connections like MCP servers and APIs.
              </p>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {settings.connections.map((connection) => (
                <div
                  key={connection.id}
                  className={`p-4 rounded-xl border ${
                    isDarkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        connection.enabled
                          ? 'bg-purple-500/10 text-purple-500'
                          : isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-400'
                      }`}>
                        <Plug size={16} />
                      </div>
                      <div>
                        <span className={`font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-800'}`}>
                          {connection.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-200 text-stone-500'
                          }`}>
                            {connection.type.toUpperCase()}
                          </span>
                          <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                            {connection.url}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeConnection(connection.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-neutral-500 hover:bg-red-500/10 hover:text-red-400'
                            : 'text-stone-400 hover:bg-red-50 hover:text-red-500'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => toggleConnectionEnabled(connection.id)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          connection.enabled
                            ? 'bg-purple-500'
                            : isDarkMode ? 'bg-neutral-600' : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            connection.enabled ? 'left-5' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {settings.connections.length === 0 && (
                <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                  No connections configured
                </div>
              )}
            </div>
          </div>
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
