const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
let splashWindow;

function createWindow() {
  // SPLASH
  splashWindow = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#EAF0F6',
    resizable: false,
    show: false,           // ← better control
  });

  splashWindow.loadFile(path.join(__dirname, 'splash', 'splash.html'));
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  // MAIN WINDOW – start hidden, NO fullscreen at creation
  mainWindow = new BrowserWindow({
    show: false,
    width: 1400,           // fallback size
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#EAF0F6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // spellcheck: false,  // optional
    },
  });

  const isDev = require('electron-is-dev');

  if (isDev) {
    mainWindow.loadURL('https://coniv.in');
  } else {
    // Option A – try local files first (recommended for packaged app!)
    // mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));  // ← adjust folder name

    // Option B – keep remote (but add wait + error handling)
    mainWindow.loadURL('https://coniv.in');
  }

  // Better sequence
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }
    mainWindow.show();
    mainWindow.maximize();      // ← better than fullscreen for most desktop apps
    // mainWindow.setFullScreen(true); // ← only if you really want true fullscreen
  });

  // Optional: debug loading problems
  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDesc, url) => {
    console.error('Failed to load:', url, errorCode, errorDesc);
  });

  mainWindow.webContents.on('did-fail-provisional-load', (e, ...args) => {
    console.error('Provisional load failed:', args);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});