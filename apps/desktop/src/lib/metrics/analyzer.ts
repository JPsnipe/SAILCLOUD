/**
 * Sail Metrics Analyzer
 *
 * High-level API for analyzing sail photos.
 * Integrates camber, twist, and other metrics.
 *
 * Based on:
 * - SailVis temporal analysis
 * - SailTool complete workflow
 * - VSPARS multi-camera approach
 */

import type { NormalizedPoint, PhotoAnalysis, PhotoLayer } from '../../shared/domain'
import type {
  SailAnalysisResult,
  CamberResult,
  CalculationOptions,
  ScaleReference,
} from './types'
import { calculateCamber, classifyCamber, classifyDraftPosition } from './camber'
import { calculateMultiStripeTwist, classifyTwist } from './twist'
import { lineAngleDeg } from './geometry'

const LABEL_LENGTH_REF = 'Length reference'
const LABEL_TWIST_REF = 'Twist reference'

/**
 * Extract stripe height percentage from layer label
 * E.g., "Stripe 1 (25%)" -> 25
 */
function extractStripeHeight(label: string): number | null {
  const match = label.match(/\((\d+(?:\.\d+)?)%\)/)
  if (match) {
    return parseFloat(match[1])
  }
  return null
}

/**
 * Get the chord endpoints for a stripe
 * Uses first and last points of the polyline
 */
function getChordEndpoints(layer: PhotoLayer): { start: NormalizedPoint; end: NormalizedPoint } | null {
  if (layer.points.length < 2) return null

  return {
    start: layer.points[0],
    end: layer.points[layer.points.length - 1],
  }
}

/**
 * Extract scale reference from photo analysis
 */
function extractScaleReference(analysis: PhotoAnalysis): ScaleReference | undefined {
  const lengthLayer = analysis.layers.find((l) => l.label === LABEL_LENGTH_REF)

  if (!lengthLayer || lengthLayer.points.length < 2) return undefined
  if (!lengthLayer.lengthValue || !lengthLayer.lengthUnit) return undefined

  return {
    points: [lengthLayer.points[0], lengthLayer.points[1]],
    realValue: lengthLayer.lengthValue,
    unit: lengthLayer.lengthUnit as 'mm' | 'm' | 'ft' | 'in',
  }
}

/**
 * Extract twist reference angle from photo analysis
 */
function extractTwistReference(analysis: PhotoAnalysis): number | undefined {
  const twistLayer = analysis.layers.find((l) => l.label === LABEL_TWIST_REF)

  if (!twistLayer || twistLayer.points.length < 2) return undefined

  return lineAngleDeg(twistLayer.points[0], twistLayer.points[1])
}

/**
 * Analyze all stripes in a photo
 */
export function analyzePhoto(
  analysis: PhotoAnalysis,
  options: Partial<CalculationOptions> = {}
): SailAnalysisResult {
  const scaleRef = extractScaleReference(analysis)

  const opts: CalculationOptions = {
    ...options,
    scaleReference: scaleRef,
  }

  // Find all stripe layers
  const stripeLayers = analysis.layers.filter((l) => l.label.startsWith('Stripe'))

  // Analyze each stripe
  const stripes: Array<{ layerId: string; heightPct: number; camber: CamberResult }> = []

  for (const layer of stripeLayers) {
    const heightPct = extractStripeHeight(layer.label)
    if (heightPct === null) continue

    const chord = getChordEndpoints(layer)
    if (!chord) continue

    const camber = calculateCamber(layer.points, chord.start, chord.end, opts)

    stripes.push({
      layerId: layer.id,
      heightPct,
      camber,
    })
  }

  // Sort stripes by height
  stripes.sort((a, b) => a.heightPct - b.heightPct)

  // Calculate twist between stripes
  const { twists, totalTwistDeg } = calculateMultiStripeTwist(stripes)

  // Calculate summary statistics
  const avgCamber = stripes.length > 0
    ? stripes.reduce((sum, s) => sum + s.camber.camberPct, 0) / stripes.length
    : 0

  const avgDraftPosition = stripes.length > 0
    ? stripes.reduce((sum, s) => sum + s.camber.draftPositionPct, 0) / stripes.length
    : 50

  // Calculate flatness index (0 = very cambered, 1 = flat)
  const maxCamber = Math.max(...stripes.map((s) => s.camber.camberPct), 0)
  const flatnessIndex = maxCamber > 0 ? Math.max(0, 1 - maxCamber / 20) : 1

  return {
    photoId: '', // To be filled by caller
    sceneType: analysis.sceneType,
    timestamp: new Date().toISOString(),
    stripes,
    twists,
    summary: {
      avgCamberPct: avgCamber,
      avgDraftPositionPct: avgDraftPosition,
      totalTwistDeg,
      flatnessIndex,
    },
  }
}

/**
 * Analyze a single stripe layer
 */
export function analyzeStripe(
  layer: PhotoLayer,
  options: Partial<CalculationOptions> = {}
): CamberResult | null {
  const chord = getChordEndpoints(layer)
  if (!chord) return null

  return calculateCamber(layer.points, chord.start, chord.end, options)
}

/**
 * Get metrics summary for display
 */
