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

  // Check if running in Electron
  isElectron: true,
})
