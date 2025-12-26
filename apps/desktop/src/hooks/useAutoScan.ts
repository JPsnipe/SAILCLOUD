/**
 * React Hook for AutoScan functionality
 *
 * Provides a convenient interface to the CV module for automatic
 * edge detection in sail/mast photographs.
 */

import { useState, useCallback } from 'react'
import type { NormalizedPoint } from '../shared/domain'
import type { AutoScanResult, CannyParameters, OpenCVStatus } from '../lib/cv'
import { runAutoScan, loadOpenCV, getOpenCVStatus, isOpenCVReady } from '../lib/cv'

export interface UseAutoScanState {
  /** Current OpenCV loading status */
  cvStatus: OpenCVStatus
  /** Whether an AutoScan is currently running */
  isScanning: boolean
  /** Last scan result */
  lastResult: AutoScanResult | null
  /** Error message if any */
  error: string | null
}

export interface UseAutoScanActions {
  /** Load OpenCV.js (call before scanning) */
  loadCV: () => Promise<void>
  /** Run AutoScan on an image */
  scan: (
    imagePath: string,
    anchorPoints: NormalizedPoint[],
    cannyParams?: Partial<CannyParameters>,
    targetColor?: { r: number; g: number; b: number },
    colorTolerance?: number,
  ) => Promise<AutoScanResult>
  /** Clear last result and error */
  reset: () => void
}

export type UseAutoScanReturn = UseAutoScanState & UseAutoScanActions

/**
 * Hook for using AutoScan in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { cvStatus, isScanning, scan, loadCV } = useAutoScan()
 *
 *   useEffect(() => {
 *     loadCV() // Pre-load OpenCV
 *   }, [])
 *
 *   const handleScan = async () => {
 *     const result = await scan(imagePath, start, end)
 *     if (result.success) {
 *       console.log('Detected points:', result.points)
 *     }
 *   }
 * }
 * ```
 */
export function useAutoScan(): UseAutoScanReturn {
  const [cvStatus, setCvStatus] = useState<OpenCVStatus>(getOpenCVStatus())
  const [isScanning, setIsScanning] = useState(false)
  const [lastResult, setLastResult] = useState<AutoScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCV = useCallback(async () => {
    if (isOpenCVReady()) {
      setCvStatus(getOpenCVStatus())
      return
    }

    setCvStatus({ loaded: false, loading: true })
    try {
      await loadOpenCV()
      setCvStatus(getOpenCVStatus())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load OpenCV'
      setCvStatus({ loaded: false, loading: false, error: message })
      setError(message)
    }
  }, [])

  const scan = useCallback(
    async (
      imagePath: string,
      anchorPoints: NormalizedPoint[],
      cannyParams?: Partial<CannyParameters>,
      targetColor?: { r: number; g: number; b: number },
      colorTolerance?: number,
    ): Promise<AutoScanResult> => {
      setIsScanning(true)
      setError(null)

      try {
        // Ensure OpenCV is loaded
        if (!isOpenCVReady()) {
          await loadCV()
        }

        const result = await runAutoScan({
          imagePath,
          anchorPoints,
          cannyParams,
          targetColor,
          colorTolerance,
        })

        setLastResult(result)

        if (!result.success) {
          setError(result.error ?? 'AutoScan failed')
        }

        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AutoScan error'
        setError(message)

        const failResult: AutoScanResult = {
          success: false,
          points: [],
          confidence: 0,
          error: message,
        }
        setLastResult(failResult)
        return failResult
      } finally {
        setIsScanning(false)
      }
    },
    [loadCV]
  )

  const reset = useCallback(() => {
    setLastResult(null)
    setError(null)
  }, [])

  return {
    cvStatus,
    isScanning,
    lastResult,
    error,
    loadCV,
    scan,
    reset,
  }
}

export default useAutoScan
