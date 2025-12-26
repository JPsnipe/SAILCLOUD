import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BoatProject, NormalizedPoint, Photo, PhotoAnalysis, PhotoLayer, SceneType } from '../shared/domain'
import { SceneTypeSchema } from '../shared/domain'
import { useAutoScan } from '../hooks/useAutoScan'
import { SailMetricsPanel } from '../components/SailMetricsPanel'
import { SailHeatmap } from '../components/SailHeatmap'
import { ClassificationAssistant } from '../components/ClassificationAssistant'
import { getCatmullRomSpline } from '../lib/metrics/geometry'
import { calculateCamber } from '../lib/metrics/camber'

type ToolbarTab = 'CLASSIFY' | 'MEASURE' | 'METRICS' | 'EDIT'
type ToolMode = 'ADD' | 'MOVE' | 'AUTOSCAN' | 'PICK_COLOR'

const LABEL_LENGTH_REF = 'Length reference'
const LABEL_TWIST_REF = 'Twist reference'
const MIN_STRIPES = 3

// Default stripe positions if sail has none configured
const DEFAULT_STRIPE_PCTS = [25, 50, 75]

const SCENE_OPTIONS: Array<{ value: SceneType; label: string }> = [
  { value: 'DEPRECATED', label: 'Deprecated' },
  { value: 'GENERIC', label: 'Generic' },
  { value: 'ONBOARD_SAIL', label: 'Onboard Sail' },
  { value: 'CHASE_SAIL_UPWIND', label: 'Chase Sail - Upwind' },
  { value: 'CHASE_SAIL_DOWNWIND', label: 'Chase Sail - Downwind' },
  { value: 'MAST_BEND_FORE_AFT', label: 'Mast Bend - Fore & aft' },
  { value: 'MAST_BEND_LATERAL', label: 'Mast Bend - Lateral' },
  { value: 'RAKE', label: 'Rake' },
  { value: 'HEEL', label: 'Heel' },
]

