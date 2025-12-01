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

interface FileStat {
  size: number
  isFile: boolean
  isDirectory: boolean
  created: string
  modified: string
}

interface FileExistsResult {
  success: boolean
  exists: boolean
}

interface SearchMatch {
  file: string
  line: number
  content: string
}

interface GlobMatch {
  path: string
  relativePath: string
  isDirectory: boolean
}

interface FileReadResult {
  path: string
  success: boolean
  content?: string
  error?: string
}

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface SearchOptions {
  filePattern?: string
  maxResults?: number
  caseSensitive?: boolean
}

interface TreeOptions {
  maxDepth?: number
  includeHidden?: boolean
}

interface SaveImageResult {
  path: string
  size: number
  mimeType: string
}

interface ElectronFilesAPI {
  // Read operations
  readFile: (path: string) => Promise<GitResult>
  selectFile: (path: string) => Promise<GitResult<{path: string; content: string}>>
  listDirectory: (path?: string) => Promise<GitResult<DirectoryEntry[]>>
  listPrompts: () => Promise<GitResult<string[]>>
  readPrompt: (name: string) => Promise<GitResult>
  readMultiple: (paths: string[]) => Promise<GitResult<FileReadResult[]>>
  // Write operations
  writeFile: (path: string, content: string) => Promise<GitResult>
  createFile: (path: string, content?: string) => Promise<GitResult>
  deleteFile: (path: string) => Promise<GitResult>
  renameFile: (oldPath: string, newPath: string) => Promise<GitResult>
  copyFile: (srcPath: string, destPath: string) => Promise<GitResult>
  // Save base64 image to file (for image uploads)
  saveImage: (base64DataUrl: string, destPath: string) => Promise<GitResult<SaveImageResult>>
  // Directory operations
  createDirectory: (path: string) => Promise<GitResult>
  deleteDirectory: (path: string) => Promise<GitResult>
  getTree: (path?: string, options?: TreeOptions) => Promise<GitResult<FileTreeNode[]>>
  // Get current working directory
  getCwd: () => Promise<GitResult>
  // Search operations
  searchInFiles: (pattern: string, dirPath?: string, options?: SearchOptions) => Promise<GitResult<SearchMatch[]>>
  glob: (pattern: string, dirPath?: string) => Promise<GitResult<GlobMatch[]>>
  // Utility operations
  exists: (path: string) => Promise<FileExistsResult>
  stat: (path: string) => Promise<GitResult<FileStat>>
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

// MCP (Model Context Protocol) types
interface MCPServerConfig {
  id: string
  name: string
  transport: MCPStdioTransport | MCPSSETransport
  enabled: boolean
  timeout?: number
}

interface MCPStdioTransport {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

interface MCPSSETransport {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

interface MCPToolCall {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

interface MCPToolResult {
  success: boolean
  content?: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  error?: string
  isError?: boolean
}

interface MCPEvent {
  type: string
  serverId: string
  timestamp: number
  data?: unknown
}

interface MCPServerState {
  config: MCPServerConfig
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
  capabilities?: unknown
  tools: MCPTool[]
  resources: unknown[]
  prompts: unknown[]
}

interface ElectronMCPAPI {
  connect: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string; capabilities?: unknown }>
  disconnect: (serverId: string) => Promise<{ success: boolean }>
  listTools: (serverId: string) => Promise<{ tools: MCPTool[]; error?: string }>
  listResources: (serverId: string) => Promise<{ resources: unknown[]; error?: string }>
  listPrompts: (serverId: string) => Promise<{ prompts: unknown[]; error?: string }>
  callTool: (call: MCPToolCall) => Promise<MCPToolResult>
  readResource: (serverId: string, uri: string) => Promise<{ content?: unknown; error?: string }>
  getPrompt: (serverId: string, name: string, args?: Record<string, string>) => Promise<{ messages?: unknown[]; error?: string }>
  getStatus: () => Promise<Record<string, MCPServerState>>
  onEvent: (callback: (event: MCPEvent) => void) => () => void
}

// Voice logging types
interface VoiceLogSession {
  sessionId: string
  startTime: string
  endTime?: string
  context: {
    projectFolder: string
    currentUrl?: string
    selectedElement?: {
      tagName: string
      text?: string
      className?: string
    } | null
  }
  entries: VoiceLogEntry[]
  summary?: {
    totalUserInputs: number
    totalAiResponses: number
    toolCallsCount: number
    errorsCount: number
    clarificationsCount: number
  }
}

interface VoiceLogEntry {
  timestamp: string
  type: 'session_start' | 'session_end' | 'user_input' | 'ai_response' | 'tool_call' | 'error' | 'clarification'
  data: Record<string, unknown>
}

interface VoiceLogInfo {
  sessionId: string
  path: string
}

interface ElectronVoiceAPI {
  ensureLogDir: () => Promise<GitResult<string>>
  saveLog: (sessionId: string, content: string) => Promise<GitResult<string>>
  listLogs: () => Promise<GitResult<VoiceLogInfo[]>>
  readLog: (sessionId: string) => Promise<GitResult<VoiceLogSession>>
  getUnprocessedLogs: () => Promise<GitResult<VoiceLogSession[]>>
  markProcessed: (sessionIds: string[]) => Promise<GitResult>
  saveLearnings: (content: string) => Promise<GitResult<string>>
  readLearnings: () => Promise<GitResult<string>>
  getLogPath: () => Promise<GitResult<string>>
  getLearningsPath: () => Promise<GitResult<string>>
}

// Tab data persistence types
import { KanbanColumn, TodoItem } from './tab'

interface TabDataKanban {
  columns: KanbanColumn[]
  updatedAt?: string
}

interface TabDataTodos {
  items: TodoItem[]
  updatedAt?: string
}

interface TabDataNotes {
  content: string
  updatedAt?: string
}

interface ElectronTabDataAPI {
  ensureDir: (projectPath?: string) => Promise<GitResult<string>>
  saveKanban: (projectPath: string | undefined, data: TabDataKanban) => Promise<GitResult<string>>
  loadKanban: (projectPath?: string) => Promise<GitResult<TabDataKanban | null>>
  saveTodos: (projectPath: string | undefined, data: TabDataTodos) => Promise<GitResult<string>>
  loadTodos: (projectPath?: string) => Promise<GitResult<TabDataTodos | null>>
  saveNotes: (projectPath: string | undefined, data: TabDataNotes) => Promise<GitResult<string>>
  loadNotes: (projectPath?: string) => Promise<GitResult<TabDataNotes | null>>
  list: (projectPath?: string) => Promise<GitResult<string[]>>
}

interface ElectronAISdkAPI {
  streamAI: (params: {
    messages: unknown[]
    model: string
    providerConfigs: unknown
    agentSystemPrompt?: string
    tools?: unknown[]
    thinkingLevel?: string
    mcpToolDefinitions?: unknown[]
    onChunk?: (chunk: string) => void
    onComplete?: (fullText: string) => void
    onError?: (error: string) => void
  }) => Promise<{ success: boolean; error?: string }>
}

interface ElectronAPI {
  git: ElectronGitAPI
  files: ElectronFilesAPI
  aiSdk: ElectronAISdkAPI
  oauth: ElectronOAuthAPI
  codex: ElectronCodexAPI
  api: ElectronApiAPI
  claudeCode: ElectronClaudeCodeAPI
  mcp?: ElectronMCPAPI
  voice?: ElectronVoiceAPI
  tabdata?: ElectronTabDataAPI
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
