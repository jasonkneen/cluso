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
  checkoutFile: (filePath: string) => Promise<GitResult>
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
  findFiles: (searchDir: string, filename: string) => Promise<GitResult<string[]>>
  lintCode: (code: string, filePath?: string) => Promise<GitResult<{ valid: boolean; errors?: string[] }>>
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
  discover?: () => Promise<{ servers: MCPServerConfig[]; error?: string }>
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
  boardId: string
  boardTitle: string
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
  // V2 API additions
  initialize: () => Promise<{ success: boolean }>
  stream: (options: {
    requestId: string
    modelId: string
    messages: Array<{ role: string; content: string }>
    providers: Record<string, string>
    system?: string
    tools?: Record<string, { description: string; parameters: Record<string, unknown> }>
    maxSteps?: number
    enableReasoning?: boolean
    mcpTools?: Array<{ name: string; description?: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] }; serverId: string }>
    projectFolder?: string
  }) => Promise<{ success: boolean; requestId: string }>
  generate: (options: {
    modelId: string
    messages: Array<{ role: string; content: string }>
    providers: Record<string, string>
    system?: string
    tools?: Record<string, { description: string; parameters: Record<string, unknown> }>
    maxSteps?: number
    mcpTools?: Array<{ name: string; description?: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] }; serverId: string }>
    projectFolder?: string
  }) => Promise<{
    success: boolean
    text?: string
    toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>
    toolResults?: Array<{ toolCallId: string; toolName: string; result: unknown }>
    finishReason?: string
    error?: string
  }>
  executeMCPTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<{
    success: boolean
    content?: Array<{ type: string; text?: string }>
    error?: string
  }>
  getModels: () => Promise<{ models: string[]; providers: string[] }>
  getProvider: (modelId: string) => Promise<{ provider: string | null }>
  onTextChunk: (callback: (data: { requestId: string; chunk: string }) => void) => () => void
  onStepFinish: (callback: (data: {
    requestId: string
    text: string
    toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>
    toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>
  }) => void) => () => void
  onComplete: (callback: (data: {
    requestId: string
    text: string
    reasoning?: string
    toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>
    toolResults?: Array<{ toolCallId: string; toolName: string; result: unknown }>
    finishReason: string
  }) => void) => () => void
  onError: (callback: (data: { requestId: string; error: string }) => void) => () => void
  removeAllListeners: () => void
  webSearch: (query: string, maxResults?: number) => Promise<{
    success: boolean
    query?: string
    results?: Array<{ title: string; url: string; snippet: string }>
    count?: number
    error?: string
  }>
}

// Agent SDK API (Claude 4.5+ models with extended thinking and streaming)
interface ElectronAgentSdkAPI {
  stream: (options: {
    requestId: string
    modelId: string
    messages: Array<{ role: string; content: string }>
    system?: string
    maxThinkingTokens?: number
    projectFolder?: string
    mcpTools?: Array<{ name: string; description?: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] }; serverId: string }>
  }) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stop: () => Promise<boolean>
  reset: () => Promise<void>
  isActive: () => Promise<boolean>
  supportsModel: (modelId: string) => Promise<boolean>
  onTextChunk: (callback: (data: { requestId: string; chunk: string }) => void) => () => void
  onThinkingStart: (callback: (data: { requestId: string; index: number }) => void) => () => void
  onThinkingChunk: (callback: (data: { requestId: string; chunk: string; index: number }) => void) => () => void
  onToolStart: (callback: (data: { requestId: string; toolCallId: string; toolName: string; index: number }) => void) => () => void
  onToolInputDelta: (callback: (data: { requestId: string; toolCallId: string; delta: string; index: number }) => void) => () => void
  onToolResult: (callback: (data: { requestId: string; toolCallId: string; result: string; isError: boolean }) => void) => () => void
  onBlockStop: (callback: (data: { requestId: string; index: number }) => void) => () => void
  onComplete: (callback: (data: { requestId: string; text: string; thinking?: string }) => void) => () => void
  onError: (callback: (data: { requestId: string; error: string }) => void) => () => void
  onInterrupted: (callback: (data: { requestId: string }) => void) => () => void
  onFileModified: (callback: (event: { type: 'write' | 'create' | 'delete'; path: string; originalContent?: string; newContent?: string }) => void) => () => void
  removeAllListeners: () => void
}

