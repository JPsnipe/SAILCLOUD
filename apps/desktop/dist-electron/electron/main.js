"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_1 = require("./ipc");
function getPreloadPath() {
    return node_path_1.default.join(__dirname, 'preload.js');
}
function getIndexHtmlPath() {
    return node_path_1.default.resolve(__dirname, '../../dist/index.html');
}
let mainWindow = null;
function createMainWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });
    win.center();
    win.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        void win.loadURL(devServerUrl);
    }
    else {
        void win.loadFile(getIndexHtmlPath());
    }
    return win;
}
electron_1.app.whenReady().then(() => {
    (0, ipc_1.registerIpcHandlers)(() => electron_1.BrowserWindow.getFocusedWindow() ?? mainWindow);
    mainWindow = createMainWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            mainWindow = createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
