const { contextBridge } = require('electron');

/*
  SAFE bridge between Electron and frontend
  Add APIs here if needed later
*/


contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.version,
  closeApp: () => app.quit() // if needed
});