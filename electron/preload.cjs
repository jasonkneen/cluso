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

  // Check if running in Electron
  isElectron: true,
})
