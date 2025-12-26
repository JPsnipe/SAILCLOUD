/**
 * Edge Detection using OpenCV.js
 *
 * Provides Canny edge detection on images.
 * Requires OpenCV.js to be loaded first.
 */

import type { CannyParameters, EdgeMap } from './types'
import { DEFAULT_CANNY_PARAMS } from './types'

// OpenCV.js global reference (loaded dynamically)
type OpenCVSize = unknown
type OpenCVPoint = unknown

type OpenCVMat = {
  data: Uint8Array
  rows: number
  cols: number
  type: () => number
  ucharAt: (row: number, col: number) => number
  delete: () => void
}

type OpenCVMatConstructor = {
  new (): OpenCVMat
  new (rows: number, cols: number, type: number, scalar?: number[]): OpenCVMat
  ones: (rows: number, cols: number, type: number) => OpenCVMat
}

type OpenCV = {
  Mat: OpenCVMatConstructor
  Size: new (width: number, height: number) => OpenCVSize
  Point: new (x: number, y: number) => OpenCVPoint
  CV_8UC4: number
  CV_8U: number
  COLOR_RGBA2GRAY: number
  BORDER_CONSTANT: number
  cvtColor: (src: OpenCVMat, dst: OpenCVMat, code: number) => void
  GaussianBlur: (src: OpenCVMat, dst: OpenCVMat, ksize: OpenCVSize, sigmaX: number) => void
  Canny: (src: OpenCVMat, dst: OpenCVMat, threshold1: number, threshold2: number, apertureSize: number, L2gradient: boolean) => void
  inRange: (src: OpenCVMat, low: OpenCVMat, high: OpenCVMat, dst: OpenCVMat) => void
  dilate: (...args: unknown[]) => void
  morphologyDefaultBorderValue: () => unknown
  bitwise_and: (src: OpenCVMat, mask: OpenCVMat, dst: OpenCVMat) => void
}

declare const cv: OpenCV

/**
 * Check if OpenCV is available
 */
export function isOpenCVAvailable(): boolean {
  return typeof cv !== 'undefined' && cv.Mat !== undefined
}

/**
 * Convert ImageData to OpenCV Mat
 */
function imageDataToMat(imageData: ImageData) {
  const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4)
  mat.data.set(imageData.data)
  return mat
}

/**
 * Convert grayscale Mat to EdgeMap
 */
function matToEdgeMap(mat: OpenCVMat): EdgeMap {
  const width = mat.cols
  const height = mat.rows
  const data = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = mat.ucharAt(y, x)
    }
  }

  return { width, height, data }
}

/**
 * Detect edges in an image using Canny algorithm, optionally guided by color
 *
 * @param imageData - Source image as ImageData
 * @param params - Canny parameters (thresholds, aperture)
 * @param targetColor - Optional target RGB color to filter for
 * @param colorTolerance - Tolerance for color matching
 * @returns EdgeMap with binary edge data
 */
export function detectEdges(
  imageData: ImageData,
  params: Partial<CannyParameters> = {},
  targetColor?: { r: number; g: number; b: number },
  colorTolerance: number = 60,
): EdgeMap {
  if (!isOpenCVAvailable()) {
    throw new Error('OpenCV is not loaded. Call loadOpenCV() first.')
  }

  const p = { ...DEFAULT_CANNY_PARAMS, ...params }

  // Convert to OpenCV Mat
  const src = imageDataToMat(imageData)

  // 1. Color filtering if targetColor is provided
  let colorMask: OpenCVMat | null = null
  if (targetColor) {
    const low = new cv.Mat(src.rows, src.cols, src.type(), [
      Math.max(0, targetColor.r - colorTolerance),
      Math.max(0, targetColor.g - colorTolerance),
      Math.max(0, targetColor.b - colorTolerance),
      0,
    ])
    const high = new cv.Mat(src.rows, src.cols, src.type(), [
      Math.min(255, targetColor.r + colorTolerance),
      Math.min(255, targetColor.g + colorTolerance),
      Math.min(255, targetColor.b + colorTolerance),
      255,
    ])

    colorMask = new cv.Mat()
    cv.inRange(src, low, high, colorMask)

    low.delete()
    high.delete()
  }

  // 2. Grayscale and Blur
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

  const blurred = new cv.Mat()
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)

  // 3. Canny
  const edges = new cv.Mat()
  cv.Canny(blurred, edges, p.threshold1, p.threshold2, p.apertureSize, p.L2gradient)

  // 4. Combine if mask exists
  if (colorMask) {
    // Dilate mask slightly to be more forgiving with edge locations
    const M = cv.Mat.ones(3, 3, cv.CV_8U)
    const anchor = new cv.Point(-1, -1)
    cv.dilate(colorMask, colorMask, M, anchor, 2, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
    M.delete()

    // bitwise_and to only keep edges that are within the color mask
    cv.bitwise_and(edges, colorMask, edges)
    colorMask.delete()
  }

  // Convert to EdgeMap
  const edgeMap = matToEdgeMap(edges)

  // Clean up OpenCV matrices
  src.delete()
  gray.delete()
  blurred.delete()
  edges.delete()

  return edgeMap
}

/**
 * Convert EdgeMap to base64 PNG for visualization
 */
export function edgeMapToBase64(edgeMap: EdgeMap): string {
  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = edgeMap.width
  canvas.height = edgeMap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  // Create ImageData
  const imgData = ctx.createImageData(edgeMap.width, edgeMap.height)

  for (let i = 0; i < edgeMap.data.length; i++) {
    const value = edgeMap.data[i]
    const idx = i * 4
    imgData.data[idx] = value // R
    imgData.data[idx + 1] = value // G
    imgData.data[idx + 2] = value // B
    imgData.data[idx + 3] = 255 // A
  }

  ctx.putImageData(imgData, 0, 0)

  return canvas.toDataURL('image/png')
}

/**
 * Load image from path and return as ImageData
 * (For use in Electron renderer process)
 */
export async function loadImageAsImageData(imagePath: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      resolve(imageData)
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imagePath}`))
    }

    // For Electron, use file:// protocol
    img.src = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`
  })
}

/**
 * Resize image if it exceeds maximum dimension
 * Returns resized ImageData and scale factor
 */
export function resizeIfNeeded(
  imageData: ImageData,
  maxDimension: number = 2048,
): { imageData: ImageData; scale: number } {
  const { width, height } = imageData
  const maxDim = Math.max(width, height)

  if (maxDim <= maxDimension) {
    return { imageData, scale: 1 }
  }

  const scale = maxDimension / maxDim
  const newWidth = Math.round(width * scale)
  const newHeight = Math.round(height * scale)

  // Create canvas for resizing
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = width
  srcCanvas.height = height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(imageData, 0, 0)

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = newWidth
  dstCanvas.height = newHeight
  const dstCtx = dstCanvas.getContext('2d')!
  dstCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight)

  const resizedData = dstCtx.getImageData(0, 0, newWidth, newHeight)

  return { imageData: resizedData, scale }
}
