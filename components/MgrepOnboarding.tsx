import React, { useState, useEffect } from 'react'
import { Search, Zap, X, Clock } from 'lucide-react'

interface MgrepOnboardingProps {
  isDarkMode: boolean
  onAccept: () => void
  onDecline: () => void
  onClose: () => void
}

// Mock search results for demo
const MOCK_GREP_RESULTS = [
  { file: 'src/auth/login.tsx', line: 45, content: 'const handleLogin = async (email, password) => {', match: false },
  { file: 'src/components/LoginForm.tsx', line: 12, content: 'export function LoginForm() {', match: false },
  { file: 'src/api/auth.ts', line: 78, content: '// Authentication endpoint', match: false },
  { file: 'src/utils/validation.ts', line: 23, content: 'function validateEmail(email: string) {', match: false },
]

const MOCK_SEMANTIC_RESULTS = [
  { file: 'src/auth/AuthProvider.tsx', line: 156, content: 'async function handleAuthentication(credentials: LoginCredentials) {\n  // JWT token validation and user session management\n  const token = await validateCredentials(credentials);', similarity: 89, match: true },
  { file: 'src/middleware/authMiddleware.ts', line: 34, content: 'export const requireAuth = async (req, res, next) => {\n  // Check JWT token and verify user permissions', similarity: 76, match: true },
  { file: 'src/hooks/useAuth.ts', line: 23, content: 'export function useAuth() {\n  const login = async (email: string, password: string) => {', similarity: 68, match: true },
]

export function MgrepOnboardingDemo({ isDarkMode, onAccept, onDecline, onClose }: MgrepOnboardingProps) {
  const [stage, setStage] = useState<'intro' | 'demo' | 'results'>('intro')
  const [grepResults, setGrepResults] = useState<typeof MOCK_GREP_RESULTS>([])
  const [semanticResults, setSemanticResults] = useState<typeof MOCK_SEMANTIC_RESULTS>([])
  const [grepTime, setGrepTime] = useState<number | null>(null)
  const [semanticTime, setSemanticTime] = useState<number | null>(null)
  const [searchQuery] = useState('authentication handler')

  useEffect(() => {
    if (stage === 'demo') {
      // Reset results when entering demo stage
      setGrepResults([])
      setSemanticResults([])
      setGrepTime(null)
      setSemanticTime(null)

      const timeouts: NodeJS.Timeout[] = []
      const intervals: NodeJS.Timeout[] = []

      // Simulate grep search (slower, less relevant)
      const grepTimeout = setTimeout(() => {
        let shown = 0
        const interval = setInterval(() => {
          if (shown < MOCK_GREP_RESULTS.length) {
            setGrepResults(prev => [...prev, MOCK_GREP_RESULTS[shown]])
            shown++
          } else {
            clearInterval(interval)
            setGrepTime(847) // Fake timing
          }
        }, 120)
        intervals.push(interval)
      }, 100)
      timeouts.push(grepTimeout)

      // Simulate semantic search (faster, more relevant)
      const semanticTimeout = setTimeout(() => {
        let shown = 0
        const interval = setInterval(() => {
          if (shown < MOCK_SEMANTIC_RESULTS.length) {
            setSemanticResults(prev => [...prev, MOCK_SEMANTIC_RESULTS[shown]])
            shown++
          } else {
            clearInterval(interval)
            setSemanticTime(234) // Fake timing - faster
            const resultTimeout = setTimeout(() => setStage('results'), 800)
            timeouts.push(resultTimeout)
          }
        }, 80)
        intervals.push(interval)
      }, 100)
      timeouts.push(semanticTimeout)

      // Cleanup function
      return () => {
        timeouts.forEach(clearTimeout)
        intervals.forEach(clearInterval)
      }
    }
  }, [stage])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={`relative max-w-4xl w-full rounded-2xl border ${
        isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-200'
      } shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-neutral-700' : 'border-stone-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                AI-Powered Code Search
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                Find code by meaning, not just keywords
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-stone-100'
            }`}
          >
            <X size={18} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === 'intro' && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-base font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                  What is Semantic Search?
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'} leading-relaxed`}>
                  Instead of searching for exact keywords, Cluso understands <strong>what you mean</strong>.
                  Ask for "authentication handler" and it finds JWT validation code, login functions,
                  and auth middleware - even if they don't contain those exact words.
                </p>
              </div>

              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <div className="flex items-start gap-3">
                  <Zap size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <h4 className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Fast & Local
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-blue-300/80' : 'text-blue-700'}`}>
                      Runs completely offline with local AI models. No API costs, no internet required.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStage('demo')}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium transition-all"
              >
                See Live Demo
              </button>
            </div>
          )}

          {stage === 'demo' && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-stone-100'}`}>
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-blue-500" />
                  <span className={`text-sm font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                    "{searchQuery}"
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Grep Column */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      Grep (Keyword)
                    </span>
                    {grepTime && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-green-500" />
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                          {grepTime}ms
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[300px]">
                    {grepResults.map((result, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border animate-fadeIn ${
                          isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
                        }`}
                        style={{ animationDelay: `${i * 120}ms` }}
                      >
                        <div className="mb-1">
                          <span className={`text-xs font-mono ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {result.file}:{result.line}
                          </span>
                        </div>
                        <pre className={`text-xs font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                          {result.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Semantic Column */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      Cluso (AI)
                    </span>
                    {semanticTime && (
                      <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-purple-500" />
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                          {semanticTime}ms
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[300px]">
                    {semanticResults.map((result, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border animate-fadeIn ${
                          result.match
                            ? isDarkMode ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
                            : isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
                        }`}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-mono ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                            {result.file}:{result.line}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            result.similarity > 80
                              ? 'bg-green-500/20 text-green-400'
                              : result.similarity > 65
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-neutral-500/20 text-neutral-400'
                          }`}>
                            {result.similarity}%
                          </span>
                        </div>
                        <pre className={`text-xs font-mono ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                          {result.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {stage === 'results' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200'}`}>
                <h3 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                  The Difference
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                        <span className="text-green-500 text-sm font-bold">Grep</span>
                      </div>
                      <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-600'}`}>847ms</span>
                    </div>
                    <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                      Found 4 matches, but none were actually authentication handlers - just files with similar words.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                        <Zap size={16} className="text-purple-500" />
                      </div>
                      <span className={`text-xs ${isDarkMode ? 'text-purple-400' : 'text-purple-600'} font-semibold`}>234ms</span>
                    </div>
                    <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                      Found 3 results - all actual authentication code. <strong className="text-purple-500">3.6x faster</strong> and more accurate.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>
                  Enable for your project?
                </h3>
                <p className={`text-sm mb-4 ${isDarkMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                  Indexing will run in the background (takes ~30 seconds for typical projects).
                  You can always disable it later in Settings.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      localStorage.setItem('mgrep-onboarding-seen', 'true')
                      localStorage.setItem('mgrep-auto-init', 'true')
                      onAccept()
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium transition-all"
                  >
                    Enable AI Search
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('mgrep-onboarding-seen', 'true')
                      localStorage.setItem('mgrep-auto-init', 'false')
                      onDecline()
                    }}
                    className={`px-4 py-3 rounded-xl transition-colors ${
                      isDarkMode
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
