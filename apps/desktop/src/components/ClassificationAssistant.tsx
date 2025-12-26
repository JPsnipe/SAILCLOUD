import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { BoatProject, PhotoAnalysis, SceneType } from '../shared/domain'

// Scene type groups for better organization
type SceneGroup = {
  label: string
  icon: ReactNode
  scenes: Array<{ value: SceneType; label: string; description: string }>
}

const SCENE_GROUPS: SceneGroup[] = [
  {
    label: 'Sail Analysis',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L4 20h16L12 2z" />
        <path d="M12 2v18" />
      </svg>
    ),
    scenes: [
      { value: 'ONBOARD_SAIL', label: 'Onboard Sail', description: 'Photo taken from on the boat, measuring stripe curvature' },
      { value: 'CHASE_SAIL_UPWIND', label: 'Chase Upwind', description: 'Photo from chase boat while sailing upwind' },
      { value: 'CHASE_SAIL_DOWNWIND', label: 'Chase Downwind', description: 'Photo from chase boat while sailing downwind' },
    ],
  },
  {
    label: 'Rig Analysis',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="6" y1="12" x2="18" y2="12" />
      </svg>
    ),
    scenes: [
      { value: 'MAST_BEND_FORE_AFT', label: 'Mast Bend (F/A)', description: 'Fore-aft mast bend measurement' },
      { value: 'MAST_BEND_LATERAL', label: 'Mast Bend (Lateral)', description: 'Lateral (sideways) mast bend' },
      { value: 'RAKE', label: 'Rake', description: 'Mast rake angle measurement' },
      { value: 'HEEL', label: 'Heel', description: 'Boat heel angle from horizon' },
    ],
  },
  {
    label: 'Other',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </svg>
    ),
    scenes: [
      { value: 'GENERIC', label: 'Generic', description: 'Reference photo without specific analysis' },
      { value: 'DEPRECATED', label: 'Deprecated', description: 'No longer used, kept for compatibility' },
    ],
  },
]

// Progress indicators
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

type ClassificationStatus = 'unclassified' | 'incomplete' | 'complete'

function getClassificationStatus(analysis: PhotoAnalysis | null, _project: BoatProject | null): ClassificationStatus {
  if (!analysis) return 'unclassified'
  if (analysis.sceneType === 'GENERIC' || analysis.sceneType === 'DEPRECATED') return 'unclassified'

  // Check if sail is assigned for sail-related scenes
  if (
    ['ONBOARD_SAIL', 'CHASE_SAIL_UPWIND', 'CHASE_SAIL_DOWNWIND'].includes(analysis.sceneType) &&
    !analysis.sailId
  ) {
    return 'incomplete'
  }

  // Check if there are any layers with points
  const hasPoints = analysis.layers.some((l) => l.points.length > 0)
  if (!hasPoints) return 'incomplete'

  return 'complete'
}

type Props = {
  project: BoatProject | null
  analysis: PhotoAnalysis | null
  onSceneChange: (sceneType: SceneType) => void
  onSailChange: (sailId: string) => void
  onMastChange: (mastId: string) => void
}

