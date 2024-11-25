import 'dotenv/config';
import { loadZshEnv } from './utils/loadEnv';
import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification } from 'electron';
import path from 'node:path';
import { start as startGoosed } from './goosed';
import started from "electron-squirrel-startup";
import log from './utils/logger';
import { getPort } from './utils/portUtils';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

declare var MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare var MAIN_WINDOW_VITE_NAME: string;
let appConfig = { GOOSE_SERVER__PORT: 3000, GOOSE_API_HOST: 'http://127.0.0.1' };

const createLauncher = () => {
  const launcherWindow = new BrowserWindow({
    width: 600,
    height: 60,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [JSON.stringify(appConfig)],
    },
    skipTaskbar: true,
    alwaysOnTop: true,
  });

  // Center on screen
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const windowBounds = launcherWindow.getBounds();

  launcherWindow.setPosition(
    Math.round(width / 2 - windowBounds.width / 2),
    Math.round(height / 3 - windowBounds.height / 2)
  );

  // Load launcher window content
  const launcherParams = '?window=launcher#/launcher';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    launcherWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${launcherParams}`);
  } else {
    launcherWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html${launcherParams}`)
    );
  }

  // Destroy window when it loses focus
  launcherWindow.on('blur', () => {
    launcherWindow.destroy();
  });
};


// Track windows by ID
let windowCounter = 0;
const windowMap = new Map<number, BrowserWindow>();

const createChat = (query?: string) => {
  const isDev = process.env.NODE_ENV === 'development';

  const mainWindow = new BrowserWindow({
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 18 },
    width: 530,
    height: 800,
    minWidth: 530,
    minHeight: 800,
    transparent: true,
    useContentSize: true,
    icon: path.join(__dirname, '../images/icon'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [JSON.stringify(appConfig)],
    },
  });

  // Load the index.html of the app.
  const queryParam = query ? `?initialQuery=${encodeURIComponent(query)}` : '';
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  // Increment window counter to track number of windows
  const windowId = ++windowCounter;
  const direction = windowId % 2 === 0 ? 1 : -1; // Alternate direction
  const initialOffset = 50;

  // Set window position with alternating offset strategy
  const baseXPosition = Math.round(width / 2 - mainWindow.getSize()[0] / 2);
  const xOffset = direction * initialOffset * Math.floor(windowId / 2);
  mainWindow.setPosition(baseXPosition + xOffset, 100);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${queryParam}`);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { search: queryParam.slice(1) }
    );
  }

  // DevTools
  globalShortcut.register('Alt+Command+I', () => {
    mainWindow.webContents.openDevTools();
  });

  windowMap.set(windowId, mainWindow);
  mainWindow.on('closed', () => {
    windowMap.delete(windowId);
  });
};

const createTray = () => {
  const isDev = process.env.NODE_ENV === 'development';
  let iconPath: string;

  if (isDev) {
    iconPath = path.join(process.cwd(), 'images', 'iconTemplate.png');
  } else {
    iconPath = path.join(process.resourcesPath, 'images', 'iconTemplate.png');
  }

  const tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('Goose');
  tray.setContextMenu(contextMenu);
};


const showWindow = () => {
  const windows = BrowserWindow.getAllWindows();

  if (windows.length === 0) {
    log.info("No windows are currently open.");
    return;
  }

  // Define the initial offset values
  const initialOffsetX = 30;
  const initialOffsetY = 30;

  // Iterate over all windows
  windows.forEach((win, index) => {
    const currentBounds = win.getBounds(); // Get the current window bounds (position and size)

    // Calculate the new position with an incremental offset
    const newX = currentBounds.x + initialOffsetX * index;
    const newY = currentBounds.y + initialOffsetY * index;

    // Set the new bounds with the calculated position
    win.setBounds({
      x: newX,
      y: newY,
      width: currentBounds.width,
      height: currentBounds.height,
    });

    if (!win.isVisible()) {
      win.show();
    }

    win.focus();
  });
};

// Handle window resize requests
ipcMain.on('resize-window', (_, { windowId, width, height }) => {
  const window = windowMap.get(windowId);
  if (window) {
    window.setSize(width, height);
  }
});

app.whenReady().then(async () => {
  // Load zsh environment variables in production mode only
  const isProduction = app.isPackaged;
  loadZshEnv(isProduction);

  // Get the server startup configuration
  const shouldStartServer = (process.env.VITE_START_EMBEDDED_SERVER || 'yes').toLowerCase() === 'yes';
  
  if (shouldStartServer) {
    log.info('Starting embedded goosed server');
    const port = await getPort();
    process.env.GOOSE_SERVER__PORT = port.toString();
    appConfig = { ...appConfig, GOOSE_SERVER__PORT: process.env.GOOSE_SERVER__PORT };
    startGoosed(app);
  } else {
    log.info('Skipping embedded server startup (disabled by configuration)');
  }

  createTray();
  createChat();

  
  // Show launcher input on key combo
  globalShortcut.register('Control+Alt+Command+G', createLauncher);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createChat();
    }
  });

  ipcMain.on('create-chat-window', (_, query) => {
    createChat(query);
  });


  ipcMain.on('notify', (event, data) => {
    console.log("NOTIFY", data);
    new Notification({ title: data.title, body: data.body }).show();
  });
   
  ipcMain.on('logInfo', (_, info) => {
    log.info("from renderer:", info);
  });
  
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});