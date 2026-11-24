'use strict';
// The only things the page may ask the app to do.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('csdReceipt', {
  load: () => ipcRenderer.invoke('csd:load'),
  saveSettings: (settings) => ipcRenderer.invoke('csd:save-settings', settings),
  fontCheck: () => ipcRenderer.invoke('csd:font-check'),
  printers: () => ipcRenderer.invoke('csd:printers'),
  print: (entry) => ipcRenderer.invoke('csd:print', entry),
  savePdf: (entry) => ipcRenderer.invoke('csd:pdf', entry),
});
