/**
 * Geometry utilities for CV operations
 */

import type { NormalizedPoint } from '../../shared/domain'
import type { PixelPoint } from './types'

/**
 * Convert normalized point (0-1) to pixel coordinates
 */
export function normalizedToPixel(
  point: NormalizedPoint,
  width: number,
  height: number,
): PixelPoint {
  return {
    x: Math.round(point.x * (width - 1)),
    y: Math.round(point.y * (height - 1)),
  }
}

/**
 * Convert pixel coordinates to normalized point (0-1)
 */
export function pixelToNormalized(
  point: PixelPoint,
  width: number,
  height: number,
): NormalizedPoint {
  return {
    x: point.x / (width - 1),
    y: point.y / (height - 1),
  }
}

/**
 * Calculate Euclidean distance between two points
 */
export function distance(a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate perpendicular distance from a point to a line segment
 * Returns the distance and the parameter t (0-1) along the line
 */
export function perpendicularDistanceToLine(
  point: PixelPoint,
  lineStart: PixelPoint,
  lineEnd: PixelPoint,
): { distance: number; t: number } {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lineLengthSq = dx * dx + dy * dy

  if (lineLengthSq === 0) {
    // Line is a point
    return { distance: distance(point, lineStart), t: 0 }
  }

  // Calculate projection parameter t
  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq),
  )

  // Calculate closest point on line
  const closestX = lineStart.x + t * dx
  const closestY = lineStart.y + t * dy

  // Calculate distance
  const distX = point.x - closestX
  const distY = point.y - closestY

  return {
    distance: Math.sqrt(distX * distX + distY * distY),
    t,
  }
}

/**
 * Douglas-Peucker line simplification algorithm
 * Reduces the number of points in a polyline while preserving its shape
 */
export function simplifyPath(points: PixelPoint[], tolerance: number): PixelPoint[] {
  if (points.length <= 2) return points

  // Find the point with maximum distance from the line
  let maxDistance = 0
  let maxIndex = 0

  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const { distance: d } = perpendicularDistanceToLine(points[i], start, end)
    if (d > maxDistance) {
      maxDistance = d
      maxIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)

    // Combine results (remove duplicate point at junction)
    return [...left.slice(0, -1), ...right]
  }

  // All points are within tolerance, return just endpoints
  return [start, end]
}

/**
 * Apply smoothing to a path using moving average
 */
export function smoothPath(points: PixelPoint[], windowSize: number = 3): PixelPoint[] {
  if (points.length <= windowSize) return points

  const result: PixelPoint[] = []
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
      x: Math.round(sumX / count),
      y: Math.round(sumY / count),
    })
  }

  // Preserve exact start and end points
  result[0] = points[0]
  result[result.length - 1] = points[points.length - 1]

  return result
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Check if a pixel coordinate is within bounds
 */
export function isInBounds(point: PixelPoint, width: number, height: number): boolean {
  return point.x >= 0 && point.x < width && point.y >= 0 && point.y < height
}
