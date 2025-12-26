import { z } from 'zod'

const PercentSchema = z.number().gt(0).lt(100)

export const SceneTypeSchema = z.enum([
  'DEPRECATED',
  'GENERIC',
  'ONBOARD_SAIL',
  'CHASE_SAIL_UPWIND',
  'CHASE_SAIL_DOWNWIND',
  'MAST_BEND_FORE_AFT',
  'MAST_BEND_LATERAL',
  'RAKE',
  'HEEL',
  'CHASE_SAIL',
  'MAST_BEND',
  'RAKE_HEEL',
])
export type SceneType = z.infer<typeof SceneTypeSchema>

function uniqueAndSortedPct(
  values: number[],
  ctx: z.RefinementCtx,
  pathLabel: string,
) {
  const unique = new Set(values)
  if (unique.size !== values.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${pathLabel} must not contain duplicates`,
    })
  }

  for (const value of values) {
    if (!Number.isFinite(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${pathLabel} must be finite numbers`,
      })
      break
    }
  }

  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${pathLabel} must be sorted ascending`,
      })
      break
    }
  }
}

export const DraftStripesPctSchema = z
  .array(PercentSchema)
  .min(1)
  .superRefine((values, ctx) => uniqueAndSortedPct(values, ctx, 'draftStripesPct'))

export const SpreadersPctSchema = z
  .array(PercentSchema)
  .superRefine((values, ctx) => uniqueAndSortedPct(values, ctx, 'spreadersPct'))

export const BoatSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  notes: z.string().optional(),
  photoPath: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Boat = z.infer<typeof BoatSchema>

export const CrewMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type CrewMember = z.infer<typeof CrewMemberSchema>

export const SailCategorySchema = z.enum([
  'HEADSAIL',
  'MAINSAIL',
  'DOWNWIND',
  'REACHING',
  'OTHER',
])

export type SailCategory = z.infer<typeof SailCategorySchema>

export const SailSchema = z.object({
  id: z.string().uuid(),
  category: SailCategorySchema,
  typeCode: z.string().optional(),
  name: z.string().min(1),
  orderNumber: z.string().optional(),
  draftStripesPct: DraftStripesPctSchema,
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Sail = z.infer<typeof SailSchema>

export const MastProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  houndsPct: PercentSchema.optional(),
  spreadersPct: SpreadersPctSchema,
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type MastProfile = z.infer<typeof MastProfileSchema>

export const NormalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>

export const AnnotationToolSchema = z.enum(['POINTS', 'POLYLINE'])
export type AnnotationTool = z.infer<typeof AnnotationToolSchema>

export const AutoScanResultSchema = z.object({
  success: z.boolean(),
  confidence: z.number().min(0).max(1),
  algorithm: z.string().optional(),
  timestamp: z.string().datetime().optional(),
})

export type AutoScanResultMeta = z.infer<typeof AutoScanResultSchema>

export const RGBColorSchema = z.object({
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255),
})

export type RGBColor = z.infer<typeof RGBColorSchema>

export const PhotoLayerSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  tool: AnnotationToolSchema,
  points: z.array(NormalizedPointSchema),
  autoScanEnabled: z.boolean().optional(),
  autoScanAnchors: z.array(NormalizedPointSchema).optional(),
  autoScanResult: AutoScanResultSchema.optional(),
  lengthValue: z.number().positive().optional(),
  lengthUnit: z.string().min(1).optional(),
  autoScanColor: RGBColorSchema.optional(),
})

export type PhotoLayer = z.infer<typeof PhotoLayerSchema>

export const PhotoAnalysisSchema = z.object({
  sceneType: SceneTypeSchema,
  sailId: z.string().uuid().optional(),
  mastId: z.string().uuid().optional(),
  layers: z.array(PhotoLayerSchema),
})

export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  originalFileName: z.string().min(1).optional(),
  fileName: z.string().min(1),
  name: z.string().min(1).optional(),
  relPath: z.string().min(1),
  importedAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  takenAt: z.string().datetime().optional(),
  timezone: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  analysis: PhotoAnalysisSchema.optional(),
})

export type Photo = z.infer<typeof PhotoSchema>

export const BoatProjectSchema = z.object({
  version: z.literal(1),
  boat: BoatSchema,
  crew: z.array(CrewMemberSchema),
  sails: z.array(SailSchema),
  masts: z.array(MastProfileSchema),
  photos: z.array(PhotoSchema).default([]),
})

export type BoatProject = z.infer<typeof BoatProjectSchema>

export const BoatIndexSchema = z.object({
  version: z.literal(1),
  boats: z.array(
    z.object({
      id: z.string().uuid(),
      folderPath: z.string().min(1),
      addedAt: z.string().datetime(),
    }),
  ),
  lastOpenedBoatId: z.string().uuid().optional(),
})

export type BoatIndex = z.infer<typeof BoatIndexSchema>

export type BoatSummary = {
  id: string
  name: string
  folderPath: string
  photoPath?: string
  timezone: string
  // Stats for fleet dashboard
  stats?: {
    photoCount: number
    inboxCount: number      // Unclassified photos
    sailCount: number
    mastCount: number
    analyzedCount: number   // Photos with measurements
  }
}

export function parsePercentList(input: string): number[] {
  const parts = input
    .split(/[,\\s]+/g)
    .map((p) => p.trim())
    .filter(Boolean)

  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n))) return []
  return nums
}