export function ClassificationAssistant({ project, analysis, onSceneChange, onSailChange, onMastChange }: Props) {
  const currentScene = analysis?.sceneType ?? 'GENERIC'
  const status = getClassificationStatus(analysis, project)

  const isSailScene = ['ONBOARD_SAIL', 'CHASE_SAIL_UPWIND', 'CHASE_SAIL_DOWNWIND'].includes(currentScene)
  const isRigScene = ['MAST_BEND_FORE_AFT', 'MAST_BEND_LATERAL', 'RAKE', 'HEEL'].includes(currentScene)

  const statusMessage = useMemo(() => {
    if (status === 'unclassified') return 'Select a scene type to begin classification'
    if (status === 'incomplete') {
      if (isSailScene && !analysis?.sailId) return 'Assign a sail to complete classification'
      return 'Add measurement points to complete analysis'
    }
    return 'Classification complete'
  }, [status, isSailScene, analysis?.sailId])

  return (
    <div className="classification-assistant">
      <div className="classification-header">
        <div className="classification-title">Classification Assistant</div>
        <div className={`classification-status classification-status-${status}`}>
          {status === 'complete' ? <CheckIcon /> : status === 'incomplete' ? <WarningIcon /> : null}
          <span>{status === 'complete' ? 'Complete' : status === 'incomplete' ? 'Incomplete' : 'Unclassified'}</span>
        </div>
      </div>

      <div className="classification-message">{statusMessage}</div>

      <div className="classification-section">
        <div className="classification-section-label">Scene Type</div>
        <div className="scene-groups">
          {SCENE_GROUPS.map((group) => (
            <div key={group.label} className="scene-group">
              <div className="scene-group-header">
                {group.icon}
                <span>{group.label}</span>
              </div>
              <div className="scene-options">
                {group.scenes.map((scene) => {
                  const isActive = currentScene === scene.value
                  return (
                    <button
                      key={scene.value}
                      className={`scene-option ${isActive ? 'scene-option-active' : ''}`}
                      onClick={() => onSceneChange(scene.value)}
                      title={scene.description}
                    >
                      <div className="scene-option-label">{scene.label}</div>
                      {isActive && (
                        <div className="scene-option-check">
                          <CheckIcon />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isSailScene && (
        <div className="classification-section">
          <div className="classification-section-label">
            Sail Assignment
            {!analysis?.sailId && <span className="required-badge">Required</span>}
          </div>
          {project?.sails.length === 0 ? (
            <div className="classification-empty">No sails configured. Add sails in the boat settings.</div>
          ) : (
            <div className="entity-options">
              {project?.sails.map((sail) => {
                const isActive = analysis?.sailId === sail.id
                return (
                  <button
                    key={sail.id}
                    className={`entity-option ${isActive ? 'entity-option-active' : ''}`}
                    onClick={() => onSailChange(sail.id)}
                  >
                    <div className="entity-option-icon sail">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L4 20h16L12 2z" />
                      </svg>
                    </div>
                    <div className="entity-option-content">
                      <div className="entity-option-name">{sail.name}</div>
                      <div className="entity-option-meta">
                        {sail.category} {sail.typeCode ? `- ${sail.typeCode}` : ''}
                      </div>
                    </div>
                    {isActive && (
                      <div className="entity-option-check">
                        <CheckIcon />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isRigScene && (
        <div className="classification-section">
          <div className="classification-section-label">
            Mast Profile
            <span className="optional-badge">Optional</span>
          </div>
          {project?.masts.length === 0 ? (
            <div className="classification-empty">No mast profiles configured.</div>
          ) : (
            <div className="entity-options">
              <button
                className={`entity-option ${!analysis?.mastId ? 'entity-option-active' : ''}`}
                onClick={() => onMastChange('')}
              >
                <div className="entity-option-content">
                  <div className="entity-option-name">No mast profile</div>
                </div>
              </button>
              {project?.masts.map((mast) => {
                const isActive = analysis?.mastId === mast.id
                return (
                  <button
                    key={mast.id}
                    className={`entity-option ${isActive ? 'entity-option-active' : ''}`}
                    onClick={() => onMastChange(mast.id)}
                  >
                    <div className="entity-option-icon mast">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="8" y1="6" x2="16" y2="6" />
                        <line x1="6" y1="12" x2="18" y2="12" />
                      </svg>
                    </div>
                    <div className="entity-option-content">
                      <div className="entity-option-name">{mast.name}</div>
                      <div className="entity-option-meta">
                        {mast.spreadersPct.length} spreader{mast.spreadersPct.length !== 1 ? 's' : ''}
                        {mast.houndsPct ? `, hounds @ ${mast.houndsPct}%` : ''}
                      </div>
                    </div>
                    {isActive && (
                      <div className="entity-option-check">
                        <CheckIcon />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="classification-tips">
        <div className="classification-section-label">Quick Tips</div>
        <ul className="tips-list">
          {currentScene === 'ONBOARD_SAIL' && (
            <>
              <li>Mark the length reference first (e.g., spreader)</li>
              <li>Trace each draft stripe from luff to leech</li>
              <li>Use AutoScan for faster curve detection</li>
            </>
          )}
          {(currentScene === 'CHASE_SAIL_UPWIND' || currentScene === 'CHASE_SAIL_DOWNWIND') && (
            <>
              <li>Trace the luff curve from head to tack</li>
              <li>Mark the mitre and leech curves</li>
              <li>Include a known length reference if possible</li>
            </>
          )}
          {currentScene === 'MAST_BEND_FORE_AFT' && (
            <>
              <li>Mark the mast from heel to masthead</li>
              <li>Include spreader positions for reference</li>
            </>
          )}
          {currentScene === 'RAKE' && (
            <>
              <li>Mark two points on the hull waterline</li>
              <li>Mark two points along the mast centerline</li>
            </>
          )}
          {currentScene === 'HEEL' && (
            <li>Mark two points on the horizon line</li>
          )}
          {currentScene === 'GENERIC' && (
            <li>Select a specific scene type for measurement tools</li>
          )}
        </ul>
      </div>
    </div>
  )
}
