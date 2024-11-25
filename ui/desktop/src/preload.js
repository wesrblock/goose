const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  createChatWindow: (query) => ipcRenderer.send('create-chat-window', query),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  openInChrome: (url) => ipcRenderer.send('open-in-chrome', url),
})