// Fast Apply types (Local LLM for instant code merging) - Pro Feature
type FastApplyModelVariant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'F16'

interface FastApplyModelInfo {
  variant: FastApplyModelVariant
  file: string
  size: number
  quality: string
  memory: number
  description: string
  downloaded: boolean
  path?: string
}

interface FastApplyStatus {
  ready: boolean
  activeModel: FastApplyModelVariant | null
  modelLoaded: boolean
  downloadedModels: FastApplyModelVariant[]
  storageDir: string
}

interface FastApplyDownloadProgress {
  variant: FastApplyModelVariant
  downloaded: number
  total: number
  percent: number
  speed: number
  eta: number
}

interface FastApplyResult {
  success: boolean
  code?: string
  error?: string
  tokensUsed?: number
  durationMs?: number
}

interface ElectronFastApplyAPI {
  getStatus: () => Promise<FastApplyStatus>
  listModels: () => Promise<{ success: boolean; models?: FastApplyModelInfo[]; error?: string }>
  download: (variant?: FastApplyModelVariant) => Promise<{ success: boolean; path?: string; error?: string }>
  setModel: (variant: FastApplyModelVariant) => Promise<{ success: boolean; error?: string }>
  load: (variant?: FastApplyModelVariant) => Promise<{ success: boolean; error?: string }>
  apply: (code: string, update: string) => Promise<FastApplyResult>
  cancel: () => Promise<{ success: boolean }>
  delete: (variant: FastApplyModelVariant) => Promise<{ success: boolean; error?: string }>
  unload: () => Promise<{ success: boolean }>
  onProgress: (callback: (progress: FastApplyDownloadProgress) => void) => () => void
  onModelLoaded: (callback: () => void) => () => void
  onModelUnloaded: (callback: () => void) => () => void
}

// Selector Agent types (persistent Claude Agent SDK session for element selection)
interface SelectorAgentInitOptions {
  cwd?: string
  modelId?: string
}

interface SelectorAgentResult {
  success: boolean
  error?: string
}

interface SelectorAgentActiveResult {
  active: boolean
}

interface SelectorAgentContextState {
  isPrimed: boolean
  pageUrl: string | null
  pageTitle: string | null
  lastPrimedAt: number | null
}

interface SelectorAgentPageContext {
  pageElements: string | object
  pageUrl?: string
  pageTitle?: string
}

interface SelectorAgentSelectOptions {
  includeContext?: boolean
  pageElements?: string
}

interface SelectorAgentSelectionResult {
  selector: string | null
  reasoning: string
  confidence: number
  alternatives: string[]
  suggestions?: string[]
  raw?: string
  parseError?: string
}

