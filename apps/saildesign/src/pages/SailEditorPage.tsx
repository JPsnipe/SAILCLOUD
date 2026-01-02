import { useState } from 'react'
import type {
  SailDefinition,
  RigDefinition,
  SailProfile,
  VlmSolverArgs,
} from '../lib/sail-geometry'

import {
  generateProfiles,
  DEFAULT_MAIN_PROFILES,
  DEFAULT_JIB_PROFILES,
  createDefaultMainSail,
  createDefaultJib,
} from '../lib/sail-geometry'
import { exportToFlow5Xml, downloadFile, exportToStl } from '../lib/flow5-export'


function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function NumberField({ label, value, min, max, step, unit, onChange }: NumberFieldProps) {
  return (
    <div className="field">
      <div className="label">
        {label} {unit && <span className="muted">({unit})</span>}
      </div>
      <div className="row">
        <input
          className="range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        />
        <span className="pill mono" style={{ minWidth: 60, textAlign: 'center' }}>
          {value.toFixed(step < 1 ? 2 : step < 0.1 ? 2 : 1)}
        </span>
      </div>
    </div>
  )
}

interface ProfileEditorProps {
  profile: SailProfile
  index: number
  onChange: (index: number, profile: SailProfile) => void
}

function ProfileEditor({ profile, index, onChange }: ProfileEditorProps) {
  const update = (key: keyof SailProfile, value: number) => {
    onChange(index, { ...profile, [key]: value })
  }

  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="kpi-row" style={{ marginBottom: 8 }}>
        <span className="mono">Section {index + 1}</span>
        <span className="pill mono">{(profile.girth * 100).toFixed(0)}% height</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <NumberField
          label="Chord"
          value={profile.chord}
          min={0.1}
          max={1.0}
          step={0.05}
          unit="ratio"
          onChange={(v) => update('chord', v)}
        />
        <NumberField
          label="Twist"
          value={profile.twist}
          min={-5}
          max={30}
          step={0.5}
          unit="deg"
          onChange={(v) => update('twist', v)}
        />
        <NumberField
          label="Camber"
          value={profile.camber * 100}
          min={0}
          max={20}
          step={0.5}
          unit="%"
          onChange={(v) => update('camber', v / 100)}
        />
        <NumberField
          label="Camber Pos"
          value={profile.camberPos * 100}
          min={20}
          max={60}
          step={1}
          unit="%"
          onChange={(v) => update('camberPos', v / 100)}
        />
        <NumberField
          label="Entry Angle"
          value={profile.entryAngle ?? 30}
          min={0}
          max={90}
          step={1}
          unit="deg"
          onChange={(v) => update('entryAngle', v)}
        />
        <NumberField
          label="Exit Angle"
          value={profile.exitAngle ?? 5}
          min={-10}
          max={30}
          step={1}
          unit="deg"
          onChange={(v) => update('exitAngle', v)}
        />
      </div>
    </div>
  )
}

