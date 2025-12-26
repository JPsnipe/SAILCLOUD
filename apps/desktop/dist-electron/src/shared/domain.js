"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoatIndexSchema = exports.BoatProjectSchema = exports.PhotoSchema = exports.PhotoAnalysisSchema = exports.PhotoLayerSchema = exports.RGBColorSchema = exports.AutoScanResultSchema = exports.AnnotationToolSchema = exports.NormalizedPointSchema = exports.MastProfileSchema = exports.SailSchema = exports.SailCategorySchema = exports.CrewMemberSchema = exports.BoatSchema = exports.SpreadersPctSchema = exports.DraftStripesPctSchema = exports.SceneTypeSchema = void 0;
exports.parsePercentList = parsePercentList;
const zod_1 = require("zod");
const PercentSchema = zod_1.z.number().gt(0).lt(100);
exports.SceneTypeSchema = zod_1.z.enum([
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
]);
function uniqueAndSortedPct(values, ctx, pathLabel) {
    const unique = new Set(values);
    if (unique.size !== values.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `${pathLabel} must not contain duplicates`,
        });
    }
    for (const value of values) {
        if (!Number.isFinite(value)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `${pathLabel} must be finite numbers`,
            });
            break;
        }
    }
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] < values[i - 1]) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `${pathLabel} must be sorted ascending`,
            });
            break;
        }
    }
}
exports.DraftStripesPctSchema = zod_1.z
    .array(PercentSchema)
    .min(1)
    .superRefine((values, ctx) => uniqueAndSortedPct(values, ctx, 'draftStripesPct'));
exports.SpreadersPctSchema = zod_1.z
    .array(PercentSchema)
    .superRefine((values, ctx) => uniqueAndSortedPct(values, ctx, 'spreadersPct'));
exports.BoatSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    timezone: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional(),
    photoPath: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CrewMemberSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional(),
    role: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.SailCategorySchema = zod_1.z.enum([
    'HEADSAIL',
    'MAINSAIL',
    'DOWNWIND',
    'REACHING',
    'OTHER',
]);
exports.SailSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    category: exports.SailCategorySchema,
    typeCode: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    orderNumber: zod_1.z.string().optional(),
    draftStripesPct: exports.DraftStripesPctSchema,
    notes: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.MastProfileSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    houndsPct: PercentSchema.optional(),
    spreadersPct: exports.SpreadersPctSchema,
    notes: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.NormalizedPointSchema = zod_1.z.object({
    x: zod_1.z.number().min(0).max(1),
    y: zod_1.z.number().min(0).max(1),
});
exports.AnnotationToolSchema = zod_1.z.enum(['POINTS', 'POLYLINE']);
exports.AutoScanResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    confidence: zod_1.z.number().min(0).max(1),
    algorithm: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().datetime().optional(),
});
exports.RGBColorSchema = zod_1.z.object({
    r: zod_1.z.number().min(0).max(255),
    g: zod_1.z.number().min(0).max(255),
    b: zod_1.z.number().min(0).max(255),
});
exports.PhotoLayerSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    label: zod_1.z.string().min(1),
    tool: exports.AnnotationToolSchema,
    points: zod_1.z.array(exports.NormalizedPointSchema),
    autoScanEnabled: zod_1.z.boolean().optional(),
    autoScanAnchors: zod_1.z.array(exports.NormalizedPointSchema).optional(),
    autoScanResult: exports.AutoScanResultSchema.optional(),
    lengthValue: zod_1.z.number().positive().optional(),
    lengthUnit: zod_1.z.string().min(1).optional(),
    autoScanColor: exports.RGBColorSchema.optional(),
});
exports.PhotoAnalysisSchema = zod_1.z.object({
    sceneType: exports.SceneTypeSchema,
    sailId: zod_1.z.string().uuid().optional(),
    mastId: zod_1.z.string().uuid().optional(),
    layers: zod_1.z.array(exports.PhotoLayerSchema),
});
exports.PhotoSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    originalFileName: zod_1.z.string().min(1).optional(),
    fileName: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).optional(),
    relPath: zod_1.z.string().min(1),
    importedAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime().optional(),
    takenAt: zod_1.z.string().datetime().optional(),
    timezone: zod_1.z.string().min(1).optional(),
    tags: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    notes: zod_1.z.string().optional(),
    analysis: exports.PhotoAnalysisSchema.optional(),
});
exports.BoatProjectSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    boat: exports.BoatSchema,
    crew: zod_1.z.array(exports.CrewMemberSchema),
    sails: zod_1.z.array(exports.SailSchema),
    masts: zod_1.z.array(exports.MastProfileSchema),
    photos: zod_1.z.array(exports.PhotoSchema).default([]),
});
exports.BoatIndexSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    boats: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        folderPath: zod_1.z.string().min(1),
        addedAt: zod_1.z.string().datetime(),
    })),
    lastOpenedBoatId: zod_1.z.string().uuid().optional(),
});
function parsePercentList(input) {
    const parts = input
        .split(/[,\\s]+/g)
        .map((p) => p.trim())
        .filter(Boolean);
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n)))
        return [];
    return nums;
}