export interface MetricsSummary {
  stripes: Array<{
    label: string
    heightPct: number
    camberPct: number
    camberClass: ReturnType<typeof classifyCamber>
    draftPositionPct: number
    draftClass: ReturnType<typeof classifyDraftPosition>
    entryAngleDeg: number
    exitAngleDeg: number
    frontPct: number
    backPct: number
  }>
  twists: Array<{
    fromHeightPct: number
    toHeightPct: number
    twistDeg: number
    twistClass: ReturnType<typeof classifyTwist>
  }>
  summary: {
    avgCamberPct: number
    avgDraftPositionPct: number
    totalTwistDeg: number
    flatnessIndex: number
    overallAssessment: string
  }
  hasScaleReference: boolean
  hasTwistReference: boolean
}

/**
 * Generate a human-readable metrics summary
 */
export function generateMetricsSummary(
  analysis: PhotoAnalysis
): MetricsSummary {
  const result = analyzePhoto(analysis)
  const scaleRef = extractScaleReference(analysis)
  const twistRef = extractTwistReference(analysis)

  // Find stripe labels
  const stripeLayers = analysis.layers.filter((l) => l.label.startsWith('Stripe'))
  const labelMap = new Map(stripeLayers.map((l) => {
    const heightPct = extractStripeHeight(l.label)
    return [heightPct, l.label] as const
  }))

  const stripes = result.stripes.map((s) => ({
    label: labelMap.get(s.heightPct) ?? `${s.heightPct}%`,
    heightPct: s.heightPct,
    camberPct: s.camber.camberPct,
    camberClass: classifyCamber(s.camber.camberPct),
    draftPositionPct: s.camber.draftPositionPct,
    draftClass: classifyDraftPosition(s.camber.draftPositionPct),
    entryAngleDeg: s.camber.entryAngleDeg,
    exitAngleDeg: s.camber.exitAngleDeg,
    frontPct: s.camber.frontPct,
    backPct: s.camber.backPct,
  }))

  const twists = result.twists.map((t) => ({
    fromHeightPct: t.referenceHeightPct,
    toHeightPct: t.comparedHeightPct,
    twistDeg: t.twistDeg,
    twistClass: classifyTwist(t.twistDeg, t.comparedHeightPct - t.referenceHeightPct),
  }))

  // Generate overall assessment
  let overallAssessment = ''

  if (result.summary.avgCamberPct < 8) {
    overallAssessment = 'Flat sail shape - good for heavy air or pointing.'
  } else if (result.summary.avgCamberPct < 14) {
    overallAssessment = 'Medium depth - versatile shape.'
  } else {
    overallAssessment = 'Deep sail shape - good for power in light air.'
  }

  if (Math.abs(result.summary.totalTwistDeg) > 12) {
    overallAssessment += ' High twist present.'
  }

  return {
    stripes,
    twists,
    summary: {
      avgCamberPct: result.summary.avgCamberPct,
      avgDraftPositionPct: result.summary.avgDraftPositionPct,
      totalTwistDeg: result.summary.totalTwistDeg,
      flatnessIndex: result.summary.flatnessIndex,
      overallAssessment,
    },
    hasScaleReference: !!scaleRef,
    hasTwistReference: twistRef !== undefined,
  }
}

/**
 * Compare two photos' metrics
 */
export interface PhotoComparison {
  camberDiff: number
  draftPositionDiff: number
  twistDiff: number
  improvements: string[]
  regressions: string[]
}

export function comparePhotos(
  before: PhotoAnalysis,
  after: PhotoAnalysis
): PhotoComparison {
  const beforeResult = analyzePhoto(before)
  const afterResult = analyzePhoto(after)

  const camberDiff = afterResult.summary.avgCamberPct - beforeResult.summary.avgCamberPct
  const draftPositionDiff = afterResult.summary.avgDraftPositionPct - beforeResult.summary.avgDraftPositionPct
  const twistDiff = afterResult.summary.totalTwistDeg - beforeResult.summary.totalTwistDeg

  const improvements: string[] = []
  const regressions: string[] = []

  // Analyze camber change
  if (Math.abs(camberDiff) > 1) {
    if (camberDiff > 0) {
      improvements.push(`Camber increased by ${camberDiff.toFixed(1)}%`)
    } else {
      improvements.push(`Camber decreased by ${Math.abs(camberDiff).toFixed(1)}%`)
    }
  }

  // Analyze draft position change
  if (Math.abs(draftPositionDiff) > 3) {
    if (draftPositionDiff < 0) {
      improvements.push(`Draft moved forward by ${Math.abs(draftPositionDiff).toFixed(0)}%`)
    } else {
      improvements.push(`Draft moved aft by ${draftPositionDiff.toFixed(0)}%`)
    }
  }

  // Analyze twist change
  if (Math.abs(twistDiff) > 2) {
    if (twistDiff > 0) {
      improvements.push(`Twist increased by ${twistDiff.toFixed(1)}°`)
    } else {
      improvements.push(`Twist decreased by ${Math.abs(twistDiff).toFixed(1)}°`)
    }
  }

  return {
    camberDiff,
    draftPositionDiff,
    twistDiff,
    improvements,
    regressions,
  }
}
