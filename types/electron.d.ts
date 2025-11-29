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

interface OAuthResult {
  success: boolean
  error?: string
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
  api: ElectronApiAPI
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
