import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BoatSummary } from '../shared/domain'

type CreateBoatFormState = {
  name: string
  basePath: string      // Base folder (e.g., Documents)
  useSubfolder: boolean // Create subfolder with boat name
  timezone: string
  notes: string
}

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

// Icons for the dashboard
function SailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L4 20h16L12 2z" />
      <path d="M12 2v18" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  )
}

function InboxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function MastIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function FleetStats({ boats }: { boats: BoatSummary[] }) {
  const totals = useMemo(() => {
    return boats.reduce(
      (acc, boat) => {
        const stats = boat.stats
        if (stats) {
          acc.photos += stats.photoCount
          acc.inbox += stats.inboxCount
          acc.sails += stats.sailCount
          acc.masts += stats.mastCount
          acc.analyzed += stats.analyzedCount
        }
        return acc
      },
      { photos: 0, inbox: 0, sails: 0, masts: 0, analyzed: 0 },
    )
  }, [boats])

  return (
    <div className="fleet-stats">
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon boats">
          <SailIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{boats.length}</div>
          <div className="fleet-stat-label">Boats</div>
        </div>
      </div>
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon photos">
          <PhotoIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{totals.photos}</div>
          <div className="fleet-stat-label">Total Photos</div>
        </div>
      </div>
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon inbox">
          <InboxIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{totals.inbox}</div>
          <div className="fleet-stat-label">Inbox</div>
        </div>
      </div>
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon sails">
          <SailIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{totals.sails}</div>
          <div className="fleet-stat-label">Sails</div>
        </div>
      </div>
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon masts">
          <MastIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{totals.masts}</div>
          <div className="fleet-stat-label">Mast Profiles</div>
        </div>
      </div>
      <div className="fleet-stat-card">
        <div className="fleet-stat-icon analyzed">
          <ChartIcon />
        </div>
        <div className="fleet-stat-content">
          <div className="fleet-stat-value">{totals.analyzed}</div>
          <div className="fleet-stat-label">Analyzed</div>
        </div>
      </div>
    </div>
  )
}

