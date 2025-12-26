/**
 * Camber (Depth) Calculation
 *
 * Calculates sail section depth using the chord-deflection method.
 * This is the primary metric for sail shape analysis.
 *
 * Based on:
 * - SailTool (CMST) methodology
 * - Industry standard definitions
 */

import type { NormalizedPoint } from '../../shared/domain'
import type { CamberResult, CalculationOptions } from './types'
import { DEFAULT_CALCULATION_OPTIONS } from './types'
import {
  distance,
  lineAngleDeg,
  entryAngleDeg,
  exitAngleDeg,
  findMaxDeflection,
  calculateDeflectionProfile,
  calculateFrontBackDistribution,
  smoothCurve,
} from './geometry'

/**
 * Calculate camber (depth) metrics for a sail section
 *
 * @param curvePoints - Points defining the sail section (draft stripe)
 * @param chordStart - Luff point (start of chord)
 * @param chordEnd - Leech point (end of chord)
 * @param options - Calculation options
 * @returns Camber analysis result
 *
 * @example
 * ```typescript
 * const result = calculateCamber(
 *   stripePoints,
 *   { x: 0.1, y: 0.3 },  // Luff
 *   { x: 0.8, y: 0.35 }, // Leech
 * )
 *
 * console.log(`Camber: ${result.camberPct.toFixed(1)}%`)
 * console.log(`Draft position: ${result.draftPositionPct.toFixed(0)}%`)
 * ```
 */
export function calculateCamber(
  curvePoints: NormalizedPoint[],
  chordStart: NormalizedPoint,
  chordEnd: NormalizedPoint,
  options: Partial<CalculationOptions> = {}
): CamberResult {
  const opts = { ...DEFAULT_CALCULATION_OPTIONS, ...options }

  // Validate input
  if (curvePoints.length < 3) {
    return createEmptyResult(chordStart, chordEnd)
  }

  // Optionally smooth the curve
  const points = opts.smoothing ? smoothCurve(curvePoints, 5) : curvePoints

  // Calculate chord properties
  const chordLength = distance(chordStart, chordEnd)
  const chordAngle = lineAngleDeg(chordStart, chordEnd)

  if (chordLength === 0) {
    return createEmptyResult(chordStart, chordEnd)
  }

  // Find maximum deflection (camber point)
  const maxDeflection = findMaxDeflection(points, chordStart, chordEnd)

  // Calculate camber percentage
  const camberPct = (maxDeflection.deflection / chordLength) * 100

  // Draft position: percentage from luff (0%) to leech (100%)
  const draftPositionPct = maxDeflection.t * 100

  // Calculate entry and exit angles
  const entryAngle = entryAngleDeg(points, chordAngle, 5)
  const exitAngle = exitAngleDeg(points, chordAngle, 5)

  // Calculate deflection profile for front/back analysis
  const profile = calculateDeflectionProfile(
    points,
    chordStart,
    chordEnd,
    opts.profileSamples
  )

  // Calculate front/back distribution
  const { frontPct, backPct } = calculateFrontBackDistribution(
    profile,
    maxDeflection.t
  )

  return {
    camberPct,
    draftPositionPct,
    chordLength,
    maxDeflectionPoint: maxDeflection.point,
    entryAngleDeg: entryAngle,
    exitAngleDeg: exitAngle,
    frontPct,
    backPct,
    chordLine: {
      start: chordStart,
      end: chordEnd,
    },
    deflectionProfile: opts.includeDebugData ? profile : undefined,
  }
}

/**
 * Create an empty result for invalid inputs
 */
function createEmptyResult(
  chordStart: NormalizedPoint,
  chordEnd: NormalizedPoint
): CamberResult {
  return {
    camberPct: 0,
    draftPositionPct: 50,
    chordLength: distance(chordStart, chordEnd),
    maxDeflectionPoint: {
      x: (chordStart.x + chordEnd.x) / 2,
      y: (chordStart.y + chordEnd.y) / 2,
    },
    entryAngleDeg: 0,
    exitAngleDeg: 0,
    frontPct: 50,
    backPct: 50,
    chordLine: { start: chordStart, end: chordEnd },
  }
}

/**
 * Classify camber based on typical sail values
 */
export function classifyCamber(camberPct: number): {
  classification: 'VERY_FLAT' | 'FLAT' | 'MEDIUM' | 'DEEP' | 'VERY_DEEP'
  description: string
} {
  if (camberPct < 6) {
    return { classification: 'VERY_FLAT', description: 'Very flat - light air or heavy weather' }
  }
  if (camberPct < 10) {
    return { classification: 'FLAT', description: 'Flat - upwind in medium-heavy breeze' }
  }
  if (camberPct < 14) {
    return { classification: 'MEDIUM', description: 'Medium - general purpose' }
  }
  if (camberPct < 18) {
    return { classification: 'DEEP', description: 'Deep - light air or reaching' }
  }
  return { classification: 'VERY_DEEP', description: 'Very deep - downwind or spinnaker' }
}

/**
 * Classify draft position based on typical sail values
 */
export function classifyDraftPosition(draftPositionPct: number): {
  classification: 'VERY_FORWARD' | 'FORWARD' | 'MIDDLE' | 'AFT' | 'VERY_AFT'
  description: string
} {
  if (draftPositionPct < 35) {
    return { classification: 'VERY_FORWARD', description: 'Very forward - may cause stall' }
  }
  if (draftPositionPct < 42) {
    return { classification: 'FORWARD', description: 'Forward - good for pointing' }
  }
  if (draftPositionPct < 52) {
    return { classification: 'MIDDLE', description: 'Middle - balanced' }
  }
  if (draftPositionPct < 60) {
    return { classification: 'AFT', description: 'Aft - power mode' }
  }
  return { classification: 'VERY_AFT', description: 'Very aft - may need adjustment' }
}

/**
 * Compare two camber results and calculate differences
 */
export function compareCamber(
  a: CamberResult,
  b: CamberResult
): {
  camberDiff: number
  draftPositionDiff: number
  entryAngleDiff: number
  exitAngleDiff: number
} {
  return {
    camberDiff: b.camberPct - a.camberPct,
    draftPositionDiff: b.draftPositionPct - a.draftPositionPct,
    entryAngleDiff: b.entryAngleDeg - a.entryAngleDeg,
    exitAngleDiff: b.exitAngleDeg - a.exitAngleDeg,
  }
}
