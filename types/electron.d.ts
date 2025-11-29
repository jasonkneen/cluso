interface GitResult<T = string> {
  success: boolean
  data?: T
  error?: string
}

interface GitStatus {
  files: { status: string; file: string }[]
  hasChanges: boolean
}

interface ElectronGitAPI {
  getCurrentBranch: () => Promise<GitResult>
  getBranches: () => Promise<GitResult<string[]>>
  checkout: (branch: string) => Promise<GitResult>
  createBranch: (name: string) => Promise<GitResult>
  getStatus: () => Promise<GitResult<GitStatus>>
  commit: (message: string) => Promise<GitResult>
  push: () => Promise<GitResult>
  pull: () => Promise<GitResult>
  stash: () => Promise<GitResult>
  stashWithMessage: (message: string) => Promise<GitResult>
  stashPop: () => Promise<GitResult>
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface ElectronFilesAPI {
  readFile: (path: string) => Promise<GitResult>
  selectFile: (path: string) => Promise<GitResult<{path: string; content: string}>>
  listDirectory: (path?: string) => Promise<GitResult<DirectoryEntry[]>>
  listPrompts: () => Promise<GitResult<string[]>>
  readPrompt: (name: string) => Promise<GitResult>
}

// OAuth types
type OAuthMode = 'max' | 'console'

interface OAuthStartResult {
  success: boolean
  authUrl?: string
  error?: string
  // When autoCompleted is true, OAuth flow completed via callback server automatically
  autoCompleted?: boolean
  // The mode of authentication that was completed
  mode?: 'api-key' | 'oauth'
  // If mode is 'api-key', this contains the created API key
  apiKey?: string
}

interface OAuthCompleteResult {
  success: boolean
  apiKey?: string
  mode?: 'api-key' | 'oauth'
  error?: string
}

interface OAuthStatusResult {
  authenticated: boolean
  expiresAt: number | null
}

interface OAuthAccessTokenResult {
  success: boolean
  accessToken?: string
  error?: string
}

interface OAuthApiKeyResult {
  success: boolean
  apiKey?: string
  error?: string
}

interface OAuthTestApiResult {
  success: boolean
  response?: unknown
  error?: string
  status?: number
}

interface OAuthResult {
  success: boolean
  error?: string
}

// Claude Code SDK types
interface ClaudeCodeStartOptions {
  prompt: string
  model?: 'fast' | 'smart'
  cwd?: string
}

interface ClaudeCodeResult {
  success: boolean
  error?: string
}

interface ClaudeCodeActiveResult {
  active: boolean
}

interface ClaudeCodeToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

interface ClaudeCodeToolResult {
  toolUseId: string
  content: string
  isError: boolean
}

interface ElectronClaudeCodeAPI {
  startSession: (options: ClaudeCodeStartOptions) => Promise<ClaudeCodeResult>
  sendMessage: (text: string) => Promise<ClaudeCodeResult>
  isActive: () => Promise<ClaudeCodeActiveResult>
  stop: () => Promise<ClaudeCodeResult>
  reset: () => Promise<ClaudeCodeResult>
  onTextChunk: (callback: (text: string) => void) => () => void
  onToolUse: (callback: (toolUse: ClaudeCodeToolUse) => void) => () => void
  onToolResult: (callback: (result: ClaudeCodeToolResult) => void) => () => void
  onComplete: (callback: () => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

interface ElectronOAuthAPI {
  // Start OAuth login flow - mode: 'max' for Claude Pro/Max, 'console' for Console API
  startLogin: (mode: OAuthMode) => Promise<OAuthStartResult>
  // Complete OAuth login by exchanging code for tokens
  // createKey: true = get API key, false = keep OAuth tokens for Claude Code
  completeLogin: (code: string, createKey?: boolean) => Promise<OAuthCompleteResult>
  // Cancel OAuth flow
  cancel: () => Promise<OAuthResult>
  // Get OAuth status
  getStatus: () => Promise<OAuthStatusResult>
  // Logout (clear OAuth tokens)
  logout: () => Promise<OAuthResult>
  // Get valid access token (handles refresh if needed)
  getAccessToken: () => Promise<OAuthAccessTokenResult>
  // Get Claude Code API key (created from OAuth)
  getClaudeCodeApiKey: () => Promise<OAuthApiKeyResult>
  // Direct test of Anthropic API with OAuth token (bypasses AI SDK)
  testApi: () => Promise<OAuthTestApiResult>
}

// Codex OAuth types (for OpenAI ChatGPT Plus/Pro)
interface CodexStartResult {
  success: boolean
  authUrl?: string
  error?: string
  autoCompleted?: boolean
}

interface CodexStatusResult {
  authenticated: boolean
  expiresAt: number | null
}

interface CodexAccessTokenResult {
  success: boolean
  accessToken?: string
  error?: string
}

interface CodexTestApiResult {
  success: boolean
  response?: unknown
  error?: string
  status?: number
}

interface CodexResult {
  success: boolean
  error?: string
}

interface ElectronCodexAPI {
  // Start Codex OAuth login flow
  startLogin: () => Promise<CodexStartResult>
  // Cancel OAuth flow
  cancel: () => Promise<CodexResult>
  // Get OAuth status
  getStatus: () => Promise<CodexStatusResult>
  // Logout (clear OAuth tokens)
  logout: () => Promise<CodexResult>
  // Get valid access token (handles refresh if needed)
  getAccessToken: () => Promise<CodexAccessTokenResult>
  // Direct test of Codex API with OAuth token
  testApi: () => Promise<CodexTestApiResult>
}

interface ApiProxyRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

interface ApiProxyResponse {
  ok: boolean
  status: number
  statusText: string
  headers?: Record<string, string>
  body?: unknown
  isStream?: boolean
  error?: string
}

interface ElectronApiAPI {
  proxy: (request: ApiProxyRequest) => Promise<ApiProxyResponse>
}

interface ElectronAPI {
  git: ElectronGitAPI
  files: ElectronFilesAPI
  oauth: ElectronOAuthAPI
  codex: ElectronCodexAPI
  api: ElectronApiAPI
  claudeCode: ElectronClaudeCodeAPI
  getWebviewPreloadPath: () => Promise<string>
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        preload?: string
        allowpopups?: string
        webpreferences?: string
        partition?: string
        httpreferrer?: string
        useragent?: string
        disablewebsecurity?: string
        nodeintegration?: string
        nodeintegrationinsubframes?: string
        plugins?: string
        enableremotemodule?: string
      }, HTMLElement>
    }
  }
}

export {}
