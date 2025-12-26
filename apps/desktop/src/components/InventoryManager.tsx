import { useMemo, useState } from 'react'
import type { MastProfile, Photo, Sail, SailCategory } from '../shared/domain'

// Icons
function SailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L4 20h16L12 2z" />
      <path d="M12 2v18" />
    </svg>
  )
}

function MastIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

type InventoryTab = 'SAILS' | 'MASTS'

const SAIL_CATEGORIES: Array<{ value: SailCategory; label: string; color: string }> = [
  { value: 'HEADSAIL', label: 'Headsail', color: '#60a5fa' },
  { value: 'MAINSAIL', label: 'Mainsail', color: '#4ade80' },
  { value: 'DOWNWIND', label: 'Downwind', color: '#f472b6' },
  { value: 'REACHING', label: 'Reaching', color: '#fb923c' },
  { value: 'OTHER', label: 'Other', color: '#94a3b8' },
]

type Props = {
  sails: Sail[]
  masts: MastProfile[]
  photos: Photo[]
  busy: boolean
  onAddSail: (sail: {
    category: SailCategory
    typeCode?: string
    name: string
    orderNumber?: string
    draftStripesPct: number[]
    notes?: string
  }) => void
  onRemoveSail: (id: string) => void
  onAddMast: (mast: {
    name: string
    houndsPct?: number
    spreadersPct: number[]
    notes?: string
  }) => void
  onRemoveMast: (id: string) => void
}

