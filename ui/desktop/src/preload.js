const { contextBridge, ipcRenderer } = require('electron')


const config = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('appConfig', {
  get: (key) => config[key],
  getAll: () => config,
});

contextBridge.exposeInMainWorld('electron', {
  getConfig: () => config,
  hideWindow: () => ipcRenderer.send('hide-window'),
  directoryChooser: () => ipcRenderer.send('directory-chooser'),
  createChatWindow: (query) => ipcRenderer.send('create-chat-window', query),
  logInfo: (txt) => ipcRenderer.send('logInfo', txt),
  showNotification: (data) => ipcRenderer.send('notify', data),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  saveSession: (session) => ipcRenderer.send('save-session', session),
  getSession: (sessionId) => ipcRenderer.send('get-session', sessionId),
  openInChrome: (url) => ipcRenderer.send('open-in-chrome', url),
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
})
