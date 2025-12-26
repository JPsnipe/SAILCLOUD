/**
 * Compare Page
 *
 * Allows comparing sail shapes between different photos, sails, or boats.
 * Inspired by TheSailCloud comparison features.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BoatProject, BoatSummary, Photo, PhotoAnalysis } from '../shared/domain'
import { generateMetricsSummary, comparePhotos, type MetricsSummary, type PhotoComparison } from '../lib/metrics'

interface PhotoSelection {
  boatId: string
  boatName: string
  photoId: string
  photoName: string
  analysis: PhotoAnalysis | null
  thumbUrl: string
}

function toFileUrl(absPath: string) {
  const normalized = absPath.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized}`)
}

export function ComparePage() {
  const [boats, setBoats] = useState<BoatSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Selection state
  const [leftSelection, setLeftSelection] = useState<PhotoSelection | null>(null)
  const [rightSelection, setRightSelection] = useState<PhotoSelection | null>(null)

  // Selector modal state
  const [selectorOpen, setSelectorOpen] = useState<'left' | 'right' | null>(null)
  const [selectorBoatId, setSelectorBoatId] = useState<string>('')
  const [selectorProject, setSelectorProject] = useState<BoatProject | null>(null)
  const [selectorPhotos, setSelectorPhotos] = useState<Array<{ photo: Photo; thumbUrl: string }>>([])

  // Load boats list
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await window.sailcloud.listBoats()
        if (!cancelled) setBoats(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load boats')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  // Load photos when boat is selected in selector
  const loadBoatPhotos = useCallback(async (boatId: string) => {
    if (!boatId) {
      setSelectorProject(null)
      setSelectorPhotos([])
      return
    }

    try {
      const project = await window.sailcloud.getBoatProject(boatId)
      setSelectorProject(project)

      // Load thumbnail URLs
      const photosWithThumbs = await Promise.all(
        project.photos.map(async (photo) => {
          try {
            const absPath = await window.sailcloud.getPhotoPath(boatId, photo.id)
            return { photo, thumbUrl: toFileUrl(absPath) }
          } catch {
            return { photo, thumbUrl: '' }
          }
        })
      )

      setSelectorPhotos(photosWithThumbs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boat photos')
    }
  }, [])

  useEffect(() => {
    if (selectorOpen && selectorBoatId) {
      void loadBoatPhotos(selectorBoatId)
    }
  }, [selectorOpen, selectorBoatId, loadBoatPhotos])

  function openSelector(side: 'left' | 'right') {
    setSelectorOpen(side)
    setSelectorBoatId('')
    setSelectorProject(null)
    setSelectorPhotos([])
  }

  function closeSelector() {
    setSelectorOpen(null)
  }

  async function selectPhoto(photo: Photo, thumbUrl: string) {
    if (!selectorOpen || !selectorProject) return

    const selection: PhotoSelection = {
      boatId: selectorProject.boat.id,
      boatName: selectorProject.boat.name,
      photoId: photo.id,
      photoName: photo.name ?? photo.fileName,
      analysis: photo.analysis ?? null,
      thumbUrl,
    }

    if (selectorOpen === 'left') {
      setLeftSelection(selection)
    } else {
      setRightSelection(selection)
    }

    closeSelector()
  }

  // Calculate metrics for both selections
  const leftMetrics = useMemo<MetricsSummary | null>(() => {
    if (!leftSelection?.analysis) return null
    try {
      return generateMetricsSummary(leftSelection.analysis)
    } catch {
      return null
    }
  }, [leftSelection])

  const rightMetrics = useMemo<MetricsSummary | null>(() => {
    if (!rightSelection?.analysis) return null
    try {
      return generateMetricsSummary(rightSelection.analysis)
    } catch {
      return null
    }
  }, [rightSelection])

  // Compare both analyses
  const comparison = useMemo<PhotoComparison | null>(() => {
    if (!leftSelection?.analysis || !rightSelection?.analysis) return null
    try {
      return comparePhotos(leftSelection.analysis, rightSelection.analysis)
    } catch {
      return null
    }
  }, [leftSelection, rightSelection])

  return (
    <div className="page page-full">
      <div className="page-header">
        <div className="row">
          <Link className="btn btn-secondary btn-small" to="/">
            Back
          </Link>
          <h1 className="h1">Compare Sails</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="muted">Loading...</div>
      ) : (
        <>
          {/* Selection Cards */}
          <div className="compare-grid">
            <SelectionCard
              side="left"
              selection={leftSelection}
              metrics={leftMetrics}
              onSelect={() => openSelector('left')}
              onClear={() => setLeftSelection(null)}
            />
            <SelectionCard
              side="right"
              selection={rightSelection}
              metrics={rightMetrics}
              onSelect={() => openSelector('right')}
              onClear={() => setRightSelection(null)}
            />
          </div>

          {/* Comparison Results */}
          {leftMetrics && rightMetrics && comparison && (
            <ComparisonResults
              left={leftMetrics}
              right={rightMetrics}
              leftName={leftSelection?.photoName ?? 'Left'}
              rightName={rightSelection?.photoName ?? 'Right'}
              comparison={comparison}
            />
          )}

          {/* Selector Modal */}
          {selectorOpen && (
            <div className="modal-backdrop" onClick={closeSelector}>
              <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Select Photo ({selectorOpen === 'left' ? 'Left' : 'Right'})</div>

                <div className="field mt">
                  <div className="label">Select Boat</div>
                  <select
                    className="select"
                    value={selectorBoatId}
                    onChange={(e) => setSelectorBoatId(e.target.value)}
                  >
                    <option value="">Choose a boat...</option>
                    {boats.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {selectorProject && (
                  <div className="mt">
                    <div className="label">Select Photo</div>
                    {selectorPhotos.length === 0 ? (
                      <div className="muted">No photos in this boat.</div>
                    ) : (
                      <div className="selector-photo-grid">
                        {selectorPhotos
                          .filter((p) => p.photo.analysis && p.photo.analysis.layers.some(l => l.label.startsWith('Stripe') && l.points.length >= 3))
                          .map(({ photo, thumbUrl }) => (
                            <button
                              key={photo.id}
                              className="selector-photo-card"
                              onClick={() => void selectPhoto(photo, thumbUrl)}
                            >
                              {thumbUrl ? (
                                <img src={thumbUrl} alt={photo.name ?? photo.fileName} />
                              ) : (
                                <div className="selector-photo-placeholder">No preview</div>
                              )}
                              <div className="selector-photo-name">{photo.name ?? photo.fileName}</div>
                              {photo.analysis?.sceneType && (
                                <div className="selector-photo-scene">{photo.analysis.sceneType}</div>
                              )}
                            </button>
                          ))}
                        {selectorPhotos.filter(p => p.photo.analysis && p.photo.analysis.layers.some(l => l.label.startsWith('Stripe') && l.points.length >= 3)).length === 0 && (
                          <div className="muted">No analyzed photos with stripe data found.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="row end mt">
                  <button className="btn btn-secondary" onClick={closeSelector}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SelectionCard({
  side,
  selection,
  metrics,
  onSelect,
  onClear,
}: {
  side: 'left' | 'right'
  selection: PhotoSelection | null
  metrics: MetricsSummary | null
  onSelect: () => void
  onClear: () => void
}) {
  if (!selection) {
    return (
      <div className="compare-card compare-card-empty">
        <div className="compare-card-placeholder">
          <div className="compare-card-label">{side === 'left' ? 'Photo A' : 'Photo B'}</div>
          <button className="btn" onClick={onSelect}>
            Select Photo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="compare-card">
      <div className="compare-card-header">
        <div>
          <div className="compare-card-title">{selection.photoName}</div>
          <div className="compare-card-subtitle">{selection.boatName}</div>
        </div>
        <button className="btn btn-secondary btn-small" onClick={onClear}>
          Change
        </button>
      </div>

      {selection.thumbUrl && (
        <div className="compare-card-image">
          <img src={selection.thumbUrl} alt={selection.photoName} />
        </div>
      )}

      {metrics && metrics.stripes.length > 0 ? (
        <div className="compare-card-metrics">
          <div className="compare-metric-row">
            <span className="compare-metric-label">Avg Camber</span>
            <span className="compare-metric-value">{metrics.summary.avgCamberPct.toFixed(1)}%</span>
          </div>
          <div className="compare-metric-row">
            <span className="compare-metric-label">Avg Draft</span>
            <span className="compare-metric-value">{metrics.summary.avgDraftPositionPct.toFixed(0)}%</span>
          </div>
          <div className="compare-metric-row">
            <span className="compare-metric-label">Total Twist</span>
            <span className="compare-metric-value">{metrics.summary.totalTwistDeg.toFixed(1)}°</span>
          </div>
          <div className="compare-metric-row">
            <span className="compare-metric-label">Stripes</span>
            <span className="compare-metric-value">{metrics.stripes.length}</span>
          </div>
        </div>
      ) : (
        <div className="compare-card-metrics muted">
          No metrics available. Ensure stripes are measured.
        </div>
      )}
    </div>
  )
}

function ComparisonResults({
  left,
  right,
  leftName,
  rightName,
  comparison,
}: {
  left: MetricsSummary
  right: MetricsSummary
  leftName: string
  rightName: string
  comparison: PhotoComparison
}) {
  return (
    <div className="compare-results card mt">
      <div className="card-title">Comparison Results</div>

      {/* Summary Differences */}
      <div className="compare-diff-grid">
        <DiffCard
          label="Camber"
          leftValue={`${left.summary.avgCamberPct.toFixed(1)}%`}
          rightValue={`${right.summary.avgCamberPct.toFixed(1)}%`}
          diff={comparison.camberDiff}
          unit="%"
        />
        <DiffCard
          label="Draft Position"
          leftValue={`${left.summary.avgDraftPositionPct.toFixed(0)}%`}
          rightValue={`${right.summary.avgDraftPositionPct.toFixed(0)}%`}
          diff={comparison.draftPositionDiff}
          unit="%"
        />
        <DiffCard
          label="Twist"
          leftValue={`${left.summary.totalTwistDeg.toFixed(1)}°`}
          rightValue={`${right.summary.totalTwistDeg.toFixed(1)}°`}
          diff={comparison.twistDiff}
          unit="°"
        />
      </div>

      {/* Stripe-by-Stripe Comparison */}
      {left.stripes.length > 0 && right.stripes.length > 0 && (
        <div className="mt">
          <div className="h2">Stripe-by-Stripe Comparison</div>
          <div className="compare-stripes-table">
            <div className="compare-stripes-header">
              <div className="compare-stripes-cell">Height</div>
              <div className="compare-stripes-cell">{leftName}</div>
              <div className="compare-stripes-cell">{rightName}</div>
              <div className="compare-stripes-cell">Diff</div>
            </div>

            {/* Match stripes by height */}
            {(() => {
              const allHeights = new Set([
                ...left.stripes.map(s => s.heightPct),
                ...right.stripes.map(s => s.heightPct),
              ])
              const sortedHeights = Array.from(allHeights).sort((a, b) => a - b)

              return sortedHeights.map((height) => {
                const leftStripe = left.stripes.find(s => s.heightPct === height)
                const rightStripe = right.stripes.find(s => s.heightPct === height)

                return (
                  <div key={height} className="compare-stripes-row">
                    <div className="compare-stripes-cell compare-stripes-height">
                      {height}%
                    </div>
                    <div className="compare-stripes-cell">
                      {leftStripe ? (
                        <div className="compare-stripe-data">
                          <span>C: {leftStripe.camberPct.toFixed(1)}%</span>
                          <span>D: {leftStripe.draftPositionPct.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                    <div className="compare-stripes-cell">
                      {rightStripe ? (
                        <div className="compare-stripe-data">
                          <span>C: {rightStripe.camberPct.toFixed(1)}%</span>
                          <span>D: {rightStripe.draftPositionPct.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                    <div className="compare-stripes-cell">
                      {leftStripe && rightStripe ? (
                        <div className="compare-stripe-diff">
                          <span className={getDiffClass(rightStripe.camberPct - leftStripe.camberPct)}>
                            {formatDiff(rightStripe.camberPct - leftStripe.camberPct)}%
                          </span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Visual Comparison Chart */}
      <div className="mt">
        <div className="h2">Visual Comparison</div>
        <div className="compare-chart">
          <CamberComparisonChart left={left} right={right} leftName={leftName} rightName={rightName} />
        </div>
      </div>
    </div>
  )
}

function DiffCard({
  label,
  leftValue,
  rightValue,
  diff,
  unit,
}: {
  label: string
  leftValue: string
  rightValue: string
  diff: number
  unit: string
}) {
  const diffClass = getDiffClass(diff)

  return (
    <div className="compare-diff-card">
      <div className="compare-diff-label">{label}</div>
      <div className="compare-diff-values">
        <span className="compare-diff-left">{leftValue}</span>
        <span className="compare-diff-arrow">→</span>
        <span className="compare-diff-right">{rightValue}</span>
      </div>
      <div className={`compare-diff-delta ${diffClass}`}>
        {formatDiff(diff)}{unit}
      </div>
    </div>
  )
}

function CamberComparisonChart({
  left,
  right,
  leftName,
  rightName,
}: {
  left: MetricsSummary
  right: MetricsSummary
  leftName: string
  rightName: string
}) {
  const maxCamber = Math.max(
    ...left.stripes.map(s => s.camberPct),
    ...right.stripes.map(s => s.camberPct),
    15
  )

  return (
    <div className="camber-chart">
      <div className="camber-chart-legend">
        <span className="camber-legend-left">{leftName}</span>
        <span className="camber-legend-right">{rightName}</span>
      </div>

      <svg viewBox="0 0 400 200" className="camber-chart-svg">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={40 + (pct / 100) * 340}
              y1={20}
              x2={40 + (pct / 100) * 340}
              y2={180}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <text
              x={40 + (pct / 100) * 340}
              y={195}
              fill="rgba(255,255,255,0.5)"
              fontSize={10}
              textAnchor="middle"
            >
              {pct}%
            </text>
          </g>
        ))}

        {/* Left line (blue) */}
        {left.stripes.length >= 2 && (
          <polyline
            points={left.stripes
              .map((s) => {
                const x = 40 + (s.heightPct / 100) * 340
                const y = 180 - (s.camberPct / maxCamber) * 160
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="#3aa9ff"
            strokeWidth={2}
          />
        )}

        {/* Left points */}
        {left.stripes.map((s, i) => {
          const x = 40 + (s.heightPct / 100) * 340
          const y = 180 - (s.camberPct / maxCamber) * 160
          return <circle key={i} cx={x} cy={y} r={4} fill="#3aa9ff" />
        })}

        {/* Right line (purple) */}
        {right.stripes.length >= 2 && (
          <polyline
            points={right.stripes
              .map((s) => {
                const x = 40 + (s.heightPct / 100) * 340
                const y = 180 - (s.camberPct / maxCamber) * 160
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="#a855f7"
            strokeWidth={2}
          />
        )}

        {/* Right points */}
        {right.stripes.map((s, i) => {
          const x = 40 + (s.heightPct / 100) * 340
          const y = 180 - (s.camberPct / maxCamber) * 160
          return <circle key={i} cx={x} cy={y} r={4} fill="#a855f7" />
        })}

        {/* Y-axis labels */}
        <text x={5} y={25} fill="rgba(255,255,255,0.5)" fontSize={10}>
          {maxCamber.toFixed(0)}%
        </text>
        <text x={5} y={100} fill="rgba(255,255,255,0.5)" fontSize={10}>
          {(maxCamber / 2).toFixed(0)}%
        </text>
        <text x={5} y={180} fill="rgba(255,255,255,0.5)" fontSize={10}>
          0%
        </text>

        {/* Axis labels */}
        <text x={200} y={12} fill="rgba(255,255,255,0.7)" fontSize={11} textAnchor="middle">
          Camber vs Height
        </text>
      </svg>
    </div>
  )
}

// Helpers
function getDiffClass(diff: number): string {
  if (Math.abs(diff) < 0.5) return 'diff-neutral'
  return diff > 0 ? 'diff-positive' : 'diff-negative'
}

function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff.toFixed(1)}`
  return diff.toFixed(1)
}

export default ComparePage
