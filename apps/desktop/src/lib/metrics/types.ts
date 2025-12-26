/**
 * Sail Metrics Types
 *
 * Based on industry standards and academic research:
 * - SailTool (CMST - Australian Yachting Federation)
 * - SailVis (Eurographics 2021)
 * - Deparday et al. photogrammetry research
 */

import type { NormalizedPoint } from '../../shared/domain'

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType =
  // Sail section metrics (per stripe)
  | 'CAMBER_PCT'           // Max depth as % of chord
  | 'DRAFT_POSITION_PCT'   // Position of max depth (% from luff)
  | 'CHORD_LENGTH'         // Length of the chord (with reference)
  | 'ENTRY_ANGLE_DEG'      // Angle at luff entry
  | 'EXIT_ANGLE_DEG'       // Angle at leech exit
  | 'FRONT_PCT'            // % of curve in front half
  | 'BACK_PCT'             // % of curve in back half

  // Multi-stripe metrics
  | 'TWIST_DEG'            // Angle difference between stripes

  // Mast metrics
  | 'MAST_BEND_MM'         // Mast deflection
  | 'MAST_BEND_PCT'        // Mast deflection as % of height

  // Boat metrics
  | 'HEEL_DEG'             // Heel angle
  | 'RAKE_DEG'             // Mast rake angle

  // Curves (full shape)
  | 'LUFF_CURVE'           // Luff profile
  | 'LEECH_CURVE'          // Leech profile
  | 'FORESTAY_SAG'         // Forestay sag

// ============================================================================
// Measurement Result
// ============================================================================

export interface Measurement {
  id: string
  photoId: string
  layerId: string
  metric: MetricType
  heightPct: number              // Height on sail (0-100), or position for mast
  value: number                  // Calculated value
  unit: string                   // %, °, mm, m
  confidence?: number            // 0-1 if from AutoScan
  payload?: Record<string, unknown>  // Additional data
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Camber Analysis (most important metric)
// ============================================================================

export interface CamberResult {
  /** Maximum depth as percentage of chord length */
  camberPct: number

  /** Position of maximum depth (0-100% from luff) */
  draftPositionPct: number

  /** Chord length in pixels (or real units if reference available) */
  chordLength: number

  /** The point of maximum deflection (normalized) */
  maxDeflectionPoint: NormalizedPoint

  /** Entry angle at luff in degrees */
  entryAngleDeg: number

  /** Exit angle at leech in degrees */
  exitAngleDeg: number

  /** Percentage of total camber area in front half */
  frontPct: number

  /** Percentage of total camber area in back half */
  backPct: number

  /** Debug: chord line endpoints */
  chordLine: {
    start: NormalizedPoint  // Luff point
    end: NormalizedPoint    // Leech point
  }

  /** Debug: deflection values along the chord */
  deflectionProfile?: Array<{
    t: number           // 0-1 along chord
    deflection: number  // Perpendicular distance
  }>
}

// ============================================================================
// Twist Analysis
// ============================================================================

export interface TwistResult {
  /** Reference stripe height (lower) */
  referenceHeightPct: number

  /** Compared stripe height (upper) */
  comparedHeightPct: number

  /** Twist angle in degrees (positive = more open at top) */
  twistDeg: number

  /** Method used for calculation */
  method: 'EXIT_ANGLE' | 'CHORD_ANGLE' | 'MAX_DEPTH_TANGENT'

  /** Individual angles */
  referenceAngleDeg: number
  comparedAngleDeg: number
}

// ============================================================================
// Mast Bend Analysis
// ============================================================================

export interface MastBendResult {
  /** Bend profile: height vs deflection */
  profile: Array<{
    heightPct: number     // 0-100% from deck
    deflectionPx: number  // In pixels
    deflectionMm?: number // If reference available
  }>

  /** Maximum bend point */
  maxBend: {
    heightPct: number
    deflection: number
    unit: 'px' | 'mm'
  }

  /** Pre-bend (at rest) vs dynamic bend estimation */
  bendType: 'STATIC' | 'DYNAMIC'
}

// ============================================================================
// Angle Measurements (Heel, Rake)
// ============================================================================

export interface AngleResult {
  angleDeg: number
  referenceType: 'HORIZON' | 'VERTICAL' | 'HULL_LINE'
  confidence: number
}

// ============================================================================
// Complete Analysis Result
// ============================================================================

export interface SailAnalysisResult {
  photoId: string
  sceneType: string
  timestamp: string

  /** Per-stripe analysis */
  stripes: Array<{
    layerId: string
    heightPct: number
    camber: CamberResult
  }>

  /** Twist between stripes */
  twists: TwistResult[]

  /** Overall sail metrics */
  summary: {
    avgCamberPct: number
    avgDraftPositionPct: number
    totalTwistDeg: number      // From lowest to highest stripe
    flatnessIndex: number      // 0-1, how flat the sail is
  }
}

// ============================================================================
// Scale Reference
// ============================================================================

export interface ScaleReference {
  /** Two points defining known distance */
  points: [NormalizedPoint, NormalizedPoint]

  /** Real-world value */
  realValue: number

  /** Unit of measurement */
  unit: 'mm' | 'm' | 'ft' | 'in'

  /** Calculated scale factor: pixels per unit */
  pxPerUnit?: number
}

// ============================================================================
// Calculation Options
// ============================================================================

export interface CalculationOptions {
  /** Include debug/visualization data */
  includeDebugData?: boolean

  /** Scale reference for absolute measurements */
  scaleReference?: ScaleReference

  /** Smooth curves before analysis */
  smoothing?: boolean

  /** Number of samples for deflection profile */
  profileSamples?: number
}

export const DEFAULT_CALCULATION_OPTIONS: Required<CalculationOptions> = {
  includeDebugData: false,
  scaleReference: undefined as unknown as ScaleReference,
  smoothing: true,
  profileSamples: 50,
}
