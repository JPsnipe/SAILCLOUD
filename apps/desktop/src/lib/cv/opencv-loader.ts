/**
 * OpenCV.js Dynamic Loader
 *
 * Handles lazy loading of OpenCV.js WebAssembly module.
 * OpenCV.js is loaded on-demand to reduce initial bundle size.
 */

import type { OpenCVStatus } from './types'

// Module state
let status: OpenCVStatus = {
  loaded: false,
  loading: false,
}

// Promise for tracking load completion
let loadPromise: Promise<void> | null = null

/**
 * Get current OpenCV loading status
 */
export function getOpenCVStatus(): OpenCVStatus {
  return { ...status }
}

/**
 * Check if OpenCV is loaded and ready
 */
export function isOpenCVReady(): boolean {
  return status.loaded && !status.error
}

/**
 * Load OpenCV.js dynamically
 *
 * This function loads the OpenCV.js WASM module from the public folder.
 * It only loads once and caches the result.
 *
 * @returns Promise that resolves when OpenCV is ready
 */
export async function loadOpenCV(): Promise<void> {
  // Already loaded
  if (status.loaded) {
    return
  }

  // Already loading - wait for existing promise
  if (loadPromise) {
    return loadPromise
  }

  status = { ...status, loading: true, error: undefined }

  loadPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded (in case of HMR or multiple calls)
    if (typeof (window as { cv?: unknown }).cv !== 'undefined') {
      status = { loaded: true, loading: false }
      resolve()
      return
    }

    // Create script element
    const script = document.createElement('script')
    // Loading from official docs CDN to ensure it works even if local files are missing
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js'
    script.async = true

      // OpenCV.js initialization callback
      ; (window as { Module?: { onRuntimeInitialized?: () => void } }).Module = {
        onRuntimeInitialized: () => {
          console.log('OpenCV.js runtime initialized')

          // Get version if available
          const cv = (window as { cv?: { getBuildInformation?: () => string } }).cv
          let version: string | undefined
          if (cv?.getBuildInformation) {
            const info = cv.getBuildInformation()
            const match = info.match(/OpenCV\s+([\d.]+)/)
            version = match?.[1]
          }

          status = {
            loaded: true,
            loading: false,
            version,
          }
          resolve()
        },
      }

    script.onload = () => {
      console.log('OpenCV.js script loaded, waiting for runtime...')
      // Runtime initialization is handled by Module.onRuntimeInitialized
    }

    script.onerror = (error) => {
      console.error('Failed to load OpenCV.js:', error)
      status = {
        loaded: false,
        loading: false,
        error: 'Failed to load OpenCV.js script',
      }
      reject(new Error('Failed to load OpenCV.js'))
    }

    // Append to document
    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * Ensure OpenCV is loaded before running a function
 *
 * @param fn - Function to run after OpenCV is loaded
 * @returns Result of the function
 */
export async function withOpenCV<T>(fn: () => T | Promise<T>): Promise<T> {
  await loadOpenCV()
  return fn()
}
