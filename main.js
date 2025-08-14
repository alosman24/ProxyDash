const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

let mainWindow;
let dotnetProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Start .NET API server
function startDotNetApi() {
  if (isDev) {
    // In development, assume API is running separately
    console.log('Development mode - expecting API to be running on localhost:5000');
    console.log('Please make sure to run: cd ProxyTester.Api && dotnet run');
    return;
  }
  
  // In production, start the API process
  const apiPath = path.join(__dirname, '..', 'ProxyTester.Api');
  dotnetProcess = spawn('dotnet', ['ProxyTester.Api.dll'], {
    cwd: apiPath,
    stdio: 'inherit'
  });
  
  dotnetProcess.on('error', (error) => {
    console.error('Failed to start .NET API:', error);
  });
}

// Stop .NET API server
function stopDotNetApi() {
  if (dotnetProcess) {
    dotnetProcess.kill();
    dotnetProcess = null;
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'ProxyChimp - Professional Proxy Testing Suite',
    show: false
  });

  // Load the React app
  if (isDev) {
    // In development, try to load from dev server, fallback to built version
    mainWindow.loadURL('http://localhost:3000')
      .then(() => {
        console.log('Loaded from dev server');
        mainWindow.webContents.openDevTools();
      })
      .catch((error) => {
        console.log('Dev server not running, loading built version...');
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
      });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  startDotNetApi();
  
  // Wait a bit for API to start, then create window
  setTimeout(createWindow, 2000);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopDotNetApi();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopDotNetApi();
});

// IPC handlers for API communication
ipcMain.handle('api-request', async (event, { method, endpoint, data }) => {
  try {
    const baseURL = 'http://localhost:5000/api';
    const config = {
      method,
      url: `${baseURL}${endpoint}`,
      timeout: 30000,
    };
    
    if (data) {
      config.data = data;
      config.headers = {
        'Content-Type': 'application/json'
      };
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('API request failed:', error);
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
});

// Health check
ipcMain.handle('check-api-health', async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/proxy/health', {
      timeout: 5000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});