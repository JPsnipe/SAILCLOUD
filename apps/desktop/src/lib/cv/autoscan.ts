/**
 * AutoScan Orchestrator
 *
 * Main entry point for automatic edge detection on sail/mast images.
 * Coordinates OpenCV loading, edge detection, and path finding.
 */

import type { NormalizedPoint } from '../../shared/domain'
import type { AutoScanInput, AutoScanResult, CannyParameters, PathFinderOptions } from './types'
import { DEFAULT_CANNY_PARAMS, DEFAULT_PATH_OPTIONS } from './types'
import { loadOpenCV, isOpenCVReady } from './opencv-loader'
import { detectEdges, loadImageAsImageData, resizeIfNeeded, edgeMapToBase64 } from './edge-detector'
import { findPath, calculatePathConfidence } from './path-finder'
import { normalizedToPixel, pixelToNormalized } from './geometry'
import type { PixelPoint } from './types'

/**
 * Run AutoScan on an image
 *
 * This is the main function for detecting edges between two anchor points.
 *
 * @param input - AutoScan input parameters
 * @returns AutoScan result with detected polyline
 */
export async function runAutoScan(input: AutoScanInput): Promise<AutoScanResult> {
  const startTime = performance.now()

  try {
    // 1. Ensure OpenCV is loaded
    if (!isOpenCVReady()) {
      console.log('Loading OpenCV...')
      await loadOpenCV()
    }

    // 2. Load and prepare image
    console.log('Loading image:', input.imagePath)
    const originalImageData = await loadImageAsImageData(input.imagePath)

    // Resize if too large (for performance)
    const { imageData, scale } = resizeIfNeeded(originalImageData, 2048)
    console.log(`Image size: ${imageData.width}x${imageData.height} (scale: ${scale})`)

    // 3. Merge parameters with defaults
    const cannyParams: CannyParameters = {
      ...DEFAULT_CANNY_PARAMS,
      ...input.cannyParams,
    }

    const pathOptions: Required<PathFinderOptions> = {
      ...DEFAULT_PATH_OPTIONS,
      ...input.pathOptions,
    }

    // 4. Detect edges
    console.log('Detecting edges with Canny...')
    const edgeMap = detectEdges(imageData, cannyParams, input.targetColor, input.colorTolerance)

    // 5. Convert normalized points to pixel coordinates
    const anchorPixels = input.anchorPoints.map(p => normalizedToPixel(p, edgeMap.width, edgeMap.height))

    if (anchorPixels.length < 2) {
      return {
        success: false,
        points: [],
        confidence: 0,
        error: 'At least two anchor points are required',
      }
    }

    console.log(`Finding path through ${anchorPixels.length} anchor points`)

    let fullPath: PixelPoint[] = []
    let totalCost = 0

    // 6. Find path segment by segment
    for (let i = 0; i < anchorPixels.length - 1; i++) {
      const startPixel = anchorPixels[i]
      const endPixel = anchorPixels[i + 1]

      const { path, cost } = findPath(edgeMap, startPixel, endPixel, pathOptions)

      if (path.length === 0) {
        return {
          success: false,
          points: [],
          confidence: 0,
          error: `No path found between anchor ${i} and ${i + 1}`,
        }
      }

      // Avoid duplicating points at segment junctions
      if (i > 0) {
        fullPath.push(...path.slice(1))
      } else {
        fullPath.push(...path)
      }
      totalCost += cost
    }

    const path = fullPath
    const cost = totalCost

    if (path.length === 0) {
      return {
        success: false,
        points: [],
        confidence: 0,
        error: 'No path found between anchor points',
      }
    }

    // 7. Calculate confidence
    const confidence = calculatePathConfidence(path, edgeMap)

    // 8. Convert path back to normalized coordinates
    // Account for any scaling that was applied
    const normalizedPoints: NormalizedPoint[] = path.map((p) => {
      const normalizedInResized = pixelToNormalized(p, edgeMap.width, edgeMap.height)
      return normalizedInResized
    })

    const processingTime = performance.now() - startTime

    console.log(`AutoScan complete: ${normalizedPoints.length} points, confidence: ${(confidence * 100).toFixed(1)}%`)

    return {
      success: true,
      points: normalizedPoints,
      confidence,
      debugInfo: {
        edgeMapBase64: edgeMapToBase64(edgeMap),
        pathCost: cost,
        rawPointCount: path.length,
        simplifiedPointCount: normalizedPoints.length,
        processingTimeMs: processingTime,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('AutoScan error:', error)

    return {
      success: false,
      points: [],
      confidence: 0,
      error: message,
    }
  }
}

/**
 * Run AutoScan with multiple sensitivity levels
 *
 * Tries different Canny thresholds and returns the best result.
 * Useful when the default parameters don't work well.
 *
 * @param input - AutoScan input parameters
 * @returns Best AutoScan result
 */
export async function runAutoScanWithFallback(input: AutoScanInput): Promise<AutoScanResult> {
  // Sensitivity presets (low to high)
  const presets: Partial<CannyParameters>[] = [
    { threshold1: 50, threshold2: 150 }, // Default
    { threshold1: 30, threshold2: 100 }, // More sensitive
    { threshold1: 80, threshold2: 200 }, // Less sensitive
    { threshold1: 20, threshold2: 80 }, // Very sensitive
  ]

  let bestResult: AutoScanResult | null = null

  for (const preset of presets) {
    const result = await runAutoScan({
      ...input,
      cannyParams: { ...input.cannyParams, ...preset },
    })

    if (result.success) {
      if (!bestResult || result.confidence > bestResult.confidence) {
        bestResult = result
      }

      // Good enough - stop searching
      if (result.confidence > 0.7) {
        break
      }
    }
  }

  return (
    bestResult ?? {
      success: false,
      points: [],
      confidence: 0,
      error: 'No valid path found with any sensitivity preset',
    }
  )
}

/**
 * Validate AutoScan input
 */
export function validateAutoScanInput(input: AutoScanInput): string | null {
  if (!input.anchorPoints || input.anchorPoints.length < 2) {
    return 'At least two anchor points are required'
  }

  for (let i = 0; i < input.anchorPoints.length; i++) {
    const p = input.anchorPoints[i]
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
      return `Anchor point ${i} must have x and y in range [0, 1]`
    }
  }

  return null
}
