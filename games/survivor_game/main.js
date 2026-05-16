const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Survivor Game",
    autoHideMenuBar: true
  });

  // 等待伺服器啟動後再載入
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8080');
  }, 1000);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startServer() {
  // 啟動 server.js
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    env: { ...process.env, PORT: 8080 }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

app.on('ready', () => {
  startServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
