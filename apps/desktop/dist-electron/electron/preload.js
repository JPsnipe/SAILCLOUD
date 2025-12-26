"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    ping: () => electron_1.ipcRenderer.invoke('app:ping'),
    selectBoatFolder: () => electron_1.ipcRenderer.invoke('system:selectBoatFolder'),
    selectImageFile: () => electron_1.ipcRenderer.invoke('system:selectImageFile'),
    selectImageFiles: () => electron_1.ipcRenderer.invoke('system:selectImageFiles'),
    listBoats: () => electron_1.ipcRenderer.invoke('boats:list'),
    createBoat: (input) => electron_1.ipcRenderer.invoke('boats:create', input),
    addExistingBoatFolder: (folderPath) => electron_1.ipcRenderer.invoke('boats:addExistingFolder', folderPath),
    removeBoatFromLibrary: (boatId) => electron_1.ipcRenderer.invoke('boats:removeFromLibrary', boatId),
    getBoatProject: (boatId) => electron_1.ipcRenderer.invoke('boat:getProject', boatId),
    updateBoat: (boatId, patch) => electron_1.ipcRenderer.invoke('boat:update', boatId, patch),
    addCrewMember: (boatId, input) => electron_1.ipcRenderer.invoke('crew:add', boatId, input),
    removeCrewMember: (boatId, crewId) => electron_1.ipcRenderer.invoke('crew:remove', boatId, crewId),
    addSail: (boatId, input) => electron_1.ipcRenderer.invoke('sails:add', boatId, input),
    removeSail: (boatId, sailId) => electron_1.ipcRenderer.invoke('sails:remove', boatId, sailId),
    addMastProfile: (boatId, input) => electron_1.ipcRenderer.invoke('masts:add', boatId, input),
    removeMastProfile: (boatId, mastId) => electron_1.ipcRenderer.invoke('masts:remove', boatId, mastId),
    importPhotos: (boatId, sourcePaths) => electron_1.ipcRenderer.invoke('photos:import', boatId, sourcePaths),
    importClipboardImage: (boatId) => electron_1.ipcRenderer.invoke('photos:importClipboard', boatId),
    getPhotoPath: (boatId, photoId) => electron_1.ipcRenderer.invoke('photos:getPath', boatId, photoId),
    updatePhotoAnalysis: (boatId, photoId, analysis) => electron_1.ipcRenderer.invoke('photos:updateAnalysis', boatId, photoId, analysis),
    updatePhotoMeta: (boatId, photoId, patch) => electron_1.ipcRenderer.invoke('photos:updateMeta', boatId, photoId, patch),
    deletePhotos: (boatId, photoIds) => electron_1.ipcRenderer.invoke('photos:delete', boatId, photoIds),
    // AutoScan - Note: This is a pass-through, actual processing happens in renderer with OpenCV.js
    runAutoScan: (input) => electron_1.ipcRenderer.invoke('cv:autoScan', input),
};
electron_1.contextBridge.exposeInMainWorld('sailcloud', api);
