import { app, dialog, ipcMain } from 'electron'
import type { BrowserWindow, OpenDialogOptions } from 'electron'
import {
  addCrewMember,
  addExistingBoatFolder,
  addMastProfile,
  addSail,
  createBoat,
  deletePhotos,
  getPhotoAbsolutePath,
  getBoatProject,
  importClipboardImage,
  importPhotos,
  listBoats,
  removeBoatFromLibrary,
  removeCrewMember,
  removeMastProfile,
  removeSail,
  updatePhotoAnalysis,
  updatePhotoMeta,
  updateBoat,
} from './store'

export function registerIpcHandlers(getFocusedWindow: () => BrowserWindow | null) {
  ipcMain.handle('app:ping', async () => ({ ok: true, version: app.getVersion() }))

  ipcMain.handle('system:selectBoatFolder', async () => {
    const win = getFocusedWindow()
    const options: OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return { folderPath: result.canceled ? null : (result.filePaths[0] ?? null) }
  })

  ipcMain.handle('system:selectImageFile', async () => {
    const win = getFocusedWindow()
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return { filePath: result.canceled ? null : (result.filePaths[0] ?? null) }
  })

  ipcMain.handle('system:selectImageFiles', async () => {
    const win = getFocusedWindow()
    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return { filePaths: result.canceled ? [] : result.filePaths }
  })

  ipcMain.handle('boats:list', listBoats)
  ipcMain.handle('boats:create', async (_evt, input) => createBoat(input))
  ipcMain.handle('boats:addExistingFolder', async (_evt, folderPath) => addExistingBoatFolder(folderPath))
  ipcMain.handle('boats:removeFromLibrary', async (_evt, boatId) => removeBoatFromLibrary(boatId))

  ipcMain.handle('boat:getProject', async (_evt, boatId) => getBoatProject(boatId))
  ipcMain.handle('boat:update', async (_evt, boatId, patch) => updateBoat(boatId, patch))

  ipcMain.handle('crew:add', async (_evt, boatId, input) => addCrewMember(boatId, input))
  ipcMain.handle('crew:remove', async (_evt, boatId, crewId) => removeCrewMember(boatId, crewId))

  ipcMain.handle('sails:add', async (_evt, boatId, input) => addSail(boatId, input))
  ipcMain.handle('sails:remove', async (_evt, boatId, sailId) => removeSail(boatId, sailId))

  ipcMain.handle('masts:add', async (_evt, boatId, input) => addMastProfile(boatId, input))
  ipcMain.handle('masts:remove', async (_evt, boatId, mastId) => removeMastProfile(boatId, mastId))

  ipcMain.handle('photos:import', async (_evt, boatId, sourcePaths) => importPhotos(boatId, sourcePaths))
  ipcMain.handle('photos:importClipboard', async (_evt, boatId) => importClipboardImage(boatId))
  ipcMain.handle('photos:getPath', async (_evt, boatId, photoId) => getPhotoAbsolutePath(boatId, photoId))
  ipcMain.handle('photos:updateAnalysis', async (_evt, boatId, photoId, analysis) =>
    updatePhotoAnalysis(boatId, photoId, analysis),
  )
  ipcMain.handle('photos:updateMeta', async (_evt, boatId, photoId, patch) => updatePhotoMeta(boatId, photoId, patch))
  ipcMain.handle('photos:delete', async (_evt, boatId, photoIds) => deletePhotos(boatId, photoIds))

  // AutoScan CV - Note: OpenCV.js runs in renderer process
  // This handler is a placeholder for future server-side processing
  // Currently, use the cv module directly from React components
  ipcMain.handle('cv:autoScan', async () => {
    return {
      success: false,
      points: [],
      confidence: 0,
      error: 'AutoScan runs in renderer process. Import from lib/cv directly.',
    }
  })
}
