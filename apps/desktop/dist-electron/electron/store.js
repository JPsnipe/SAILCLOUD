"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBoats = listBoats;
exports.createBoat = createBoat;
exports.addExistingBoatFolder = addExistingBoatFolder;
exports.removeBoatFromLibrary = removeBoatFromLibrary;
exports.getBoatProject = getBoatProject;
exports.updateBoat = updateBoat;
exports.addCrewMember = addCrewMember;
exports.removeCrewMember = removeCrewMember;
exports.addSail = addSail;
exports.removeSail = removeSail;
exports.addMastProfile = addMastProfile;
exports.removeMastProfile = removeMastProfile;
exports.importPhotos = importPhotos;
exports.importClipboardImage = importClipboardImage;
exports.getPhotoAbsolutePath = getPhotoAbsolutePath;
exports.updatePhotoAnalysis = updatePhotoAnalysis;
exports.updatePhotoMeta = updatePhotoMeta;
exports.deletePhotos = deletePhotos;
const electron_1 = require("electron");
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const domain_1 = require("../src/shared/domain");
const BOAT_DATA_DIRNAME = '.sailcloud';
const BOAT_DATA_FILENAME = 'boat.json';
const BOATS_INDEX_FILENAME = 'boats-index.json';
const IMAGES_DIRNAME = 'images';
function nowIso() {
    return new Date().toISOString();
}
function nowFileStamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
}
function getIndexPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), BOATS_INDEX_FILENAME);
}
function getBoatDataPath(folderPath) {
    return node_path_1.default.join(folderPath, BOAT_DATA_DIRNAME, BOAT_DATA_FILENAME);
}
async function pathExists(filePath) {
    try {
        await promises_1.default.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
async function readJsonFile(filePath) {
    const raw = await promises_1.default.readFile(filePath, 'utf8');
    try {
        return JSON.parse(raw);
    }
    catch (parseError) {
        // Try to provide more helpful error message
        const err = parseError;
        console.error(`[Store] JSON parse error in ${filePath}:`, err.message);
        // Attempt to find the problematic line
        const lines = raw.split('\n');
        const match = err.message.match(/position (\d+)/);
        if (match) {
            const pos = parseInt(match[1], 10);
            let charCount = 0;
            for (let i = 0; i < lines.length; i++) {
                charCount += lines[i].length + 1; // +1 for newline
                if (charCount >= pos) {
                    console.error(`[Store] Error near line ${i + 1}: "${lines[i].substring(0, 100)}..."`);
                    break;
                }
            }
        }
        throw new Error(`JSON parse error in boat data: ${err.message}. The file may be corrupted. Try restoring from backup.`);
    }
}
async function writeJsonFileAtomic(filePath, data) {
    const dir = node_path_1.default.dirname(filePath);
    // Ensure directory exists
    try {
        await promises_1.default.mkdir(dir, { recursive: true });
    }
    catch (mkdirErr) {
        console.error(`[Store] Failed to create directory ${dir}:`, mkdirErr);
        throw new Error(`Cannot create directory: ${dir}`);
    }
    const tmpPath = `${filePath}.tmp`;
    const json = JSON.stringify(data, null, 2);
    try {
        await promises_1.default.writeFile(tmpPath, json, 'utf8');
    }
    catch (writeErr) {
        console.error(`[Store] Failed to write temp file ${tmpPath}:`, writeErr);
        throw new Error(`Cannot write to ${tmpPath}. Check folder permissions.`);
    }
    try {
        await promises_1.default.rename(tmpPath, filePath);
    }
    catch (renameErr) {
        // If rename fails, try direct write as fallback
        console.warn(`[Store] Rename failed, trying direct write:`, renameErr);
        try {
            await promises_1.default.writeFile(filePath, json, 'utf8');
            // Clean up temp file
            await promises_1.default.unlink(tmpPath).catch(() => { });
        }
        catch (directWriteErr) {
            console.error(`[Store] Direct write also failed:`, directWriteErr);
            throw new Error(`Cannot save to ${filePath}. The file may be locked or you don't have write permissions.`);
        }
    }
}
async function readBoatIndex() {
    const indexPath = getIndexPath();
    if (!(await pathExists(indexPath))) {
        return { version: 1, boats: [] };
    }
    const data = await readJsonFile(indexPath);
    const parsed = domain_1.BoatIndexSchema.safeParse(data);
    if (!parsed.success) {
        return { version: 1, boats: [] };
    }
    return parsed.data;
}
async function writeBoatIndex(index) {
    await writeJsonFileAtomic(getIndexPath(), index);
}
async function ensureBoatFolderStructure(folderPath) {
    await promises_1.default.mkdir(folderPath, { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(folderPath, BOAT_DATA_DIRNAME), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(folderPath, IMAGES_DIRNAME), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(folderPath, 'logs'), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(folderPath, 'reports'), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(folderPath, 'crew'), { recursive: true });
}
function defaultTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
async function listBoats() {
    const index = await readBoatIndex();
    const result = [];
    for (const entry of index.boats) {
        const boatPath = getBoatDataPath(entry.folderPath);
        if (!(await pathExists(boatPath)))
            continue;
        try {
            const project = await readJsonFile(boatPath);
            const parsed = domain_1.BoatProjectSchema.safeParse(project);
            if (!parsed.success)
                continue;
            const { boat, photos, sails, masts } = parsed.data;
            // Calculate statistics for the fleet dashboard
            const photoCount = photos.length;
            const inboxCount = photos.filter((p) => !p.analysis || p.analysis.sceneType === 'GENERIC').length;
            const sailCount = sails.length;
            const mastCount = masts.length;
            const analyzedCount = photos.filter((p) => p.analysis && p.analysis.layers.length > 0).length;
            result.push({
                id: boat.id,
                name: boat.name,
                timezone: boat.timezone,
                folderPath: entry.folderPath,
                photoPath: boat.photoPath,
                stats: {
                    photoCount,
                    inboxCount,
                    sailCount,
                    mastCount,
                    analyzedCount,
                },
            });
        }
        catch {
            continue;
        }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}
// Folders that should not be used directly as boat folders
const PROTECTED_FOLDERS = ['Documents', 'Desktop', 'Downloads', 'Pictures', 'Music', 'Videos'];
function isProtectedFolder(folderPath) {
    const normalized = node_path_1.default.normalize(folderPath);
    const basename = node_path_1.default.basename(normalized);
    // Check if it's a direct child of user home
    const userHome = electron_1.app.getPath('home');
    const parent = node_path_1.default.dirname(normalized);
    if (parent === userHome && PROTECTED_FOLDERS.includes(basename)) {
        return true;
    }
    // Also check common paths
    for (const folder of PROTECTED_FOLDERS) {
        const protectedPath = node_path_1.default.join(userHome, folder);
        if (normalized.toLowerCase() === protectedPath.toLowerCase()) {
            return true;
        }
    }
    return false;
}
async function createBoat(input) {
    const folderPath = node_path_1.default.resolve(input.folderPath);
    // Validate folder path
    if (isProtectedFolder(folderPath)) {
        throw new Error(`Cannot create boat directly in "${node_path_1.default.basename(folderPath)}". ` +
            `Please create a subfolder (e.g., "${node_path_1.default.join(folderPath, input.name.trim())}")`);
    }
    await ensureBoatFolderStructure(folderPath);
    const boatDataPath = getBoatDataPath(folderPath);
    if (await pathExists(boatDataPath)) {
        throw new Error('This folder already contains a SailCloud boat.');
    }
    const id = (0, node_crypto_1.randomUUID)();
    const createdAt = nowIso();
    const timezone = input.timezone?.trim() || defaultTimezone();
    const project = {
        version: 1,
        boat: {
            id,
            name: input.name.trim(),
            timezone,
            notes: input.notes?.trim() || undefined,
            photoPath: undefined,
            createdAt,
            updatedAt: createdAt,
        },
        crew: [],
        sails: [],
        masts: [],
        photos: [],
    };
    const validated = domain_1.BoatProjectSchema.parse(project);
    await writeJsonFileAtomic(boatDataPath, validated);
    const index = await readBoatIndex();
    const withoutDup = index.boats.filter((b) => b.id !== id && b.folderPath !== folderPath);
    withoutDup.push({ id, folderPath, addedAt: createdAt });
    index.boats = withoutDup;
    index.lastOpenedBoatId = id;
    await writeBoatIndex(index);
    return { id, name: validated.boat.name, timezone, folderPath, photoPath: undefined };
}
async function addExistingBoatFolder(folderPathRaw) {
    const folderPath = node_path_1.default.resolve(folderPathRaw);
    const boatDataPath = getBoatDataPath(folderPath);
    if (!(await pathExists(boatDataPath))) {
        throw new Error('No SailCloud boat found in the selected folder.');
    }
    const data = await readJsonFile(boatDataPath);
    const project = domain_1.BoatProjectSchema.parse(data);
    const index = await readBoatIndex();
    const addedAt = nowIso();
    const withoutDup = index.boats.filter((b) => b.id !== project.boat.id && b.folderPath !== folderPath);
    withoutDup.push({ id: project.boat.id, folderPath, addedAt });
    index.boats = withoutDup;
    index.lastOpenedBoatId = project.boat.id;
    await writeBoatIndex(index);
    return {
        id: project.boat.id,
        name: project.boat.name,
        timezone: project.boat.timezone,
        folderPath,
        photoPath: project.boat.photoPath,
    };
}
async function removeBoatFromLibrary(boatId) {
    const index = await readBoatIndex();
    index.boats = index.boats.filter((b) => b.id !== boatId);
    if (index.lastOpenedBoatId === boatId)
        delete index.lastOpenedBoatId;
    await writeBoatIndex(index);
}
async function resolveBoatFolder(boatId) {
    const index = await readBoatIndex();
    const entry = index.boats.find((b) => b.id === boatId);
    if (!entry)
        throw new Error('Boat not found in library.');
    return entry.folderPath;
}
async function readProjectByBoatId(boatId) {
    const folderPath = await resolveBoatFolder(boatId);
    const boatDataPath = getBoatDataPath(folderPath);
    const data = await readJsonFile(boatDataPath);
    const project = domain_1.BoatProjectSchema.parse(data);
    return { folderPath, project };
}
async function writeProject(folderPath, project) {
    const validated = domain_1.BoatProjectSchema.parse(project);
    await writeJsonFileAtomic(getBoatDataPath(folderPath), validated);
}
async function getBoatProject(boatId) {
    const { project } = await readProjectByBoatId(boatId);
    return project;
}
async function updateBoat(boatId, patch) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const nextNotes = patch.notes === undefined ? project.boat.notes : patch.notes.trim() ? patch.notes.trim() : undefined;
    const next = {
        ...project.boat,
        name: patch.name?.trim() ? patch.name.trim() : project.boat.name,
        timezone: patch.timezone?.trim() ? patch.timezone.trim() : project.boat.timezone,
        notes: nextNotes,
        updatedAt: nowIso(),
    };
    project.boat = next;
    await writeProject(folderPath, project);
    return next;
}
async function addCrewMember(boatId, input) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const crew = domain_1.CrewMemberSchema.parse({
        id: (0, node_crypto_1.randomUUID)(),
        name: input.name.trim(),
        email: input.email?.trim() || undefined,
        role: input.role?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
    });
    project.crew.push(crew);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return crew;
}
async function removeCrewMember(boatId, crewId) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    project.crew = project.crew.filter((c) => c.id !== crewId);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
}
async function addSail(boatId, input) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const sail = domain_1.SailSchema.parse({
        id: (0, node_crypto_1.randomUUID)(),
        category: input.category,
        typeCode: input.typeCode?.trim() || undefined,
        name: input.name.trim(),
        orderNumber: input.orderNumber?.trim() || undefined,
        draftStripesPct: input.draftStripesPct,
        notes: input.notes?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
    });
    project.sails.push(sail);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return sail;
}
async function removeSail(boatId, sailId) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    project.sails = project.sails.filter((s) => s.id !== sailId);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
}
async function addMastProfile(boatId, input) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const mast = domain_1.MastProfileSchema.parse({
        id: (0, node_crypto_1.randomUUID)(),
        name: input.name.trim(),
        houndsPct: input.houndsPct,
        spreadersPct: input.spreadersPct,
        notes: input.notes?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
    });
    project.masts.push(mast);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return mast;
}
async function removeMastProfile(boatId, mastId) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    project.masts = project.masts.filter((m) => m.id !== mastId);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
}
function normalizeRelPath(relPath) {
    return relPath.split(node_path_1.default.sep).join('/');
}
function resolveRelPath(folderPath, relPath) {
    return node_path_1.default.join(folderPath, relPath.split('/').join(node_path_1.default.sep));
}
async function copyIntoImagesFolder(folderPath, sourcePath) {
    const imagesDir = node_path_1.default.join(folderPath, IMAGES_DIRNAME);
    await promises_1.default.mkdir(imagesDir, { recursive: true });
    const originalBaseName = node_path_1.default.basename(sourcePath);
    const ext = node_path_1.default.extname(originalBaseName);
    const base = node_path_1.default.basename(originalBaseName, ext);
    let candidateName = originalBaseName;
    let candidatePath = node_path_1.default.join(imagesDir, candidateName);
    let i = 1;
    while (await pathExists(candidatePath)) {
        candidateName = `${base} (${i})${ext}`;
        candidatePath = node_path_1.default.join(imagesDir, candidateName);
        i += 1;
    }
    await promises_1.default.copyFile(sourcePath, candidatePath);
    return { fileName: candidateName, absPath: candidatePath, originalFileName: originalBaseName, baseName: base };
}
async function writeBufferIntoImagesFolder(folderPath, buffer, originalBaseName) {
    const imagesDir = node_path_1.default.join(folderPath, IMAGES_DIRNAME);
    await promises_1.default.mkdir(imagesDir, { recursive: true });
    const ext = node_path_1.default.extname(originalBaseName);
    const base = node_path_1.default.basename(originalBaseName, ext);
    let candidateName = originalBaseName;
    let candidatePath = node_path_1.default.join(imagesDir, candidateName);
    let i = 1;
    while (await pathExists(candidatePath)) {
        candidateName = `${base} (${i})${ext}`;
        candidatePath = node_path_1.default.join(imagesDir, candidateName);
        i += 1;
    }
    await promises_1.default.writeFile(candidatePath, buffer);
    return { fileName: candidateName, absPath: candidatePath, originalFileName: originalBaseName, baseName: base };
}
async function importPhotos(boatId, sourcePaths) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const imported = [];
    for (const sourcePath of sourcePaths) {
        const { fileName, absPath, originalFileName, baseName } = await copyIntoImagesFolder(folderPath, sourcePath);
        const relPath = normalizeRelPath(node_path_1.default.relative(folderPath, absPath));
        const photo = domain_1.PhotoSchema.parse({
            id: (0, node_crypto_1.randomUUID)(),
            originalFileName,
            fileName,
            name: baseName,
            relPath,
            importedAt: ts,
            updatedAt: ts,
            timezone: project.boat.timezone,
        });
        project.photos.push(photo);
        imported.push(photo);
    }
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return imported;
}
async function importClipboardImage(boatId) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const img = electron_1.clipboard.readImage();
    if (img.isEmpty())
        return null;
    const png = img.toPNG();
    if (!png.length)
        return null;
    const baseName = `Clipboard_${nowFileStamp()}`;
    const originalBaseName = `${baseName}.png`;
    const { fileName, absPath } = await writeBufferIntoImagesFolder(folderPath, png, originalBaseName);
    const relPath = normalizeRelPath(node_path_1.default.relative(folderPath, absPath));
    const photo = domain_1.PhotoSchema.parse({
        id: (0, node_crypto_1.randomUUID)(),
        originalFileName: originalBaseName,
        fileName,
        name: baseName,
        relPath,
        importedAt: ts,
        updatedAt: ts,
        timezone: project.boat.timezone,
    });
    project.photos.push(photo);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return photo;
}
async function getPhotoAbsolutePath(boatId, photoId) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const photo = project.photos.find((p) => p.id === photoId);
    if (!photo)
        throw new Error('Photo not found.');
    return resolveRelPath(folderPath, photo.relPath);
}
async function updatePhotoAnalysis(boatId, photoId, analysis) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const parsed = domain_1.PhotoAnalysisSchema.parse(analysis);
    const idx = project.photos.findIndex((p) => p.id === photoId);
    if (idx === -1)
        throw new Error('Photo not found.');
    const updated = {
        ...project.photos[idx],
        analysis: parsed,
        updatedAt: ts,
    };
    project.photos[idx] = domain_1.PhotoSchema.parse(updated);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return project.photos[idx];
}
async function updatePhotoMeta(boatId, photoId, patch) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const idx = project.photos.findIndex((p) => p.id === photoId);
    if (idx === -1)
        throw new Error('Photo not found.');
    const nextTags = patch.tags === undefined ? project.photos[idx].tags : patch.tags.map((t) => t.trim()).filter(Boolean);
    const updated = {
        ...project.photos[idx],
        name: patch.name?.trim() ? patch.name.trim() : project.photos[idx].name,
        timezone: patch.timezone?.trim() ? patch.timezone.trim() : project.photos[idx].timezone,
        notes: patch.notes?.trim() ? patch.notes.trim() : undefined,
        tags: nextTags,
        updatedAt: ts,
    };
    project.photos[idx] = domain_1.PhotoSchema.parse(updated);
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
    return project.photos[idx];
}
async function deletePhotos(boatId, photoIds) {
    const { folderPath, project } = await readProjectByBoatId(boatId);
    const ts = nowIso();
    const photoIdSet = new Set(photoIds);
    const photosToDelete = project.photos.filter((p) => photoIdSet.has(p.id));
    // Delete the actual image files
    for (const photo of photosToDelete) {
        try {
            const absPath = resolveRelPath(folderPath, photo.relPath);
            await promises_1.default.unlink(absPath);
        }
        catch {
            // Ignore errors if file doesn't exist
        }
    }
    // Remove photos from project
    project.photos = project.photos.filter((p) => !photoIdSet.has(p.id));
    project.boat.updatedAt = ts;
    await writeProject(folderPath, project);
}
