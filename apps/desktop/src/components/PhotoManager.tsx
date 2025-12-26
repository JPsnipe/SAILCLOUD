/**
 * Photo Manager Component
 *
 * Enhanced photo management with:
 * - Better classification dropdown with icons
 * - Bulk selection and operations
 * - Delete functionality
 * - Filtering and sorting
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Photo, Sail, MastProfile } from '../shared/domain'

// Icons as SVG components for better visual hierarchy
const SailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 21L4 4C4 4 8 2 12 6C16 10 20 8 20 8L20 21" />
    <path d="M4 21H20" />
  </svg>
)

const MastIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
)

const PhotoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15L16 10L5 21" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6H21" />
    <path d="M19 6V20C19 21 18 22 17 22H7C6 22 5 21 5 20V6" />
    <path d="M8 6V4C8 3 9 2 10 2H14C15 2 16 3 16 4V6" />
  </svg>
)

const InboxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12H16L14 15H10L8 12H2" />
    <path d="M5.45 5.11L2 12V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V12L18.55 5.11C18.21 4.43 17.52 4 16.76 4H7.24C6.48 4 5.79 4.43 5.45 5.11Z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

interface PhotoManagerProps {
  boatId: string
  photos: Photo[]
  sails: Sail[]
  masts: MastProfile[]
  thumbUrls: Record<string, string>
  busy: boolean
  onClassify: (photoId: string, sceneType: string, sailId?: string, mastId?: string) => void
  onDelete?: (photoIds: string[]) => void
  onRename?: (photoId: string, newName: string) => void
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'
type FilterOption = 'all' | 'inbox' | 'sails' | 'rigging' | 'other' | string

export function PhotoManager({
  boatId,
  photos,
  sails,
  masts,
  thumbUrls,
  busy,
  onClassify,
  onDelete,
  onRename,
}: PhotoManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (filterBy === 'all') return true
      if (filterBy === 'inbox') return !p.analysis
      if (filterBy === 'sails') return p.analysis?.sailId
      if (filterBy === 'rigging') return p.analysis?.mastId
      if (filterBy === 'other') return p.analysis && !p.analysis.sailId && !p.analysis.mastId
      // Filter by specific sail or mast ID
      if (filterBy.startsWith('sail:')) return p.analysis?.sailId === filterBy.replace('sail:', '')
      if (filterBy.startsWith('mast:')) return p.analysis?.mastId === filterBy.replace('mast:', '')
      return true
    })
  }, [photos, filterBy])

  // Sort photos
  const sortedPhotos = useMemo(() => {
    const sorted = [...filteredPhotos]
    switch (sortBy) {
      case 'date-desc':
        return sorted.sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      case 'date-asc':
        return sorted.sort((a, b) => a.importedAt.localeCompare(b.importedAt))
      case 'name-asc':
        return sorted.sort((a, b) => (a.name ?? a.fileName).localeCompare(b.name ?? b.fileName))
      case 'name-desc':
        return sorted.sort((a, b) => (b.name ?? b.fileName).localeCompare(a.name ?? a.fileName))
      default:
        return sorted
    }
  }, [filteredPhotos, sortBy])

  // Update selection when filter changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const filteredIds = new Set(filteredPhotos.map((p) => p.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (filteredIds.has(id)) next.add(id)
      }
      return next
    })
  }, [filteredPhotos])

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(sortedPhotos.map((p) => p.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function handleBulkClassify(sceneType: string, sailId?: string, mastId?: string) {
    for (const photoId of selectedIds) {
      onClassify(photoId, sceneType, sailId, mastId)
    }
    setSelectedIds(new Set())
    setShowBulkActions(false)
  }

  function handleBulkDelete() {
    if (!onDelete) return
    const ids = Array.from(selectedIds)
    const confirmed = window.confirm(`Delete ${ids.length} photo(s)? This cannot be undone.`)
    if (confirmed) {
      onDelete(ids)
      setSelectedIds(new Set())
      setShowBulkActions(false)
    }
  }

  const hasSelection = selectedIds.size > 0

  return (
    <div className="photo-manager">
      {/* Toolbar */}
      <div className="photo-manager-toolbar">
        <div className="photo-manager-toolbar-left">
          {/* Filter dropdown */}
          <div className="photo-filter">
            <label className="photo-filter-label">Filter:</label>
            <select
              className="select select-small"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
            >
              <option value="all">All Photos ({photos.length})</option>
              <option value="inbox">Inbox ({photos.filter((p) => !p.analysis).length})</option>
              <option value="sails">All Sails ({photos.filter((p) => p.analysis?.sailId).length})</option>
              {sails.map((s) => (
                <option key={s.id} value={`sail:${s.id}`}>
                  &nbsp;&nbsp;{s.name} ({photos.filter((p) => p.analysis?.sailId === s.id).length})
                </option>
              ))}
              <option value="rigging">All Rigging ({photos.filter((p) => p.analysis?.mastId).length})</option>
              {masts.map((m) => (
                <option key={m.id} value={`mast:${m.id}`}>
                  &nbsp;&nbsp;{m.name} ({photos.filter((p) => p.analysis?.mastId === m.id).length})
                </option>
              ))}
              <option value="other">Other ({photos.filter((p) => p.analysis && !p.analysis.sailId && !p.analysis.mastId).length})</option>
            </select>
          </div>

          {/* Sort dropdown */}
          <div className="photo-sort">
            <label className="photo-sort-label">Sort:</label>
            <select
              className="select select-small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>

        <div className="photo-manager-toolbar-right">
          {/* Selection controls */}
          <div className="photo-selection-controls">
            <button
              className="btn btn-small btn-secondary"
              onClick={hasSelection ? deselectAll : selectAll}
            >
              {hasSelection ? `Deselect (${selectedIds.size})` : 'Select all'}
            </button>

            {hasSelection && (
              <button
                className="btn btn-small"
                onClick={() => setShowBulkActions(!showBulkActions)}
              >
                Bulk actions
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk actions panel */}
      {showBulkActions && hasSelection && (
        <div className="bulk-actions-panel">
          <div className="bulk-actions-header">
            <strong>{selectedIds.size} photos selected</strong>
            <button className="btn-icon" onClick={() => setShowBulkActions(false)}>×</button>
          </div>
          <div className="bulk-actions-content">
            <div className="bulk-actions-section">
              <div className="bulk-actions-label">Move to sail:</div>
              <div className="bulk-actions-buttons">
                {sails.map((s) => (
                  <button
                    key={s.id}
                    className="btn btn-small btn-secondary"
                    disabled={busy}
                    onClick={() => handleBulkClassify('ONBOARD_SAIL', s.id, undefined)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="bulk-actions-section">
              <div className="bulk-actions-label">Move to rigging:</div>
              <div className="bulk-actions-buttons">
                {masts.map((m) => (
                  <button
                    key={m.id}
                    className="btn btn-small btn-secondary"
                    disabled={busy}
                    onClick={() => handleBulkClassify('MAST_BEND', undefined, m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="bulk-actions-section">
              <div className="bulk-actions-label">Other:</div>
              <div className="bulk-actions-buttons">
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busy}
                  onClick={() => handleBulkClassify('GENERIC', undefined, undefined)}
                >
                  General
                </button>
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busy}
                  onClick={() => handleBulkClassify('CHASE_SAIL', undefined, undefined)}
                >
                  Chase Boat
                </button>
                {onDelete && (
                  <button
                    className="btn btn-small btn-danger"
                    disabled={busy}
                    onClick={handleBulkDelete}
                  >
                    <TrashIcon /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="photo-manager-grid">
        {sortedPhotos.length === 0 ? (
          <div className="photo-manager-empty">
            <div className="muted">No photos match the current filter.</div>
          </div>
        ) : (
          sortedPhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              boatId={boatId}
              sails={sails}
              masts={masts}
              thumbUrl={thumbUrls[photo.id]}
              selected={selectedIds.has(photo.id)}
              busy={busy}
              onToggleSelect={() => toggleSelect(photo.id)}
              onClassify={(sceneType, sailId, mastId) => onClassify(photo.id, sceneType, sailId, mastId)}
              onDelete={onDelete ? () => {
                const confirmed = window.confirm(`Delete "${photo.name ?? photo.fileName}"? This cannot be undone.`)
                if (confirmed) onDelete([photo.id])
              } : undefined}
              onRename={onRename ? (newName) => onRename(photo.id, newName) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface PhotoCardProps {
  photo: Photo
  boatId: string
  sails: Sail[]
  masts: MastProfile[]
  thumbUrl?: string
  selected: boolean
  busy: boolean
  onToggleSelect: () => void
  onClassify: (sceneType: string, sailId?: string, mastId?: string) => void
  onDelete?: () => void
  onRename?: (newName: string) => void
}

function PhotoCard({
  photo,
  boatId,
  sails,
  masts,
  thumbUrl,
  selected,
  busy,
  onToggleSelect,
  onClassify,
  onDelete,
  onRename: _onRename,
}: PhotoCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Get current assignment info
  const currentSail = photo.analysis?.sailId ? sails.find((s) => s.id === photo.analysis?.sailId) : null
  const currentMast = photo.analysis?.mastId ? masts.find((m) => m.id === photo.analysis?.mastId) : null
  const isClassified = !!photo.analysis
  const sceneLabel = photo.analysis?.sceneType?.replace(/_/g, ' ') ?? ''

  function handleMenuClick(action: string) {
    setDropdownOpen(false)

    if (action === 'INBOX') {
      // Clear classification - move to inbox
      // This requires a special handler since we're removing analysis
      onClassify('DEPRECATED', undefined, undefined)
    } else if (action.startsWith('SAIL:')) {
      onClassify('ONBOARD_SAIL', action.replace('SAIL:', ''), undefined)
    } else if (action.startsWith('MAST:')) {
      onClassify('MAST_BEND', undefined, action.replace('MAST:', ''))
    } else {
      onClassify(action, undefined, undefined)
    }
  }

  return (
    <div className={`photo-card-v2 ${selected ? 'photo-card-selected' : ''}`}>
      {/* Selection checkbox */}
      <button
        className={`photo-checkbox ${selected ? 'photo-checkbox-checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
      >
        {selected && <CheckIcon />}
      </button>

      {/* Image */}
      <div className="photo-card-image">
        {thumbUrl ? (
          <img src={thumbUrl} alt={photo.name ?? photo.fileName} loading="lazy" draggable={false} />
        ) : (
          <div className="photo-card-placeholder">
            <PhotoIcon />
          </div>
        )}

        {/* Scene badge */}
        {sceneLabel && (
          <div className="photo-card-badge">{sceneLabel}</div>
        )}
      </div>

      {/* Info */}
      <div className="photo-card-info">
        <div className="photo-card-name">{photo.name ?? photo.fileName}</div>
        <div className="photo-card-meta">
          {new Date(photo.importedAt).toLocaleDateString()}
        </div>

        {/* Current assignment */}
        {currentSail && (
          <div className="photo-card-assignment sail">
            <SailIcon /> {currentSail.name}
          </div>
        )}
        {currentMast && (
          <div className="photo-card-assignment mast">
            <MastIcon /> {currentMast.name}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="photo-card-actions">
        {/* Dropdown menu */}
        <div className="photo-dropdown" ref={dropdownRef}>
          <button
            className="photo-dropdown-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={busy}
          >
            Move to...
            <span className="photo-dropdown-arrow">▾</span>
          </button>

          {dropdownOpen && (
            <div className="photo-dropdown-menu">
              {/* Current status indicator */}
              {isClassified && (
                <div className="photo-dropdown-current">
                  Current: {currentSail?.name ?? currentMast?.name ?? sceneLabel ?? 'Classified'}
                </div>
              )}

              {/* Move to inbox option */}
              {isClassified && (
                <>
                  <button
                    className="photo-dropdown-item"
                    onClick={() => handleMenuClick('INBOX')}
                  >
                    <InboxIcon />
                    <span>Move to Inbox</span>
                  </button>
                  <div className="photo-dropdown-divider" />
                </>
              )}

              {/* Sails section */}
              {sails.length > 0 && (
                <>
                  <div className="photo-dropdown-section">
                    <SailIcon />
                    <span>Sails</span>
                  </div>
                  {sails.map((s) => (
                    <button
                      key={s.id}
                      className={`photo-dropdown-item ${currentSail?.id === s.id ? 'photo-dropdown-item-active' : ''}`}
                      onClick={() => handleMenuClick(`SAIL:${s.id}`)}
                    >
                      <span className="photo-dropdown-item-name">{s.name}</span>
                      {s.typeCode && <span className="photo-dropdown-item-code">{s.typeCode}</span>}
                      {currentSail?.id === s.id && <CheckIcon />}
                    </button>
                  ))}
                  <div className="photo-dropdown-divider" />
                </>
              )}

              {/* Masts/Rigging section */}
              {masts.length > 0 && (
                <>
                  <div className="photo-dropdown-section">
                    <MastIcon />
                    <span>Rigging</span>
                  </div>
                  {masts.map((m) => (
                    <button
                      key={m.id}
                      className={`photo-dropdown-item ${currentMast?.id === m.id ? 'photo-dropdown-item-active' : ''}`}
                      onClick={() => handleMenuClick(`MAST:${m.id}`)}
                    >
                      <span className="photo-dropdown-item-name">{m.name}</span>
                      {currentMast?.id === m.id && <CheckIcon />}
                    </button>
                  ))}
                  <div className="photo-dropdown-divider" />
                </>
              )}

              {/* Other options */}
              <div className="photo-dropdown-section">
                <PhotoIcon />
                <span>Other</span>
              </div>
              <button
                className={`photo-dropdown-item ${photo.analysis?.sceneType === 'GENERIC' ? 'photo-dropdown-item-active' : ''}`}
                onClick={() => handleMenuClick('GENERIC')}
              >
                <span className="photo-dropdown-item-name">General photo</span>
                {photo.analysis?.sceneType === 'GENERIC' && <CheckIcon />}
              </button>
              <button
                className={`photo-dropdown-item ${photo.analysis?.sceneType === 'CHASE_SAIL' || photo.analysis?.sceneType === 'CHASE_SAIL_UPWIND' ? 'photo-dropdown-item-active' : ''}`}
                onClick={() => handleMenuClick('CHASE_SAIL_UPWIND')}
              >
                <span className="photo-dropdown-item-name">Chase Boat view</span>
                {(photo.analysis?.sceneType === 'CHASE_SAIL' || photo.analysis?.sceneType === 'CHASE_SAIL_UPWIND') && <CheckIcon />}
              </button>

              {/* Delete option */}
              {onDelete && (
                <>
                  <div className="photo-dropdown-divider" />
                  <button
                    className="photo-dropdown-item photo-dropdown-item-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDropdownOpen(false)
                      onDelete()
                    }}
                  >
                    <TrashIcon />
                    <span>Delete photo</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Measure button */}
        <Link
          className="btn btn-small btn-primary"
          to={`/boats/${boatId}/photos/${photo.id}`}
        >
          {photo.analysis ? 'Review' : 'Measure'}
        </Link>
      </div>
    </div>
  )
}

export default PhotoManager
