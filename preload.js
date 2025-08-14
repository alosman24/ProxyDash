const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // API communication
  apiRequest: (method, endpoint, data) => 
    ipcRenderer.invoke('api-request', { method, endpoint, data }),
  
  // Health check
  checkApiHealth: () => 
    ipcRenderer.invoke('check-api-health'),
  
  // Platform info
  platform: process.platform,
  
  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});