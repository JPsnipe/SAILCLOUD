import { app, clipboard } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  type Boat,
  type BoatIndex,
  type BoatProject,
  type BoatSummary,
  type Photo,
  type PhotoAnalysis,
  BoatIndexSchema,
  BoatProjectSchema,
  CrewMemberSchema,
  MastProfileSchema,
  PhotoAnalysisSchema,
  PhotoSchema,
  SailSchema,
} from '../src/shared/domain'
import type {
  CreateBoatInput,
  CreateCrewMemberInput,
  CreateMastProfileInput,
  CreateSailInput,
  UpdateBoatInput,
} from '../src/shared/ipc'

const BOAT_DATA_DIRNAME = '.sailcloud'
const BOAT_DATA_FILENAME = 'boat.json'
const BOATS_INDEX_FILENAME = 'boats-index.json'
const IMAGES_DIRNAME = 'images'

function nowIso() {
  return new Date().toISOString()
}

function nowFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function getIndexPath() {
  return path.join(app.getPath('userData'), BOATS_INDEX_FILENAME)
}

function getBoatDataPath(folderPath: string) {
  return path.join(folderPath, BOAT_DATA_DIRNAME, BOAT_DATA_FILENAME)
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  try {
    return JSON.parse(raw) as T
  } catch (parseError) {
    // Try to provide more helpful error message
    const err = parseError as Error
    console.error(`[Store] JSON parse error in ${filePath}:`, err.message)

    // Attempt to find the problematic line
    const lines = raw.split('\n')
    const match = err.message.match(/position (\d+)/)
    if (match) {
      const pos = parseInt(match[1], 10)
      let charCount = 0
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1 // +1 for newline
        if (charCount >= pos) {
          console.error(`[Store] Error near line ${i + 1}: "${lines[i].substring(0, 100)}..."`)
          break
        }
      }
    }

    throw new Error(`JSON parse error in boat data: ${err.message}. The file may be corrupted. Try restoring from backup.`)
  }
}

async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath)

  // Ensure directory exists
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (mkdirErr) {
    console.error(`[Store] Failed to create directory ${dir}:`, mkdirErr)
    throw new Error(`Cannot create directory: ${dir}`)
  }

  const tmpPath = `${filePath}.tmp`
  const json = JSON.stringify(data, null, 2)

  try {
    await fs.writeFile(tmpPath, json, 'utf8')
  } catch (writeErr) {
    console.error(`[Store] Failed to write temp file ${tmpPath}:`, writeErr)
    throw new Error(`Cannot write to ${tmpPath}. Check folder permissions.`)
  }

  try {
    await fs.rename(tmpPath, filePath)
  } catch (renameErr) {
    // If rename fails, try direct write as fallback
    console.warn(`[Store] Rename failed, trying direct write:`, renameErr)
    try {
      await fs.writeFile(filePath, json, 'utf8')
      // Clean up temp file
      await fs.unlink(tmpPath).catch(() => {})
    } catch (directWriteErr) {
      console.error(`[Store] Direct write also failed:`, directWriteErr)
      throw new Error(`Cannot save to ${filePath}. The file may be locked or you don't have write permissions.`)
    }
  }
}

async function readBoatIndex(): Promise<BoatIndex> {
  const indexPath = getIndexPath()
  if (!(await pathExists(indexPath))) {
    return { version: 1, boats: [] }
  }

  const data = await readJsonFile<unknown>(indexPath)
  const parsed = BoatIndexSchema.safeParse(data)
  if (!parsed.success) {
    return { version: 1, boats: [] }
  }
  return parsed.data
}

async function writeBoatIndex(index: BoatIndex) {
  await writeJsonFileAtomic(getIndexPath(), index)
}

