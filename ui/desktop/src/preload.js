const { contextBridge, ipcRenderer } = require('electron')

let windowId = null;

// Listen for window ID from main process
ipcRenderer.on('set-window-id', (_, id) => {
  windowId = id;
});

const config = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('appConfig', {
  get: (key) => config[key],
  getAll: () => config,
});

contextBridge.exposeInMainWorld('electron', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  createChatWindow: (query) => ipcRenderer.send('create-chat-window', query),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { windowId, width, height }),
  getWindowId: () => windowId,
  logInfo: (txt) => ipcRenderer.send('logInfo', txt),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  openInChrome: (url) => ipcRenderer.send('open-in-chrome', url),
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
})
  
