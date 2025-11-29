const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Git operations
  git: {
    getCurrentBranch: () => ipcRenderer.invoke('git:getCurrentBranch'),
    getBranches: () => ipcRenderer.invoke('git:getBranches'),
    checkout: (branch) => ipcRenderer.invoke('git:checkout', branch),
    createBranch: (name) => ipcRenderer.invoke('git:createBranch', name),
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    commit: (message) => ipcRenderer.invoke('git:commit', message),
    push: () => ipcRenderer.invoke('git:push'),
    pull: () => ipcRenderer.invoke('git:pull'),
    stash: () => ipcRenderer.invoke('git:stash'),
    stashWithMessage: (message) => ipcRenderer.invoke('git:stashWithMessage', message),
    stashPop: () => ipcRenderer.invoke('git:stashPop'),
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

  // API proxy to bypass CORS restrictions
  api: {
    proxy: (request) => ipcRenderer.invoke('api:proxy', request),
  },

  // Webview preload path - fetched from main process
  getWebviewPreloadPath: () => ipcRenderer.invoke('get-webview-preload-path'),

  // File operations
  files: {
    readFile: (path) => ipcRenderer.invoke('files:readFile', path),
    selectFile: (path) => ipcRenderer.invoke('files:selectFile', path),
    listDirectory: (path) => ipcRenderer.invoke('files:listDirectory', path),
    listPrompts: () => ipcRenderer.invoke('files:listPrompts'),
    readPrompt: (name) => ipcRenderer.invoke('files:readPrompt', name),
  },

  // Dialog operations
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
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

  // Check if running in Electron
  isElectron: true,
})
