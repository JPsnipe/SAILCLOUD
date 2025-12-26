/**
 * Geometry utilities for sail metrics calculations
 *
 * Based on mathematical models from:
 * - SailTool (CMST)
 * - Deparday et al. photogrammetry research
 */

import type { NormalizedPoint } from '../../shared/domain'

// ============================================================================
// Basic Geometry
// ============================================================================

/**
 * Calculate Euclidean distance between two points
 */
export function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate angle of a line segment in degrees
 * 0° = horizontal right, 90° = up
 */
export function lineAngleDeg(start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  return Math.atan2(-dy, dx) * (180 / Math.PI) // Negative dy because Y is inverted in images
}

/**
 * Calculate perpendicular distance from point to line
 * Returns signed distance (positive = above line, negative = below)
 */
export function perpendicularDistance(
  point: NormalizedPoint,
  lineStart: NormalizedPoint,
  lineEnd: NormalizedPoint
): { distance: number; t: number; closestPoint: NormalizedPoint } {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lineLengthSq = dx * dx + dy * dy

  if (lineLengthSq === 0) {
    return {
      distance: distance(point, lineStart),
      t: 0,
      closestPoint: lineStart,
    }
  }

  // Parameter t: 0 = at start, 1 = at end
  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq
  ))

  const closestPoint: NormalizedPoint = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  }

  // Signed distance (using cross product)
  const crossProduct = (point.x - lineStart.x) * dy - (point.y - lineStart.y) * dx
  const signedDistance = crossProduct / Math.sqrt(lineLengthSq)

  return {
    distance: signedDistance,
    t,
    closestPoint,
  }
}

/**
 * Calculate tangent angle at a point on a curve
 * Uses neighboring points to estimate tangent
 */
export function tangentAngleDeg(
  points: NormalizedPoint[],
  index: number,
  windowSize: number = 3
): number {
  const halfWindow = Math.floor(windowSize / 2)
  const startIdx = Math.max(0, index - halfWindow)
  const endIdx = Math.min(points.length - 1, index + halfWindow)

  if (startIdx === endIdx) return 0

  const start = points[startIdx]
  const end = points[endIdx]

  return lineAngleDeg(start, end)
}

/**
 * Calculate entry angle (tangent at luff/start of curve)
 */
export function entryAngleDeg(
  curvePoints: NormalizedPoint[],
  chordAngleDeg: number,
  sampleSize: number = 5
): number {
  if (curvePoints.length < 2) return 0

  const tangent = tangentAngleDeg(curvePoints, 0, sampleSize)
  return normalizeAngle(tangent - chordAngleDeg)
}

/**
 * Calculate exit angle (tangent at leech/end of curve)
 */
export function exitAngleDeg(
  curvePoints: NormalizedPoint[],
  chordAngleDeg: number,
  sampleSize: number = 5
): number {
  if (curvePoints.length < 2) return 0

  const tangent = tangentAngleDeg(curvePoints, curvePoints.length - 1, sampleSize)
  return normalizeAngle(tangent - chordAngleDeg)
}

/**
 * Normalize angle to -180 to 180 range
 */
export function normalizeAngle(angleDeg: number): number {
  while (angleDeg > 180) angleDeg -= 360
  while (angleDeg < -180) angleDeg += 360
  return angleDeg
}

// ============================================================================
// Curve Analysis
// ============================================================================

/**
 * Find the point of maximum deflection from chord
 */
export function findMaxDeflection(
  curvePoints: NormalizedPoint[],
  chordStart: NormalizedPoint,
  chordEnd: NormalizedPoint
): { point: NormalizedPoint; index: number; deflection: number; t: number } {
  let maxDeflection = 0
  let maxIndex = 0
  let maxT = 0
  let maxPoint = curvePoints[0]

  for (let i = 0; i < curvePoints.length; i++) {
    const { distance: d, t } = perpendicularDistance(curvePoints[i], chordStart, chordEnd)
    const absD = Math.abs(d)

    if (absD > maxDeflection) {
      maxDeflection = absD
      maxIndex = i
      maxT = t
      maxPoint = curvePoints[i]
    }
  }

  return {
    point: maxPoint,
    index: maxIndex,
    deflection: maxDeflection,
    t: maxT,
  }
}

/**
 * Calculate deflection profile along the chord
 * Returns array of {t, deflection} where t is 0-1 along chord
 */
export function calculateDeflectionProfile(
  curvePoints: NormalizedPoint[],
  chordStart: NormalizedPoint,
  chordEnd: NormalizedPoint,
  numSamples: number = 50
): Array<{ t: number; deflection: number }> {
  const profile: Array<{ t: number; deflection: number }> = []

  // For each sample point along the chord, find nearest curve point
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1)

    // Interpolate point on chord
    const chordPoint: NormalizedPoint = {
      x: chordStart.x + t * (chordEnd.x - chordStart.x),
      y: chordStart.y + t * (chordEnd.y - chordStart.y),
    }

    // Find nearest curve point
    let minDist = Infinity
    let nearestDeflection = 0

    for (const curvePoint of curvePoints) {
      const dist = distance(curvePoint, chordPoint)
      if (dist < minDist) {
        minDist = dist

        // Calculate perpendicular deflection
        const { distance: defl } = perpendicularDistance(curvePoint, chordStart, chordEnd)
        nearestDeflection = Math.abs(defl)
      }
    }

    profile.push({ t, deflection: nearestDeflection })
  }

  return profile
}