interface ElectronSelectorAgentAPI {
  init: (options?: SelectorAgentInitOptions) => Promise<SelectorAgentResult>
  prime: (context: SelectorAgentPageContext) => Promise<SelectorAgentResult>
  select: (description: string, options?: SelectorAgentSelectOptions) => Promise<SelectorAgentResult>
  send: (text: string) => Promise<SelectorAgentResult>
  isActive: () => Promise<SelectorAgentActiveResult>
  getContextState: () => Promise<SelectorAgentContextState>
  reset: () => Promise<SelectorAgentResult>
  interrupt: () => Promise<SelectorAgentResult>
  onTextChunk: (callback: (text: string) => void) => () => void
  onSelectionResult: (callback: (result: SelectorAgentSelectionResult) => void) => () => void
  onReady: (callback: () => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

// File Watcher API
interface FileWatcherEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  relativePath: string
  projectPath: string
  timestamp: number
}

interface ElectronFileWatcherAPI {
  start: (projectPath: string) => Promise<{ success: boolean; alreadyWatching?: boolean }>
  stop: (projectPath: string) => Promise<{ success: boolean; wasNotWatching?: boolean }>
  getWatched: () => Promise<string[]>
  onChange: (callback: (event: FileWatcherEvent) => void) => () => void
}

// Background Validator API
interface ValidationIssue {
  file: string
  relativePath: string
  line: number
  column: number
  severity: 'error' | 'warning'
  code: string
  message: string
  tool: 'typescript' | 'eslint'
  fixable?: boolean
}

interface ValidationResult {
  tool: string
  success: boolean
  issues: ValidationIssue[]
  skipped?: boolean
  raw?: string
}

interface ValidationEvent {
  type: 'start' | 'complete' | 'error'
  projectPath: string
  timestamp: number
  changedFiles?: string[]
  results?: ValidationResult[]
  issues?: ValidationIssue[]
  summary?: {
    errors: number
    warnings: number
    total: number
  }
}

interface ValidationState {
  running: boolean
  issues: ValidationIssue[]
  lastRun?: number
  lastComplete?: number
}

interface ElectronValidatorAPI {
  trigger: (projectPath: string) => Promise<{ results: ValidationResult[]; issues: ValidationIssue[] }>
  getState: (projectPath: string) => Promise<ValidationState>
  clear: (projectPath: string) => Promise<{ success: boolean }>
  onEvent: (callback: (event: ValidationEvent) => void) => () => void
}

// Agent Todos Aggregation API
interface AgentTodo {
  id: string
  text: string
  completed: boolean
  status?: 'pending' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  agent: string
  source: string
  line?: number
  createdAt: string
}

interface AgentInfo {
  id: string
  name: string
  icon: string
  color: string
  count?: number
}

interface AgentTodosScanResult {
  todos: AgentTodo[]
  agents: Record<string, AgentInfo>
}

interface ElectronAgentTodosAPI {
  scan: (projectPath: string) => Promise<AgentTodosScanResult>
  getAgents: () => Promise<AgentInfo[]>
  getAgentInfo: (agentId: string) => Promise<AgentInfo | null>
}

// LSP Diagnostic from language servers
interface LSPDiagnostic {
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  severity?: 1 | 2 | 3 | 4 // Error, Warning, Info, Hint
  code?: string | number
  source?: string
  message: string
  relatedInformation?: Array<{
    location: { uri: string; range: LSPDiagnostic['range'] }
    message: string
  }>
}

// LSP Hover result
interface LSPHoverResult {
  contents: string | { kind: 'plaintext' | 'markdown'; value: string } | Array<string | { kind: string; value: string }>
  range?: LSPDiagnostic['range']
}

// LSP Completion item
interface LSPCompletionItem {
  label: string
  kind?: number
  detail?: string
  documentation?: string | { kind: string; value: string }
  sortText?: string
  filterText?: string
  insertText?: string
  textEdit?: {
    range: LSPDiagnostic['range']
    newText: string
  }
}

// LSP Location (for definition/references)
interface LSPLocation {
  uri: string
  range: LSPDiagnostic['range']
}

// LSP Server status for UI
interface LSPServerStatus {
  id: string
  name: string
  extensions: string[]
  enabled: boolean
  installed: boolean
  installable: boolean
  running: boolean
  instances: Array<{
    root: string
    openDocuments: number
    diagnosticCount: number
  }>
}

// LSP Event types
interface LSPEvent {
  type: 'diagnostics' | 'server-started' | 'server-closed' | 'server-status-changed'
  path?: string
  diagnostics?: LSPDiagnostic[]
  serverId?: string
  root?: string
  enabled?: boolean
}

interface LSPInstallProgress {
  serverId: string
  stage: 'installing' | 'fetching' | 'downloading' | 'extracting' | 'complete'
  package?: string
  size?: number
}

interface LSPCacheInfo {
  cacheDir: string
  binDir: string
  nodeModulesDir: string
  cacheSize: number
  cacheVersion: string
}

interface ElectronLSPAPI {
  init: (projectPath: string) => Promise<{ success: boolean; error?: string }>
  shutdown: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<{ success: boolean; data?: LSPServerStatus[]; error?: string }>
  touchFile: (filePath: string, waitForDiagnostics?: boolean) => Promise<{ success: boolean; clientCount?: number; error?: string }>
  fileChanged: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>
  fileSaved: (filePath: string) => Promise<{ success: boolean; error?: string }>
  getDiagnostics: () => Promise<{ success: boolean; data?: Record<string, LSPDiagnostic[]>; error?: string }>
  getDiagnosticsForFile: (filePath: string) => Promise<{ success: boolean; data?: LSPDiagnostic[]; error?: string }>
  getDiagnosticsForFiles: (filePaths: string[]) => Promise<{ success: boolean; data?: Record<string, LSPDiagnostic[]>; error?: string }>
  hover: (filePath: string, line: number, character: number) => Promise<{ success: boolean; data?: LSPHoverResult | null; error?: string }>
  completion: (filePath: string, line: number, character: number) => Promise<{ success: boolean; data?: LSPCompletionItem[]; error?: string }>
  definition: (filePath: string, line: number, character: number) => Promise<{ success: boolean; data?: LSPLocation | LSPLocation[] | null; error?: string }>
  references: (filePath: string, line: number, character: number) => Promise<{ success: boolean; data?: LSPLocation[]; error?: string }>
  setServerEnabled: (serverId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
  installServer: (serverId: string) => Promise<{ success: boolean; path?: string; error?: string }>
  getCacheInfo: () => Promise<{ success: boolean; data?: LSPCacheInfo; error?: string }>
  clearCache: () => Promise<{ success: boolean; error?: string }>
  onEvent: (callback: (event: LSPEvent) => void) => () => void
  onInstallProgress: (callback: (progress: LSPInstallProgress) => void) => () => void
}

// Mgrep (Local Semantic Code Search) types
interface MgrepIndexStats {
  totalFiles: number
  totalChunks: number
  totalEmbeddings: number
  databaseSize: number
  lastIndexedAt: string | null
}

interface MgrepStatus {
  ready: boolean
  indexing: boolean
  stats: MgrepIndexStats | null
  projectPath: string | null
  error: string | null
}

interface MgrepFileChangeEvent {
  filePath: string
  eventType: 'added' | 'modified' | 'deleted'
  timestamp: number
}

interface MgrepSearchOptions {
  limit?: number
  threshold?: number
}

interface MgrepSearchResult {
  filePath: string
  chunkIndex: number
  content: string
  similarity: number
  metadata: {
    startLine: number
    endLine: number
    language: string
    functionName?: string
    classScope?: string
    isDocstring?: boolean
  }
}

interface MgrepEvent {
  type: 'ready' | 'indexing-start' | 'indexing-progress' | 'indexing-complete' | 'scanning-start' | 'scanning-complete' | 'file-indexed' | 'stats-updated' | 'error'
  projectPath?: string
  stats?: MgrepIndexStats
  totalFiles?: number
  filesFound?: number
  filesProcessed?: number
  current?: number
  total?: number
  currentFile?: string
  totalChunks?: number
  chunksIndexed?: number
  filePath?: string
  chunks?: number
  error?: string
}

// Multi-project status
interface MgrepProjectStatus {
  projectPath: string
  ready: boolean
  indexing: boolean
  stats: MgrepIndexStats | null
  error: string | null
  isActive: boolean
}

interface ElectronMgrepAPI {
  initialize: (projectPath: string) => Promise<{ success: boolean; message?: string; error?: string }>
  search: (query: string, options?: MgrepSearchOptions & { projectPath?: string }) => Promise<{ success: boolean; results?: MgrepSearchResult[]; projectPath?: string; error?: string }>
  indexFile: (filePath: string, content: string, projectDir?: string) => Promise<{ success: boolean; chunks?: number; error?: string }>
  indexFiles: (files: Array<{ filePath: string; content: string }>, projectDir?: string) => Promise<{ success: boolean; filesProcessed?: number; totalChunks?: number; error?: string }>
  onFileChange: (event: MgrepFileChangeEvent) => Promise<{ success: boolean; error?: string }>
  getStatus: (projectPath?: string) => Promise<{ success: boolean; status?: MgrepStatus; error?: string }>
  getStats: (projectPath?: string) => Promise<{ success: boolean; stats?: MgrepIndexStats; projectPath?: string; error?: string }>
  clearIndex: (projectPath?: string) => Promise<{ success: boolean; projectPath?: string; error?: string }>
  resync: (projectPath: string) => Promise<{ success: boolean; filesProcessed?: number; totalChunks?: number; error?: string }>
  // Multi-project APIs
  getAllProjectsStatus: () => Promise<{ success: boolean; projects?: MgrepProjectStatus[]; error?: string }>
  setActiveProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>
  removeProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>
  onEvent: (callback: (event: MgrepEvent) => void) => () => void
}

interface ProjectRunnerStatus {
  projectPath: string
  running: boolean
  pid: number | null
  command: string | null
  startedAt: number | null
  exitCode: number | null
}

interface ElectronProjectRunnerAPI {
  getStatus: (projectPath: string) => Promise<{ success: boolean; status?: ProjectRunnerStatus; error?: string }>
  start: (payload: { projectPath: string; command: string; env?: Record<string, string> }) => Promise<{ success: boolean; status?: ProjectRunnerStatus; alreadyRunning?: boolean; error?: string }>
  stop: (projectPath: string) => Promise<{ success: boolean; stopped?: boolean; status?: ProjectRunnerStatus; error?: string }>
  onEvent: (callback: (event: unknown) => void) => () => void
  onLog: (callback: (event: unknown) => void) => () => void
}

// Window Management API (Multi-window support with project locking)
interface WindowInfo {
  windowId: number | null
  projectPath: string | null
  projectName: string | null
}

interface WindowLockResult {
  success: boolean
  message?: string
  error?: string
  windowId?: number
  projectPath?: string
  projectName?: string
  currentProject?: string
  existingWindowId?: number
}

interface WindowOpenResult {
  success: boolean
  action: 'focused' | 'created'
  windowId: number
  alreadyOpen: boolean
}

interface WindowNewResult {
  success: boolean
  windowId: number
}

interface WindowIsOpenResult {
  isOpen: boolean
  windowId: number | null
}

interface WindowEntry {
  id: number
  projectPath: string | null
  projectName: string | null
  isFocused: boolean
}

interface ElectronWindowAPI {
  getInfo: () => Promise<WindowInfo>
  lockProject: (projectPath: string, projectName: string) => Promise<WindowLockResult>
  openProject: (projectPath: string, projectName: string) => Promise<WindowOpenResult>
  new: () => Promise<WindowNewResult>
  isProjectOpen: (projectPath: string) => Promise<WindowIsOpenResult>
  getAll: () => Promise<WindowEntry[]>
  focus: (windowId: number) => Promise<{ success: boolean; error?: string }>
  close: (windowId: number) => Promise<{ success: boolean; error?: string }>
  setAppearance: (appearance: { transparencyEnabled?: boolean; opacity?: number; blur?: number }) => Promise<{ success: boolean; applied?: { transparencyEnabled: boolean; opacity: number; blur: number }; error?: string }>
  onInfo: (callback: (info: WindowInfo) => void) => () => void
  onRegistryChanged: (callback: (windows: WindowEntry[]) => void) => () => void
}

// Extension Bridge API - Chrome extension communication
export interface ExtensionChatRequest {
  requestId: string
  message: string
  elements: Array<{
    id: string
    tagName: string
    label: string
    fullInfo?: Record<string, unknown>
  }>
  pageUrl: string
  pageTitle: string
}

interface ElectronExtensionBridgeAPI {
  getStatus: () => Promise<{ connected: boolean; port: number }>
  activateInspector: () => Promise<{ success: boolean }>
  deactivateInspector: () => Promise<{ success: boolean }>
  requestElements: () => Promise<{ success: boolean }>
  sendChatResponse: (requestId: string, reply?: string, error?: string) => Promise<{ success: boolean }>
  onSelection: (callback: (element: unknown) => void) => () => void
  onPageElements: (callback: (elements: unknown[]) => void) => () => void
  onChatRequest: (callback: (request: ExtensionChatRequest) => void) => () => void
  // Cursor sharing
  onCursorMove?: (callback: (data: ExtensionCursorData) => void) => () => void
  onSharingStarted?: (callback: () => void) => () => void
  onSharingStopped?: (callback: () => void) => () => void
  sendCursor?: (data: ExtensionCursorData) => Promise<{ success: boolean }>
}

// Cursor position data for collaborative sharing
interface ExtensionCursorData {
  // Element-relative anchoring (most accurate across breakpoints)
  elementAnchor?: {
    selector: string
    relativeX: number
    relativeY: number
    elementText?: string
  }
  // Viewport percentage (breakpoint-aware)
  viewportPercentX?: number
  viewportPercentY?: number
  // Document-relative position (accounts for scroll)
  pageX: number
  pageY: number
  // Viewport-relative position
  clientX: number
  clientY: number
  // Scroll position
  scrollX: number
  scrollY: number
  // Viewport dimensions
  viewportWidth: number
  viewportHeight: number
  // Document dimensions
  documentWidth: number
  documentHeight: number
  // Page URL for matching
  pageUrl: string
  // Timestamp for interpolation
  timestamp?: number
}

// Dialog API for file/folder selection
interface ElectronDialogAPI {
  openFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    data?: { path: string; name: string }
  }>
  openFile?: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{
    success: boolean
    canceled?: boolean
    data?: { path: string; name: string }
  }>
}

export interface ElectronAPI {
  git: ElectronGitAPI
  files: ElectronFilesAPI
  aiSdk: ElectronAISdkAPI
  agentSdk?: ElectronAgentSdkAPI
  oauth: ElectronOAuthAPI
  codex: ElectronCodexAPI
  api: ElectronApiAPI
  claudeCode: ElectronClaudeCodeAPI
  selectorAgent?: ElectronSelectorAgentAPI
  mcp?: ElectronMCPAPI
  voice?: ElectronVoiceAPI
  tabdata?: ElectronTabDataAPI
  fastApply?: ElectronFastApplyAPI
  fileWatcher?: ElectronFileWatcherAPI
  validator?: ElectronValidatorAPI
  agentTodos?: ElectronAgentTodosAPI
  lsp?: ElectronLSPAPI
  mgrep?: ElectronMgrepAPI
  projectRunner?: ElectronProjectRunnerAPI
  window?: ElectronWindowAPI
  extensionBridge?: ElectronExtensionBridgeAPI
  pty?: ElectronPtyAPI
  clipboard?: ElectronClipboardAPI
  dialog?: ElectronDialogAPI
  getWebviewPreloadPath: () => Promise<string>
  isElectron: boolean
  // Shell operations
  openExternal?: (url: string) => Promise<void>
  // Auto-update functionality
  updates?: {
    check: () => Promise<{ available: boolean; version?: string }>
    install: () => Promise<void>
    onProgress?: (callback: (progress: number) => void) => () => void
  }
  // Code morphing API for source transformations
  morph?: {
    apply: (options: { filePath: string; changes: unknown }) => Promise<{ success: boolean; error?: string }>
  }
}

interface ElectronPtyAPI {
  getPort: () => Promise<{ success: boolean; port: number | null }>
}

interface ElectronClipboardAPI {
  writeText: (text: string) => void
  readText: () => string
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
