import { contextBridge, ipcRenderer } from 'electron'
import type { SailcloudApi } from '../src/shared/ipc'

const api: SailcloudApi = {
  ping: () => ipcRenderer.invoke('app:ping'),

  selectBoatFolder: () => ipcRenderer.invoke('system:selectBoatFolder'),
  selectImageFile: () => ipcRenderer.invoke('system:selectImageFile'),
  selectImageFiles: () => ipcRenderer.invoke('system:selectImageFiles'),

  listBoats: () => ipcRenderer.invoke('boats:list'),
  createBoat: (input) => ipcRenderer.invoke('boats:create', input),
  addExistingBoatFolder: (folderPath) => ipcRenderer.invoke('boats:addExistingFolder', folderPath),
  removeBoatFromLibrary: (boatId) => ipcRenderer.invoke('boats:removeFromLibrary', boatId),

  getBoatProject: (boatId) => ipcRenderer.invoke('boat:getProject', boatId),
  updateBoat: (boatId, patch) => ipcRenderer.invoke('boat:update', boatId, patch),

  addCrewMember: (boatId, input) => ipcRenderer.invoke('crew:add', boatId, input),
  removeCrewMember: (boatId, crewId) => ipcRenderer.invoke('crew:remove', boatId, crewId),

  addSail: (boatId, input) => ipcRenderer.invoke('sails:add', boatId, input),
  removeSail: (boatId, sailId) => ipcRenderer.invoke('sails:remove', boatId, sailId),

  addMastProfile: (boatId, input) => ipcRenderer.invoke('masts:add', boatId, input),
  removeMastProfile: (boatId, mastId) => ipcRenderer.invoke('masts:remove', boatId, mastId),

  importPhotos: (boatId, sourcePaths) => ipcRenderer.invoke('photos:import', boatId, sourcePaths),
  importClipboardImage: (boatId) => ipcRenderer.invoke('photos:importClipboard', boatId),
  getPhotoPath: (boatId, photoId) => ipcRenderer.invoke('photos:getPath', boatId, photoId),
  updatePhotoAnalysis: (boatId, photoId, analysis) =>
    ipcRenderer.invoke('photos:updateAnalysis', boatId, photoId, analysis),
  updatePhotoMeta: (boatId, photoId, patch) => ipcRenderer.invoke('photos:updateMeta', boatId, photoId, patch),
  deletePhotos: (boatId, photoIds) => ipcRenderer.invoke('photos:delete', boatId, photoIds),

  // AutoScan - Note: This is a pass-through, actual processing happens in renderer with OpenCV.js
  runAutoScan: (input) => ipcRenderer.invoke('cv:autoScan', input),
}

contextBridge.exposeInMainWorld('sailcloud', api)
