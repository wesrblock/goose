const { contextBridge, ipcRenderer } = require('electron')

const config = {
    DEFAULT_HOST: 'http://127.0.0.1:3000',
    START_EMBEDDED_SERVER: process.env.VITE_START_EMBEDDED_SERVER === 'yes',
};

contextBridge.exposeInMainWorld('appConfig', config);
contextBridge.exposeInMainWorld('electron', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  createChatWindow: (query) => ipcRenderer.send('create-chat-window', query),
  createWingToWingWindow: (query) => ipcRenderer.send('create-wing-to-wing-window', query),
  logInfo: (txt) => ipcRenderer.send('logInfo', txt),
})