/**
 * Calculate front/back distribution of camber
 * Based on SailTool methodology
 */
export function calculateFrontBackDistribution(
  profile: Array<{ t: number; deflection: number }>,
  draftPositionT: number
): { frontPct: number; backPct: number } {
  let frontArea = 0
  let backArea = 0
  let totalArea = 0

  for (let i = 1; i < profile.length; i++) {
    const t1 = profile[i - 1].t
    const t2 = profile[i].t
    const d1 = profile[i - 1].deflection
    const d2 = profile[i].deflection

    // Trapezoidal area
    const width = t2 - t1
    const avgHeight = (d1 + d2) / 2
    const area = width * avgHeight

    totalArea += area

    // Midpoint of this segment
    const midT = (t1 + t2) / 2

    if (midT < draftPositionT) {
      frontArea += area
    } else {
      backArea += area
    }
  }

  if (totalArea === 0) {
    return { frontPct: 50, backPct: 50 }
  }

  return {
    frontPct: (frontArea / totalArea) * 100,
    backPct: (backArea / totalArea) * 100,
  }
}

// ============================================================================
// Curve Processing
// ============================================================================

/**
 * Smooth a curve using moving average
 */
export function smoothCurve(
  points: NormalizedPoint[],
  windowSize: number = 5
): NormalizedPoint[] {
  if (points.length <= windowSize) return [...points]

  const result: NormalizedPoint[] = []
  const halfWindow = Math.floor(windowSize / 2)

  for (let i = 0; i < points.length; i++) {
    let sumX = 0
    let sumY = 0
    let count = 0

    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumX += points[j].x
      sumY += points[j].y
      count++
    }

    result.push({
      x: sumX / count,
      y: sumY / count,
    })
  }

  // Preserve exact endpoints
  result[0] = points[0]
  result[result.length - 1] = points[points.length - 1]

  return result
}

/**
 * Resample curve to have evenly spaced points
 */
export function resampleCurve(
  points: NormalizedPoint[],
  numPoints: number
): NormalizedPoint[] {
  if (points.length < 2) return [...points]
  if (numPoints <= 2) return [points[0], points[points.length - 1]]

  // Calculate cumulative arc length
  const arcLengths: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    arcLengths.push(arcLengths[i - 1] + distance(points[i - 1], points[i]))
  }

  const totalLength = arcLengths[arcLengths.length - 1]
  const result: NormalizedPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    const targetLength = (i / (numPoints - 1)) * totalLength

    // Find segment containing target length
    let segmentIdx = 0
    for (let j = 1; j < arcLengths.length; j++) {
      if (arcLengths[j] >= targetLength) {
        segmentIdx = j - 1
        break
      }
    }

    // Interpolate within segment
    const segmentStart = arcLengths[segmentIdx]
    const segmentEnd = arcLengths[segmentIdx + 1] || segmentStart
    const segmentLength = segmentEnd - segmentStart

    const t = segmentLength > 0 ? (targetLength - segmentStart) / segmentLength : 0

    result.push({
      x: points[segmentIdx].x + t * (points[segmentIdx + 1].x - points[segmentIdx].x),
      y: points[segmentIdx].y + t * (points[segmentIdx + 1].y - points[segmentIdx].y),
    })
  }

  return result
}

/**
 * Generate a smooth Catmull-Rom spline path through a set of points
 */
export function getCatmullRomSpline(
  points: NormalizedPoint[],
  segmentsPerStep: number = 10
): NormalizedPoint[] {
  if (points.length < 2) return points
  if (points.length === 2) return points

  const res: NormalizedPoint[] = []

  // Catmull-Rom needs 4 points (p0, p1, p2, p3)
  // We duplicate endpoints to allow drawing from start to end
  const p = [points[0], ...points, points[points.length - 1]]

  for (let i = 0; i < p.length - 3; i++) {
    const p0 = p[i]
    const p1 = p[i + 1]
    const p2 = p[i + 2]
    const p3 = p[i + 3]

    for (let j = 0; j < segmentsPerStep; j++) {
      const t = j / segmentsPerStep
      const t2 = t * t
      const t3 = t2 * t

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      )

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      )

      res.push({ x, y })
    }
  }

  // Add the last point
  res.push(points[points.length - 1])

  return res
}

// ============================================================================
// Scale Conversion
// ============================================================================

/**
 * Calculate scale factor from reference points
 */
export function calculateScaleFactor(
  point1: NormalizedPoint,
  point2: NormalizedPoint,
  realValue: number,
  imageWidth: number,
  imageHeight: number
): number {
  // Convert normalized to pixels
  const px1 = { x: point1.x * imageWidth, y: point1.y * imageHeight }
  const px2 = { x: point2.x * imageWidth, y: point2.y * imageHeight }

  const pixelDistance = Math.sqrt(
    Math.pow(px2.x - px1.x, 2) + Math.pow(px2.y - px1.y, 2)
  )

  return realValue / pixelDistance // Units per pixel
}

/**
 * Convert normalized distance to real units
 */
export function normalizedToReal(
  normalizedDistance: number,
  scaleFactor: number,
  imageDimension: number
): number {
  return normalizedDistance * imageDimension * scaleFactor
}
