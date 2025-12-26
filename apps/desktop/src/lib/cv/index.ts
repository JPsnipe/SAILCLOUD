/**
 * Computer Vision Module for SailCloud
 *
 * Provides edge detection and path finding capabilities for
 * automatic sail/mast shape analysis.
 *
 * Main exports:
 * - runAutoScan: Main function for detecting edges between anchor points
 * - loadOpenCV: Load OpenCV.js WebAssembly module
 * - isOpenCVReady: Check if OpenCV is loaded
 *
 * @example
 * ```typescript
 * import { runAutoScan, loadOpenCV } from '@/lib/cv'
 *
 * // Load OpenCV (lazy, only once)
 * await loadOpenCV()
 *
 * // Run AutoScan
 * const result = await runAutoScan({
 *   imagePath: '/path/to/sail-photo.jpg',
 *   startPoint: { x: 0.1, y: 0.3 },  // Normalized coordinates
 *   endPoint: { x: 0.8, y: 0.35 },
 * })
 *
 * if (result.success) {
 *   console.log('Detected points:', result.points)
 *   console.log('Confidence:', result.confidence)
 * }
 * ```
 */

// Main AutoScan functions
export { runAutoScan, runAutoScanWithFallback, validateAutoScanInput } from './autoscan'

// OpenCV loader
export { loadOpenCV, isOpenCVReady, getOpenCVStatus, withOpenCV } from './opencv-loader'

// Edge detection (for advanced use)
export { detectEdges, loadImageAsImageData, resizeIfNeeded, edgeMapToBase64, isOpenCVAvailable } from './edge-detector'

// Path finding (for advanced use)
export { findPath, calculatePathConfidence } from './path-finder'

// Geometry utilities
export {
  normalizedToPixel,
  pixelToNormalized,
  distance,
  perpendicularDistanceToLine,
  simplifyPath,
  smoothPath,
} from './geometry'

// Types
export type {
  AutoScanInput,
  AutoScanResult,
  AutoScanIpcInput,
  AutoScanIpcResponse,
  CannyParameters,
  EdgeMap,
  OpenCVStatus,
  PathFinderOptions,
  PixelPoint,
} from './types'

export { DEFAULT_CANNY_PARAMS, DEFAULT_PATH_OPTIONS } from './types'