export function SailEditorPage(props: {
  mainSail: SailDefinition | null
  jib: SailDefinition | null
  rig: RigDefinition
  solverArgs: VlmSolverArgs
  onUpdateMainSail: (sail: SailDefinition | null) => void
  onUpdateJib: (sail: SailDefinition | null) => void
  onUpdateRig: (rig: RigDefinition) => void
  onUpdateSolverArgs: (args: VlmSolverArgs) => void
}) {
  const [activeTab, setActiveTab] = useState<'main' | 'jib' | 'rig' | 'trim' | 'solver'>('main')
  const [expandedSection, setExpandedSection] = useState<number | null>(null)

  const updateMainSail = (key: keyof SailDefinition, value: unknown) => {
    if (!props.mainSail) return
    props.onUpdateMainSail({ ...props.mainSail, [key]: value })
  }

  const updateJib = (key: keyof SailDefinition, value: unknown) => {
    if (!props.jib) return
    props.onUpdateJib({ ...props.jib, [key]: value })
  }

  const updateRig = (key: keyof RigDefinition, value: number) => {
    props.onUpdateRig({ ...props.rig, [key]: value })
  }

  const updateSolver = (key: keyof VlmSolverArgs, value: unknown) => {
    props.onUpdateSolverArgs({ ...props.solverArgs, [key]: value })
  }

  const updateMainProfile = (index: number, profile: SailProfile) => {
    if (!props.mainSail) return
    const profiles = [...props.mainSail.profiles]
    profiles[index] = profile
    props.onUpdateMainSail({ ...props.mainSail, profiles })
  }

  const updateJibProfile = (index: number, profile: SailProfile) => {
    if (!props.jib) return
    const profiles = [...props.jib.profiles]
    profiles[index] = profile
    props.onUpdateJib({ ...props.jib, profiles })
  }

  const handleExportFlow5 = (type: 'main' | 'jib' | 'all') => {
    let sails: (SailDefinition | null)[] = []
    let filename = 'boat_flow5.xml'

    if (type === 'main') {
      sails = [props.mainSail]
      filename = props.mainSail ? `${props.mainSail.name.replace(/\s+/g, '_')}_flow5.xml` : filename
    } else if (type === 'jib') {
      sails = [props.jib]
      filename = props.jib ? `${props.jib.name.replace(/\s+/g, '_')}_flow5.xml` : filename
    } else {
      sails = [props.mainSail, props.jib]
      filename = 'both_sails_flow5.xml'
    }

    if (sails.filter(s => s !== null).length === 0) return
    const xml = exportToFlow5Xml(sails, props.rig)
    downloadFile(filename, xml)
  }

  const handleExportStl = (type: 'main' | 'jib' | 'all') => {
    let sails: (SailDefinition | null)[] = []
    let filename = 'boat_sails.stl'

    if (type === 'main') {
      sails = [props.mainSail]
      filename = props.mainSail ? `${props.mainSail.name.replace(/\s+/g, '_')}.stl` : filename
    } else if (type === 'jib') {
      sails = [props.jib]
      filename = props.jib ? `${props.jib.name.replace(/\s+/g, '_')}.stl` : filename
    } else {
      sails = [props.mainSail, props.jib]
      filename = 'both_sails.stl'
    }

    if (sails.filter(s => s !== null).length === 0) return
    const stl = exportToStl(sails, props.rig)
    downloadFile(filename, stl, 'model/stl')
  }

  const isMulti = props.mainSail && props.jib;

  return (
    <div className="stack">
      <div className="card">
        <h2 className="h2">Sail Editor</h2>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>


          <button
            className={`btn ${activeTab === 'main' ? 'primary' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main
          </button>
          <button
            className={`btn ${activeTab === 'jib' ? 'primary' : ''}`}
            onClick={() => setActiveTab('jib')}
          >
            Jib
          </button>
          <button
            className={`btn ${activeTab === 'rig' ? 'primary' : ''}`}
            onClick={() => setActiveTab('rig')}
          >
            Rig
          </button>
          <button
            className={`btn ${activeTab === 'trim' ? 'primary' : ''}`}
            onClick={() => setActiveTab('trim')}
          >
            Trim
          </button>
          <button
            className={`btn ${activeTab === 'solver' ? 'primary' : ''}`}
            onClick={() => setActiveTab('solver')}
          >
            Solver
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn success"
            style={{
              background: '#059669',
              color: 'white',
              border: '1px solid #047857',
              fontWeight: 'bold',
              padding: '6px 16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onClick={() => handleExportFlow5('all')}
            disabled={!props.mainSail && !props.jib}
          >
            EXPORT (.xml)
          </button>
          <button
            className="btn"
            style={{
              background: '#7c3aed',
              color: 'white',
              border: '1px solid #6d28d9',
              fontWeight: 'bold',
              padding: '6px 16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onClick={() => handleExportStl('all')}
            disabled={!props.mainSail && !props.jib}
          >
            EXPORT (.stl)
          </button>
        </div>

        {isMulti && (
          <div style={{
            fontSize: '11px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderLeft: '4px solid #f59e0b',
            padding: '10px 14px',
            color: '#92400e',
            marginTop: '-5px',
            marginBottom: '15px',
            borderRadius: '4px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <b style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>⚠️ HOW TO IMPORT BOTH SAILS IN FLOW5:</b>
            To see both sails at once, do <b>NOT</b> use the "Sails" menu.<br />
            Instead, use: <b>Planes/Boats &rarr; Import from XML file...</b>
          </div>
        )}
      </div>




      {activeTab === 'main' && (
        <div className="stack">
          <div className="kpi-row">
            <span style={{ fontWeight: 600 }}>Main Sail</span>
            <div className="row" style={{ gap: 6 }}>
              <button
                className={`btn ${props.mainSail ? 'danger' : 'primary'}`}
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => props.onUpdateMainSail(props.mainSail ? null : createDefaultMainSail())}
              >
                {props.mainSail ? 'Remove' : 'Add'}
              </button>
              {props.mainSail && (
                <>
                  <button
                    className="btn"
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      background: '#059669',
                      color: 'white',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}
                    onClick={() => handleExportFlow5('main')}
                  >
                    .xml
                  </button>
                  <button
                    className="btn"
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      background: '#7c3aed',
                      color: 'white',
                      border: '1px solid #6d28d9',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}
                    onClick={() => handleExportStl('main')}
                  >
                    .stl
                  </button>
                </>
              )}
            </div>
          </div>

          {props.mainSail && (
            <>
              <NumberField
                label="Luff Length"
                value={props.mainSail.luffLength}
                min={5}
                max={30}
                step={0.5}
                unit="m"
                onChange={(v) => updateMainSail('luffLength', v)}
              />
              <NumberField
                label="Foot Length"
                value={props.mainSail.footLength}
                min={2}
                max={15}
                step={0.25}
                unit="m"
                onChange={(v) => updateMainSail('footLength', v)}
              />
              <NumberField
                label="Leech Length"
                value={props.mainSail.leechLength}
                min={5}
                max={35}
                step={0.5}
                unit="m"
                onChange={(v) => updateMainSail('leechLength', v)}
              />

              <div className="field">
                <div className="label">Head Shape</div>
                <div className="row">
                  <button
                    className={`btn ${props.mainSail.headShape === 'triangular' ? 'primary' : ''}`}
                    onClick={() => updateMainSail('headShape', 'triangular')}
                  >
                    Triangular
                  </button>
                  <button
                    className={`btn ${props.mainSail.headShape === 'square' ? 'primary' : ''}`}
                    onClick={() => updateMainSail('headShape', 'square')}
                  >
                    Square Top
                  </button>
                </div>
              </div>

              {props.mainSail.headShape === 'square' && (
                <NumberField
                  label="Head Width"
                  value={(props.mainSail.headWidth ?? 0.3) * 100}
                  min={10}
                  max={60}
                  step={5}
                  unit="% of foot"
                  onChange={(v) => updateMainSail('headWidth', v / 100)}
                />
              )}

              <div style={{ marginTop: 10 }}>
                <div className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <span className="label" style={{ margin: 0 }}>Profile Sections</span>
                  <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                    <button
                      className="btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      disabled={props.mainSail.profiles.length <= 2}
                      onClick={() => {
                        const newCount = Math.max(2, props.mainSail!.profiles.length - 1)
                        const newProfiles = generateProfiles(newCount, DEFAULT_MAIN_PROFILES)
                        updateMainSail('profiles', newProfiles)
                      }}
                    >
                      −
                    </button>
                    <span className="pill mono" style={{ minWidth: 30, textAlign: 'center' }}>
                      {props.mainSail.profiles.length}
                    </span>
                    <button
                      className="btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      disabled={props.mainSail.profiles.length >= 10}
                      onClick={() => {
                        const newCount = Math.min(10, props.mainSail!.profiles.length + 1)
                        const newProfiles = generateProfiles(newCount, DEFAULT_MAIN_PROFILES)
                        updateMainSail('profiles', newProfiles)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {props.mainSail.profiles.map((profile, i) => (
                    <div key={i}>
                      <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'space-between' }}
                        onClick={() => setExpandedSection(expandedSection === i ? null : i)}
                      >
                        <span>
                          Section {i + 1} ({(profile.girth * 100).toFixed(0)}%)
                        </span>
                        <span className="muted">{expandedSection === i ? '−' : '+'}</span>
                      </button>
                      {expandedSection === i && (
                        <div style={{ marginTop: 8 }}>
                          <ProfileEditor
                            profile={profile}
                            index={i}
                            onChange={updateMainProfile}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'jib' && (
        <div className="stack">
          <div className="kpi-row">
            <span style={{ fontWeight: 600 }}>Jib / Genoa</span>
            <div className="row" style={{ gap: 6 }}>
              <button
                className={`btn ${props.jib ? 'danger' : 'primary'}`}
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => props.onUpdateJib(props.jib ? null : createDefaultJib())}
              >
                {props.jib ? 'Remove' : 'Add'}
              </button>
              {props.jib && (
                <>
                  <button
                    className="btn"
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      background: '#059669',
                      color: 'white',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}
                    onClick={() => handleExportFlow5('jib')}
                  >
                    .xml
                  </button>
                  <button
                    className="btn"
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      background: '#7c3aed',
                      color: 'white',
                      border: '1px solid #6d28d9',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}
                    onClick={() => handleExportStl('jib')}
                  >
                    .stl
                  </button>
                </>
              )}

            </div>
          </div>



          {props.jib && (
            <>
              <NumberField
                label="Luff Length"
                value={props.jib.luffLength}
                min={3}
                max={20}
                step={0.5}
                unit="m"
                onChange={(v) => updateJib('luffLength', v)}
              />
              <NumberField
                label="Foot Length"
                value={props.jib.footLength}
                min={1}
                max={10}
                step={0.25}
                unit="m"
                onChange={(v) => updateJib('footLength', v)}
              />
              <NumberField
                label="Leech Length"
                value={props.jib.leechLength}
                min={3}
                max={22}
                step={0.5}
                unit="m"
                onChange={(v) => updateJib('leechLength', v)}
              />

              <div className="field">
                <div className="label">Head Shape</div>
                <div className="row">
                  <button
                    className={`btn ${props.jib.headShape === 'triangular' ? 'primary' : ''}`}
                    onClick={() => updateJib('headShape', 'triangular')}
                  >
                    Triangular
                  </button>
                  <button
                    className={`btn ${props.jib.headShape === 'square' ? 'primary' : ''}`}
                    onClick={() => updateJib('headShape', 'square')}
                  >
                    Square Top
                  </button>
                </div>
              </div>

              {props.jib.headShape === 'square' && (
                <NumberField
                  label="Head Width"
                  value={(props.jib.headWidth ?? 0.3) * 100}
                  min={10}
                  max={60}
                  step={5}
                  unit="% of foot"
                  onChange={(v) => updateJib('headWidth', v / 100)}
                />
              )}

              <div style={{ marginTop: 10 }}>
                <div className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <span className="label" style={{ margin: 0 }}>Profile Sections</span>
                  <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                    <button
                      className="btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      disabled={props.jib.profiles.length <= 2}
                      onClick={() => {
                        const newCount = Math.max(2, props.jib!.profiles.length - 1)
                        const newProfiles = generateProfiles(newCount, DEFAULT_JIB_PROFILES)
                        updateJib('profiles', newProfiles)
                      }}
                    >
                      −
                    </button>
                    <span className="pill mono" style={{ minWidth: 30, textAlign: 'center' }}>
                      {props.jib.profiles.length}
                    </span>
                    <button
                      className="btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      disabled={props.jib.profiles.length >= 10}
                      onClick={() => {
                        const newCount = Math.min(10, props.jib!.profiles.length + 1)
                        const newProfiles = generateProfiles(newCount, DEFAULT_JIB_PROFILES)
                        updateJib('profiles', newProfiles)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {props.jib.profiles.map((profile, i) => (
                    <div key={i}>
                      <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'space-between' }}
                        onClick={() =>
                          setExpandedSection(expandedSection === 100 + i ? null : 100 + i)
                        }
                      >
                        <span>
                          Section {i + 1} ({(profile.girth * 100).toFixed(0)}%)
                        </span>
                        <span className="muted">{expandedSection === 100 + i ? '−' : '+'}</span>
                      </button>
                      {expandedSection === 100 + i && (
                        <div style={{ marginTop: 8 }}>
                          <ProfileEditor profile={profile} index={i} onChange={updateJibProfile} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )
      }

      {
        activeTab === 'rig' && (
          <div className="stack">
            <NumberField
              label="Sheer Above Waterline"
              value={props.rig.sheerAboveWaterline}
              min={0.5}
              max={3}
              step={0.1}
              unit="m"
              onChange={(v) => updateRig('sheerAboveWaterline', v)}
            />
            <NumberField
              label="Boom Above Sheer"
              value={props.rig.boomAboveSheer}
              min={0.3}
              max={3}
              step={0.1}
              unit="m"
              onChange={(v) => updateRig('boomAboveSheer', v)}
            />
            <NumberField
              label="Mast Rake"
              value={props.rig.rakeDeg}
              min={-5}
              max={10}
              step={0.5}
              unit="deg"
              onChange={(v) => updateRig('rakeDeg', v)}
            />
            <NumberField
              label="J (Tack to Mast)"
              value={props.rig.jPosition}
              min={0.5}
              max={5}
              step={0.1}
              unit="m"
              onChange={(v) => updateRig('jPosition', v)}
            />
            <NumberField
              label="Jib Tack Height"
              value={props.rig.jibTackHeight}
              min={0}
              max={2}
              step={0.05}
              unit="m"
              onChange={(v) => updateRig('jibTackHeight', v)}
            />
            <NumberField
              label="Jib Halyard Height"
              value={props.rig.jibHalyardHeight}
              min={2}
              max={10}
              step={0.1}
              unit="m"
              onChange={(v) => updateRig('jibHalyardHeight', v)}
            />
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              <strong>J (Tack to Mast)</strong>: Distance from jib tack to mast at deck.<br />
              <strong>Jib Tack Height</strong>: Height of jib tack above sheer.<br />
              <strong>Jib Halyard Height</strong>: Height where jib halyard attaches on mast.
            </div>
          </div>
        )
      }

      {
        activeTab === 'trim' && (
          <div className="stack">
            <div className="label-sub" style={{ marginBottom: 10, fontWeight: 'bold' }}>Trimming & Sheeting</div>

            <NumberField
              label="Main Sheet Angle"
              value={props.rig.mainSheetAngle}
              min={-5}
              max={30}
              step={0.5}
              unit="deg"
              onChange={(v) => updateRig('mainSheetAngle', v)}
            />
            <NumberField
              label="Jib Sheet Angle"
              value={props.rig.jibSheetAngle}
              min={-5}
              max={40}
              step={0.5}
              unit="deg"
              onChange={(v) => updateRig('jibSheetAngle', v)}
            />
            <NumberField
              label="Jib Forestay Sag"
              value={props.rig.jibSag}
              min={0}
              max={0.5}
              step={0.01}
              unit="m"
              onChange={(v) => updateRig('jibSag', v)}
            />
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              <strong>Sheet Angle</strong>: Rotation of the sail around the luff.<br />
              <strong>Jib Sag</strong>: Lateral deflection of the forestay (sagging).
            </div>
          </div>
        )
      }


      {
        activeTab === 'solver' && (
          <div className="stack">
            <NumberField
              label="Spanwise Points"
              value={props.solverArgs.nSpanwise}
              min={10}
              max={100}
              step={5}
              onChange={(v) => updateSolver('nSpanwise', Math.round(v))}
            />
            <NumberField
              label="Chordwise Points"
              value={props.solverArgs.nChordwise}
              min={5}
              max={50}
              step={5}
              onChange={(v) => updateSolver('nChordwise', Math.round(v))}
            />
            <div className="field">
              <div className="label">Interpolation</div>
              <div className="row">
                <button
                  className={`btn ${props.solverArgs.interpolationType === 'spline' ? 'primary' : ''}`}
                  onClick={() => updateSolver('interpolationType', 'spline')}
                >
                  Spline
                </button>
                <button
                  className={`btn ${props.solverArgs.interpolationType === 'linear' ? 'primary' : ''}`}
                  onClick={() => updateSolver('interpolationType', 'linear')}
                >
                  Linear
                </button>
              </div>
            </div>
            {/* Panel count and warning */}
            {(() => {
              const totalPanels = props.solverArgs.nSpanwise * props.solverArgs.nChordwise
              const numSails = (props.mainSail ? 1 : 0) + (props.jib ? 1 : 0)
              const totalWithSails = totalPanels * numSails
              const isHighRes = totalPanels > 1200
              return (
                <div style={{ marginTop: 10 }}>
                  <div className="kpi-row" style={{ marginBottom: 6 }}>
                    <span className="muted">Total panels</span>
                    <span className="mono" style={{ color: isHighRes ? '#fbbf24' : undefined }}>
                      {totalPanels} {numSails > 1 ? `(×${numSails} = ${totalWithSails})` : ''}
                    </span>
                  </div>
                  {isHighRes && (
                    <div style={{
                      padding: '6px 8px',
                      background: 'rgba(251, 191, 36, 0.12)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: 6,
                      fontSize: 10,
                      color: '#fbbf24',
                      marginBottom: 8,
                    }}>
                      ⚠️ Alta resolución. El solver puede fallar con &gt;1200 paneles.
                      Reduce a ~40×30 si hay problemas.
                    </div>
                  )}
                  <div className="muted" style={{ fontSize: 11 }}>
                    Mayor resolución = más preciso pero más lento.
                    Recomendado: 40×30 para análisis, 20×15 para preview.
                  </div>
                </div>
              )
            })()}
          </div>
        )
      }


      <div className="card">
        <h2 className="h2">Quick Stats</h2>
        <div className="stack" style={{ gap: 6 }}>
          <div className="kpi-row">
            <span className="muted">Main Sail</span>
            <span className="mono">{props.mainSail ? `${props.mainSail.luffLength}m luff` : '—'}</span>
          </div>
          <div className="kpi-row">
            <span className="muted">Jib</span>
            <span className="mono">{props.jib ? `${props.jib.luffLength}m luff` : '—'}</span>
          </div>
          <div className="kpi-row">
            <span className="muted">Sails Config</span>
            <span className="mono">
              {props.mainSail && props.jib
                ? 'Main + Jib'
                : props.mainSail
                  ? 'Main only'
                  : props.jib
                    ? 'Jib only'
                    : 'None'}
            </span>
          </div>
          <div className="kpi-row">
            <span className="muted">Mesh Resolution</span>
            <span className="mono">
              {props.solverArgs.nSpanwise}x{props.solverArgs.nChordwise}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