export function InventoryManager({
  sails,
  masts,
  photos,
  busy,
  onAddSail,
  onRemoveSail,
  onAddMast,
  onRemoveMast,
}: Props) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('SAILS')
  const [showAddSail, setShowAddSail] = useState(false)
  const [showAddMast, setShowAddMast] = useState(false)

  // Form state for adding sails
  const [newSailCategory, setNewSailCategory] = useState<SailCategory>('HEADSAIL')
  const [newSailTypeCode, setNewSailTypeCode] = useState('')
  const [newSailName, setNewSailName] = useState('')
  const [newSailOrderNumber, setNewSailOrderNumber] = useState('')
  const [newSailDraftStripes, setNewSailDraftStripes] = useState('25, 50, 75')
  const [newSailNotes, setNewSailNotes] = useState('')

  // Form state for adding masts
  const [newMastName, setNewMastName] = useState('')
  const [newMastHoundsPct, setNewMastHoundsPct] = useState('')
  const [newMastSpreadersPct, setNewMastSpreadersPct] = useState('45, 65')
  const [newMastNotes, setNewMastNotes] = useState('')

  // Calculate usage stats
  const sailUsage = useMemo(() => {
    const usage: Record<string, number> = {}
    for (const sail of sails) {
      usage[sail.id] = photos.filter((p) => p.analysis?.sailId === sail.id).length
    }
    return usage
  }, [sails, photos])

  const mastUsage = useMemo(() => {
    const usage: Record<string, number> = {}
    for (const mast of masts) {
      usage[mast.id] = photos.filter((p) => p.analysis?.mastId === mast.id).length
    }
    return usage
  }, [masts, photos])

  // Group sails by category
  const sailsByCategory = useMemo(() => {
    const grouped: Record<SailCategory, Sail[]> = {
      HEADSAIL: [],
      MAINSAIL: [],
      DOWNWIND: [],
      REACHING: [],
      OTHER: [],
    }
    for (const sail of sails) {
      grouped[sail.category].push(sail)
    }
    return grouped
  }, [sails])

  function parsePercentList(input: string): number[] {
    const parts = input
      .split(/[,\s]+/g)
      .map((p) => p.trim())
      .filter(Boolean)
    const nums = parts.map((p) => Number(p))
    if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n >= 100)) return []
    return nums.sort((a, b) => a - b)
  }

  function handleAddSail() {
    const draftStripes = parsePercentList(newSailDraftStripes)
    if (!newSailName.trim() || draftStripes.length === 0) return

    onAddSail({
      category: newSailCategory,
      typeCode: newSailTypeCode || undefined,
      name: newSailName.trim(),
      orderNumber: newSailOrderNumber || undefined,
      draftStripesPct: draftStripes,
      notes: newSailNotes || undefined,
    })

    // Reset form
    setNewSailName('')
    setNewSailTypeCode('')
    setNewSailOrderNumber('')
    setNewSailNotes('')
    setShowAddSail(false)
  }

  function handleAddMast() {
    const spreaders = parsePercentList(newMastSpreadersPct)
    if (!newMastName.trim()) return

    const houndsPct = newMastHoundsPct.trim()
      ? Number(newMastHoundsPct)
      : undefined

    onAddMast({
      name: newMastName.trim(),
      houndsPct: Number.isFinite(houndsPct) && houndsPct! > 0 && houndsPct! < 100 ? houndsPct : undefined,
      spreadersPct: spreaders,
      notes: newMastNotes || undefined,
    })

    // Reset form
    setNewMastName('')
    setNewMastHoundsPct('')
    setNewMastNotes('')
    setShowAddMast(false)
  }

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <div className="inventory-stats">
          <div className="inventory-stat">
            <SailIcon />
            <span>{sails.length} sails</span>
          </div>
          <div className="inventory-stat">
            <MastIcon />
            <span>{masts.length} mast profiles</span>
          </div>
        </div>
        <div className="inventory-tabs">
          <button
            className={`inventory-tab ${activeTab === 'SAILS' ? 'inventory-tab-active' : ''}`}
            onClick={() => setActiveTab('SAILS')}
          >
            <SailIcon />
            Sails
          </button>
          <button
            className={`inventory-tab ${activeTab === 'MASTS' ? 'inventory-tab-active' : ''}`}
            onClick={() => setActiveTab('MASTS')}
          >
            <MastIcon />
            Masts
          </button>
        </div>
      </div>

      {activeTab === 'SAILS' ? (
        <div className="inventory-content">
          <div className="inventory-action-bar">
            <button
              className="btn inventory-add-btn"
              onClick={() => setShowAddSail(!showAddSail)}
              disabled={busy}
            >
              <PlusIcon />
              Add Sail
            </button>
          </div>

          {showAddSail && (
            <div className="inventory-add-form">
              <div className="inventory-form-row">
                <label className="field">
                  <div className="label">Category</div>
                  <select
                    className="select"
                    value={newSailCategory}
                    onChange={(e) => setNewSailCategory(e.target.value as SailCategory)}
                  >
                    {SAIL_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <div className="label">Name</div>
                  <input
                    className="input"
                    value={newSailName}
                    onChange={(e) => setNewSailName(e.target.value)}
                    placeholder="e.g. J1 Light"
                  />
                </label>
              </div>
              <div className="inventory-form-row">
                <label className="field">
                  <div className="label">Type Code</div>
                  <input
                    className="input"
                    value={newSailTypeCode}
                    onChange={(e) => setNewSailTypeCode(e.target.value)}
                    placeholder="e.g. J1"
                  />
                </label>
                <label className="field">
                  <div className="label">Order #</div>
                  <input
                    className="input"
                    value={newSailOrderNumber}
                    onChange={(e) => setNewSailOrderNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <label className="field">
                <div className="label">Draft Stripes (% height)</div>
                <input
                  className="input mono"
                  value={newSailDraftStripes}
                  onChange={(e) => setNewSailDraftStripes(e.target.value)}
                  placeholder="25, 50, 75"
                />
                <div className="muted small">Comma-separated percentages (0-100)</div>
              </label>
              <label className="field">
                <div className="label">Notes</div>
                <textarea
                  className="textarea"
                  rows={2}
                  value={newSailNotes}
                  onChange={(e) => setNewSailNotes(e.target.value)}
                />
              </label>
              <div className="inventory-form-actions">
                <button className="btn btn-secondary" onClick={() => setShowAddSail(false)}>
                  Cancel
                </button>
                <button
                  className="btn"
                  disabled={busy || !newSailName.trim() || parsePercentList(newSailDraftStripes).length === 0}
                  onClick={handleAddSail}
                >
                  Add Sail
                </button>
              </div>
            </div>
          )}

          {sails.length === 0 ? (
            <div className="inventory-empty">
              <SailIcon />
              <div>No sails configured yet</div>
              <div className="muted small">Add your first sail to start tracking measurements</div>
            </div>
          ) : (
            <div className="inventory-categories">
              {SAIL_CATEGORIES.map((category) => {
                const categorySails = sailsByCategory[category.value]
                if (categorySails.length === 0) return null

                return (
                  <div key={category.value} className="inventory-category">
                    <div className="inventory-category-header" style={{ borderColor: category.color }}>
                      <span style={{ color: category.color }}>{category.label}</span>
                      <span className="muted small">{categorySails.length}</span>
                    </div>
                    <div className="inventory-items">
                      {categorySails.map((sail) => (
                        <div key={sail.id} className="inventory-item">
                          <div
                            className="inventory-item-indicator"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="inventory-item-content">
                            <div className="inventory-item-header">
                              <div className="inventory-item-name">{sail.name}</div>
                              {sail.typeCode && (
                                <div className="inventory-item-code">{sail.typeCode}</div>
                              )}
                            </div>
                            <div className="inventory-item-meta">
                              <span>Stripes: {sail.draftStripesPct.join(', ')}%</span>
                              {sailUsage[sail.id] > 0 && (
                                <span className="inventory-item-usage">
                                  <PhotoIcon />
                                  {sailUsage[sail.id]}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            className="inventory-item-delete"
                            onClick={() => {
                              if (window.confirm(`Remove sail "${sail.name}"?`)) {
                                onRemoveSail(sail.id)
                              }
                            }}
                            disabled={busy}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="inventory-content">
          <div className="inventory-action-bar">
            <button
              className="btn inventory-add-btn"
              onClick={() => setShowAddMast(!showAddMast)}
              disabled={busy}
            >
              <PlusIcon />
              Add Mast Profile
            </button>
          </div>

          {showAddMast && (
            <div className="inventory-add-form">
              <div className="inventory-form-row">
                <label className="field">
                  <div className="label">Name</div>
                  <input
                    className="input"
                    value={newMastName}
                    onChange={(e) => setNewMastName(e.target.value)}
                    placeholder="e.g. Race Rig"
                  />
                </label>
                <label className="field">
                  <div className="label">Hounds (%)</div>
                  <input
                    className="input mono"
                    value={newMastHoundsPct}
                    onChange={(e) => setNewMastHoundsPct(e.target.value)}
                    placeholder="e.g. 80"
                  />
                </label>
              </div>
              <label className="field">
                <div className="label">Spreaders (% up the rig)</div>
                <input
                  className="input mono"
                  value={newMastSpreadersPct}
                  onChange={(e) => setNewMastSpreadersPct(e.target.value)}
                  placeholder="45, 65"
                />
                <div className="muted small">Comma-separated percentages (0-100)</div>
              </label>
              <label className="field">
                <div className="label">Notes</div>
                <textarea
                  className="textarea"
                  rows={2}
                  value={newMastNotes}
                  onChange={(e) => setNewMastNotes(e.target.value)}
                />
              </label>
              <div className="inventory-form-actions">
                <button className="btn btn-secondary" onClick={() => setShowAddMast(false)}>
                  Cancel
                </button>
                <button
                  className="btn"
                  disabled={busy || !newMastName.trim()}
                  onClick={handleAddMast}
                >
                  Add Mast
                </button>
              </div>
            </div>
          )}

          {masts.length === 0 ? (
            <div className="inventory-empty">
              <MastIcon />
              <div>No mast profiles yet</div>
              <div className="muted small">Add a mast profile to track rig measurements</div>
            </div>
          ) : (
            <div className="inventory-items">
              {masts.map((mast) => (
                <div key={mast.id} className="inventory-item inventory-item-mast">
                  <div className="inventory-item-icon">
                    <MastIcon />
                  </div>
                  <div className="inventory-item-content">
                    <div className="inventory-item-header">
                      <div className="inventory-item-name">{mast.name}</div>
                    </div>
                    <div className="inventory-item-meta">
                      <span>
                        {mast.houndsPct ? `Hounds: ${mast.houndsPct}%` : 'No hounds'}
                        {' · '}
                        {mast.spreadersPct.length} spreader{mast.spreadersPct.length !== 1 ? 's' : ''} ({mast.spreadersPct.join(', ')}%)
                      </span>
                      {mastUsage[mast.id] > 0 && (
                        <span className="inventory-item-usage">
                          <PhotoIcon />
                          {mastUsage[mast.id]}
                        </span>
                      )}
                    </div>
                    {mast.notes && <div className="inventory-item-notes">{mast.notes}</div>}
                  </div>
                  <button
                    className="inventory-item-delete"
                    onClick={() => {
                      if (window.confirm(`Remove mast profile "${mast.name}"?`)) {
                        onRemoveMast(mast.id)
                      }
                    }}
                    disabled={busy}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