async function ensureBoatFolderStructure(folderPath: string) {
  await fs.mkdir(folderPath, { recursive: true })
  await fs.mkdir(path.join(folderPath, BOAT_DATA_DIRNAME), { recursive: true })
  await fs.mkdir(path.join(folderPath, IMAGES_DIRNAME), { recursive: true })
  await fs.mkdir(path.join(folderPath, 'logs'), { recursive: true })
  await fs.mkdir(path.join(folderPath, 'reports'), { recursive: true })
  await fs.mkdir(path.join(folderPath, 'crew'), { recursive: true })
}

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export async function listBoats(): Promise<BoatSummary[]> {
  const index = await readBoatIndex()
  const result: BoatSummary[] = []

  for (const entry of index.boats) {
    const boatPath = getBoatDataPath(entry.folderPath)
    if (!(await pathExists(boatPath))) continue

    try {
      const project = await readJsonFile<unknown>(boatPath)
      const parsed = BoatProjectSchema.safeParse(project)
      if (!parsed.success) continue

      const { boat, photos, sails, masts } = parsed.data

      // Calculate statistics for the fleet dashboard
      const photoCount = photos.length
      const inboxCount = photos.filter((p) => !p.analysis || p.analysis.sceneType === 'GENERIC').length
      const sailCount = sails.length
      const mastCount = masts.length
      const analyzedCount = photos.filter((p) => p.analysis && p.analysis.layers.length > 0).length

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
      })
    } catch {
      continue
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

// Folders that should not be used directly as boat folders
const PROTECTED_FOLDERS = ['Documents', 'Desktop', 'Downloads', 'Pictures', 'Music', 'Videos']

function isProtectedFolder(folderPath: string): boolean {
  const normalized = path.normalize(folderPath)
  const basename = path.basename(normalized)

  // Check if it's a direct child of user home
  const userHome = app.getPath('home')
  const parent = path.dirname(normalized)

  if (parent === userHome && PROTECTED_FOLDERS.includes(basename)) {
    return true
  }

  // Also check common paths
  for (const folder of PROTECTED_FOLDERS) {
    const protectedPath = path.join(userHome, folder)
    if (normalized.toLowerCase() === protectedPath.toLowerCase()) {
      return true
    }
  }

  return false
}

export async function createBoat(input: CreateBoatInput): Promise<BoatSummary> {
  const folderPath = path.resolve(input.folderPath)

  // Validate folder path
  if (isProtectedFolder(folderPath)) {
    throw new Error(
      `Cannot create boat directly in "${path.basename(folderPath)}". ` +
      `Please create a subfolder (e.g., "${path.join(folderPath, input.name.trim())}")`
    )
  }

  await ensureBoatFolderStructure(folderPath)

  const boatDataPath = getBoatDataPath(folderPath)
  if (await pathExists(boatDataPath)) {
    throw new Error('This folder already contains a SailCloud boat.')
  }

  const id = randomUUID()
  const createdAt = nowIso()
  const timezone = input.timezone?.trim() || defaultTimezone()

  const project: BoatProject = {
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
  }

  const validated = BoatProjectSchema.parse(project)
  await writeJsonFileAtomic(boatDataPath, validated)

  const index = await readBoatIndex()
  const withoutDup = index.boats.filter((b) => b.id !== id && b.folderPath !== folderPath)
  withoutDup.push({ id, folderPath, addedAt: createdAt })
  index.boats = withoutDup
  index.lastOpenedBoatId = id
  await writeBoatIndex(index)

  return { id, name: validated.boat.name, timezone, folderPath, photoPath: undefined }
}

export async function addExistingBoatFolder(folderPathRaw: string): Promise<BoatSummary> {
  const folderPath = path.resolve(folderPathRaw)
  const boatDataPath = getBoatDataPath(folderPath)
  if (!(await pathExists(boatDataPath))) {
    throw new Error('No SailCloud boat found in the selected folder.')
  }

  const data = await readJsonFile<unknown>(boatDataPath)
  const project = BoatProjectSchema.parse(data)

  const index = await readBoatIndex()
  const addedAt = nowIso()
  const withoutDup = index.boats.filter((b) => b.id !== project.boat.id && b.folderPath !== folderPath)
  withoutDup.push({ id: project.boat.id, folderPath, addedAt })
  index.boats = withoutDup
  index.lastOpenedBoatId = project.boat.id
  await writeBoatIndex(index)

  return {
    id: project.boat.id,
    name: project.boat.name,
    timezone: project.boat.timezone,
    folderPath,
    photoPath: project.boat.photoPath,
  }
}

export async function removeBoatFromLibrary(boatId: string): Promise<void> {
  const index = await readBoatIndex()
  index.boats = index.boats.filter((b) => b.id !== boatId)
  if (index.lastOpenedBoatId === boatId) delete index.lastOpenedBoatId
  await writeBoatIndex(index)
}

async function resolveBoatFolder(boatId: string): Promise<string> {
  const index = await readBoatIndex()
  const entry = index.boats.find((b) => b.id === boatId)
  if (!entry) throw new Error('Boat not found in library.')
  return entry.folderPath
}

async function readProjectByBoatId(boatId: string): Promise<{ folderPath: string; project: BoatProject }> {
  const folderPath = await resolveBoatFolder(boatId)
  const boatDataPath = getBoatDataPath(folderPath)
  const data = await readJsonFile<unknown>(boatDataPath)
  const project = BoatProjectSchema.parse(data)
  return { folderPath, project }
}

async function writeProject(folderPath: string, project: BoatProject) {
  const validated = BoatProjectSchema.parse(project)
  await writeJsonFileAtomic(getBoatDataPath(folderPath), validated)
}

export async function getBoatProject(boatId: string): Promise<BoatProject> {
  const { project } = await readProjectByBoatId(boatId)
  return project
}

export async function updateBoat(boatId: string, patch: UpdateBoatInput): Promise<Boat> {
  const { folderPath, project } = await readProjectByBoatId(boatId)

  const nextNotes =
    patch.notes === undefined ? project.boat.notes : patch.notes.trim() ? patch.notes.trim() : undefined

  const next: Boat = {
    ...project.boat,
    name: patch.name?.trim() ? patch.name.trim() : project.boat.name,
    timezone: patch.timezone?.trim() ? patch.timezone.trim() : project.boat.timezone,
    notes: nextNotes,
    updatedAt: nowIso(),
  }

  project.boat = next
  await writeProject(folderPath, project)
  return next
}

export async function addCrewMember(boatId: string, input: CreateCrewMemberInput) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const crew = CrewMemberSchema.parse({
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    role: input.role?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  })

  project.crew.push(crew)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return crew
}

