const { contextBridge, ipcRenderer } = require('electron')

const config = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('appConfig', {
  get: (key) => config[key],
  getAll: () => config,
});

contextBridge.exposeInMainWorld('electron', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  createChatWindow: (query) => ipcRenderer.send('create-chat-window', query),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  logInfo: (txt) => ipcRenderer.send('logInfo', txt),
})