function toFileUrl(absPath: string) {
  const normalized = absPath.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized}`)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function normalizeSceneType(sceneType: SceneType): SceneType {
  if (sceneType === 'CHASE_SAIL') return 'CHASE_SAIL_UPWIND'
  if (sceneType === 'MAST_BEND') return 'MAST_BEND_FORE_AFT'
  if (sceneType === 'RAKE_HEEL') return 'HEEL'
  return sceneType
}

function makeLengthReferenceLayer(): PhotoLayer {
  return {
    id: crypto.randomUUID(),
    label: LABEL_LENGTH_REF,
    tool: 'POINTS',
    points: [],
    lengthUnit: 'm',
  }
}

function makeTwistReferenceLayer(): PhotoLayer {
  return {
    id: crypto.randomUUID(),
    label: LABEL_TWIST_REF,
    tool: 'POINTS',
    points: [],
  }
}

function getStripePcts(project: BoatProject, sailId: string | undefined): number[] {
  const sail = sailId ? project.sails.find((s) => s.id === sailId) : project.sails[0]
  const sailPcts = sail?.draftStripesPct ?? []
  // Ensure at least MIN_STRIPES stripes
  if (sailPcts.length >= MIN_STRIPES) return sailPcts
  // Fill with defaults if needed
  const result = [...sailPcts]
  for (let i = result.length; i < MIN_STRIPES; i++) {
    result.push(DEFAULT_STRIPE_PCTS[i] ?? (25 + i * 25))
  }
  return result
}

function getLayerByLabel(layers: PhotoLayer[], label: string) {
  return layers.find((l) => l.label === label)
}

function rebuildOnboardLayers(project: BoatProject, sailId: string | undefined, previous: PhotoLayer[] | undefined) {
  const prev = previous ?? []
  const prevLength = getLayerByLabel(prev, LABEL_LENGTH_REF)
  const prevTwist = getLayerByLabel(prev, LABEL_TWIST_REF)

  const nextLength = prevLength ? { ...prevLength, label: LABEL_LENGTH_REF } : makeLengthReferenceLayer()
  const nextTwist = prevTwist ? { ...prevTwist, label: LABEL_TWIST_REF } : makeTwistReferenceLayer()

  const stripePcts = getStripePcts(project, sailId)
  const stripeLayers: PhotoLayer[] = stripePcts.map((pct, idx) => {
    const prefix = `Stripe ${idx + 1}`
    const existing = prev.find((l) => l.label.startsWith(prefix))
    return existing
      ? { ...existing, label: `Stripe ${idx + 1} (${pct}%)` }
      : {
        id: crypto.randomUUID(),
        label: `Stripe ${idx + 1} (${pct}%)`,
        tool: 'POLYLINE',
        points: [],
        autoScanEnabled: false,
        autoScanAnchors: [],
      }
  })

  return [nextLength, nextTwist, ...stripeLayers]
}

function buildDefaultAnalysis(project: BoatProject, sceneType: SceneType, sailId: string | undefined, previous?: PhotoAnalysis) {
  const normalizedScene = normalizeSceneType(sceneType)
  const prevLayers = previous?.layers ?? []
  const prevSceneType = previous?.sceneType ? normalizeSceneType(previous.sceneType) : undefined

  // Helper to find existing layer by label and preserve its data
  function findOrCreateLayer(label: string, tool: 'POLYLINE' | 'POINTS', defaults?: Partial<PhotoLayer>): PhotoLayer {
    const existing = prevLayers.find((l) => l.label === label)
    if (existing) {
      return { ...existing } // Return copy of existing layer with all its data
    }
    return {
      id: crypto.randomUUID(),
      label,
      tool,
      points: [],
      ...(tool === 'POLYLINE' ? { autoScanEnabled: false, autoScanAnchors: [] } : {}),
      ...defaults,
    }
  }

  if (normalizedScene === 'ONBOARD_SAIL') {
    const resolvedSailId = sailId ?? previous?.sailId ?? project.sails[0]?.id
    return {
      sceneType: normalizedScene,
      sailId: resolvedSailId,
      mastId: previous?.mastId,
      layers: rebuildOnboardLayers(project, resolvedSailId, prevLayers),
    } satisfies PhotoAnalysis
  }

  // If same scene type, preserve all existing layers
  if (prevSceneType === normalizedScene && prevLayers.length > 0) {
    return {
      sceneType: normalizedScene,
      sailId: undefined,
      mastId: previous?.mastId,
      layers: prevLayers.map(l => ({ ...l })), // Return copy of all existing layers
    } satisfies PhotoAnalysis
  }

  // Different scene type or no previous - create default layers (preserving any matching labels)
  const lengthLayer = findOrCreateLayer(LABEL_LENGTH_REF, 'POINTS')

  // Define layers for each scene type
  let curveLayers: PhotoLayer[]

  switch (normalizedScene) {
    case 'CHASE_SAIL_UPWIND':
    case 'CHASE_SAIL_DOWNWIND': {
      const chaseStripePcts = [25, 50, 75]
      const stripes = chaseStripePcts.map((pct, idx) =>
        findOrCreateLayer(`Stripe ${idx + 1} (${pct}%)`, 'POLYLINE')
      )
      curveLayers = [
        ...stripes,
        findOrCreateLayer('Luff curve', 'POLYLINE'),
        findOrCreateLayer('Leech curve', 'POLYLINE'),
      ]
      break
    }
    case 'MAST_BEND_FORE_AFT':
      curveLayers = [findOrCreateLayer('Mast bend (fore/aft)', 'POLYLINE')]
      break
    case 'MAST_BEND_LATERAL':
      curveLayers = [findOrCreateLayer('Mast bend (lateral)', 'POLYLINE')]
      break
    case 'RAKE':
      curveLayers = [
        findOrCreateLayer('Hull line', 'POINTS'),
        findOrCreateLayer('Mast line', 'POINTS'),
      ]
      break
    case 'HEEL':
      curveLayers = [findOrCreateLayer('Horizon line', 'POINTS')]
      break
    default:
      curveLayers = [findOrCreateLayer('Curve', 'POLYLINE')]
  }

  return {
    sceneType: normalizedScene,
    sailId: undefined,
    mastId: previous?.mastId,
    layers: [lengthLayer, ...curveLayers],
  } satisfies PhotoAnalysis
}

function pickDefaultActiveLayerId(analysis: PhotoAnalysis) {
  const twist = analysis.layers.find((l) => l.label === LABEL_TWIST_REF)
  if (twist) return twist.id

  const firstNonLength = analysis.layers.find((l) => l.label !== LABEL_LENGTH_REF)
  return firstNonLength?.id ?? analysis.layers[0]?.id ?? ''
}

function getNormalizedFromEvent(event: { clientX: number; clientY: number }, rect: DOMRect): NormalizedPoint {
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return { x: clamp01(x), y: clamp01(y) }
}

export function PhotoMeasurePage() {
  const { boatId, photoId } = useParams()
  const overlayRef = useRef<SVGSVGElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [project, setProject] = useState<BoatProject | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [photoPath, setPhotoPath] = useState<string>('')

  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null)
  const [activeLayerId, setActiveLayerId] = useState<string>('')

  const [toolbarTab, setToolbarTab] = useState<ToolbarTab>('CLASSIFY')
  const [toolMode, setToolMode] = useState<ToolMode>('ADD')

  const [editName, setEditName] = useState('')
  const [editTimezone, setEditTimezone] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const [dragging, setDragging] = useState<{ layerId: string; pointIndex: number; pointerId: number } | null>(null)
  const [useSplineInterpolation, setUseSplineInterpolation] = useState(true)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string>('')

  // AutoScan CV hook
  const { cvStatus, isScanning, scan: runAutoScanCV, loadCV } = useAutoScan()

  // Pre-load OpenCV when component mounts
  useEffect(() => {
    void loadCV()
  }, [loadCV])

  const refresh = useCallback(async () => {
    if (!boatId || !photoId) return
    setBusy(true)
    setError('')

    try {
      const [proj, absPath] = await Promise.all([
        window.sailcloud.getBoatProject(boatId),
        window.sailcloud.getPhotoPath(boatId, photoId),
      ])

      setProject(proj)
      setPhotoPath(absPath)

      const found = proj.photos.find((p) => p.id === photoId) ?? null
      setPhoto(found)

      const nextAnalysis = found?.analysis
        ? buildDefaultAnalysis(proj, found.analysis.sceneType, found.analysis.sailId, found.analysis)
        : buildDefaultAnalysis(proj, 'ONBOARD_SAIL', proj.sails[0]?.id)

      setAnalysis(nextAnalysis)
      setActiveLayerId(pickDefaultActiveLayerId(nextAnalysis))

      setEditName(found?.name ?? found?.originalFileName ?? found?.fileName ?? '')
      setEditTimezone(found?.timezone ?? proj.boat.timezone ?? 'UTC')
      setEditTags((found?.tags ?? []).join(', '))
      setEditNotes(found?.notes ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load photo')
    } finally {
      setBusy(false)
    }
  }, [boatId, photoId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fileUrl = useMemo(() => (photoPath ? toFileUrl(photoPath) : ''), [photoPath])

  const activeLayer = useMemo(() => {
    if (!analysis) return null
    return analysis.layers.find((l) => l.id === activeLayerId) ?? null
  }, [analysis, activeLayerId])

  const isOnboard = analysis?.sceneType === 'ONBOARD_SAIL'

  function updateLayer(layerId: string, updater: (layer: PhotoLayer) => PhotoLayer) {
    setAnalysis((prev) => {
      if (!prev) return prev
      return { ...prev, layers: prev.layers.map((l) => (l.id === layerId ? updater(l) : l)) }
    })
  }

  function clearLayer(layerId: string) {
    updateLayer(layerId, (layer) => ({ ...layer, points: [], autoScanAnchors: [], autoScanEnabled: layer.autoScanEnabled }))
  }

  function addStripeLayer() {
    setAnalysis((prev) => {
      if (!prev) return prev
      // Count existing stripes
      const stripeCount = prev.layers.filter((l) => l.label.startsWith('Stripe ')).length
      const newStripeNum = stripeCount + 1
      // Calculate a reasonable percentage position
      const pct = Math.min(95, 25 + (newStripeNum - 1) * 15)
      const newLayer: PhotoLayer = {
        id: crypto.randomUUID(),
        label: `Stripe ${newStripeNum} (${pct}%)`,
        tool: 'POLYLINE',
        points: [],
        autoScanEnabled: false,
        autoScanAnchors: [],
      }
      return { ...prev, layers: [...prev.layers, newLayer] }
    })
  }

  function removeStripeLayer(layerId: string) {
    setAnalysis((prev) => {
      if (!prev) return prev
      const layer = prev.layers.find((l) => l.id === layerId)
      // Only allow removing stripe layers (not length ref, twist ref, etc.)
      if (!layer || !layer.label.startsWith('Stripe ')) return prev
      // Keep at least MIN_STRIPES
      const stripeCount = prev.layers.filter((l) => l.label.startsWith('Stripe ')).length
      if (stripeCount <= MIN_STRIPES) return prev
      const newLayers = prev.layers.filter((l) => l.id !== layerId)
      // If we removed the active layer, select another
      if (layerId === activeLayerId) {
        const firstStripe = newLayers.find((l) => l.label.startsWith('Stripe '))
        if (firstStripe) setActiveLayerId(firstStripe.id)
      }
      return { ...prev, layers: newLayers }
    })
  }

  function undoLayer(layerId: string) {
    updateLayer(layerId, (layer) => {
      if (toolMode === 'AUTOSCAN' && layer.tool === 'POLYLINE' && layer.autoScanEnabled) {
        const anchors = layer.autoScanAnchors ?? []
        return { ...layer, autoScanAnchors: anchors.slice(0, -1) }
      }
      return { ...layer, points: layer.points.slice(0, -1) }
    })
  }

  function sampleColorAtPoint(point: NormalizedPoint): { r: number; g: number; b: number } | null {
    const img = imgRef.current
    if (!img || !img.complete) return null

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0)
    const px = Math.round(point.x * (img.naturalWidth - 1))
    const py = Math.round(point.y * (img.naturalHeight - 1))

    const data = ctx.getImageData(px, py, 1, 1).data
    return { r: data[0], g: data[1], b: data[2] }
  }

  function addPointToActiveLayer(point: NormalizedPoint) {
    if (!activeLayer) return
    if (toolMode === 'PICK_COLOR') {
      const color = sampleColorAtPoint(point)
      if (color) {
        updateLayer(activeLayer.id, (layer) => ({ ...layer, autoScanColor: color }))
        setToolMode('AUTOSCAN')
      }
      return
    }

    if (toolMode === 'AUTOSCAN') {
      if (activeLayer.tool !== 'POLYLINE') return
      if (!activeLayer.autoScanEnabled) return
      updateLayer(activeLayer.id, (layer) => ({ ...layer, autoScanAnchors: [...(layer.autoScanAnchors ?? []), point] }))
      return
    }

    if (activeLayer.tool === 'POINTS') {
      updateLayer(activeLayer.id, (layer) => {
        const next = layer.points.length >= 2 ? [layer.points[0], point] : [...layer.points, point]
        return { ...layer, points: next }
      })
      return
    }

    updateLayer(activeLayer.id, (layer) => ({ ...layer, points: [...layer.points, point] }))
  }

  function onOverlayPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (toolbarTab !== 'MEASURE') return
    if (!activeLayer) return
    if (e.button !== 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const point = getNormalizedFromEvent(e, rect)
    addPointToActiveLayer(point)
  }

  function removePoint(layerId: string, pointIndex: number) {
    updateLayer(layerId, (layer) => {
      if (pointIndex < 0 || pointIndex >= layer.points.length) return layer
      return { ...layer, points: layer.points.filter((_, idx) => idx !== pointIndex) }
    })
  }

  function onPointPointerDown(e: PointerEvent<SVGCircleElement>, layerId: string, pointIndex: number) {
    if (toolbarTab !== 'MEASURE') return
    if (e.button !== 0) return
    if (layerId !== activeLayerId) return

    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }
    target.setPointerCapture?.(e.pointerId)
    setDragging({ layerId, pointIndex, pointerId: e.pointerId })
  }

  function onPointContextMenu(e: MouseEvent<SVGCircleElement>, layerId: string, pointIndex: number) {
    if (toolbarTab !== 'MEASURE') return
    if (layerId !== activeLayerId) return

    e.preventDefault()
    e.stopPropagation()
    removePoint(layerId, pointIndex)
  }

  function onOverlayPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragging) return
    const overlay = overlayRef.current
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const point = getNormalizedFromEvent(e, rect)

    updateLayer(dragging.layerId, (layer) => {
      const points = layer.points.map((p, idx) => (idx === dragging.pointIndex ? point : p))
      return { ...layer, points }
    })
  }

  function stopDragging(e: PointerEvent<SVGSVGElement>) {
    if (!dragging) return
    if (dragging.pointerId !== e.pointerId) return
    setDragging(null)
  }

  function toggleAutoScan(layerId: string, enabled: boolean) {
    updateLayer(layerId, (layer) => ({
      ...layer,
      autoScanEnabled: enabled,
      autoScanAnchors: enabled ? layer.autoScanAnchors ?? [] : [],
    }))
  }

  function startAutoScanAnchors() {
    if (!activeLayer || activeLayer.tool !== 'POLYLINE') return
    toggleAutoScan(activeLayer.id, true)
    updateLayer(activeLayer.id, (layer) => ({ ...layer, autoScanAnchors: [] }))
    setToolMode('AUTOSCAN')
  }

  async function runAutoScanReal() {
    if (!activeLayer || activeLayer.tool !== 'POLYLINE') return
    const anchors = activeLayer.autoScanAnchors ?? []
    if (anchors.length < 2) return
    if (!photoPath) return

    // Run real AutoScan with OpenCV.js
    const result = await runAutoScanCV(photoPath, anchors, undefined, activeLayer.autoScanColor)

    if (result.success && result.points.length > 0) {
      // Update layer with detected points
      updateLayer(activeLayer.id, (layer) => ({
        ...layer,
        points: result.points,
        autoScanResult: {
          success: true,
          confidence: result.confidence,
          algorithm: 'CANNY_ASTAR',
          timestamp: new Date().toISOString(),
        },
      }))
      setToolMode('MOVE')
    } else {
      // Fallback to straight lines connecting anchors
      console.warn('AutoScan failed, using fallback:', result.error)
      const points: NormalizedPoint[] = []
      const steps = 12
      for (let i = 0; i < anchors.length - 1; i++) {
        const start = anchors[i]
        const end = anchors[i + 1]
        for (let j = 0; j < steps; j++) {
          const t = j / (steps - 1)
          if (i > 0 && j === 0) continue // Skip start point of next link
          points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          })
        }
      }

      updateLayer(activeLayer.id, (layer) => ({
        ...layer,
        points,
        autoScanResult: {
          success: false,
          confidence: 0,
          algorithm: 'FALLBACK_LINEAR',
          timestamp: new Date().toISOString(),
        },
      }))
      setToolMode('MOVE')
      setError(result.error ?? 'AutoScan failed, using straight line fallback')
    }
  }

  function onSceneChange(next: string) {
    if (!project) return
    const parsed = SceneTypeSchema.safeParse(next)
    if (!parsed.success) return

    const nextAnalysis = buildDefaultAnalysis(project, parsed.data, analysis?.sailId, analysis ?? undefined)
    setAnalysis(nextAnalysis)
    setActiveLayerId(pickDefaultActiveLayerId(nextAnalysis))
  }

  function onSailChange(nextSailId: string) {
    if (!project) return
    if (!analysis || analysis.sceneType !== 'ONBOARD_SAIL') return

    const nextLayers = rebuildOnboardLayers(project, nextSailId, analysis.layers)
    const next: PhotoAnalysis = { ...analysis, sailId: nextSailId, layers: nextLayers }
    setAnalysis(next)

    if (!nextLayers.some((l) => l.id === activeLayerId)) {
      setActiveLayerId(pickDefaultActiveLayerId(next))
    }
  }

  function onMastChange(nextMastId: string) {
    setAnalysis((prev) => (prev ? { ...prev, mastId: nextMastId || undefined } : prev))
  }

  async function onSave() {
    if (!boatId || !photoId || !analysis) {
      console.warn('[Save] Missing data:', { boatId, photoId, hasAnalysis: !!analysis })
      setError('Cannot save: missing boat, photo, or analysis data')
      return
    }
    setBusy(true)
    setError('')
    console.log('[Save] Starting save...', { boatId, photoId, layerCount: analysis.layers.length })

    try {
      const tags = splitTags(editTags)
      await Promise.all([
        window.sailcloud.updatePhotoMeta(boatId, photoId, {
          name: editName,
          timezone: editTimezone,
          tags,
          notes: editNotes,
        }),
        window.sailcloud.updatePhotoAnalysis(boatId, photoId, analysis),
      ])
      const savedTime = new Date().toLocaleTimeString()
      console.log('[Save] Success at', savedTime)
      setSavedAt(savedTime)
      await refresh()
    } catch (e) {
      console.error('[Save] Error:', e)
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  if (!boatId || !photoId) {
    return (
      <div className="page">
        <div className="alert alert-error">Missing route params.</div>
        <Link className="btn" to="/">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="page page-full">
      <div className="page-header">
        <div className="row">
          <Link className="btn btn-secondary btn-small" to={`/boats/${boatId}`}>
            Back
          </Link>
          <h1 className="h1">{editName || photo?.fileName || 'Measure'}</h1>
        </div>
        <div className="row">
          {savedAt ? <div className="muted small" style={{ color: '#4ade80' }}>✓ Saved {savedAt}</div> : null}
          <button
            className="btn"
            disabled={busy || !analysis}
            onClick={() => void onSave()}
            title={!analysis ? 'No analysis data to save' : 'Save changes'}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="measure-layout">
        <div className="photo-view card">
          {!fileUrl ? (
            <div className="muted">{busy ? 'Loading…' : 'No photo path.'}</div>
          ) : (
            <div className="photo-stage">
              <img ref={imgRef} className="photo-img" src={fileUrl} alt={photo?.fileName ?? 'Photo'} draggable={false} />
              <svg
                ref={overlayRef}
                className="photo-overlay"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
                onContextMenu={(e) => e.preventDefault()}
              >
                {(analysis?.layers ?? []).map((layer) => {
                  const isActive = layer.id === activeLayerId
                  const lineStroke = isActive ? '#3aa9ff' : 'rgba(255,255,255,0.28)'
                  const pointFill = isActive ? '#ff4d4d' : 'rgba(255,255,255,0.35)'
                  const strokeWidth = isActive ? 0.004 : 0.003

                  const points = layer.points

                  const anchors = layer.autoScanAnchors ?? []
                  const anchorStroke = isActive ? '#f7d46a' : 'rgba(247,212,106,0.35)'

                  return (
                    <g key={layer.id}>
                      {layer.tool === 'POLYLINE' && points.length >= 2 ? (
                        <polyline
                          points={(useSplineInterpolation && points.length >= 3 ? getCatmullRomSpline(points) : points).map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={lineStroke}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}

                      {anchors.map((p, idx) => (
                        <circle key={`a-${idx}`} cx={p.x} cy={p.y} r={0.012} fill="none" stroke={anchorStroke} strokeWidth={0.004} />
                      ))}

                      {layer.tool === 'POLYLINE' && points.length >= 3 && isActive ? (
                        <>
                          {/* Chord Line */}
                          <line
                            x1={points[0].x}
                            y1={points[0].y}
                            x2={points[points.length - 1].x}
                            y2={points[points.length - 1].y}
                            stroke="rgba(255, 255, 255, 0.6)"
                            strokeWidth={0.002}
                            strokeDasharray="0.01 0.01"
                          />
                          {/* Max Depth Indicator */}
                          {(() => {
                            const result = calculateCamber(points, points[0], points[points.length - 1])
                            const chordPoint = {
                              x: points[0].x + (result.draftPositionPct / 100) * (points[points.length - 1].x - points[0].x),
                              y: points[0].y + (result.draftPositionPct / 100) * (points[points.length - 1].y - points[0].y),
                            }
                            return (
                              <g>
                                <line
                                  x1={result.maxDeflectionPoint.x}
                                  y1={result.maxDeflectionPoint.y}
                                  x2={chordPoint.x}
                                  y2={chordPoint.y}
                                  stroke="#4ade80"
                                  strokeWidth={0.003}
                                  strokeDasharray="0.005 0.005"
                                />
                                <circle cx={result.maxDeflectionPoint.x} cy={result.maxDeflectionPoint.y} r={0.006} fill="#4ade80" />
                                <text
                                  x={result.maxDeflectionPoint.x}
                                  y={result.maxDeflectionPoint.y - 0.02}
                                  fontSize="0.015"
                                  fill="#4ade80"
                                  textAnchor="middle"
                                  fontWeight="bold"
                                  style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.8)', strokeWidth: '0.002px' }}
                                >
                                  {result.camberPct.toFixed(1)}% @ {result.draftPositionPct.toFixed(0)}%
                                </text>
                              </g>
                            )
                          })()}
                        </>
                      ) : null}

                      {points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={0.009}
                          fill={pointFill}
                          onPointerDown={(e) => onPointPointerDown(e, layer.id, idx)}
                          onContextMenu={(e) => onPointContextMenu(e, layer.id, idx)}
                        />
                      ))}
                    </g>
                  )
                })}
              </svg>
            </div>
          )}
        </div>

        <aside className="measure-toolbar card">
          <div className="tabs" style={{ width: '100%' }}>
            <button className={toolbarTab === 'CLASSIFY' ? 'tab tab-active' : 'tab'} onClick={() => setToolbarTab('CLASSIFY')}>
              Classify
            </button>
            <button className={toolbarTab === 'MEASURE' ? 'tab tab-active' : 'tab'} onClick={() => setToolbarTab('MEASURE')}>
              Measure
            </button>
            <button className={toolbarTab === 'METRICS' ? 'tab tab-active' : 'tab'} onClick={() => setToolbarTab('METRICS')}>
              Metrics
            </button>
            <button className={toolbarTab === 'EDIT' ? 'tab tab-active' : 'tab'} onClick={() => setToolbarTab('EDIT')}>
              Edit
            </button>
          </div>

          {toolbarTab === 'CLASSIFY' ? (
            <div className="mt">
              <ClassificationAssistant
                project={project}
                analysis={analysis}
                onSceneChange={onSceneChange}
                onSailChange={onSailChange}
                onMastChange={onMastChange}
              />
            </div>
          ) : toolbarTab === 'METRICS' ? (
            <div className="mt metrics-tab-content">
              <SailHeatmap analysis={analysis} width={260} height={340} />
              <SailMetricsPanel
                analysis={analysis}
                mastProfile={project?.masts.find((m) => m.id === analysis?.mastId)}
              />
            </div>
          ) : toolbarTab === 'EDIT' ? (
            <>
              <div className="field mt">
                <div className="label">Scene</div>
                <select
                  className="select"
                  value={analysis?.sceneType ?? 'ONBOARD_SAIL'}
                  onChange={(e) => onSceneChange(e.target.value)}
                >
                  {SCENE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mt">
                <div className="label">Image name</div>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                {photo?.originalFileName ? <div className="muted small mono">Original: {photo.originalFileName}</div> : null}
              </div>

              <div className="field mt">
                <div className="label">Tags (comma separated)</div>
                <input className="input" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="training, J1, 14-18kts" />
              </div>

              <div className="field mt">
                <div className="label">Timezone</div>
                <input className="input" value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)} placeholder="e.g. Europe/Madrid" />
              </div>

              <div className="field mt">
                <div className="label">Sail</div>
                <select
                  className="select"
                  value={analysis?.sailId ?? ''}
                  onChange={(e) => onSailChange(e.target.value)}
                  disabled={!project || !analysis || project.sails.length === 0}
                >
                  {project?.sails.length ? null : <option value="">Add a sail first</option>}
                  {project?.sails.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {isOnboard ? <div className="muted small">Selecting a sail loads the stripe positions.</div> : null}
              </div>

              <div className="field mt">
                <div className="label">Mast (optional)</div>
                <select className="select" value={analysis?.mastId ?? ''} onChange={(e) => onMastChange(e.target.value)} disabled={!project}>
                  <option value="">—</option>
                  {project?.masts.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mt">
                <div className="label">Notes</div>
                <textarea className="textarea" rows={5} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              {/* Reference Layers Section */}
              <div className="mt">
                <div className="label">Reference</div>
                <div className="layer-list">
                  {(analysis?.layers ?? [])
                    .filter((l) => l.label === LABEL_LENGTH_REF || l.label === LABEL_TWIST_REF)
                    .map((l) => {
                      const isActive = l.id === activeLayerId
                      return (
                        <button
                          key={l.id}
                          className={isActive ? 'layer-btn layer-btn-active' : 'layer-btn'}
                          onClick={() => setActiveLayerId(l.id)}
                        >
                          <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{l.label}</span>
                            <span className="muted small">{l.points.length}/2 pts</span>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Draft Stripes Section - These are for metrics calculation */}
              <div className="mt">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="label" style={{ margin: 0 }} title="Horizontal lines across the sail for camber/draft measurement">
                    Draft Stripes <span className="small muted">(for metrics)</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={addStripeLayer}
                    title="Add another stripe section"
                    style={{ padding: '2px 8px', fontSize: '14px' }}
                  >
                    +
                  </button>
                </div>
                <div className="small muted" style={{ marginTop: '4px' }}>
                  Click on sail to trace horizontal stripes. Need 3+ points per stripe.
                </div>
                <div className="layer-list" style={{ marginTop: '8px' }}>
                  {(analysis?.layers ?? [])
                    .filter((l) => l.label.startsWith('Stripe '))
                    .map((l) => {
                      const isActive = l.id === activeLayerId
                      const stripeCount = (analysis?.layers ?? []).filter((x) => x.label.startsWith('Stripe ')).length
                      const canRemove = stripeCount > MIN_STRIPES
                      return (
                        <div
                          key={l.id}
                          className={`layer-btn-wrapper ${isActive ? 'layer-btn-wrapper-active' : ''}`}
                          style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}
                        >
                          <button
                            className={isActive ? 'layer-btn layer-btn-active' : 'layer-btn'}
                            onClick={() => setActiveLayerId(l.id)}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}
                          >
                            <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <span>{l.label}</span>
                              <span className="muted small">{l.points.length} pts</span>
                            </div>
                            {l.points.length >= 3 && (
                              <div className="muted small" style={{ display: 'flex', gap: '8px', color: '#4ade80' }}>
                                {(() => {
                                  const res = calculateCamber(l.points, l.points[0], l.points[l.points.length - 1])
                                  return (
                                    <>
                                      <span>C: <strong>{res.camberPct.toFixed(1)}%</strong></span>
                                      <span>D: <strong>{res.draftPositionPct.toFixed(0)}%</strong></span>
                                    </>
                                  )
                                })()}
                              </div>
                            )}
                          </button>
                          {canRemove && (
                            <button
                              className="btn btn-danger btn-small"
                              onClick={() => removeStripeLayer(l.id)}
                              title="Remove this stripe"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Other Layers (for non-onboard scenes) - Outline curves */}
              {(analysis?.layers ?? []).filter(
                (l) => !l.label.startsWith('Stripe ') && l.label !== LABEL_LENGTH_REF && l.label !== LABEL_TWIST_REF
              ).length > 0 && (
                <div className="mt">
                  <div className="label" title="Sail outline curves for shape reference">
                    Outline Curves <span className="small muted">(optional)</span>
                  </div>
                  <div className="layer-list">
                    {(analysis?.layers ?? [])
                      .filter((l) => !l.label.startsWith('Stripe ') && l.label !== LABEL_LENGTH_REF && l.label !== LABEL_TWIST_REF)
                      .map((l) => {
                        const isActive = l.id === activeLayerId
                        return (
                          <button
                            key={l.id}
                            className={isActive ? 'layer-btn layer-btn-active' : 'layer-btn'}
                            onClick={() => setActiveLayerId(l.id)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}
                          >
                            <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <span>{l.label}</span>
                              <span className="muted small">{l.points.length} pts</span>
                            </div>
                            {isActive && l.points.length >= 3 && l.tool === 'POLYLINE' && (
                              <div className="muted small" style={{ display: 'flex', gap: '8px', color: '#4ade80' }}>
                                {(() => {
                                  const res = calculateCamber(l.points, l.points[0], l.points[l.points.length - 1])
                                  return (
                                    <>
                                      <span>C: <strong>{res.camberPct.toFixed(1)}%</strong></span>
                                      <span>D: <strong>{res.draftPositionPct.toFixed(0)}%</strong></span>
                                    </>
                                  )
                                })()}
                              </div>
                            )}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              <div className="mt">
                <div className="label">Tools</div>
                <div className="row">
                  <button
                    className={toolMode === 'ADD' ? 'btn btn-small' : 'btn btn-secondary btn-small'}
                    disabled={!activeLayer}
                    onClick={() => setToolMode('ADD')}
                  >
                    + Add
                  </button>
                  <button
                    className={toolMode === 'MOVE' ? 'btn btn-small' : 'btn btn-secondary btn-small'}
                    disabled={!activeLayer}
                    onClick={() => setToolMode('MOVE')}
                  >
                    Move
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    disabled={!activeLayer || (activeLayer.points.length === 0 && (activeLayer.autoScanAnchors?.length ?? 0) === 0)}
                    onClick={() => (activeLayer ? undoLayer(activeLayer.id) : null)}
                  >
                    Undo
                  </button>
                  <button className="btn btn-danger btn-small" disabled={!activeLayer} onClick={() => (activeLayer ? clearLayer(activeLayer.id) : null)}>
                    Trash
                  </button>
                </div>

                {activeLayer?.label === LABEL_LENGTH_REF ? (
                  <div className="mt">
                    <div className="label">Length reference</div>
                    <div className="grid2">
                      <label className="field">
                        <div className="label">Value</div>
                        <input
                          className="input mono"
                          value={activeLayer.lengthValue ?? ''}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            updateLayer(activeLayer.id, (layer) => ({ ...layer, lengthValue: Number.isFinite(n) ? n : undefined }))
                          }}
                          placeholder="e.g. 2.15"
                        />
                      </label>
                      <label className="field">
                        <div className="label">Unit</div>
                        <select
                          className="select"
                          value={activeLayer.lengthUnit ?? 'm'}
                          onChange={(e) => updateLayer(activeLayer.id, (layer) => ({ ...layer, lengthUnit: e.target.value }))}
                        >
                          <option value="m">m</option>
                          <option value="mm">mm</option>
                          <option value="ft">ft</option>
                        </select>
                      </label>
                    </div>
                    <div className="muted small mt">
                      Place two points on a known distance (e.g. spreader length) to enable absolute measurements later.
                    </div>
                  </div>
                ) : null}

                {activeLayer?.tool === 'POLYLINE' ? (
                  <div className="mt">
                    <label className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <span className="label" style={{ margin: 0 }}>
                        Auto Scan
                      </span>
                      <input
                        type="checkbox"
                        checked={!!activeLayer.autoScanEnabled}
                        onChange={(e) => toggleAutoScan(activeLayer.id, e.target.checked)}
                      />
                    </label>

                    {activeLayer.autoScanEnabled ? (
                      <>
                        <div className="row mt">
                          <button className="btn btn-secondary btn-small" onClick={startAutoScanAnchors}>
                            + ADD ANCHOR
                          </button>
                          <button
                            className={`btn btn-small ${toolMode === 'PICK_COLOR' ? 'btn-active' : 'btn-secondary'}`}
                            style={{ margin: '0 8px', flex: 1 }}
                            onClick={() => setToolMode(toolMode === 'PICK_COLOR' ? 'AUTOSCAN' : 'PICK_COLOR')}
                          >
                            {activeLayer.autoScanColor ? 'CHANGE COLOR' : 'PICK COLOR'}
                          </button>
                          {activeLayer.autoScanColor && (
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                backgroundColor: `rgb(${activeLayer.autoScanColor.r},${activeLayer.autoScanColor.g},${activeLayer.autoScanColor.b})`,
                                border: '1px solid rgba(255,255,255,0.2)',
                                flexShrink: 0,
                              }}
                              title={`RGB: ${activeLayer.autoScanColor.r},${activeLayer.autoScanColor.g},${activeLayer.autoScanColor.b}`}
                            />
                          )}
                        </div>

                        <div className="row mt">
                          <button
                            className="btn btn-small"
                            style={{ width: '100%' }}
                            disabled={(activeLayer.autoScanAnchors ?? []).length < 2 || isScanning || !cvStatus.loaded}
                            onClick={() => void runAutoScanReal()}
                          >
                            {isScanning ? 'Scanning...' : 'RUN SCANNER'}
                          </button>
                        </div>

                        {/* CV Status indicator */}
                        <div className="muted small mt">
                          {!cvStatus.loaded && cvStatus.loading ? (
                            <span style={{ color: '#f7d46a' }}>Loading OpenCV.js...</span>
                          ) : !cvStatus.loaded && cvStatus.error ? (
                            <span style={{ color: '#ff4d4d' }}>CV Error: {cvStatus.error}</span>
                          ) : cvStatus.loaded ? (
                            <span style={{ color: '#4ade80' }}>OpenCV ready {cvStatus.version ? `(v${cvStatus.version})` : ''}</span>
                          ) : null}
                        </div>

                        {/* Last scan result */}
                        {activeLayer.autoScanResult ? (
                          <div className="muted small mt">
                            {activeLayer.autoScanResult.success ? (
                              <span style={{ color: activeLayer.autoScanResult.confidence > 0.7 ? '#4ade80' : '#f7d46a' }}>
                                Confidence: {(activeLayer.autoScanResult.confidence * 100).toFixed(0)}%
                                {activeLayer.autoScanResult.confidence < 0.7 ? ' (review manually)' : ''}
                              </span>
                            ) : (
                              <span style={{ color: '#ff4d4d' }}>
                                Fallback mode (edge detection failed)
                              </span>
                            )}
                          </div>
                        ) : null}

                        <div className="muted small mt">
                          Click luff → leech anchor points, then run scanner. Uses edge detection for accurate tracing.
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {/* Spline Interpolation Toggle */}
                <div className="mt" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                  <label className="row" style={{ justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}>
                    <span className="label" style={{ margin: 0 }}>
                      Spline Interpolation
                    </span>
                    <input
                      type="checkbox"
                      checked={useSplineInterpolation}
                      onChange={(e) => setUseSplineInterpolation(e.target.checked)}
                    />
                  </label>
                  <div className="muted small" style={{ marginTop: '4px' }}>
                    {useSplineInterpolation
                      ? 'Smooth curves using Catmull-Rom spline'
                      : 'Linear segments between points'}
                  </div>
                </div>

                <div className="muted small mt" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Controls:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', lineHeight: '1.6' }}>
                    <li><strong>LMB click</strong> — Add point</li>
                    <li><strong>LMB drag</strong> — Move point</li>
                    <li><strong>RMB click</strong> — Delete point</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
