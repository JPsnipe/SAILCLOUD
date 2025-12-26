import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { BoatProject, CrewMember, Photo, SailCategory } from '../shared/domain'
import { PhotoManager } from '../components/PhotoManager'
import { InventoryManager } from '../components/InventoryManager'

type TabKey = 'PHOTOS' | 'INVENTORY' | 'CREW'

function toFileUrl(absPath: string) {
  const normalized = absPath.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized}`)
}

function isSupportedImagePath(filePath: string) {
  return /\.(jpe?g|png|webp)$/i.test(filePath)
}

export function BoatDetailPage() {
  const { boatId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<BoatProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [tab, setTab] = useState<TabKey>('PHOTOS')

  const [busy, setBusy] = useState(false)

  const [boatName, setBoatName] = useState('')
  const [boatTimezone, setBoatTimezone] = useState('')
  const [boatNotes, setBoatNotes] = useState('')

  const [newCrewName, setNewCrewName] = useState('')
  const [newCrewEmail, setNewCrewEmail] = useState('')
  const [newCrewRole, setNewCrewRole] = useState('')

  const refresh = useCallback(async () => {
    if (!boatId) return
    setLoading(true)
    setError('')
    try {
      const data = await window.sailcloud.getBoatProject(boatId)
      setProject(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boat')
    } finally {
      setLoading(false)
    }
  }, [boatId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!project) return
    setBoatName(project.boat.name)
    setBoatTimezone(project.boat.timezone)
    setBoatNotes(project.boat.notes ?? '')
  }, [project])

  async function onSaveBoat() {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.updateBoat(boatId, {
        name: boatName,
        timezone: boatTimezone,
        notes: boatNotes,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update boat')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveSail(sailId: string) {
    if (!boatId) return
    const sail = project?.sails.find((s) => s.id === sailId)
    const ok = window.confirm(`Remove sail "${sail?.name ?? 'Unnamed'}"?`)
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.removeSail(boatId, sailId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove sail')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveBoat() {
    if (!boatId || !project) return

    let folderPath: string | undefined
    try {
      const boats = await window.sailcloud.listBoats()
      folderPath = boats.find((b) => b.id === boatId)?.folderPath
    } catch {
      folderPath = undefined
    }

    const ok = window.confirm(
      `Remove "${project.boat.name}" from the library?\n\nThis does NOT delete the folder${folderPath ? `:\n${folderPath}` : '.'}`,
    )
    if (!ok) return

    setBusy(true)
    setError('')
    try {
      await window.sailcloud.removeBoatFromLibrary(boatId)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove boat')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveMast(mastId: string) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.removeMastProfile(boatId, mastId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove mast')
    } finally {
      setBusy(false)
    }
  }

  async function onAddSailFromInventory(sail: {
    category: SailCategory
    typeCode?: string
    name: string
    orderNumber?: string
    draftStripesPct: number[]
    notes?: string
  }) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.addSail(boatId, sail)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add sail')
    } finally {
      setBusy(false)
    }
  }

  async function onAddMastFromInventory(mast: {
    name: string
    houndsPct?: number
    spreadersPct: number[]
    notes?: string
  }) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.addMastProfile(boatId, mast)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add mast')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveCrew(crewId: string) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.removeCrewMember(boatId, crewId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove crew member')
    } finally {
      setBusy(false)
    }
  }

  async function onAddCrew() {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.addCrewMember(boatId, {
        name: newCrewName,
        email: newCrewEmail || undefined,
        role: newCrewRole || undefined,
      })
      setNewCrewName('')
      setNewCrewEmail('')
      setNewCrewRole('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add crew member')
    } finally {
      setBusy(false)
    }
  }

  async function onImportPhotos() {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      const res = await window.sailcloud.selectImageFiles()
      if (res.filePaths.length === 0) return
      await window.sailcloud.importPhotos(boatId, res.filePaths)
      await refresh()
      setTab('PHOTOS')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import photos')
    } finally {
      setBusy(false)
    }
  }

  async function onImportPhotoPaths(sourcePathsRaw: string[]) {
    if (!boatId) return

    const sourcePaths = Array.from(new Set(sourcePathsRaw.map((p) => p.trim()).filter(Boolean))).filter(isSupportedImagePath)
    if (sourcePaths.length === 0) return

    setBusy(true)
    setError('')
    try {
      await window.sailcloud.importPhotos(boatId, sourcePaths)
      await refresh()
      setTab('PHOTOS')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import photos')
    } finally {
      setBusy(false)
    }
  }

  async function onPasteClipboardImage(showErrorIfEmpty: boolean) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      const imported = await window.sailcloud.importClipboardImage(boatId)
      if (!imported) {
        if (showErrorIfEmpty) setError('No image found in clipboard.')
        return
      }
      await refresh()
      setTab('PHOTOS')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to paste image')
    } finally {
      setBusy(false)
    }
  }

  async function onClassifyPhoto(photoId: string, sceneType: any, sailId?: string, mastId?: string) {
    if (!boatId) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.updatePhotoAnalysis(boatId, photoId, {
        sceneType,
        sailId,
        mastId,
        layers: [],
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to classify photo')
    } finally {
      setBusy(false)
    }
  }

  async function onDeletePhotos(photoIds: string[]) {
    if (!boatId || photoIds.length === 0) return
    setBusy(true)
    setError('')
    try {
      await window.sailcloud.deletePhotos(boatId, photoIds)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete photos')
    } finally {
      setBusy(false)
    }
  }

  if (!boatId) {
    return (
      <div className="page">
        <div className="alert alert-error">Missing boat id.</div>
        <Link className="btn" to="/">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="row">
            <Link className="btn btn-secondary btn-small" to="/">
              Back
            </Link>
            <h1 className="h1">{project?.boat.name ?? 'Boat'}</h1>
          </div>
          {project ? <div className="muted small">Timezone: {project.boat.timezone}</div> : null}
        </div>
        <div className="tabs">
          <button className={tab === 'PHOTOS' ? 'tab tab-active' : 'tab'} onClick={() => setTab('PHOTOS')}>
            Photos
          </button>
          <button className={tab === 'INVENTORY' ? 'tab tab-active' : 'tab'} onClick={() => setTab('INVENTORY')}>
            Inventory
          </button>
          <button className={tab === 'CREW' ? 'tab tab-active' : 'tab'} onClick={() => setTab('CREW')}>
            Crew
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : !project ? (
        <div className="muted">Boat not found.</div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Boat details</div>
            <div className="grid2">
              <label className="field">
                <div className="label">Name</div>
                <input className="input" value={boatName} onChange={(e) => setBoatName(e.target.value)} />
              </label>
              <label className="field">
                <div className="label">Timezone</div>
                <input className="input" value={boatTimezone} onChange={(e) => setBoatTimezone(e.target.value)} />
              </label>
              <label className="field grid2-span">
                <div className="label">Notes</div>
                <textarea className="textarea" rows={3} value={boatNotes} onChange={(e) => setBoatNotes(e.target.value)} />
              </label>
            </div>
            <div className="row end mt">
              <button className="btn btn-danger btn-small" disabled={busy} onClick={() => void onRemoveBoat()}>
                Remove boat
              </button>
              <button className="btn" disabled={busy || !boatName.trim() || !boatTimezone.trim()} onClick={() => void onSaveBoat()}>
                Save
              </button>
            </div>
          </div>

          <div className="mt">
            {tab === 'PHOTOS' ? (
              <PhotosTab
                boatId={boatId}
                project={project}
                busy={busy}
                onImportPhotos={() => void onImportPhotos()}
                onImportPhotoPaths={(paths) => void onImportPhotoPaths(paths)}
                onPasteClipboardImage={(showError) => void onPasteClipboardImage(!!showError)}
                onClassify={(pid, scene, sid, mid) => void onClassifyPhoto(pid, scene, sid, mid)}
                onDelete={(ids) => void onDeletePhotos(ids)}
              />
            ) : tab === 'INVENTORY' ? (
              <div className="card">
                <InventoryManager
                  sails={project.sails}
                  masts={project.masts}
                  photos={project.photos}
                  busy={busy}
                  onAddSail={(sail) => void onAddSailFromInventory(sail)}
                  onRemoveSail={(id) => void onRemoveSail(id)}
                  onAddMast={(mast) => void onAddMastFromInventory(mast)}
                  onRemoveMast={(id) => void onRemoveMast(id)}
                />
              </div>
            ) : (
              <CrewTab
                crew={project.crew}
                busy={busy}
                newCrewName={newCrewName}
                setNewCrewName={setNewCrewName}
                newCrewEmail={newCrewEmail}
                setNewCrewEmail={setNewCrewEmail}
                newCrewRole={newCrewRole}
                setNewCrewRole={setNewCrewRole}
                onAddCrew={() => void onAddCrew()}
                onRemoveCrew={(id) => void onRemoveCrew(id)}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PhotosTab(props: {
  boatId: string
  project: BoatProject
  busy: boolean
  onImportPhotos: () => void
  onImportPhotoPaths: (paths: string[]) => void
  onPasteClipboardImage: (showErrorIfEmpty: boolean) => void
  onClassify: (photoId: string, sceneType: string, sailId?: string, mastId?: string) => void
  onDelete: (photoIds: string[]) => void
}) {
  const { photos, sails, masts } = props.project
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [dragActive, setDragActive] = useState(false)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    let canceled = false

    async function loadThumbs() {
      const entries = await Promise.all(
        photos.map(async (p: Photo) => {
          try {
            const absPath = await window.sailcloud.getPhotoPath(props.boatId, p.id)
            return [p.id, toFileUrl(absPath)] as const
          } catch {
            return [p.id, ''] as const
          }
        }),
      )

      if (canceled) return

      const next: Record<string, string> = {}
      for (const [id, url] of entries) {
        if (url) next[id] = url
      }
      setThumbUrls(next)
    }

    void loadThumbs()
    return () => {
      canceled = true
    }
  }, [props.boatId, photos])

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (props.busy) return

      const target = e.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return

      const dt = e.clipboardData
      const paths: string[] = []

      if (dt) {
        for (const f of Array.from(dt.files ?? [])) {
          const filePath = (f as unknown as { path?: unknown }).path
          if (typeof filePath === 'string' && filePath) paths.push(filePath)
        }

        for (const item of Array.from(dt.items ?? [])) {
          if (item.kind !== 'file') continue
          const f = item.getAsFile()
          const filePath = (f as unknown as { path?: unknown } | null)?.path
          if (typeof filePath === 'string' && filePath) paths.push(filePath)
        }
      }

      if (paths.length > 0) {
        e.preventDefault()
        props.onImportPhotoPaths(paths)
        return
      }

      const hasImage =
        !!dt &&
        (Array.from(dt.files ?? []).some((f) => f.type.startsWith('image/')) ||
          Array.from(dt.items ?? []).some((item) => item.kind === 'file' && item.type.startsWith('image/')))

      if (hasImage) {
        e.preventDefault()
        props.onPasteClipboardImage(false)
      }
    }

    window.addEventListener('paste', onPaste as unknown as EventListener)
    return () => window.removeEventListener('paste', onPaste as unknown as EventListener)
  }, [props])

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setDragActive(true)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragActive(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setDragActive(false)

    if (props.busy) return
    const files = Array.from(e.dataTransfer.files ?? [])
    const paths = files
      .map((f) => (f as unknown as { path?: unknown }).path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)

    if (paths.length > 0) props.onImportPhotoPaths(paths)
  }

  return (
    <div
      className={dragActive ? 'drop-target drop-target-active' : 'drop-target'}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive ? <div className="drop-overlay">Drop images to import</div> : null}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">Photos</div>
            <div className="muted small">Drag & drop here or paste (Ctrl+V). You can also import via explorer.</div>
          </div>
          <div className="row">
            <button className="btn btn-secondary" disabled={props.busy} onClick={() => props.onPasteClipboardImage(true)}>
              Paste image
            </button>
            <button className="btn" disabled={props.busy} onClick={props.onImportPhotos}>
              Import photos
            </button>
          </div>
        </div>
      </div>

      <div className="mt">
        {photos.length === 0 ? (
          <div className="muted">No photos yet.</div>
        ) : (
          <PhotoManager
            boatId={props.boatId}
            photos={photos}
            sails={sails}
            masts={masts}
            thumbUrls={thumbUrls}
            busy={props.busy}
            onClassify={props.onClassify}
            onDelete={props.onDelete}
          />
        )}
      </div>
    </div>
  )
}

function CrewTab(props: {
  crew: CrewMember[]
  busy: boolean
  newCrewName: string
  setNewCrewName: (v: string) => void
  newCrewEmail: string
  setNewCrewEmail: (v: string) => void
  newCrewRole: string
  setNewCrewRole: (v: string) => void
  onAddCrew: () => void
  onRemoveCrew: (id: string) => void
}) {
  return (
    <>
      <div className="card">
        <div className="card-title">Add team member</div>
        <div className="grid2">
          <label className="field">
            <div className="label">Name</div>
            <input className="input" value={props.newCrewName} onChange={(e) => props.setNewCrewName(e.target.value)} />
          </label>
          <label className="field">
            <div className="label">Email (optional)</div>
            <input className="input" value={props.newCrewEmail} onChange={(e) => props.setNewCrewEmail(e.target.value)} />
          </label>
          <label className="field grid2-span">
            <div className="label">Role (optional)</div>
            <input className="input" value={props.newCrewRole} onChange={(e) => props.setNewCrewRole(e.target.value)} />
          </label>
        </div>
        <div className="row end mt">
          <button className="btn" disabled={props.busy || !props.newCrewName.trim()} onClick={props.onAddCrew}>
            Add member
          </button>
        </div>
      </div>

      <div className="mt">
        {props.crew.length === 0 ? (
          <div className="muted">No crew yet.</div>
        ) : (
          <div className="grid">
            {props.crew.map((c) => (
              <div key={c.id} className="card">
                <div className="card-title">{c.name}</div>
                <div className="muted small">
                  {c.email ? c.email : '—'}
                  {c.role ? ` · ${c.role}` : ''}
                </div>
                <div className="row end mt">
                  <button className="btn btn-danger btn-small" disabled={props.busy} onClick={() => props.onRemoveCrew(c.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