export async function removeCrewMember(boatId: string, crewId: string) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()
  project.crew = project.crew.filter((c) => c.id !== crewId)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
}

export async function addSail(boatId: string, input: CreateSailInput) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const sail = SailSchema.parse({
    id: randomUUID(),
    category: input.category,
    typeCode: input.typeCode?.trim() || undefined,
    name: input.name.trim(),
    orderNumber: input.orderNumber?.trim() || undefined,
    draftStripesPct: input.draftStripesPct,
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  })

  project.sails.push(sail)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return sail
}

export async function removeSail(boatId: string, sailId: string) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()
  project.sails = project.sails.filter((s) => s.id !== sailId)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
}

export async function addMastProfile(boatId: string, input: CreateMastProfileInput) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const mast = MastProfileSchema.parse({
    id: randomUUID(),
    name: input.name.trim(),
    houndsPct: input.houndsPct,
    spreadersPct: input.spreadersPct,
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  })

  project.masts.push(mast)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return mast
}

export async function removeMastProfile(boatId: string, mastId: string) {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()
  project.masts = project.masts.filter((m) => m.id !== mastId)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
}

function normalizeRelPath(relPath: string) {
  return relPath.split(path.sep).join('/')
}

function resolveRelPath(folderPath: string, relPath: string) {
  return path.join(folderPath, relPath.split('/').join(path.sep))
}

async function copyIntoImagesFolder(folderPath: string, sourcePath: string) {
  const imagesDir = path.join(folderPath, IMAGES_DIRNAME)
  await fs.mkdir(imagesDir, { recursive: true })

  const originalBaseName = path.basename(sourcePath)
  const ext = path.extname(originalBaseName)
  const base = path.basename(originalBaseName, ext)

  let candidateName = originalBaseName
  let candidatePath = path.join(imagesDir, candidateName)
  let i = 1
  while (await pathExists(candidatePath)) {
    candidateName = `${base} (${i})${ext}`
    candidatePath = path.join(imagesDir, candidateName)
    i += 1
  }

  await fs.copyFile(sourcePath, candidatePath)
  return { fileName: candidateName, absPath: candidatePath, originalFileName: originalBaseName, baseName: base }
}

