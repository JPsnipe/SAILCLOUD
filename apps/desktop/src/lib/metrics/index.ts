/**
 * Sail Metrics Module
 *
 * Complete sail shape analysis toolkit based on:
 * - SailTool (CMST - Australian Yachting Federation)
 * - SailVis (Eurographics 2021) - 3D reconstruction, 2D profiles
 * - Deparday et al. - Photogrammetry with markers
 * - VSPARS - Multi-camera stripe tracking
 *
 * Key Metrics:
 * - Camber (depth %) - Max perpendicular distance from chord as % of chord length
 * - Draft Position (%) - Location of max depth along chord (0% = luff, 100% = leech)
 * - Entry/Exit Angle - Tangent angles at luff and leech
 * - Front/Back % - Distribution of camber area
 * - Twist - Angle difference between stripes at different heights
 */

// Types
export type {
  MetricType,
  Measurement,
  CamberResult,
  TwistResult,
  MastBendResult,
  AngleResult,
  SailAnalysisResult,
  ScaleReference,
  CalculationOptions,
} from './types'

export { DEFAULT_CALCULATION_OPTIONS } from './types'

// Geometry utilities
export {
  distance,
  lineAngleDeg,
  perpendicularDistance,
  tangentAngleDeg,
  entryAngleDeg,
  exitAngleDeg,
  normalizeAngle,
  findMaxDeflection,
  calculateDeflectionProfile,
  calculateFrontBackDistribution,
  smoothCurve,
  resampleCurve,
  calculateScaleFactor,
  normalizedToReal,
} from './geometry'

// Camber calculations
export {
  calculateCamber,
  classifyCamber,
  classifyDraftPosition,
  compareCamber,
} from './camber'

// Twist calculations
export {
  calculateTwist,
  calculateTwistFromCurves,
  calculateTwistFromHorizontal,
  calculateMultiStripeTwist,
  classifyTwist,
  recommendedTwist,
} from './twist'

// High-level analyzer
export {
  analyzePhoto,
  analyzeStripe,
  generateMetricsSummary,
  comparePhotos,
} from './analyzer'

export type { MetricsSummary, PhotoComparison } from './analyzer'

// Mast bend analysis
export {
  analyzeMastBend,
  generateMastMetricsSummary,
  isMastScene,
  getMastCurveLayers,
} from './mastBend'

export type { MastBendPoint, MastBendAnalysis, MastMetricsSummary } from './mastBend'
