import 'dotenv/config';
import { app, BrowserWindow, Tray, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import { spawn } from 'child_process';
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

let tray: Tray | null = null;
let isQuitting = false;

// Function to show the main window
let spotlightWindow: BrowserWindow | null = null;

const createSpotlightWindow = () => {
  // If window exists, just show it
  if (spotlightWindow) {
    spotlightWindow.show();
    spotlightWindow.focus();
    return;
  }

  // Create new spotlight window
  spotlightWindow = new BrowserWindow({
    width: 600,
    height: 60,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    skipTaskbar: true,
    alwaysOnTop: true,
  });

  // Center on screen
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const windowBounds = spotlightWindow.getBounds();
  spotlightWindow.setPosition(
    Math.round(width / 2 - windowBounds.width / 2),
    Math.round(height / 3 - windowBounds.height / 2)
  );

  // Load spotlight window content
  const spotlightParams = '?window=spotlight#/spotlight';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    spotlightWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${spotlightParams}`);
  } else {
    spotlightWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html${spotlightParams}`)
    );
  }

  // Hide window when it loses focus
  spotlightWindow.on('blur', () => {
    spotlightWindow?.hide();
  });

  // Cleanup on close
  spotlightWindow.on('closed', () => {
    spotlightWindow = null;
  });
};

const showWindow = () => {
  // TODO show a list of windows
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.show();
    win.focus();
  }
};

const createTray = () => {
  const isDev = process.env.NODE_ENV === 'development';
  let iconPath;
  
  if (isDev) {
    iconPath = path.join(process.cwd(), 'src', 'bin', 'goose.png');
  } else {
    iconPath = path.join(process.resourcesPath, 'bin', 'goose.png');
  }

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setToolTip('Goose Dev');
  tray.setContextMenu(contextMenu);
};

// Start the goosed binary
const startGoosed = () => {
  // In development, the binary is in src/bin
  // In production, it will be in the resources/bin directory
  const isDev = process.env.NODE_ENV === 'development';
  let goosedPath;
  
  if (isDev) {
    // In development, use the absolute path from the project root
    goosedPath = path.join(process.cwd(), 'src', 'bin', process.platform === 'win32' ? 'goosed.exe' : 'goosed');
  } else {
    // In production, use the path relative to the app resources
    goosedPath = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'goosed.exe' : 'goosed');
  }

  console.log(`Starting goosed from: ${goosedPath}`);
  
  const goosedProcess = spawn(goosedPath);

  goosedProcess.stdout.on('data', (data) => {
    console.log(`goosed stdout: ${data}`);
  });

  goosedProcess.stderr.on('data', (data) => {
    console.error(`goosed stderr: ${data}`);
  });

  goosedProcess.on('close', (code) => {
    console.log(`goosed process exited with code ${code}`);
  });

  goosedProcess.on('error', (err) => {
    console.error('Failed to start goosed:', err);
  });

  // Ensure goosed is terminated when the app quits
  app.on('will-quit', () => {
    goosedProcess.kill();
  });
};

const createWindow = (query?: string) => {
  const mainWindow = new BrowserWindow({
    frame: false,
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  const queryParam = query ? `?initialQuery=${encodeURIComponent(query)}` : '';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${queryParam}`);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { search: queryParam.slice(1) }
    );
  }

  console.log(MAIN_WINDOW_VITE_NAME);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Handle window close button - hide instead of quit
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Import ipcMain at the top
import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } from 'electron';

// Add IPC handler for hiding windows
ipcMain.on('hide-window', () => {
  if (spotlightWindow) {
    spotlightWindow.hide();
  }
});

ipcMain.on('create-chat-window', (_, query) => {
  createWindow(query);
});

app.whenReady().then(() => {
  // Get the server startup configuration
  const shouldStartServer = (import.meta.env.VITE_START_EMBEDDED_SERVER || 'yes').toLowerCase() === 'yes';
  
  if (shouldStartServer) {
    console.log('Starting embedded goosed server');
    startGoosed();
  } else {
    console.log('Skipping embedded server startup (disabled by configuration)');
  }
  //createWindow();
  createTray();
  createSpotlightWindow();

  // Register global shortcut
  globalShortcut.register('Control+Alt+Command+G', createSpotlightWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});