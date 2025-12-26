/**
 * Computer Vision types for SailCloud AutoScan
 *
 * These types define the interface for edge detection and path finding
 * operations used in sail/mast analysis.
 */

import type { NormalizedPoint } from '../../shared/domain'

// ============================================================================
// Canny Edge Detection Parameters
// ============================================================================

export interface CannyParameters {
  /** Lower threshold for hysteresis (typical: 50-100) */
  threshold1: number
  /** Upper threshold for hysteresis (typical: 150-200) */
  threshold2: number
  /** Aperture size for Sobel operator (3, 5, or 7) */
  apertureSize: 3 | 5 | 7
  /** Use L2 gradient for more accurate results */
  L2gradient: boolean
}

export const DEFAULT_CANNY_PARAMS: CannyParameters = {
  threshold1: 50,
  threshold2: 150,
  apertureSize: 3,
  L2gradient: false,
}

// ============================================================================
// Edge Map
// ============================================================================

export interface EdgeMap {
  /** Width of the edge map in pixels */
  width: number
  /** Height of the edge map in pixels */
  height: number
  /** Binary edge data: 0 = no edge, 255 = edge */
  data: Uint8Array
}

// ============================================================================
// Path Finding Options
// ============================================================================

export interface PathFinderOptions {
  /** Maximum iterations before giving up (default: 100000) */
  maxIterations?: number
  /** Apply smoothing to the result path */
  smoothing?: boolean
  /** Tolerance for Douglas-Peucker simplification (0 = no simplification) */
  simplifyTolerance?: number
  /** Cost for traversing a non-edge pixel (higher = avoid more) */
  nonEdgeCost?: number
  /** Allow diagonal movement */
  allowDiagonal?: boolean
}

export const DEFAULT_PATH_OPTIONS: Required<PathFinderOptions> = {
  maxIterations: 100000,
  smoothing: true,
  simplifyTolerance: 0.5,
  nonEdgeCost: 100,
  allowDiagonal: true,
}

// ============================================================================
// AutoScan Input/Output
// ============================================================================

export interface AutoScanInput {
  /** Absolute path to the image file */
  imagePath: string
  /** Anchor points for path finding (normalized 0-1, 2 or more points) */
  anchorPoints: NormalizedPoint[]
  /** Optional Canny parameters override */
  cannyParams?: Partial<CannyParameters>
  /** Optional path finder options override */
  pathOptions?: Partial<PathFinderOptions>
  /** Optional target color for color-guided detection */
  targetColor?: { r: number; g: number; b: number }
  /** Tolerance for color matching (0-255) */
  colorTolerance?: number
}

export interface AutoScanResult {
  /** Whether the scan succeeded */
  success: boolean
  /** Detected polyline points (normalized 0-1) */
  points: NormalizedPoint[]
  /** Confidence score (0-1): percentage of path on detected edges */
  confidence: number
  /** Error message if success is false */
  error?: string
  /** Debug information */
  debugInfo?: {
    /** Base64 encoded edge map image (for visualization) */
    edgeMapBase64?: string
    /** Total path cost from A* */
    pathCost: number
    /** Number of points before simplification */
    rawPointCount: number
    /** Number of points after simplification */
    simplifiedPointCount: number
    /** Processing time in milliseconds */
    processingTimeMs: number
  }
}

// ============================================================================
// Pixel Point (for internal use)
// ============================================================================

export interface PixelPoint {
  x: number
  y: number
}

// ============================================================================
// OpenCV Status
// ============================================================================

export interface OpenCVStatus {
  loaded: boolean
  loading: boolean
  error?: string
  version?: string
}

// ============================================================================
// IPC Types (for Electron communication)
// ============================================================================

export interface AutoScanIpcInput {
  imagePath: string
  anchorPoints: NormalizedPoint[]
  cannyParams?: Partial<CannyParameters>
  pathOptions?: Partial<PathFinderOptions>
}

export interface AutoScanIpcResponse {
  success: boolean
  data?: AutoScanResult
  error?: string
}
