/**
 * Twist Calculation
 *
 * Calculates twist angle between sail sections at different heights.
 * Twist is the difference in angle between stripes, measured from
 * the reference line (typically the boom or lowest stripe).
 *
 * Based on:
 * - SailTool (CMST) methodology
 * - VSPARS multi-stripe analysis
 * - SailVis temporal analysis
 */

import type { NormalizedPoint } from '../../shared/domain'
import type { TwistResult, CamberResult } from './types'
import { lineAngleDeg, normalizeAngle, tangentAngleDeg } from './geometry'

/**
 * Calculate twist between two sail sections
 *
 * @param lowerStripe - Lower stripe camber result (reference)
 * @param upperStripe - Upper stripe camber result
 * @param lowerHeightPct - Height of lower stripe (% from tack)
 * @param upperHeightPct - Height of upper stripe (% from tack)
 * @param method - Method for twist calculation
 * @returns Twist analysis result
 *
 * @example
 * ```typescript
 * const twist = calculateTwist(
 *   stripeAt25Camber,
 *   stripeAt75Camber,
 *   25,
 *   75,
 *   'EXIT_ANGLE'
 * )
 * console.log(`Twist: ${twist.twistDeg.toFixed(1)}°`)
 * ```
 */
export function calculateTwist(
  lowerStripe: CamberResult,
  upperStripe: CamberResult,
  lowerHeightPct: number,
  upperHeightPct: number,
  method: TwistResult['method'] = 'EXIT_ANGLE'
): TwistResult {
  let referenceAngle: number
  let comparedAngle: number

  switch (method) {
    case 'EXIT_ANGLE':
      // Use exit angles (most common method)
      referenceAngle = lowerStripe.exitAngleDeg
      comparedAngle = upperStripe.exitAngleDeg
      break

    case 'CHORD_ANGLE':
      // Use chord line angles
      referenceAngle = lineAngleDeg(lowerStripe.chordLine.start, lowerStripe.chordLine.end)
      comparedAngle = lineAngleDeg(upperStripe.chordLine.start, upperStripe.chordLine.end)
      break

    case 'MAX_DEPTH_TANGENT':
      // Use tangent at max depth point (requires curve points)
      // This requires the original points, fall back to exit angle
      referenceAngle = lowerStripe.exitAngleDeg
      comparedAngle = upperStripe.exitAngleDeg
      break

    default:
      referenceAngle = lowerStripe.exitAngleDeg
      comparedAngle = upperStripe.exitAngleDeg
  }

  const twistDeg = normalizeAngle(comparedAngle - referenceAngle)

  return {
    referenceHeightPct: lowerHeightPct,
    comparedHeightPct: upperHeightPct,
    twistDeg,
    method,
    referenceAngleDeg: referenceAngle,
    comparedAngleDeg: comparedAngle,
  }
}

/**
 * Calculate twist from curve points directly
 * Uses tangent at specified position for more accurate results
 */
export function calculateTwistFromCurves(
  lowerPoints: NormalizedPoint[],
  upperPoints: NormalizedPoint[],
  lowerHeightPct: number,
  upperHeightPct: number,
  tangentPosition: 'ENTRY' | 'EXIT' | 'MAX_DEPTH' = 'EXIT'
): TwistResult {
  if (lowerPoints.length < 3 || upperPoints.length < 3) {
    return {
      referenceHeightPct: lowerHeightPct,
      comparedHeightPct: upperHeightPct,
      twistDeg: 0,
      method: 'EXIT_ANGLE',
      referenceAngleDeg: 0,
      comparedAngleDeg: 0,
    }
  }

  let lowerIndex: number
  let upperIndex: number

  switch (tangentPosition) {
    case 'ENTRY':
      lowerIndex = 0
      upperIndex = 0
      break
    case 'EXIT':
      lowerIndex = lowerPoints.length - 1
      upperIndex = upperPoints.length - 1
      break
    case 'MAX_DEPTH':
      // Find point with max Y deflection (approximate)
      lowerIndex = findMaxYIndex(lowerPoints)
      upperIndex = findMaxYIndex(upperPoints)
      break
    default:
      lowerIndex = lowerPoints.length - 1
      upperIndex = upperPoints.length - 1
  }

  const referenceAngle = tangentAngleDeg(lowerPoints, lowerIndex, 5)
  const comparedAngle = tangentAngleDeg(upperPoints, upperIndex, 5)
  const twistDeg = normalizeAngle(comparedAngle - referenceAngle)

  return {
    referenceHeightPct: lowerHeightPct,
    comparedHeightPct: upperHeightPct,
    twistDeg,
    method: tangentPosition === 'EXIT' ? 'EXIT_ANGLE' : 'MAX_DEPTH_TANGENT',
    referenceAngleDeg: referenceAngle,
    comparedAngleDeg: comparedAngle,
  }
}

/**
 * Find index of point with maximum Y value
 */
function findMaxYIndex(points: NormalizedPoint[]): number {
  let maxY = -Infinity
  let maxIdx = 0

  for (let i = 0; i < points.length; i++) {
    if (points[i].y > maxY) {
      maxY = points[i].y
      maxIdx = i
    }
  }

  return maxIdx
}

