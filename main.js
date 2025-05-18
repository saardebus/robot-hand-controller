const { app, BrowserWindow } = require('electron')
const path = require('path');

// Create the application window
const createWindow = () => {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow loading local resources
      enableRemoteModule: true // Enable remote module for file dialogs
    },
    icon: path.join(__dirname, 'build_icon.ico')
  });

  // Provide the app path to the renderer process
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.electronAppPath = '${app.getAppPath().replace(/\\/g, '/')}';
      console.log('App path set:', window.electronAppPath);
    `);
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Load the index.html file
  mainWindow.loadFile('index.html');
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the dock icon
  // is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
