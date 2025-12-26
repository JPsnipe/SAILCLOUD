/**
 * Sail & Mast Metrics Panel Component
 *
 * Displays calculated sail shape or mast bend metrics in a clean, informative layout.
 * Based on SailTool and SailVis visualization patterns.
 */

import { useMemo } from 'react'
import type { PhotoAnalysis, MastProfile } from '../shared/domain'
import {
  generateMetricsSummary,
  generateMastMetricsSummary,
  isMastScene,
  type MetricsSummary,
  type MastMetricsSummary,
} from '../lib/metrics'

interface SailMetricsPanelProps {
  analysis: PhotoAnalysis | null
  mastProfile?: MastProfile
  compact?: boolean
}

export function SailMetricsPanel({ analysis, mastProfile, compact = false }: SailMetricsPanelProps) {
  // Check if this is a mast scene
  const isMast = useMemo(() => isMastScene(analysis?.sceneType), [analysis?.sceneType])

  // Generate sail metrics
  const sailMetrics = useMemo<MetricsSummary | null>(() => {
    if (!analysis || isMast) return null
    try {
      return generateMetricsSummary(analysis)
    } catch {
      return null
    }
  }, [analysis, isMast])

  // Generate mast metrics
  const mastMetrics = useMemo<MastMetricsSummary | null>(() => {
    if (!analysis || !isMast) return null
    try {
      return generateMastMetricsSummary(analysis, mastProfile)
    } catch {
      return null
    }
  }, [analysis, isMast, mastProfile])

  // Mast scene handling
  if (isMast) {
    if (!mastMetrics) {
      const curveLayers = analysis?.layers.filter(
        (l) => l.label.includes('Curve') && l.points.length > 0
      ) ?? []

      return (
        <div className="metrics-panel metrics-empty">
          <div className="muted small">
            {curveLayers.length === 0 ? (
              'Draw points on the mast curve to analyze bend'
            ) : (
              <>
                <div>Need 3+ points on curve for analysis</div>
                <div className="mt-sm">
                  {curveLayers.map(l => `${l.label}: ${l.points.length}pts`).join(' • ')}
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    if (compact) {
      return <CompactMastMetrics metrics={mastMetrics} />
    }

    return <FullMastMetrics metrics={mastMetrics} />
  }

  // Sail scene handling
  if (!sailMetrics || sailMetrics.stripes.length === 0) {
    const stripeLayers = analysis?.layers.filter((l) => l.label.startsWith('Stripe')) ?? []
    const stripesWithPoints = stripeLayers.filter((l) => l.points.length > 0)

    return (
      <div className="metrics-panel metrics-empty">
        <div className="muted small">
          {stripeLayers.length === 0 ? (
            'No stripes defined'
          ) : stripesWithPoints.length === 0 ? (
            `Add points to stripes (${stripeLayers.length} stripes, 0 with data)`
          ) : (
            <>
              <div>Need 3+ points per stripe for metrics</div>
              <div className="mt-sm">
                {stripeLayers.map(l => `${l.label.split('(')[0].trim()}: ${l.points.length}pts`).join(' • ')}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (compact) {
    return <CompactMetrics metrics={sailMetrics} />
  }

  return <FullMetrics metrics={sailMetrics} />
}

function CompactMetrics({ metrics }: { metrics: MetricsSummary }) {
  return (
    <div className="metrics-panel metrics-compact">
      <div className="metrics-summary-row">
        <MetricBadge
          label="Camber"
          value={`${metrics.summary.avgCamberPct.toFixed(1)}%`}
          status={getStatusColor(metrics.summary.avgCamberPct, 8, 14)}
        />
        <MetricBadge
          label="Draft"
          value={`${metrics.summary.avgDraftPositionPct.toFixed(0)}%`}
          status={getStatusColor(50 - Math.abs(metrics.summary.avgDraftPositionPct - 45), 40, 48)}
        />
        <MetricBadge
          label="Twist"
          value={`${metrics.summary.totalTwistDeg.toFixed(1)}°`}
          status={getStatusColor(12 - Math.abs(metrics.summary.totalTwistDeg), 5, 10)}
        />
      </div>
    </div>
  )
}

function FullMetrics({ metrics }: { metrics: MetricsSummary }) {
  return (
    <div className="metrics-panel">
      {/* Summary Section */}
      <div className="metrics-section">
        <div className="metrics-section-title">Summary</div>
        <div className="metrics-summary-grid">
          <SummaryCard
            label="Avg Camber"
            value={`${metrics.summary.avgCamberPct.toFixed(1)}%`}
            subtitle={getCamberDescription(metrics.summary.avgCamberPct)}
          />
          <SummaryCard
            label="Avg Draft Position"
            value={`${metrics.summary.avgDraftPositionPct.toFixed(0)}%`}
            subtitle={getDraftDescription(metrics.summary.avgDraftPositionPct)}
          />
          <SummaryCard
            label="Total Twist"
            value={`${metrics.summary.totalTwistDeg.toFixed(1)}°`}
            subtitle={getTwistDescription(metrics.summary.totalTwistDeg)}
          />
          <SummaryCard
            label="Flatness"
            value={`${(metrics.summary.flatnessIndex * 100).toFixed(0)}%`}
            subtitle={metrics.summary.flatnessIndex > 0.6 ? 'Flat' : 'Full'}
          />
        </div>
        {metrics.summary.overallAssessment && (
          <div className="metrics-assessment">
            {metrics.summary.overallAssessment}
          </div>
        )}
      </div>

      {/* Stripes Section */}
      <div className="metrics-section mt">
        <div className="metrics-section-title">Stripe Analysis</div>
        <div className="metrics-stripes">
          {metrics.stripes.map((stripe, idx) => (
            <StripeRow key={idx} stripe={stripe} />
          ))}
        </div>
      </div>

      {/* Twist Section */}
      {metrics.twists.length > 0 && (
        <div className="metrics-section mt">
          <div className="metrics-section-title">Twist Between Stripes</div>
          <div className="metrics-twists">
            {metrics.twists.map((twist, idx) => (
              <TwistRow key={idx} twist={twist} />
            ))}
          </div>
        </div>
      )}

      {/* Reference Status */}
      <div className="metrics-section mt">
        <div className="metrics-ref-status">
          <span className={metrics.hasScaleReference ? 'ref-active' : 'ref-inactive'}>
            {metrics.hasScaleReference ? '✓' : '○'} Scale Ref
          </span>
          <span className={metrics.hasTwistReference ? 'ref-active' : 'ref-inactive'}>
            {metrics.hasTwistReference ? '✓' : '○'} Twist Ref
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricBadge({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'good' | 'warning' | 'neutral'
}) {
  return (
    <div className={`metric-badge metric-badge-${status}`}>
      <span className="metric-badge-label">{label}</span>
      <span className="metric-badge-value">{value}</span>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle: string
}) {
  return (
    <div className="summary-card">
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-subtitle">{subtitle}</div>
    </div>
  )
}

function StripeRow({
  stripe,
}: {
  stripe: MetricsSummary['stripes'][0]
}) {
  return (
    <div className="stripe-row">
      <div className="stripe-header">
        <span className="stripe-label">{stripe.label}</span>
        <span className="stripe-height">{stripe.heightPct}%</span>
      </div>
      <div className="stripe-metrics">
        <div className="stripe-metric">
          <span className="stripe-metric-label">Camber</span>
          <span className="stripe-metric-value">{stripe.camberPct.toFixed(1)}%</span>
        </div>
        <div className="stripe-metric">
          <span className="stripe-metric-label">Draft</span>
          <span className="stripe-metric-value">{stripe.draftPositionPct.toFixed(0)}%</span>
        </div>
        <div className="stripe-metric">
          <span className="stripe-metric-label">Entry</span>
          <span className="stripe-metric-value">{stripe.entryAngleDeg.toFixed(1)}°</span>
        </div>
        <div className="stripe-metric">
          <span className="stripe-metric-label">Exit</span>
          <span className="stripe-metric-value">{stripe.exitAngleDeg.toFixed(1)}°</span>
        </div>
      </div>
      <div className="stripe-distribution">
        <div
          className="stripe-distribution-front"
          style={{ width: `${stripe.frontPct}%` }}
          title={`Front: ${stripe.frontPct.toFixed(0)}%`}
        />
        <div
          className="stripe-distribution-back"
          style={{ width: `${stripe.backPct}%` }}
          title={`Back: ${stripe.backPct.toFixed(0)}%`}
        />
      </div>
    </div>
  )
}

function TwistRow({
  twist,
}: {
  twist: MetricsSummary['twists'][0]
}) {
  const isPositive = twist.twistDeg > 0

  return (
    <div className="twist-row">
      <div className="twist-range">
        {twist.fromHeightPct}% → {twist.toHeightPct}%
      </div>
      <div className={`twist-value ${isPositive ? 'twist-open' : 'twist-closed'}`}>
        {isPositive ? '+' : ''}{twist.twistDeg.toFixed(1)}°
      </div>
      <div className="twist-class muted small">
        {twist.twistClass.description}
      </div>
    </div>
  )
}

// Helper functions
function getStatusColor(value: number, warningThreshold: number, goodThreshold: number): 'good' | 'warning' | 'neutral' {
  if (value >= goodThreshold) return 'good'
  if (value >= warningThreshold) return 'warning'
  return 'neutral'
}

function getCamberDescription(camber: number): string {
  if (camber < 6) return 'Very flat'
  if (camber < 10) return 'Flat'
  if (camber < 14) return 'Medium'
  if (camber < 18) return 'Deep'
  return 'Very deep'
}

function getDraftDescription(draft: number): string {
  if (draft < 35) return 'Very forward'
  if (draft < 42) return 'Forward'
  if (draft < 52) return 'Middle'
  if (draft < 60) return 'Aft'
  return 'Very aft'
}

function getTwistDescription(twist: number): string {
  const abs = Math.abs(twist)
  if (abs < 3) return 'Minimal'
  if (abs < 6) return 'Light'
  if (abs < 10) return 'Moderate'
  if (abs < 15) return 'Significant'
  return 'Heavy'
}

// ============================================================================
// Mast Metrics Components
// ============================================================================

function CompactMastMetrics({ metrics }: { metrics: MastMetricsSummary }) {
  return (
    <div className="metrics-panel metrics-compact">
      <div className="metrics-summary-row">
        <MetricBadge
          label="Max Bend"
          value={`${Math.abs(metrics.maxBend.deflectionPct).toFixed(1)}%`}
          status={getMastBendStatus(metrics.maxBend.deflectionPct)}
        />
        <MetricBadge
          label="At Height"
          value={`${metrics.maxBend.heightPct.toFixed(0)}%`}
          status="neutral"
        />
        <MetricBadge
          label="Type"
          value={metrics.bendType === 'FORE_AFT' ? 'F/A' : 'Lat'}
          status="neutral"
        />
      </div>
    </div>
  )
}

function FullMastMetrics({ metrics }: { metrics: MastMetricsSummary }) {
  return (
    <div className="metrics-panel">
      {/* Summary Section */}
      <div className="metrics-section">
        <div className="metrics-section-title">
          Mast Bend Analysis - {metrics.bendType === 'FORE_AFT' ? 'Fore/Aft' : 'Lateral'}
        </div>
        <div className="metrics-summary-grid">
          <SummaryCard
            label="Max Bend"
            value={metrics.maxBend.label}
            subtitle={`at ${metrics.maxBend.heightPct.toFixed(0)}% height`}
          />
          <SummaryCard
            label="Bend Direction"
            value={metrics.maxBend.deflectionPct > 0 ? 'Forward' : 'Aft'}
            subtitle={metrics.bendType === 'FORE_AFT' ? 'fore/aft plane' : 'lateral plane'}
          />
        </div>
        {metrics.assessment && (
          <div className="metrics-assessment">{metrics.assessment}</div>
        )}
      </div>

      {/* Bend Profile Chart */}
      <div className="metrics-section mt">
        <div className="metrics-section-title">Bend Profile</div>
        <MastBendChart profile={metrics.profile} maxBend={metrics.maxBend} />
      </div>

      {/* Key Positions */}
      <div className="metrics-section mt">
        <div className="metrics-section-title">Key Positions</div>
        <div className="mast-positions">
          {metrics.keyPositions.map((pos, idx) => (
            <div key={idx} className="mast-position-row">
              <div className="mast-position-label">{pos.label}</div>
              <div className="mast-position-height">{pos.heightPct.toFixed(0)}%</div>
              <div className={`mast-position-value ${pos.deflectionPct > 0 ? 'bend-forward' : 'bend-aft'}`}>
                {pos.deflectionPct > 0 ? '+' : ''}{pos.deflectionPct.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Analysis */}
      <div className="metrics-section mt">
        <div className="metrics-section-title">Section Analysis</div>
        <div className="mast-sections">
          {metrics.sections.map((section, idx) => (
            <div key={idx} className="mast-section-row">
              <div className="mast-section-label">{section.label}</div>
              <div className="mast-section-curvature">{section.curvature}</div>
              <div className="mast-section-direction muted">{section.direction}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reference Status */}
      <div className="metrics-section mt">
        <div className="metrics-ref-status">
          <span className={metrics.hasScaleReference ? 'ref-active' : 'ref-inactive'}>
            {metrics.hasScaleReference ? '✓' : '○'} Scale Ref
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * SVG chart showing the mast bend profile
 */
function MastBendChart({
  profile,
  maxBend,
}: {
  profile: MastMetricsSummary['profile']
  maxBend: MastMetricsSummary['maxBend']
}) {
  if (profile.length < 2) {
    return <div className="muted small">Not enough data points</div>
  }

  const width = 200
  const height = 150
  const padding = { top: 10, right: 30, bottom: 20, left: 30 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Find the max deflection for scaling
  const maxDeflection = Math.max(
    Math.abs(Math.min(...profile.map((p) => p.deflectionPct))),
    Math.abs(Math.max(...profile.map((p) => p.deflectionPct))),
    1 // Minimum scale
  )

  // Scale functions
  const xScale = (deflection: number) =>
    padding.left + chartWidth / 2 + (deflection / maxDeflection) * (chartWidth / 2)
  const yScale = (height: number) =>
    padding.top + chartHeight - (height / 100) * chartHeight

  // Create path
  const pathPoints = profile.map((p) => `${xScale(p.deflectionPct)},${yScale(p.heightPct)}`).join(' L ')
  const path = `M ${pathPoints}`

  // Straight reference line
  const refLine = `M ${xScale(0)},${yScale(0)} L ${xScale(0)},${yScale(100)}`

  return (
    <svg width={width} height={height} className="mast-bend-chart">
      {/* Background grid */}
      <line
        x1={padding.left}
        y1={yScale(25)}
        x2={width - padding.right}
        y2={yScale(25)}
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="2,2"
      />
      <line
        x1={padding.left}
        y1={yScale(50)}
        x2={width - padding.right}
        y2={yScale(50)}
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="2,2"
      />
      <line
        x1={padding.left}
        y1={yScale(75)}
        x2={width - padding.right}
        y2={yScale(75)}
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="2,2"
      />

      {/* Reference straight line */}
      <path d={refLine} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,4" fill="none" />

      {/* Actual bend curve */}
      <path d={path} stroke="#4ade80" strokeWidth="2" fill="none" />

      {/* Max bend marker */}
      <circle
        cx={xScale(maxBend.deflectionPct)}
        cy={yScale(maxBend.heightPct)}
        r="4"
        fill="#f59e0b"
      />

      {/* Labels */}
      <text x={padding.left - 5} y={yScale(0)} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">
        0%
      </text>
      <text x={padding.left - 5} y={yScale(50)} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">
        50%
      </text>
      <text x={padding.left - 5} y={yScale(100)} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">
        100%
      </text>

      {/* Deflection labels */}
      <text x={xScale(-maxDeflection)} y={height - 5} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">
        Aft
      </text>
      <text x={xScale(0)} y={height - 5} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">
        0
      </text>
      <text x={xScale(maxDeflection)} y={height - 5} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">
        Fwd
      </text>
    </svg>
  )
}

function getMastBendStatus(deflection: number): 'good' | 'warning' | 'neutral' {
  const abs = Math.abs(deflection)
  if (abs < 2) return 'good'
  if (abs < 4) return 'neutral'
  return 'warning'
}