/**
 * Calculate twist using horizontal reference line
 * This is useful when comparing to boom angle or apparent wind
 */
export function calculateTwistFromHorizontal(
  camberResult: CamberResult,
  referenceAngleDeg: number = 0
): number {
  const exitAngle = camberResult.exitAngleDeg
  const chordAngle = lineAngleDeg(camberResult.chordLine.start, camberResult.chordLine.end)

  // Total angle relative to reference
  return normalizeAngle(chordAngle + exitAngle - referenceAngleDeg)
}

/**
 * Calculate total twist across multiple stripes
 * Returns array of twist values from bottom to top
 */
export function calculateMultiStripeTwist(
  camberResults: Array<{ heightPct: number; camber: CamberResult }>,
  method: TwistResult['method'] = 'EXIT_ANGLE'
): {
  twists: TwistResult[]
  totalTwistDeg: number
  avgTwistPerSection: number
} {
  // Sort by height
  const sorted = [...camberResults].sort((a, b) => a.heightPct - b.heightPct)

  if (sorted.length < 2) {
    return {
      twists: [],
      totalTwistDeg: 0,
      avgTwistPerSection: 0,
    }
  }

  const twists: TwistResult[] = []

  // Calculate twist between each adjacent pair
  for (let i = 1; i < sorted.length; i++) {
    const twist = calculateTwist(
      sorted[i - 1].camber,
      sorted[i].camber,
      sorted[i - 1].heightPct,
      sorted[i].heightPct,
      method
    )
    twists.push(twist)
  }

  // Total twist from lowest to highest
  const totalTwist = calculateTwist(
    sorted[0].camber,
    sorted[sorted.length - 1].camber,
    sorted[0].heightPct,
    sorted[sorted.length - 1].heightPct,
    method
  )

  return {
    twists,
    totalTwistDeg: totalTwist.twistDeg,
    avgTwistPerSection: twists.length > 0
      ? twists.reduce((sum, t) => sum + t.twistDeg, 0) / twists.length
      : 0,
  }
}

/**
 * Classify twist based on typical sailing conditions
 */
export function classifyTwist(
  twistDeg: number,
  heightDifferencePct: number
): {
  classification: 'VERY_CLOSED' | 'CLOSED' | 'NEUTRAL' | 'OPEN' | 'VERY_OPEN'
  description: string
  recommendation: string
} {
  // Normalize twist per 50% height difference for comparison
  const normalizedTwist = (twistDeg / heightDifferencePct) * 50

  if (normalizedTwist < -3) {
    return {
      classification: 'VERY_CLOSED',
      description: 'Very closed - top twisted towards wind',
      recommendation: 'Check for over-sheeting or tight backstay',
    }
  }
  if (normalizedTwist < 0) {
    return {
      classification: 'CLOSED',
      description: 'Closed - less twist than typical',
      recommendation: 'Good for pointing in moderate breeze',
    }
  }
  if (normalizedTwist < 5) {
    return {
      classification: 'NEUTRAL',
      description: 'Neutral twist - balanced setup',
      recommendation: 'Good general purpose setting',
    }
  }
  if (normalizedTwist < 10) {
    return {
      classification: 'OPEN',
      description: 'Open twist - top eased',
      recommendation: 'Good for power or light air',
    }
  }
  return {
    classification: 'VERY_OPEN',
    description: 'Very open twist - significant ease at top',
    recommendation: 'Check for loose vang or mainsheet',
  }
}

/**
 * Calculate recommended twist for given conditions
 * Based on empirical sailing data
 */
export function recommendedTwist(
  windSpeedKts: number,
  pointOfSail: 'CLOSE_HAULED' | 'REACHING' | 'RUNNING',
  sailType: 'MAINSAIL' | 'HEADSAIL' | 'SPINNAKER'
): {
  minTwistDeg: number
  maxTwistDeg: number
  optimalTwistDeg: number
  notes: string
} {
  // Base twist values (per 50% height difference)
  let baseTwist = 5

  // Adjust for point of sail
  if (pointOfSail === 'CLOSE_HAULED') {
    baseTwist = 3
  } else if (pointOfSail === 'REACHING') {
    baseTwist = 6
  } else if (pointOfSail === 'RUNNING') {
    baseTwist = 10
  }

  // Adjust for wind speed
  if (windSpeedKts < 8) {
    baseTwist += 2 // More twist in light air
  } else if (windSpeedKts > 18) {
    baseTwist -= 1 // Less twist in heavy air
  }

  // Adjust for sail type
  if (sailType === 'HEADSAIL') {
    baseTwist *= 0.8 // Genoas typically have less twist
  } else if (sailType === 'SPINNAKER') {
    baseTwist *= 1.5 // Spinnakers have more twist
  }

  const range = baseTwist * 0.4

  return {
    minTwistDeg: baseTwist - range,
    maxTwistDeg: baseTwist + range,
    optimalTwistDeg: baseTwist,
    notes: `Estimated for ${windSpeedKts}kts ${pointOfSail.toLowerCase().replace('_', ' ')}`,
  }
}
