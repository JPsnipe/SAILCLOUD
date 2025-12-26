/**
 * Mast Bend Metrics Analysis
 *
 * Analyzes mast bend curves to calculate:
 * - Maximum bend amount and position
 * - Bend at spreader heights
 * - Curvature profile
 * - Pre-bend vs sailing bend comparison
 *
 * Based on mast tuning principles from:
 * - Spar manufacturers (Seldén, Southern Spars)
 * - Sail design optimization
 */

import type { NormalizedPoint, PhotoAnalysis, PhotoLayer, MastProfile } from '../../shared/domain'
import type { MastBendResult, ScaleReference } from './types'
import { distance, perpendicularDistance, smoothCurve, resampleCurve } from './geometry'

// ============================================================================
// Types
// ============================================================================

export interface MastBendPoint {
  heightPct: number       // 0-100% from deck/base
  deflectionPct: number   // Deflection as % of mast height (signed: + = forward/port, - = aft/starboard)
  deflectionPx: number    // Raw pixel deflection
  deflectionMm?: number   // Real units if reference available
}

export interface MastBendAnalysis {
  /** Bend type based on scene */
  bendType: 'FORE_AFT' | 'LATERAL'

  /** Full bend profile */
  profile: MastBendPoint[]

  /** Maximum bend */
  maxBend: {
    heightPct: number
    deflectionPct: number
    deflectionPx: number
    deflectionMm?: number
  }

  /** Bend at key positions */
  keyPositions: Array<{
    label: string
    heightPct: number
    deflectionPct: number
  }>

  /** Curvature analysis by section */
  sections: Array<{
    label: string
    fromPct: number
    toPct: number
    avgCurvature: number  // Higher = more curved
    direction: 'FORWARD' | 'AFT' | 'PORT' | 'STARBOARD' | 'STRAIGHT'
  }>

  /** Overall statistics */
  summary: {
    totalBendPct: number      // Max deflection as % of height
    bendAtHounds: number      // Deflection at hounds position
    straightness: number      // 0-1, how close to straight line
    symmetry?: number         // For lateral: -1 to 1 (0 = symmetric)
  }

  /** Has scale reference */
  hasScaleReference: boolean
}