function BoatCard({ boat, onRemove }: { boat: BoatSummary; onRemove: () => void }) {
  const stats = boat.stats
  const hasInbox = stats && stats.inboxCount > 0

  return (
    <div className="boat-card">
      <div className="boat-card-header">
        <div className="boat-card-title">{boat.name}</div>
        {hasInbox && <div className="boat-card-badge">{stats.inboxCount} pending</div>}
      </div>

      {stats && (
        <div className="boat-card-stats">
          <div className="boat-card-stat">
            <PhotoIcon />
            <span>{stats.photoCount} photos</span>
          </div>
          <div className="boat-card-stat">
            <SailIcon />
            <span>{stats.sailCount} sails</span>
          </div>
          <div className="boat-card-stat">
            <MastIcon />
            <span>{stats.mastCount} masts</span>
          </div>
          <div className="boat-card-stat">
            <ChartIcon />
            <span>{stats.analyzedCount} analyzed</span>
          </div>
        </div>
      )}

      <div className="boat-card-meta">
        <div className="muted small">Timezone: {boat.timezone}</div>
        <div className="muted small mono truncate">{boat.folderPath}</div>
      </div>

      <div className="boat-card-actions">
        <Link className="btn" to={`/boats/${boat.id}`}>
          Open
        </Link>
        <button className="btn btn-danger btn-small" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}

export function BoatListPage() {
  const navigate = useNavigate()
  const [boats, setBoats] = useState<BoatSummary[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateBoatFormState>(() => ({
    name: '',
    basePath: '',
    useSubfolder: true, // Default: create subfolder with boat name
    timezone: defaultTimezone(),
    notes: '',
  }))

  // Compute the final folder path
  const finalFolderPath = useMemo(() => {
    if (!createForm.basePath) return ''
    if (!createForm.useSubfolder) return createForm.basePath
    const sanitizedName = createForm.name.trim().replace(/[<>:"/\\|?*]/g, '_') || 'NewBoat'
    return `${createForm.basePath}${createForm.basePath.endsWith('\\') || createForm.basePath.endsWith('/') ? '' : '\\'}${sanitizedName}`
  }, [createForm.basePath, createForm.name, createForm.useSubfolder])

  const canCreate = useMemo(() => {
    return (
      createForm.name.trim().length > 0 &&
      createForm.basePath.trim().length > 0 &&
      createForm.timezone.trim().length > 0
    )
  }, [createForm.basePath, createForm.name, createForm.timezone])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const data = await window.sailcloud.listBoats()
      setBoats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function pickBaseFolder() {
    setCreateError('')
    const res = await window.sailcloud.selectBoatFolder()
    const folderPath = res.folderPath
    if (!folderPath) return
    setCreateForm((prev) => ({ ...prev, basePath: folderPath }))
  }

  async function addExisting() {
    setError('')
    try {
      const res = await window.sailcloud.selectBoatFolder()
      const folderPath = res.folderPath
      if (!folderPath) return
      const boat = await window.sailcloud.addExistingBoatFolder(folderPath)
      await refresh()
      navigate(`/boats/${boat.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add existing boat folder')
    }
  }

  async function submitCreate() {
    if (!canCreate || !finalFolderPath) return
    setCreating(true)
    setCreateError('')
    try {
      const boat = await window.sailcloud.createBoat({
        name: createForm.name,
        folderPath: finalFolderPath,
        timezone: createForm.timezone,
        notes: createForm.notes,
      })
      setIsCreateOpen(false)
      setCreateForm({ name: '', basePath: '', useSubfolder: true, timezone: defaultTimezone(), notes: '' })
      await refresh()
      navigate(`/boats/${boat.id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create boat')
    } finally {
      setCreating(false)
    }
  }

  async function onRemoveBoat(boat: BoatSummary) {
    const ok = window.confirm(
      `Remove "${boat.name}" from the library?\n\nThis does NOT delete the folder:\n${boat.folderPath}`,
    )
    if (!ok) return

    setError('')
    setLoading(true)
    try {
      await window.sailcloud.removeBoatFromLibrary(boat.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove boat')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page fleet-dashboard">
      <div className="page-header">
        <div>
          <h1 className="h1">Fleet Dashboard</h1>
          <div className="muted">Manage your boats, sails, and sail shape analysis.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setIsCreateOpen(true)}>
            Add boat
          </button>
          <button className="btn btn-secondary" onClick={() => void addExisting()}>
            Add existing folder
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : boats.length === 0 ? (
        <div className="card">
          <div className="h2">No boats yet</div>
          <div className="muted">Create a boat to initialize its folder structure and inventory.</div>
        </div>
      ) : (
        <>
          <FleetStats boats={boats} />

          <div className="fleet-section">
            <h2 className="h2">Your Boats</h2>
            <div className="boat-grid">
              {boats.map((boat) => (
                <BoatCard key={boat.id} boat={boat} onRemove={() => void onRemoveBoat(boat)} />
              ))}
            </div>
          </div>
        </>
      )}

      {isCreateOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-title">Create boat</div>

            {createError ? <div className="alert alert-error">{createError}</div> : null}

            <label className="field">
              <div className="label">Boat name</div>
              <input
                className="input"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. TP52 Training"
                autoFocus
              />
            </label>

            <div className="field">
              <div className="label">Location</div>
              <div className="row">
                <input
                  className="input mono"
                  value={createForm.basePath}
                  readOnly
                  placeholder="Select parent folder…"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={() => void pickBaseFolder()}>
                  Browse…
                </button>
              </div>
            </div>

            <div className="field">
              <label className="row" style={{ cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={createForm.useSubfolder}
                  onChange={(e) => setCreateForm((p) => ({ ...p, useSubfolder: e.target.checked }))}
                  style={{ width: 18, height: 18 }}
                />
                <span>Create subfolder with boat name <span className="muted">(recommended)</span></span>
              </label>
            </div>

            {finalFolderPath && (
              <div className="field">
                <div className="label">Final location</div>
                <div
                  className="mono small"
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    borderRadius: '6px',
                    wordBreak: 'break-all',
                  }}
                >
                  {finalFolderPath}
                </div>
                <div className="muted small" style={{ marginTop: '4px' }}>
                  Will create: <span className="mono">images/</span>, <span className="mono">logs/</span>, <span className="mono">reports/</span>
                </div>
              </div>
            )}

            <label className="field">
              <div className="label">Timezone</div>
              <input
                className="input"
                value={createForm.timezone}
                onChange={(e) => setCreateForm((p) => ({ ...p, timezone: e.target.value }))}
                placeholder="e.g. Europe/Madrid"
              />
            </label>

            <label className="field">
              <div className="label">Notes <span className="muted">(optional)</span></div>
              <textarea
                className="textarea"
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Known reference lengths (e.g. spreaders, stanchions)…"
                rows={3}
              />
            </label>

            <div className="row end mt">
              <button className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn" onClick={() => void submitCreate()} disabled={!canCreate || creating}>
                {creating ? 'Creating…' : 'Create boat'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
