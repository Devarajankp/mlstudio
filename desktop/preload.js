// Safe bridge between the Malayalam Studio page and the Windows app.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mlDesktop', {
  version: ipcRenderer.sendSync('app:version'),
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-max'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-max'),
  onMaximized: (cb) => ipcRenderer.on('win:max', (_e, m) => cb(!!m)),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openExternal: (u) => ipcRenderer.send('app:open-external', String(u)),
});