async function writeBufferIntoImagesFolder(folderPath: string, buffer: Buffer, originalBaseName: string) {
  const imagesDir = path.join(folderPath, IMAGES_DIRNAME)
  await fs.mkdir(imagesDir, { recursive: true })

  const ext = path.extname(originalBaseName)
  const base = path.basename(originalBaseName, ext)

  let candidateName = originalBaseName
  let candidatePath = path.join(imagesDir, candidateName)
  let i = 1
  while (await pathExists(candidatePath)) {
    candidateName = `${base} (${i})${ext}`
    candidatePath = path.join(imagesDir, candidateName)
    i += 1
  }

  await fs.writeFile(candidatePath, buffer)
  return { fileName: candidateName, absPath: candidatePath, originalFileName: originalBaseName, baseName: base }
}

export async function importPhotos(boatId: string, sourcePaths: string[]): Promise<Photo[]> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const imported: Photo[] = []
  for (const sourcePath of sourcePaths) {
    const { fileName, absPath, originalFileName, baseName } = await copyIntoImagesFolder(folderPath, sourcePath)
    const relPath = normalizeRelPath(path.relative(folderPath, absPath))

    const photo = PhotoSchema.parse({
      id: randomUUID(),
      originalFileName,
      fileName,
      name: baseName,
      relPath,
      importedAt: ts,
      updatedAt: ts,
      timezone: project.boat.timezone,
    })

    project.photos.push(photo)
    imported.push(photo)
  }

  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return imported
}

export async function importClipboardImage(boatId: string): Promise<Photo | null> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const img = clipboard.readImage()
  if (img.isEmpty()) return null

  const png = img.toPNG()
  if (!png.length) return null

  const baseName = `Clipboard_${nowFileStamp()}`
  const originalBaseName = `${baseName}.png`
  const { fileName, absPath } = await writeBufferIntoImagesFolder(folderPath, png, originalBaseName)
  const relPath = normalizeRelPath(path.relative(folderPath, absPath))

  const photo = PhotoSchema.parse({
    id: randomUUID(),
    originalFileName: originalBaseName,
    fileName,
    name: baseName,
    relPath,
    importedAt: ts,
    updatedAt: ts,
    timezone: project.boat.timezone,
  })

  project.photos.push(photo)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return photo
}

export async function getPhotoAbsolutePath(boatId: string, photoId: string): Promise<string> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const photo = project.photos.find((p) => p.id === photoId)
  if (!photo) throw new Error('Photo not found.')
  return resolveRelPath(folderPath, photo.relPath)
}

export async function updatePhotoAnalysis(
  boatId: string,
  photoId: string,
  analysis: PhotoAnalysis,
): Promise<Photo> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const parsed = PhotoAnalysisSchema.parse(analysis)
  const idx = project.photos.findIndex((p) => p.id === photoId)
  if (idx === -1) throw new Error('Photo not found.')

  const updated: Photo = {
    ...project.photos[idx],
    analysis: parsed,
    updatedAt: ts,
  }

  project.photos[idx] = PhotoSchema.parse(updated)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return project.photos[idx]
}

export async function updatePhotoMeta(
  boatId: string,
  photoId: string,
  patch: { name?: string; timezone?: string; tags?: string[]; notes?: string },
): Promise<Photo> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const idx = project.photos.findIndex((p) => p.id === photoId)
  if (idx === -1) throw new Error('Photo not found.')

  const nextTags =
    patch.tags === undefined ? project.photos[idx].tags : patch.tags.map((t) => t.trim()).filter(Boolean)

  const updated: Photo = {
    ...project.photos[idx],
    name: patch.name?.trim() ? patch.name.trim() : project.photos[idx].name,
    timezone: patch.timezone?.trim() ? patch.timezone.trim() : project.photos[idx].timezone,
    notes: patch.notes?.trim() ? patch.notes.trim() : undefined,
    tags: nextTags,
    updatedAt: ts,
  }

  project.photos[idx] = PhotoSchema.parse(updated)
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
  return project.photos[idx]
}

export async function deletePhotos(boatId: string, photoIds: string[]): Promise<void> {
  const { folderPath, project } = await readProjectByBoatId(boatId)
  const ts = nowIso()

  const photoIdSet = new Set(photoIds)
  const photosToDelete = project.photos.filter((p) => photoIdSet.has(p.id))

  // Delete the actual image files
  for (const photo of photosToDelete) {
    try {
      const absPath = resolveRelPath(folderPath, photo.relPath)
      await fs.unlink(absPath)
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  // Remove photos from project
  project.photos = project.photos.filter((p) => !photoIdSet.has(p.id))
  project.boat.updatedAt = ts
  await writeProject(folderPath, project)
}
