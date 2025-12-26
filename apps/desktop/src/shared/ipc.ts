import type { Boat, BoatProject, BoatSummary, CrewMember, MastProfile, NormalizedPoint, Photo, PhotoAnalysis, Sail } from './domain'

export type PingResponse = {
  ok: true
  version: string
}

export type SelectDirectoryResponse = {
  folderPath: string | null
}

export type SelectImageResponse = {
  filePath: string | null
}

export type SelectImagesResponse = {
  filePaths: string[]
}

export type CreateBoatInput = {
  folderPath: string
  name: string
  timezone?: string
  notes?: string
  photoSourcePath?: string
}

export type UpdateBoatInput = {
  name?: string
  timezone?: string
  notes?: string
}

export type CreateCrewMemberInput = {
  name: string
  email?: string
  role?: string
}

export type CreateSailInput = {
  category: 'HEADSAIL' | 'MAINSAIL' | 'DOWNWIND' | 'REACHING' | 'OTHER'
  typeCode?: string
  name: string
  orderNumber?: string
  draftStripesPct: number[]
  notes?: string
}

export type CreateMastProfileInput = {
  name: string
  houndsPct?: number
  spreadersPct: number[]
  notes?: string
}

export type UpdatePhotoMetaInput = {
  name?: string
  timezone?: string
  tags?: string[]
  notes?: string
}

// AutoScan types
export type AutoScanInput = {
  imagePath: string
  startPoint: NormalizedPoint
  endPoint: NormalizedPoint
  cannyParams?: {
    threshold1?: number
    threshold2?: number
    apertureSize?: 3 | 5 | 7
    L2gradient?: boolean
  }
}

export type AutoScanOutput = {
  success: boolean
  points: NormalizedPoint[]
  confidence: number
  error?: string
  debugInfo?: {
    edgeMapBase64?: string
    pathCost: number
    rawPointCount: number
    simplifiedPointCount: number
    processingTimeMs: number
  }
}

export type SailcloudApi = {
  ping: () => Promise<PingResponse>

  selectBoatFolder: () => Promise<SelectDirectoryResponse>
  selectImageFile: () => Promise<SelectImageResponse>
  selectImageFiles: () => Promise<SelectImagesResponse>

  listBoats: () => Promise<BoatSummary[]>
  createBoat: (input: CreateBoatInput) => Promise<BoatSummary>
  addExistingBoatFolder: (folderPath: string) => Promise<BoatSummary>
  removeBoatFromLibrary: (boatId: string) => Promise<void>

  getBoatProject: (boatId: string) => Promise<BoatProject>
  updateBoat: (boatId: string, patch: UpdateBoatInput) => Promise<Boat>

  addCrewMember: (boatId: string, input: CreateCrewMemberInput) => Promise<CrewMember>
  removeCrewMember: (boatId: string, crewId: string) => Promise<void>

  addSail: (boatId: string, input: CreateSailInput) => Promise<Sail>
  removeSail: (boatId: string, sailId: string) => Promise<void>

  addMastProfile: (boatId: string, input: CreateMastProfileInput) => Promise<MastProfile>
  removeMastProfile: (boatId: string, mastId: string) => Promise<void>

  importPhotos: (boatId: string, sourcePaths: string[]) => Promise<Photo[]>
  importClipboardImage: (boatId: string) => Promise<Photo | null>
  getPhotoPath: (boatId: string, photoId: string) => Promise<string>
  updatePhotoAnalysis: (boatId: string, photoId: string, analysis: PhotoAnalysis) => Promise<Photo>
  updatePhotoMeta: (boatId: string, photoId: string, patch: UpdatePhotoMetaInput) => Promise<Photo>
  deletePhotos: (boatId: string, photoIds: string[]) => Promise<void>

  // AutoScan CV - runs in renderer process with OpenCV.js WASM
  runAutoScan: (input: AutoScanInput) => Promise<AutoScanOutput>
}
