"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const store_1 = require("./store");
function registerIpcHandlers(getFocusedWindow) {
    electron_1.ipcMain.handle('app:ping', async () => ({ ok: true, version: electron_1.app.getVersion() }));
    electron_1.ipcMain.handle('system:selectBoatFolder', async () => {
        const win = getFocusedWindow();
        const options = { properties: ['openDirectory', 'createDirectory'] };
        const result = win ? await electron_1.dialog.showOpenDialog(win, options) : await electron_1.dialog.showOpenDialog(options);
        return { folderPath: result.canceled ? null : (result.filePaths[0] ?? null) };
    });
    electron_1.ipcMain.handle('system:selectImageFile', async () => {
        const win = getFocusedWindow();
        const options = {
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        };
        const result = win ? await electron_1.dialog.showOpenDialog(win, options) : await electron_1.dialog.showOpenDialog(options);
        return { filePath: result.canceled ? null : (result.filePaths[0] ?? null) };
    });
    electron_1.ipcMain.handle('system:selectImageFiles', async () => {
        const win = getFocusedWindow();
        const options = {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        };
        const result = win ? await electron_1.dialog.showOpenDialog(win, options) : await electron_1.dialog.showOpenDialog(options);
        return { filePaths: result.canceled ? [] : result.filePaths };
    });
    electron_1.ipcMain.handle('boats:list', store_1.listBoats);
    electron_1.ipcMain.handle('boats:create', async (_evt, input) => (0, store_1.createBoat)(input));
    electron_1.ipcMain.handle('boats:addExistingFolder', async (_evt, folderPath) => (0, store_1.addExistingBoatFolder)(folderPath));
    electron_1.ipcMain.handle('boats:removeFromLibrary', async (_evt, boatId) => (0, store_1.removeBoatFromLibrary)(boatId));
    electron_1.ipcMain.handle('boat:getProject', async (_evt, boatId) => (0, store_1.getBoatProject)(boatId));
    electron_1.ipcMain.handle('boat:update', async (_evt, boatId, patch) => (0, store_1.updateBoat)(boatId, patch));
    electron_1.ipcMain.handle('crew:add', async (_evt, boatId, input) => (0, store_1.addCrewMember)(boatId, input));
    electron_1.ipcMain.handle('crew:remove', async (_evt, boatId, crewId) => (0, store_1.removeCrewMember)(boatId, crewId));
    electron_1.ipcMain.handle('sails:add', async (_evt, boatId, input) => (0, store_1.addSail)(boatId, input));
    electron_1.ipcMain.handle('sails:remove', async (_evt, boatId, sailId) => (0, store_1.removeSail)(boatId, sailId));
    electron_1.ipcMain.handle('masts:add', async (_evt, boatId, input) => (0, store_1.addMastProfile)(boatId, input));
    electron_1.ipcMain.handle('masts:remove', async (_evt, boatId, mastId) => (0, store_1.removeMastProfile)(boatId, mastId));
    electron_1.ipcMain.handle('photos:import', async (_evt, boatId, sourcePaths) => (0, store_1.importPhotos)(boatId, sourcePaths));
    electron_1.ipcMain.handle('photos:importClipboard', async (_evt, boatId) => (0, store_1.importClipboardImage)(boatId));
    electron_1.ipcMain.handle('photos:getPath', async (_evt, boatId, photoId) => (0, store_1.getPhotoAbsolutePath)(boatId, photoId));
    electron_1.ipcMain.handle('photos:updateAnalysis', async (_evt, boatId, photoId, analysis) => (0, store_1.updatePhotoAnalysis)(boatId, photoId, analysis));
    electron_1.ipcMain.handle('photos:updateMeta', async (_evt, boatId, photoId, patch) => (0, store_1.updatePhotoMeta)(boatId, photoId, patch));
    electron_1.ipcMain.handle('photos:delete', async (_evt, boatId, photoIds) => (0, store_1.deletePhotos)(boatId, photoIds));
    // AutoScan CV - Note: OpenCV.js runs in renderer process
    // This handler is a placeholder for future server-side processing
    // Currently, use the cv module directly from React components
    electron_1.ipcMain.handle('cv:autoScan', async () => {
        return {
            success: false,
            points: [],
            confidence: 0,
            error: 'AutoScan runs in renderer process. Import from lib/cv directly.',
        };
    });
}
