/**
 * Sail Heatmap Visualization
 *
 * Displays a 2D heatmap of sail shape showing camber distribution.
 * Inspired by TheSailCloud's reconstructed sail visualization.
 *
 * The heatmap shows:
 * - Sail outline (from stripes)
 * - Color gradient representing camber depth
 * - Color scale legend
 */

import { useMemo } from 'react'
import type { PhotoAnalysis, NormalizedPoint } from '../shared/domain'
import { calculateCamber } from '../lib/metrics/camber'
import { getCatmullRomSpline } from '../lib/metrics/geometry'

interface SailHeatmapProps {
  analysis: PhotoAnalysis | null
  width?: number
  height?: number
  colorScheme?: 'viridis' | 'thermal' | 'blues'
}

// Color schemes for the heatmap
const COLOR_SCHEMES = {
  viridis: [
    { stop: 0, color: '#440154' },    // Dark purple
    { stop: 0.15, color: '#482878' },
    { stop: 0.3, color: '#3e4989' },
    { stop: 0.45, color: '#31688e' },
    { stop: 0.6, color: '#26828e' },
    { stop: 0.75, color: '#1f9e89' },
    { stop: 0.85, color: '#35b779' },
    { stop: 0.92, color: '#6ece58' },
    { stop: 1, color: '#fde725' },     // Yellow
  ],
  thermal: [
    { stop: 0, color: '#000033' },     // Dark blue
    { stop: 0.2, color: '#0000ff' },   // Blue
    { stop: 0.4, color: '#00ffff' },   // Cyan
    { stop: 0.5, color: '#00ff00' },   // Green
    { stop: 0.6, color: '#ffff00' },   // Yellow
    { stop: 0.8, color: '#ff8800' },   // Orange
    { stop: 1, color: '#ff0000' },     // Red
  ],
  blues: [
    { stop: 0, color: '#f7fbff' },
    { stop: 0.2, color: '#deebf7' },
    { stop: 0.4, color: '#c6dbef' },
    { stop: 0.6, color: '#9ecae1' },
    { stop: 0.8, color: '#6baed6' },
    { stop: 0.9, color: '#3182bd' },
    { stop: 1, color: '#08519c' },
  ],
}

interface StripeData {
  heightPct: number
  points: NormalizedPoint[]
  camberPct: number
  draftPositionPct: number
}

function extractStripeHeight(label: string): number | null {
  const match = label.match(/\((\d+(?:\.\d+)?)%\)/)
  return match ? parseFloat(match[1]) : null
}

