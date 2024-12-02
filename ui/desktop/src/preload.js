const { contextBridge, ipcRenderer } = require('electron')


const config = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('appConfig', {
  get: (key) => config[key],
  getAll: () => config,
});

contextBridge.exposeInMainWorld('electron', {
  getConfig: () => config,
  listRecent: () => ipcRenderer.invoke('list-recent'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  createChatWindow: (query, dir) => ipcRenderer.send('create-chat-window', query, dir),
  logInfo: (txt) => ipcRenderer.send('logInfo', txt),
  showNotification: (data) => ipcRenderer.send('notify', data),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  openInChrome: (url) => ipcRenderer.send('open-in-chrome', url),
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
  startGoosed: (dir) => ipcRenderer.invoke('start-goosed', dir),
})
