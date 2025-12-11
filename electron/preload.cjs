const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Git operations
  git: {
    getCurrentBranch: () => ipcRenderer.invoke('git:getCurrentBranch'),
    getBranches: () => ipcRenderer.invoke('git:getBranches'),
    checkout: (branch) => ipcRenderer.invoke('git:checkout', branch),
    checkoutFile: (filePath) => ipcRenderer.invoke('git:checkoutFile', filePath),
    createBranch: (name) => ipcRenderer.invoke('git:createBranch', name),
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    commit: (message) => ipcRenderer.invoke('git:commit', message),
    push: () => ipcRenderer.invoke('git:push'),
    pull: () => ipcRenderer.invoke('git:pull'),
    stash: () => ipcRenderer.invoke('git:stash'),
    stashWithMessage: (message) => ipcRenderer.invoke('git:stashWithMessage', message),
    stashPop: () => ipcRenderer.invoke('git:stashPop'),
  },

  // Backup/recovery operations
  backup: {
    create: (filePath, description) => ipcRenderer.invoke('backup:create', filePath, description),
    restore: (filePath, backupId) => ipcRenderer.invoke('backup:restore', filePath, backupId),
    list: (filePath) => ipcRenderer.invoke('backup:list', filePath),
    getContent: (filePath, backupId) => ipcRenderer.invoke('backup:get-content', filePath, backupId),
    delete: (filePath, backupId) => ipcRenderer.invoke('backup:delete', filePath, backupId),
    cleanup: () => ipcRenderer.invoke('backup:cleanup'),
  },

  // OAuth operations (for Anthropic API keys and Claude Code)
  oauth: {
    // Start OAuth login flow - mode: 'max' for Claude Pro/Max, 'console' for Console API
    startLogin: (mode) => ipcRenderer.invoke('oauth:start-login', mode),
    // Complete OAuth login by exchanging code for tokens
    // createKey: true = get API key, false = keep OAuth tokens for Claude Code
    completeLogin: (code, createKey) => ipcRenderer.invoke('oauth:complete-login', code, createKey),
    // Cancel OAuth flow
    cancel: () => ipcRenderer.invoke('oauth:cancel'),
    // Get OAuth status
    getStatus: () => ipcRenderer.invoke('oauth:get-status'),
    // Logout (clear OAuth tokens)
    logout: () => ipcRenderer.invoke('oauth:logout'),
    // Get valid access token (handles refresh if needed)
    getAccessToken: () => ipcRenderer.invoke('oauth:get-access-token'),
    // Get Claude Code API key (created from OAuth)
    getClaudeCodeApiKey: () => ipcRenderer.invoke('oauth:get-claude-code-api-key'),
    // Direct test of Anthropic API with OAuth token (bypasses AI SDK)
    testApi: () => ipcRenderer.invoke('oauth:test-api'),
  },

  // Codex OAuth operations (for OpenAI ChatGPT Plus/Pro via Codex)
  codex: {
    // Start Codex OAuth login flow
    startLogin: () => ipcRenderer.invoke('codex:start-login'),
    // Cancel OAuth flow
    cancel: () => ipcRenderer.invoke('codex:cancel'),
    // Get OAuth status
    getStatus: () => ipcRenderer.invoke('codex:get-status'),
    // Logout (clear OAuth tokens)
    logout: () => ipcRenderer.invoke('codex:logout'),
    // Get valid access token (handles refresh if needed)
    getAccessToken: () => ipcRenderer.invoke('codex:get-access-token'),
    // Direct test of Codex API with OAuth token
    testApi: () => ipcRenderer.invoke('codex:test-api'),
  },

  // Updates
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    getVersion: () => ipcRenderer.invoke('updates:get-version'),
    onEvent: (callback) => {
      const handler = (_event, payload) => callback(payload)
      ipcRenderer.on('updates:event', handler)
      return () => ipcRenderer.removeListener('updates:event', handler)
    }
  },

  // API proxy to bypass CORS restrictions
  api: {
    proxy: (request) => ipcRenderer.invoke('api:proxy', request),
  },

  // Webview preload path - fetched from main process
  getWebviewPreloadPath: () => ipcRenderer.invoke('get-webview-preload-path'),

  // Morph (cloud apply / router) - handled in main to avoid CORS
  morph: {
    fastApply: (payload) => ipcRenderer.invoke('morph:fast-apply', payload),
    selectModel: (payload) => ipcRenderer.invoke('morph:select-model', payload),
  },

  // File operations
  files: {
    // Read operations
    readFile: (path) => ipcRenderer.invoke('files:readFile', path),
    selectFile: (path) => ipcRenderer.invoke('files:selectFile', path),
    listDirectory: (path) => ipcRenderer.invoke('files:listDirectory', path),
    listPrompts: () => ipcRenderer.invoke('files:listPrompts'),
    readPrompt: (name) => ipcRenderer.invoke('files:readPrompt', name),
    readMultiple: (paths) => ipcRenderer.invoke('files:readMultiple', paths),
    // Write operations
    writeFile: (path, content) => ipcRenderer.invoke('files:writeFile', path, content),
    createFile: (path, content) => ipcRenderer.invoke('files:createFile', path, content),
    deleteFile: (path) => ipcRenderer.invoke('files:deleteFile', path),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke('files:renameFile', oldPath, newPath),
    copyFile: (srcPath, destPath) => ipcRenderer.invoke('files:copyFile', srcPath, destPath),
    // Save base64 image to file
    saveImage: (base64DataUrl, destPath) => ipcRenderer.invoke('files:saveImage', base64DataUrl, destPath),
    // Directory operations
    createDirectory: (path) => ipcRenderer.invoke('files:createDirectory', path),
    deleteDirectory: (path) => ipcRenderer.invoke('files:deleteDirectory', path),
    getTree: (path, options) => ipcRenderer.invoke('files:getTree', path, options),
    // Get current working directory
    getCwd: () => ipcRenderer.invoke('files:getCwd'),
    // Search operations
    searchInFiles: (pattern, dirPath, options) => ipcRenderer.invoke('files:searchInFiles', pattern, dirPath, options),
    glob: (pattern, dirPath) => ipcRenderer.invoke('files:glob', pattern, dirPath),
    findFiles: (searchDir, filename) => ipcRenderer.invoke('files:findFiles', searchDir, filename),
    lintCode: (code, filePath) => ipcRenderer.invoke('files:lintCode', code, filePath),
    // Utility operations
    exists: (path) => ipcRenderer.invoke('files:exists', path),
    stat: (path) => ipcRenderer.invoke('files:stat', path),
  },

  // File watcher operations
  fileWatcher: {
    start: (projectPath) => ipcRenderer.invoke('file-watcher:start', projectPath),
    stop: (projectPath) => ipcRenderer.invoke('file-watcher:stop', projectPath),
    getWatched: () => ipcRenderer.invoke('file-watcher:get-watched'),
    // Listen for file change events
    onChange: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('file-watcher:change', handler)
      return () => ipcRenderer.removeListener('file-watcher:change', handler)
    },
  },

  // Mgrep (local semantic code search) operations - supports multiple concurrent projects
  mgrep: {
    // Initialize mgrep for a project (can have multiple active)
    initialize: (projectPath) => ipcRenderer.invoke('mgrep:initialize', projectPath),
    // Semantic search (optional projectPath to search specific project)
    search: (query, options) => ipcRenderer.invoke('mgrep:search', query, options),
    // Index a single file (auto-routes to correct project)
    indexFile: (filePath, content, projectPath) => ipcRenderer.invoke('mgrep:index-file', filePath, content, projectPath),
    // Index multiple files for a specific project
    indexFiles: (files, projectPath) => ipcRenderer.invoke('mgrep:index-files', files, projectPath),
    // Handle file change event (auto-routes to correct project)
    onFileChange: (changeEvent) => ipcRenderer.invoke('mgrep:on-file-change', changeEvent),
    // Get status for a specific project (or active project if not specified)
    getStatus: (projectPath) => ipcRenderer.invoke('mgrep:get-status', projectPath),
    // Get status of ALL indexed projects (new multi-project API)
    getAllProjectsStatus: () => ipcRenderer.invoke('mgrep:get-all-projects-status'),
    // Set the active project
    setActiveProject: (projectPath) => ipcRenderer.invoke('mgrep:set-active-project', projectPath),
    // Remove a project from tracking
    removeProject: (projectPath) => ipcRenderer.invoke('mgrep:remove-project', projectPath),
    // Get stats for a specific project
    getStats: (projectPath) => ipcRenderer.invoke('mgrep:get-stats', projectPath),
    // Clear the index for a specific project
    clearIndex: (projectPath) => ipcRenderer.invoke('mgrep:clear-index', projectPath),
    // Resync (re-scan and re-index) a project
    resync: (projectPath) => ipcRenderer.invoke('mgrep:resync', projectPath),
    // Listen for mgrep events (includes projectPath in event data)
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('mgrep:event', handler)
      return () => ipcRenderer.removeListener('mgrep:event', handler)
    },
  },

  // Dialog operations
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },

  // Voice logging operations
  voice: {
    ensureLogDir: () => ipcRenderer.invoke('voice:ensureLogDir'),
    saveLog: (sessionId, content) => ipcRenderer.invoke('voice:saveLog', sessionId, content),
    listLogs: () => ipcRenderer.invoke('voice:listLogs'),
    readLog: (sessionId) => ipcRenderer.invoke('voice:readLog', sessionId),
    getUnprocessedLogs: () => ipcRenderer.invoke('voice:getUnprocessedLogs'),
    markProcessed: (sessionIds) => ipcRenderer.invoke('voice:markProcessed', sessionIds),
    saveLearnings: (content) => ipcRenderer.invoke('voice:saveLearnings', content),
    readLearnings: () => ipcRenderer.invoke('voice:readLearnings'),
    getLogPath: () => ipcRenderer.invoke('voice:getLogPath'),
    getLearningsPath: () => ipcRenderer.invoke('voice:getLearningsPath'),
  },

  // Tab data persistence operations (kanban, todos, notes)
  tabdata: {
    ensureDir: (projectPath) => ipcRenderer.invoke('tabdata:ensureDir', projectPath),
    saveKanban: (projectPath, data) => ipcRenderer.invoke('tabdata:saveKanban', projectPath, data),
    loadKanban: (projectPath) => ipcRenderer.invoke('tabdata:loadKanban', projectPath),
    saveTodos: (projectPath, data) => ipcRenderer.invoke('tabdata:saveTodos', projectPath, data),
    loadTodos: (projectPath) => ipcRenderer.invoke('tabdata:loadTodos', projectPath),
    saveNotes: (projectPath, data) => ipcRenderer.invoke('tabdata:saveNotes', projectPath, data),
    loadNotes: (projectPath) => ipcRenderer.invoke('tabdata:loadNotes', projectPath),
    list: (projectPath) => ipcRenderer.invoke('tabdata:list', projectPath),
  },

  // Selector Agent (persistent Claude Agent SDK session for fast element selection)
  selectorAgent: {
    // Initialize selector agent session
    init: (options) => ipcRenderer.invoke('selector-agent:init', options),
    // Prime context with page elements (proactive context loading)
    prime: (context) => ipcRenderer.invoke('selector-agent:prime', context),
    // Request element selection based on description
    select: (description, options) => ipcRenderer.invoke('selector-agent:select', { description, options }),
    // Send a general message to the session
    send: (text) => ipcRenderer.invoke('selector-agent:send', text),
    // Check if session is active
    isActive: () => ipcRenderer.invoke('selector-agent:is-active'),
    // Get current context state (isPrimed, pageUrl, etc.)
    getContextState: () => ipcRenderer.invoke('selector-agent:context-state'),
    // Reset the session
    reset: () => ipcRenderer.invoke('selector-agent:reset'),
    // Interrupt current response
    interrupt: () => ipcRenderer.invoke('selector-agent:interrupt'),
    // Listen for streaming text chunks
    onTextChunk: (callback) => {
      ipcRenderer.on('selector-agent:text-chunk', (_event, text) => callback(text))
      return () => ipcRenderer.removeAllListeners('selector-agent:text-chunk')
    },
    // Listen for selection results
    onSelectionResult: (callback) => {
      ipcRenderer.on('selector-agent:selection-result', (_event, result) => callback(result))
      return () => ipcRenderer.removeAllListeners('selector-agent:selection-result')
    },
    // Listen for ready event
    onReady: (callback) => {
      ipcRenderer.on('selector-agent:ready', () => callback())
      return () => ipcRenderer.removeAllListeners('selector-agent:ready')
    },
    // Listen for errors
    onError: (callback) => {
      ipcRenderer.on('selector-agent:error', (_event, error) => callback(error))
      return () => ipcRenderer.removeAllListeners('selector-agent:error')
    },
  },

  // Claude Code SDK operations (uses Claude Agent SDK with OAuth)
  claudeCode: {
    // Start a session with initial prompt
    startSession: (options) => ipcRenderer.invoke('claude-code:start-session', options),
    // Send a message to active session
    sendMessage: (text) => ipcRenderer.invoke('claude-code:send-message', text),
    // Check if session is active
    isActive: () => ipcRenderer.invoke('claude-code:is-active'),
    // Stop current response
    stop: () => ipcRenderer.invoke('claude-code:stop'),
    // Reset session
    reset: () => ipcRenderer.invoke('claude-code:reset'),
    // Listen for streaming events
    onTextChunk: (callback) => {
      ipcRenderer.on('claude-code:text-chunk', (_event, text) => callback(text))
      return () => ipcRenderer.removeAllListeners('claude-code:text-chunk')
    },
    onToolUse: (callback) => {
      ipcRenderer.on('claude-code:tool-use', (_event, toolUse) => callback(toolUse))
      return () => ipcRenderer.removeAllListeners('claude-code:tool-use')
    },
    onToolResult: (callback) => {
      ipcRenderer.on('claude-code:tool-result', (_event, result) => callback(result))
      return () => ipcRenderer.removeAllListeners('claude-code:tool-result')
    },
    onComplete: (callback) => {
      ipcRenderer.on('claude-code:complete', () => callback())
      return () => ipcRenderer.removeAllListeners('claude-code:complete')
    },
    onError: (callback) => {
      ipcRenderer.on('claude-code:error', (_event, error) => callback(error))
      return () => ipcRenderer.removeAllListeners('claude-code:error')
    },
  },

  // MCP (Model Context Protocol) operations
  mcp: {
    // Connect to an MCP server
    connect: (config) => ipcRenderer.invoke('mcp:connect', config),
    // Disconnect from an MCP server
    disconnect: (serverId) => ipcRenderer.invoke('mcp:disconnect', serverId),
    // List tools from a connected server
    listTools: (serverId) => ipcRenderer.invoke('mcp:list-tools', serverId),
    // List resources from a connected server
    listResources: (serverId) => ipcRenderer.invoke('mcp:list-resources', serverId),
    // List prompts from a connected server
    listPrompts: (serverId) => ipcRenderer.invoke('mcp:list-prompts', serverId),
    // Call a tool on a connected server
    callTool: (call) => ipcRenderer.invoke('mcp:call-tool', call),
    // Read a resource from a connected server
    readResource: (serverId, uri) => ipcRenderer.invoke('mcp:read-resource', { serverId, uri }),
    // Get a prompt from a connected server
    getPrompt: (serverId, name, args) => ipcRenderer.invoke('mcp:get-prompt', { serverId, name, arguments: args }),
    // Get status of all connections
    getStatus: () => ipcRenderer.invoke('mcp:get-status'),
    // Discover MCP servers from Claude Desktop, project .mcp.json, etc.
    discover: (projectPath) => ipcRenderer.invoke('mcp:discover', projectPath),
    // Probe a discovered server to get its tools
    probe: (serverConfig) => ipcRenderer.invoke('mcp:probe', serverConfig),
    // Listen for MCP events
    onEvent: (callback) => {
      ipcRenderer.on('mcp:event', (_event, mcpEvent) => callback(mcpEvent))
      return () => ipcRenderer.removeAllListeners('mcp:event')
    },
  },

  // AI SDK operations (unified wrapper for all providers)
  aiSdk: {
    // Initialize AI SDK modules
    initialize: () => ipcRenderer.invoke('ai-sdk:initialize'),
    // Stream chat completion (events sent via callbacks)
    stream: (options) => ipcRenderer.invoke('ai-sdk:stream', options),
    // Generate chat completion (non-streaming)
    generate: (options) => ipcRenderer.invoke('ai-sdk:generate', options),
    // Execute MCP tool
    executeMCPTool: (serverId, toolName, args) =>
      ipcRenderer.invoke('ai-sdk:execute-mcp-tool', { serverId, toolName, args }),
    // Get supported models
    getModels: () => ipcRenderer.invoke('ai-sdk:get-models'),
    // Get provider for model
    getProvider: (modelId) => ipcRenderer.invoke('ai-sdk:get-provider', modelId),
    // Listen for streaming text chunks
    onTextChunk: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('ai-sdk:text-chunk', handler)
      return () => ipcRenderer.removeListener('ai-sdk:text-chunk', handler)
    },
    // Listen for step finish events
    onStepFinish: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('ai-sdk:step-finish', handler)
      return () => ipcRenderer.removeListener('ai-sdk:step-finish', handler)
    },
    // Listen for completion events
    onComplete: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('ai-sdk:complete', handler)
      return () => ipcRenderer.removeListener('ai-sdk:complete', handler)
    },
    // Listen for error events
    onError: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('ai-sdk:error', handler)
      return () => ipcRenderer.removeListener('ai-sdk:error', handler)
    },
    // Remove all listeners for a specific request
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('ai-sdk:text-chunk')
      ipcRenderer.removeAllListeners('ai-sdk:step-finish')
      ipcRenderer.removeAllListeners('ai-sdk:complete')
      ipcRenderer.removeAllListeners('ai-sdk:error')
    },
    // Direct web search (for instant console error searching)
    webSearch: (query, maxResults) => ipcRenderer.invoke('ai-sdk:web-search', { query, maxResults }),
  },

  // Agent SDK operations (Claude models with full streaming)
  agentSdk: {
    // Stream chat with Agent SDK (for Claude 4.5+ models)
    stream: (options) => ipcRenderer.invoke('agent-sdk:stream', options),
    // Send follow-up message to active session
    sendMessage: (text) => ipcRenderer.invoke('agent-sdk:send-message', text),
    // Stop current response
    stop: () => ipcRenderer.invoke('agent-sdk:stop'),
    // Reset session
    reset: () => ipcRenderer.invoke('agent-sdk:reset'),
    // Check if session is active
    isActive: () => ipcRenderer.invoke('agent-sdk:is-active'),
    // Check if model supports Agent SDK
    supportsModel: (modelId) => ipcRenderer.invoke('agent-sdk:supports-model', modelId),
    // Listen for text chunks
    onTextChunk: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:text-chunk', handler)
      return () => ipcRenderer.removeListener('agent-sdk:text-chunk', handler)
    },
    // Listen for thinking start
    onThinkingStart: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:thinking-start', handler)
      return () => ipcRenderer.removeListener('agent-sdk:thinking-start', handler)
    },
    // Listen for thinking chunks
    onThinkingChunk: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:thinking-chunk', handler)
      return () => ipcRenderer.removeListener('agent-sdk:thinking-chunk', handler)
    },
    // Listen for tool start
    onToolStart: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:tool-start', handler)
      return () => ipcRenderer.removeListener('agent-sdk:tool-start', handler)
    },
    // Listen for tool input deltas (partial JSON)
    onToolInputDelta: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:tool-input-delta', handler)
      return () => ipcRenderer.removeListener('agent-sdk:tool-input-delta', handler)
    },
    // Listen for tool results
    onToolResult: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:tool-result', handler)
      return () => ipcRenderer.removeListener('agent-sdk:tool-result', handler)
    },
    // Listen for block stop
    onBlockStop: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:block-stop', handler)
      return () => ipcRenderer.removeListener('agent-sdk:block-stop', handler)
    },
    // Listen for completion
    onComplete: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:complete', handler)
      return () => ipcRenderer.removeListener('agent-sdk:complete', handler)
    },
    // Listen for errors
    onError: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:error', handler)
      return () => ipcRenderer.removeListener('agent-sdk:error', handler)
    },
    // Listen for interruption
    onInterrupted: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('agent-sdk:interrupted', handler)
      return () => ipcRenderer.removeListener('agent-sdk:interrupted', handler)
    },
    // Listen for file modifications (for edited files drawer)
    onFileModified: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('ai-sdk:file-modified', handler)
      return () => ipcRenderer.removeListener('ai-sdk:file-modified', handler)
    },
    // Remove all listeners
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('agent-sdk:text-chunk')
      ipcRenderer.removeAllListeners('agent-sdk:thinking-start')
      ipcRenderer.removeAllListeners('agent-sdk:thinking-chunk')
      ipcRenderer.removeAllListeners('agent-sdk:tool-start')
      ipcRenderer.removeAllListeners('agent-sdk:tool-input-delta')
      ipcRenderer.removeAllListeners('agent-sdk:tool-result')
      ipcRenderer.removeAllListeners('agent-sdk:block-stop')
      ipcRenderer.removeAllListeners('agent-sdk:complete')
      ipcRenderer.removeAllListeners('agent-sdk:error')
      ipcRenderer.removeAllListeners('agent-sdk:interrupted')
      ipcRenderer.removeAllListeners('ai-sdk:file-modified')
    },
  },

  // Fast Apply (Local LLM for instant code merging) - Pro Feature
  fastApply: {
    // Get current status of Fast Apply
    getStatus: () => ipcRenderer.invoke('fast-apply:status'),
    // List all available model variants
    listModels: () => ipcRenderer.invoke('fast-apply:list-models'),
    // Download a model variant (defaults to Q4_K_M)
    download: (variant) => ipcRenderer.invoke('fast-apply:download', variant),
    // Set the active model variant
    setModel: (variant) => ipcRenderer.invoke('fast-apply:set-model', variant),
    // Apply code changes using the local model
    apply: (code, update) => ipcRenderer.invoke('fast-apply:apply', { code, update }),
    // Cancel an ongoing download
    cancel: () => ipcRenderer.invoke('fast-apply:cancel'),
    // Delete a downloaded model
    delete: (variant) => ipcRenderer.invoke('fast-apply:delete', variant),
    // Load model into memory (pre-warm)
    load: () => ipcRenderer.invoke('fast-apply:load'),
    // Unload model from memory
    unload: () => ipcRenderer.invoke('fast-apply:unload'),
    // Listen for download progress events
    onProgress: (callback) => {
      const handler = (_event, progress) => callback(progress)
      ipcRenderer.on('fast-apply:progress', handler)
      return () => ipcRenderer.removeListener('fast-apply:progress', handler)
    },
    // Listen for model loaded events
    onModelLoaded: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('fast-apply:model-loaded', handler)
      return () => ipcRenderer.removeListener('fast-apply:model-loaded', handler)
    },
    // Listen for model unloaded events
    onModelUnloaded: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('fast-apply:model-unloaded', handler)
      return () => ipcRenderer.removeListener('fast-apply:model-unloaded', handler)
    },
  },

  // Background validator operations (lint, typecheck, etc)
  validator: {
    trigger: (projectPath) => ipcRenderer.invoke('validator:trigger', projectPath),
    getState: (projectPath) => ipcRenderer.invoke('validator:get-state', projectPath),
    clear: (projectPath) => ipcRenderer.invoke('validator:clear', projectPath),
    // Listen for validation events
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('background-validator:event', handler)
      return () => ipcRenderer.removeListener('background-validator:event', handler)
    },
  },

  // Agent todos aggregation (scan todos from Claude, Cline, Roo, etc)
  agentTodos: {
    scan: (projectPath) => ipcRenderer.invoke('agent-todos:scan', projectPath),
    getAgents: () => ipcRenderer.invoke('agent-todos:agents'),
    getAgentInfo: (agentId) => ipcRenderer.invoke('agent-todos:agent-info', agentId),
  },

  // LSP (Language Server Protocol) - background language intelligence
  lsp: {
    // Initialize LSP for a project
    init: (projectPath) => ipcRenderer.invoke('lsp:init', projectPath),
    // Shutdown all LSP servers
    shutdown: () => ipcRenderer.invoke('lsp:shutdown'),
    // Get status of all language servers
    getStatus: () => ipcRenderer.invoke('lsp:status'),
    // Touch a file (notify LSP it's open)
    touchFile: (filePath, waitForDiagnostics) => ipcRenderer.invoke('lsp:touch-file', filePath, waitForDiagnostics),
    // Notify file changed
    fileChanged: (filePath, content) => ipcRenderer.invoke('lsp:file-changed', filePath, content),
    // Notify file saved
    fileSaved: (filePath) => ipcRenderer.invoke('lsp:file-saved', filePath),
    // Get all diagnostics
    getDiagnostics: () => ipcRenderer.invoke('lsp:diagnostics'),
    // Get diagnostics for a specific file
    getDiagnosticsForFile: (filePath) => ipcRenderer.invoke('lsp:diagnostics-for-file', filePath),
    // Get diagnostics for multiple files (for agent context)
    getDiagnosticsForFiles: (filePaths) => ipcRenderer.invoke('lsp:diagnostics-for-files', filePaths),
    // Get hover information at position
    hover: (filePath, line, character) => ipcRenderer.invoke('lsp:hover', filePath, line, character),
    // Get completions at position
    completion: (filePath, line, character) => ipcRenderer.invoke('lsp:completion', filePath, line, character),
    // Get definition at position
    definition: (filePath, line, character) => ipcRenderer.invoke('lsp:definition', filePath, line, character),
    // Get references at position
    references: (filePath, line, character) => ipcRenderer.invoke('lsp:references', filePath, line, character),
    // Enable/disable a specific server
    setServerEnabled: (serverId, enabled) => ipcRenderer.invoke('lsp:set-server-enabled', serverId, enabled),
    // Install an LSP server
    installServer: (serverId) => ipcRenderer.invoke('lsp:install-server', serverId),
    // Get cache info (size, paths)
    getCacheInfo: () => ipcRenderer.invoke('lsp:get-cache-info'),
    // Clear the LSP cache
    clearCache: () => ipcRenderer.invoke('lsp:clear-cache'),
    // Listen for LSP events (diagnostics, server status changes)
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('lsp:event', handler)
      return () => ipcRenderer.removeListener('lsp:event', handler)
    },
    // Listen for install progress events
    onInstallProgress: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('lsp:install-progress', handler)
      return () => ipcRenderer.removeListener('lsp:install-progress', handler)
    },
  },

  // Window management (multi-window support with project locking)
  window: {
    // Get current window info (windowId, projectPath, projectName)
    getInfo: () => ipcRenderer.invoke('window:get-info'),
    // Lock this window to a project (one-time operation per window)
    lockProject: (projectPath, projectName) => ipcRenderer.invoke('window:lock-project', projectPath, projectName),
    // Open a project - creates new window or focuses existing
    openProject: (projectPath, projectName) => ipcRenderer.invoke('window:open-project', projectPath, projectName),
    // Open a new empty window
    new: () => ipcRenderer.invoke('window:new'),
    // Check if a project is already open in any window
    isProjectOpen: (projectPath) => ipcRenderer.invoke('window:is-project-open', projectPath),
    // Get all open project windows
    getAll: () => ipcRenderer.invoke('window:get-all'),
    // Focus a specific window by ID
    focus: (windowId) => ipcRenderer.invoke('window:focus', windowId),
    // Close a specific window by ID
    close: (windowId) => ipcRenderer.invoke('window:close', windowId),
    // Listen for window info (sent on ready-to-show)
    onInfo: (callback) => {
      const handler = (_event, info) => callback(info)
      ipcRenderer.on('window:info', handler)
      return () => ipcRenderer.removeListener('window:info', handler)
    },
    // Listen for registry changes (when windows open/close/lock)
    onRegistryChanged: (callback) => {
      const handler = (_event, windows) => callback(windows)
      ipcRenderer.on('window:registry-changed', handler)
      return () => ipcRenderer.removeListener('window:registry-changed', handler)
    },
  },

  // Check if running in Electron
  isElectron: true,
})