export function SailHeatmap({
  analysis,
  width = 300,
  height = 400,
  colorScheme = 'viridis',
}: SailHeatmapProps) {
  // Extract and analyze stripes
  const stripeData = useMemo<StripeData[]>(() => {
    if (!analysis) return []

    const stripeLayers = analysis.layers.filter(
      (l) => l.label.startsWith('Stripe') && l.points.length >= 3
    )

    return stripeLayers
      .map((layer) => {
        const heightPct = extractStripeHeight(layer.label)
        if (heightPct === null) return null

        const camber = calculateCamber(
          layer.points,
          layer.points[0],
          layer.points[layer.points.length - 1]
        )

        return {
          heightPct,
          points: layer.points,
          camberPct: camber.camberPct,
          draftPositionPct: camber.draftPositionPct,
        }
      })
      .filter((s): s is StripeData => s !== null)
      .sort((a, b) => a.heightPct - b.heightPct)
  }, [analysis])

  // Calculate max camber for color scaling
  const maxCamber = useMemo(() => {
    if (stripeData.length === 0) return 15
    return Math.max(...stripeData.map((s) => s.camberPct), 15)
  }, [stripeData])

  // Generate sail outline and heatmap data
  const heatmapData = useMemo(() => {
    if (stripeData.length < 2) return null

    // Create sail shape by connecting stripe endpoints
    const luffPoints: NormalizedPoint[] = []
    const leechPoints: NormalizedPoint[] = []

    for (const stripe of stripeData) {
      luffPoints.push(stripe.points[0])
      leechPoints.push(stripe.points[stripe.points.length - 1])
    }

    // Generate smooth curves for luff and leech
    const smoothLuff = luffPoints.length >= 3 ? getCatmullRomSpline(luffPoints, 8) : luffPoints
    const smoothLeech = leechPoints.length >= 3 ? getCatmullRomSpline(leechPoints, 8) : leechPoints

    // Create grid for heatmap interpolation
    const gridRows = 50
    const gridCols = 30
    const grid: Array<Array<{ x: number; y: number; camber: number }>> = []

    for (let row = 0; row < gridRows; row++) {
      const rowData: Array<{ x: number; y: number; camber: number }> = []
      const heightPct = (row / (gridRows - 1)) * 100

      // Find surrounding stripes for interpolation
      let lowerStripe: StripeData | null = null
      let upperStripe: StripeData | null = null

      for (let i = 0; i < stripeData.length; i++) {
        if (stripeData[i].heightPct <= heightPct) {
          lowerStripe = stripeData[i]
        }
        if (stripeData[i].heightPct >= heightPct && !upperStripe) {
          upperStripe = stripeData[i]
        }
      }

      // Use boundary stripes if outside range
      if (!lowerStripe) lowerStripe = stripeData[0]
      if (!upperStripe) upperStripe = stripeData[stripeData.length - 1]

      // Interpolate camber between stripes
      let interpolatedCamber: number
      let interpolatedDraft: number

      if (lowerStripe === upperStripe) {
        interpolatedCamber = lowerStripe.camberPct
        interpolatedDraft = lowerStripe.draftPositionPct
      } else {
        const t = (heightPct - lowerStripe.heightPct) / (upperStripe.heightPct - lowerStripe.heightPct)
        interpolatedCamber = lowerStripe.camberPct + t * (upperStripe.camberPct - lowerStripe.camberPct)
        interpolatedDraft = lowerStripe.draftPositionPct + t * (upperStripe.draftPositionPct - lowerStripe.draftPositionPct)
      }

      // Interpolate x positions
      const luffT = row / (gridRows - 1)
      const luffIdx = Math.min(Math.floor(luffT * (smoothLuff.length - 1)), smoothLuff.length - 1)
      const leechIdx = Math.min(Math.floor(luffT * (smoothLeech.length - 1)), smoothLeech.length - 1)

      const luffX = smoothLuff[luffIdx]?.x ?? 0
      const leechX = smoothLeech[leechIdx]?.x ?? 1
      const luffY = smoothLuff[luffIdx]?.y ?? luffT
      const leechY = smoothLeech[leechIdx]?.y ?? luffT

      for (let col = 0; col < gridCols; col++) {
        const colT = col / (gridCols - 1)
        const x = luffX + colT * (leechX - luffX)
        const y = luffY + colT * (leechY - luffY)

        // Calculate camber at this point (bell curve distribution)
        const distFromDraft = Math.abs(colT * 100 - interpolatedDraft)
        const camberFactor = Math.exp(-(distFromDraft * distFromDraft) / (2 * 25 * 25))
        const localCamber = interpolatedCamber * camberFactor

        rowData.push({ x, y, camber: localCamber })
      }

      grid.push(rowData)
    }

    return {
      luff: smoothLuff,
      leech: smoothLeech,
      grid,
    }
  }, [stripeData])

  // Get color for camber value
  function getCamberColor(camber: number): string {
    const scheme = COLOR_SCHEMES[colorScheme]
    const normalizedValue = Math.min(camber / maxCamber, 1)

    // Find color stops
    let lowerStop = scheme[0]
    let upperStop = scheme[scheme.length - 1]

    for (let i = 0; i < scheme.length - 1; i++) {
      if (scheme[i].stop <= normalizedValue && scheme[i + 1].stop >= normalizedValue) {
        lowerStop = scheme[i]
        upperStop = scheme[i + 1]
        break
      }
    }

    // Interpolate between stops
    const t = (normalizedValue - lowerStop.stop) / (upperStop.stop - lowerStop.stop || 1)
    return interpolateColor(lowerStop.color, upperStop.color, t)
  }

  if (!analysis || stripeData.length < 2 || !heatmapData) {
    // Count stripes with data for better feedback
    const stripeLayers = analysis?.layers.filter((l) => l.label.startsWith('Stripe')) ?? []
    const stripesWithEnoughPoints = stripeLayers.filter((l) => l.points.length >= 3)
    const stripesWithSomePoints = stripeLayers.filter((l) => l.points.length > 0 && l.points.length < 3)

    return (
      <div className="sail-heatmap-empty">
        <div className="muted">
          {stripeLayers.length === 0 ? (
            'No stripes defined. Add stripes in Measure tab.'
          ) : stripesWithEnoughPoints.length < 2 ? (
            <>
              <div>Need at least 2 stripes with 3+ points each</div>
              <div className="small mt-sm">
                {stripesWithEnoughPoints.length} stripe(s) ready •
                {stripesWithSomePoints.length > 0 && ` ${stripesWithSomePoints.length} need more points`}
              </div>
              <div className="small mt-sm">
                Stripes: {stripeLayers.map(l => `${l.label.split(' ')[1]?.split('(')[0] || '?'}(${l.points.length}pts)`).join(', ')}
              </div>
            </>
          ) : (
            'Processing stripes...'
          )}
        </div>
      </div>
    )
  }

  // Calculate bounding box for the sail
  const allPoints = [...heatmapData.luff, ...heatmapData.leech]
  const minX = Math.min(...allPoints.map((p) => p.x))
  const maxX = Math.max(...allPoints.map((p) => p.x))
  const minY = Math.min(...allPoints.map((p) => p.y))
  const maxY = Math.max(...allPoints.map((p) => p.y))

  const padding = 0.05
  const viewMinX = minX - padding
  const viewMaxX = maxX + padding
  const viewMinY = minY - padding
  const viewMaxY = maxY + padding
  const viewWidth = viewMaxX - viewMinX
  const viewHeight = viewMaxY - viewMinY

  // Transform points to SVG coordinates
  const toSvgX = (x: number) => ((x - viewMinX) / viewWidth) * width
  const toSvgY = (y: number) => ((y - viewMinY) / viewHeight) * height

  return (
    <div className="sail-heatmap">
      <div className="sail-heatmap-container">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="sail-heatmap-svg"
        >
          <defs>
            {/* Gradient for legend */}
            <linearGradient id="heatmap-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
              {COLOR_SCHEMES[colorScheme].map((stop, i) => (
                <stop key={i} offset={`${stop.stop * 100}%`} stopColor={stop.color} />
              ))}
            </linearGradient>

            {/* Clip path for sail shape */}
            <clipPath id="sail-clip">
              <path
                d={`
                  M ${toSvgX(heatmapData.luff[0].x)} ${toSvgY(heatmapData.luff[0].y)}
                  ${heatmapData.luff.map((p) => `L ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(' ')}
                  ${heatmapData.leech.slice().reverse().map((p) => `L ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(' ')}
                  Z
                `}
              />
            </clipPath>
          </defs>

          {/* Heatmap cells */}
          <g clipPath="url(#sail-clip)">
            {heatmapData.grid.map((row, rowIdx) =>
              row.map((cell, colIdx) => {
                if (rowIdx >= heatmapData.grid.length - 1 || colIdx >= row.length - 1) return null
                const nextRow = heatmapData.grid[rowIdx + 1]
                const nextCol = row[colIdx + 1]
                const nextDiag = nextRow[colIdx + 1]

                const avgCamber = (cell.camber + nextCol.camber + nextRow[colIdx].camber + nextDiag.camber) / 4

                return (
                  <polygon
                    key={`${rowIdx}-${colIdx}`}
                    points={`
                      ${toSvgX(cell.x)},${toSvgY(cell.y)}
                      ${toSvgX(nextCol.x)},${toSvgY(nextCol.y)}
                      ${toSvgX(nextDiag.x)},${toSvgY(nextDiag.y)}
                      ${toSvgX(nextRow[colIdx].x)},${toSvgY(nextRow[colIdx].y)}
                    `}
                    fill={getCamberColor(avgCamber)}
                    stroke="none"
                  />
                )
              })
            )}
          </g>

          {/* Sail outline */}
          <path
            d={`
              M ${toSvgX(heatmapData.luff[0].x)} ${toSvgY(heatmapData.luff[0].y)}
              ${heatmapData.luff.map((p) => `L ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(' ')}
              ${heatmapData.leech.slice().reverse().map((p) => `L ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(' ')}
              Z
            `}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={2}
          />

          {/* Stripe lines */}
          {stripeData.map((stripe, idx) => {
            const smoothedPoints = stripe.points.length >= 3
              ? getCatmullRomSpline(stripe.points, 5)
              : stripe.points

            return (
              <polyline
                key={idx}
                points={smoothedPoints.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )
          })}

          {/* Max camber points */}
          {stripeData.map((stripe, idx) => {
            const camber = calculateCamber(
              stripe.points,
              stripe.points[0],
              stripe.points[stripe.points.length - 1]
            )
            return (
              <circle
                key={idx}
                cx={toSvgX(camber.maxDeflectionPoint.x)}
                cy={toSvgY(camber.maxDeflectionPoint.y)}
                r={4}
                fill="#fff"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {/* Color Legend */}
        <div className="sail-heatmap-legend">
          <div className="sail-heatmap-legend-bar">
            <div
              className="sail-heatmap-legend-gradient"
              style={{
                background: `linear-gradient(to top, ${COLOR_SCHEMES[colorScheme].map((s) => s.color).join(', ')})`,
              }}
            />
          </div>
          <div className="sail-heatmap-legend-labels">
            <span>{maxCamber.toFixed(0)}%</span>
            <span>{(maxCamber * 0.75).toFixed(0)}%</span>
            <span>{(maxCamber * 0.5).toFixed(0)}%</span>
            <span>{(maxCamber * 0.25).toFixed(0)}%</span>
            <span>0%</span>
          </div>
        </div>
      </div>

      {/* Stripe metrics table */}
      <div className="sail-heatmap-table">
        <table>
          <thead>
            <tr>
              <th>Height(%)</th>
              <th>Camber</th>
              <th>Draft</th>
            </tr>
          </thead>
          <tbody>
            {stripeData.map((stripe, idx) => (
              <tr key={idx}>
                <td>{stripe.heightPct}</td>
                <td>{stripe.camberPct.toFixed(1)}%</td>
                <td>{stripe.draftPositionPct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Helper: Interpolate between two hex colors
function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)

  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  const r = Math.round(r1 + t * (r2 - r1))
  const g = Math.round(g1 + t * (g2 - g1))
  const b = Math.round(b1 + t * (b2 - b1))

  return `rgb(${r},${g},${b})`
}
