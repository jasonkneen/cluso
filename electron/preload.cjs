const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods you need here
  // Example:
  // sendMessage: (channel, data) => ipcRenderer.send(channel, data),
  // onMessage: (channel, callback) => ipcRenderer.on(channel, callback),
})