export interface MastMetricsSummary {
  bendType: 'FORE_AFT' | 'LATERAL'
  profile: MastBendPoint[]
  maxBend: {
    heightPct: number
    deflectionPct: number
    label: string
  }
  keyPositions: Array<{
    label: string
    heightPct: number
    deflectionPct: number
  }>
  sections: Array<{
    label: string
    direction: string
    curvature: 'Straight' | 'Slight' | 'Moderate' | 'Heavy'
  }>
  assessment: string
  hasScaleReference: boolean
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze mast bend from photo analysis
 */
export function analyzeMastBend(
  analysis: PhotoAnalysis,
  mastProfile?: MastProfile,
  scaleRef?: ScaleReference
): MastBendAnalysis | null {
  const sceneType = analysis.sceneType
  if (!sceneType?.includes('MAST_BEND')) return null

  const bendType = sceneType.includes('FORE_AFT') ? 'FORE_AFT' : 'LATERAL'

  // Find mast curve layers
  const curveLayers = analysis.layers.filter(
    (l) => l.label.includes('Curve') || l.label.includes('Mast')
  )

  if (curveLayers.length === 0 || curveLayers.every((l) => l.points.length < 3)) {
    return null
  }

  // Use the first curve with enough points (typically "Mast Curve" or "Fore-Aft Curve")
  const mainCurve = curveLayers.find((l) => l.points.length >= 3)
  if (!mainCurve) return null

  // Calculate bend profile
  const profile = calculateBendProfile(mainCurve.points, bendType)

  // Find max bend
  const maxBend = findMaxBend(profile)

  // Calculate key positions based on mast profile or defaults
  const keyPositions = calculateKeyPositions(profile, mastProfile)

  // Analyze sections
  const sections = analyzeSections(profile, mastProfile)

  // Calculate summary statistics
  const summary = calculateSummary(profile, mastProfile)

  return {
    bendType,
    profile,
    maxBend,
    keyPositions,
    sections,
    summary,
    hasScaleReference: !!scaleRef,
  }
}

/**
 * Calculate bend profile from curve points
 * Assumes points go from deck (bottom) to masthead (top)
 */
function calculateBendProfile(
  points: NormalizedPoint[],
  bendType: 'FORE_AFT' | 'LATERAL'
): MastBendPoint[] {
  if (points.length < 2) return []

  // Sort points by Y (bottom to top in image = higher Y to lower Y in normalized coords)
  const sortedPoints = [...points].sort((a, b) => b.y - a.y)

  // Define the reference line (straight mast from base to tip)
  const basePoint = sortedPoints[0]
  const tipPoint = sortedPoints[sortedPoints.length - 1]

  // Calculate total mast height in normalized coords
  const mastHeight = distance(basePoint, tipPoint)
  if (mastHeight < 0.01) return [] // Too short

  // Smooth the curve for better analysis
  const smoothedPoints = smoothCurve(sortedPoints, 5)

  // Calculate deflection at each point
  const profile: MastBendPoint[] = []

  for (let i = 0; i < smoothedPoints.length; i++) {
    const point = smoothedPoints[i]

    // Calculate height percentage (0 = deck, 100 = masthead)
    const heightFromBase = distance(basePoint, point)
    const heightPct = (heightFromBase / mastHeight) * 100

    // Calculate perpendicular deflection from straight line
    const { distance: deflection, t } = perpendicularDistance(point, basePoint, tipPoint)

    // Deflection as percentage of mast height
    const deflectionPct = (deflection / mastHeight) * 100

    profile.push({
      heightPct,
      deflectionPct,
      deflectionPx: deflection * 1000, // Approximate pixel scale
    })
  }

  // Sort by height
  profile.sort((a, b) => a.heightPct - b.heightPct)

  return profile
}

/**
 * Find maximum bend point
 */
function findMaxBend(profile: MastBendPoint[]): MastBendAnalysis['maxBend'] {
  if (profile.length === 0) {
    return { heightPct: 0, deflectionPct: 0, deflectionPx: 0 }
  }

  let maxIdx = 0
  let maxDeflection = 0

  for (let i = 0; i < profile.length; i++) {
    const absDeflection = Math.abs(profile[i].deflectionPct)
    if (absDeflection > maxDeflection) {
      maxDeflection = absDeflection
      maxIdx = i
    }
  }

  return {
    heightPct: profile[maxIdx].heightPct,
    deflectionPct: profile[maxIdx].deflectionPct,
    deflectionPx: profile[maxIdx].deflectionPx,
  }
}

/**
 * Calculate bend at key mast positions
 */
function calculateKeyPositions(
  profile: MastBendPoint[],
  mastProfile?: MastProfile
): MastBendAnalysis['keyPositions'] {
  const positions: MastBendAnalysis['keyPositions'] = []

  // Default key heights if no mast profile
  const keyHeights: Array<{ label: string; pct: number }> = []

  if (mastProfile) {
    // Use mast profile spreader positions
    if (mastProfile.spreadersHeightPct) {
      // Single spreader or first spreader
      keyHeights.push({ label: 'Spreaders', pct: mastProfile.spreadersHeightPct })
    }
    if (mastProfile.houndsHeightPct) {
      keyHeights.push({ label: 'Hounds', pct: mastProfile.houndsHeightPct })
    }
  }

  // Add standard measurement points
  keyHeights.push(
    { label: 'Lower (25%)', pct: 25 },
    { label: 'Middle (50%)', pct: 50 },
    { label: 'Upper (75%)', pct: 75 }
  )

  // Remove duplicates and sort
  const uniqueHeights = keyHeights.filter(
    (h, i, arr) => arr.findIndex((x) => Math.abs(x.pct - h.pct) < 5) === i
  )
  uniqueHeights.sort((a, b) => a.pct - b.pct)

  for (const { label, pct } of uniqueHeights) {
    const deflection = interpolateDeflection(profile, pct)
    positions.push({
      label,
      heightPct: pct,
      deflectionPct: deflection,
    })
  }

  return positions
}

/**
 * Interpolate deflection at a specific height
 */
function interpolateDeflection(profile: MastBendPoint[], heightPct: number): number {
  if (profile.length === 0) return 0
  if (profile.length === 1) return profile[0].deflectionPct

  // Find surrounding points
  let lower = profile[0]
  let upper = profile[profile.length - 1]

  for (let i = 0; i < profile.length - 1; i++) {
    if (profile[i].heightPct <= heightPct && profile[i + 1].heightPct >= heightPct) {
      lower = profile[i]
      upper = profile[i + 1]
      break
    }
  }

  // Linear interpolation
  const range = upper.heightPct - lower.heightPct
  if (range < 0.001) return lower.deflectionPct

  const t = (heightPct - lower.heightPct) / range
  return lower.deflectionPct + t * (upper.deflectionPct - lower.deflectionPct)
}

/**
 * Analyze mast sections for curvature
 */
function analyzeSections(
  profile: MastBendPoint[],
  mastProfile?: MastProfile
): MastBendAnalysis['sections'] {
  const sections: MastBendAnalysis['sections'] = []

  // Define sections
  const sectionDefs = [
    { label: 'Lower', from: 0, to: 33 },
    { label: 'Middle', from: 33, to: 66 },
    { label: 'Upper', from: 66, to: 100 },
  ]

  for (const { label, from, to } of sectionDefs) {
    const sectionPoints = profile.filter((p) => p.heightPct >= from && p.heightPct <= to)

    if (sectionPoints.length < 2) {
      sections.push({
        label,
        fromPct: from,
        toPct: to,
        avgCurvature: 0,
        direction: 'STRAIGHT',
      })
      continue
    }

    // Calculate average curvature (rate of change of deflection)
    let totalCurvature = 0
    let avgDeflection = 0

    for (let i = 1; i < sectionPoints.length; i++) {
      const dHeight = sectionPoints[i].heightPct - sectionPoints[i - 1].heightPct
      const dDeflection = sectionPoints[i].deflectionPct - sectionPoints[i - 1].deflectionPct

      if (dHeight > 0) {
        totalCurvature += Math.abs(dDeflection / dHeight)
      }
      avgDeflection += sectionPoints[i].deflectionPct
    }

    avgDeflection /= sectionPoints.length
    const avgCurvature = totalCurvature / (sectionPoints.length - 1)

    // Determine direction based on average deflection
    let direction: MastBendAnalysis['sections'][0]['direction'] = 'STRAIGHT'
    if (Math.abs(avgDeflection) > 0.5) {
      direction = avgDeflection > 0 ? 'FORWARD' : 'AFT'
    }

    sections.push({
      label,
      fromPct: from,
      toPct: to,
      avgCurvature,
      direction,
    })
  }

  return sections
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  profile: MastBendPoint[],
  mastProfile?: MastProfile
): MastBendAnalysis['summary'] {
  if (profile.length < 2) {
    return {
      totalBendPct: 0,
      bendAtHounds: 0,
      straightness: 1,
    }
  }

  // Total bend = max deflection
  const maxDeflection = Math.max(...profile.map((p) => Math.abs(p.deflectionPct)))

  // Bend at hounds
  const houndsHeight = mastProfile?.houndsHeightPct ?? 85
  const bendAtHounds = interpolateDeflection(profile, houndsHeight)

  // Straightness: how close is the actual curve to a straight line
  // 1 = perfectly straight, 0 = very curved
  const avgDeflection = profile.reduce((sum, p) => sum + Math.abs(p.deflectionPct), 0) / profile.length
  const straightness = Math.max(0, 1 - avgDeflection / 5) // 5% avg deflection = straightness 0

  return {
    totalBendPct: maxDeflection,
    bendAtHounds,
    straightness,
  }
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate human-readable mast metrics summary
 */
export function generateMastMetricsSummary(
  analysis: PhotoAnalysis,
  mastProfile?: MastProfile
): MastMetricsSummary | null {
  const result = analyzeMastBend(analysis, mastProfile)
  if (!result) return null

  // Classify curvature
  function classifyCurvature(curvature: number): 'Straight' | 'Slight' | 'Moderate' | 'Heavy' {
    if (curvature < 0.05) return 'Straight'
    if (curvature < 0.15) return 'Slight'
    if (curvature < 0.3) return 'Moderate'
    return 'Heavy'
  }

  // Generate assessment
  let assessment = ''
  const maxBendAbs = Math.abs(result.maxBend.deflectionPct)

  if (maxBendAbs < 1) {
    assessment = 'Very straight mast - minimal bend detected.'
  } else if (maxBendAbs < 2.5) {
    assessment = 'Light bend - typical for moderate conditions.'
  } else if (maxBendAbs < 4) {
    assessment = 'Moderate bend - good power shape.'
  } else {
    assessment = 'Heavy bend - check rig tension or wind load.'
  }

  // Add position info
  if (result.maxBend.heightPct < 40) {
    assessment += ' Max bend is low - may indicate backstay or lower shroud tension.'
  } else if (result.maxBend.heightPct > 70) {
    assessment += ' Max bend is high - typical of upper backstay or topmast flex.'
  }

  // Format max bend label
  const maxBendDirection = result.maxBend.deflectionPct > 0 ? 'forward' : 'aft'
  const maxBendLabel = `${Math.abs(result.maxBend.deflectionPct).toFixed(1)}% ${maxBendDirection}`

  return {
    bendType: result.bendType,
    profile: result.profile,
    maxBend: {
      heightPct: result.maxBend.heightPct,
      deflectionPct: result.maxBend.deflectionPct,
      label: maxBendLabel,
    },
    keyPositions: result.keyPositions,
    sections: result.sections.map((s) => ({
      label: s.label,
      direction: s.direction === 'STRAIGHT' ? 'Straight' : s.direction.toLowerCase(),
      curvature: classifyCurvature(s.avgCurvature),
    })),
    assessment,
    hasScaleReference: result.hasScaleReference,
  }
}

/**
 * Check if analysis is a mast scene
 */
export function isMastScene(sceneType: string | undefined): boolean {
  if (!sceneType) return false
  return sceneType.includes('MAST_BEND') || sceneType === 'RAKE'
}

/**
 * Get curve layers for mast analysis
 */
export function getMastCurveLayers(analysis: PhotoAnalysis): PhotoLayer[] {
  return analysis.layers.filter(
    (l) => l.label.includes('Curve') && l.tool === 'POLYLINE' && l.points.length >= 3
  )
}
