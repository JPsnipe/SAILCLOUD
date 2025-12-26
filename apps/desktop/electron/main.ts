import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipc'

function getPreloadPath() {
  return path.join(__dirname, 'preload.js')
}

function getIndexHtmlPath() {
  return path.resolve(__dirname, '../../dist/index.html')
}

let mainWindow: BrowserWindow | null = null

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.center()

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(getIndexHtmlPath())
  }

  return win
}

app.whenReady().then(() => {
  registerIpcHandlers(() => BrowserWindow.getFocusedWindow() ?? mainWindow)
  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
