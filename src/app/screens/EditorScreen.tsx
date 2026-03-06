import { useCallback, useEffect, useMemo, useState } from 'react'
import { DrawTools } from '../components/DrawTools/DrawTools'
import { MapView } from '../components/MapView/MapView'
import { RoofEditor } from '../components/RoofEditor/RoofEditor'
import { FootprintPanel } from '../components/FootprintPanel'
import { StatusPanel } from '../components/StatusPanel'
import { SunProjectionStatus } from '../components/SunProjectionStatus'
import { SunDailyChartPanel } from '../components/SunDailyChartPanel'
import { SunOverlayColumn } from '../components/SunOverlayColumn'
import { useConstraintEditor } from '../hooks/useConstraintEditor'
import { useRoofDebugSimulation } from '../hooks/useRoofDebugSimulation'
import { useSolvedRoofEntries } from '../hooks/useSolvedRoofEntries'
import { useSunProjectionPanel } from '../hooks/useSunProjectionPanel'
import { useProjectStore } from '../../state/project-store'
import { validateFootprint } from '../../geometry/solver/validation'
import type { SelectedRoofSunInput } from '../components/SunOverlayColumn'

function computeFootprintCentroid(vertices: Array<[number, number]>): [number, number] | null {
  if (vertices.length === 0) {
    return null
  }
  let lonSum = 0
  let latSum = 0
  for (const [lon, lat] of vertices) {
    lonSum += lon
    latSum += lat
  }
  return [lonSum / vertices.length, latSum / vertices.length]
}

type ImportedFootprintConfigEntry = {
  footprintId: string
  polygon: Array<[number, number]>
  vertexHeights: Array<{ vertexIndex: number; heightM: number }>
}

function parseImportedFootprintsConfig(raw: string): ImportedFootprintConfigEntry[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Configuration must be an array.')
  }

  const entries: ImportedFootprintConfigEntry[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const footprintId = typeof item.footprintId === 'string' ? item.footprintId.trim() : ''
    const polygonRaw = Array.isArray(item.polygon) ? item.polygon : []
    const vertexHeightsRaw = Array.isArray(item.vertexHeights) ? item.vertexHeights : []
    if (!footprintId || polygonRaw.length < 3) {
      continue
    }

    const polygon: Array<[number, number]> = []
    for (const coordinate of polygonRaw) {
      if (!Array.isArray(coordinate) || coordinate.length !== 2) {
        continue
      }
      const lon = Number(coordinate[0])
      const lat = Number(coordinate[1])
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        continue
      }
      polygon.push([lon, lat])
    }

    const vertexHeights: Array<{ vertexIndex: number; heightM: number }> = []
    for (const constraint of vertexHeightsRaw) {
      if (!constraint || typeof constraint !== 'object') {
        continue
      }
      const vertexIndex = Number(constraint.vertexIndex)
      const heightM = Number(constraint.heightM)
      if (!Number.isInteger(vertexIndex) || !Number.isFinite(heightM)) {
        continue
      }
      vertexHeights.push({ vertexIndex, heightM })
    }

    if (polygon.length < 3) {
      continue
    }

    entries.push({ footprintId, polygon, vertexHeights })
  }

  if (entries.length === 0) {
    throw new Error('No valid footprint entries found in configuration.')
  }

  return entries
}

export function EditorScreen() {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)
  const [showImportConfig, setShowImportConfig] = useState(false)
  const [importConfigJson, setImportConfigJson] = useState('')
  const [importConfigError, setImportConfigError] = useState<string | null>(null)

  const {
    state,
    activeFootprint,
    activeConstraints,
    startDrawing,
    cancelDrawing,
    addDraftPoint,
    undoDraftPoint,
    commitFootprint,
    deleteFootprint,
    moveVertex,
    moveEdge,
    setVertexHeight,
    setVertexHeights,
    setEdgeHeight,
    clearVertexHeight,
    clearEdgeHeight,
    sunProjection,
    setSunProjectionEnabled,
    setSunProjectionDatetimeIso,
    setSunProjectionDailyDateIso,
    selectedFootprintIds,
    setActiveFootprintKwp,
    selectOnlyFootprint,
    toggleFootprintSelection,
    selectAllFootprints,
    clearFootprintSelection,
    upsertImportedFootprints,
  } = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(state.footprints), [state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])
  const activeFootprintErrors = validateFootprint(activeFootprint)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    type FootprintDebugEntry = {
      footprintId: string
      polygon: Array<[number, number]>
      vertexHeights: Array<{ vertexIndex: number; heightM: number }>
    }

    const debugEntries: FootprintDebugEntry[] = footprintEntries.map((entry) => ({
      footprintId: entry.footprint.id,
      polygon: entry.footprint.vertices,
      vertexHeights: entry.constraints.vertexHeights,
    }))

    const debugWindow = window as Window & {
      suncastDebug?: {
        getPolygonsAndHeights: () => FootprintDebugEntry[]
        selectVertex: (vertexIndex: number) => void
        selectEdge: (edgeIndex: number) => void
        clearSelection: () => void
        importPolygonsAndHeights: (rawConfig: string) => void
      }
    }

    debugWindow.suncastDebug = {
      getPolygonsAndHeights: () => debugEntries,
      selectVertex: (vertexIndex: number) => {
        if (!Number.isInteger(vertexIndex)) {
          return
        }
        setSelectedVertexIndex(vertexIndex)
        setSelectedEdgeIndex(null)
      },
      selectEdge: (edgeIndex: number) => {
        if (!Number.isInteger(edgeIndex)) {
          return
        }
        setSelectedEdgeIndex(edgeIndex)
        setSelectedVertexIndex(null)
      },
      clearSelection: () => {
        setSelectedVertexIndex(null)
        setSelectedEdgeIndex(null)
      },
      importPolygonsAndHeights: (rawConfig: string) => {
        const entries = parseImportedFootprintsConfig(rawConfig)
        upsertImportedFootprints(entries)
      },
    }
  }, [footprintEntries, upsertImportedFootprints])

  const solved = useSolvedRoofEntries(footprintEntries, state.activeFootprintId)
  const solvedByFootprintId = useMemo(() => new Map(solved.entries.map((entry) => [entry.footprintId, entry])), [solved.entries])

  const selectedRoofInputs = useMemo<SelectedRoofSunInput[]>(() => {
    const inputs: SelectedRoofSunInput[] = []
    for (const footprintId of selectedFootprintIds) {
      const solvedEntry = solvedByFootprintId.get(footprintId)
      const footprintEntry = state.footprints[footprintId]
      if (!solvedEntry || !footprintEntry) {
        continue
      }
      const centroid = computeFootprintCentroid(footprintEntry.footprint.vertices)
      if (!centroid) {
        continue
      }
      inputs.push({
        footprintId,
        lonDeg: centroid[0],
        latDeg: centroid[1],
        kwp: footprintEntry.footprint.kwp,
        roofPitchDeg: solvedEntry.metrics.pitchDeg,
        roofAzimuthDeg: solvedEntry.metrics.azimuthDeg,
        roofPlane: solvedEntry.solution.plane,
      })
    }
    return inputs
  }, [selectedFootprintIds, solvedByFootprintId, state.footprints])

  const {
    interactionError,
    safeSelectedVertexIndex,
    safeSelectedEdgeIndex,
    applyVertexHeight,
    applyEdgeHeight,
    moveVertexIfValid,
    moveEdgeIfValid,
    applyHeightStep,
    clearInteractionError,
    setConstraintLimitError,
    setMoveRejectedError,
  } = useConstraintEditor({
    activeFootprint,
    activeConstraints,
    isDrawing: state.isDrawing,
    selectedVertexIndex,
    selectedEdgeIndex,
    setVertexHeight,
    setVertexHeights,
    setEdgeHeight,
    moveVertex,
    moveEdge,
  })

  const activeDiagnostics = useMemo(() => {
    if (!solved.activeSolved) {
      return null
    }
    const { mesh, metrics } = solved.activeSolved
    return {
      constraintCount: activeConstraints.vertexHeights.length,
      minHeightM: metrics.minHeightM,
      maxHeightM: metrics.maxHeightM,
      pitchDeg: metrics.pitchDeg,
      triangleCount: Math.floor(mesh.triangleIndices.length / 3),
    }
  }, [activeConstraints.vertexHeights.length, solved.activeSolved])

  const {
    sunDatetimeRaw,
    sunDailyDateRaw,
    sunDailyTimeZone,
    sunDatetimeError,
    hasValidSunDatetime,
    sunProjectionResult,
    onSunDatetimeInputChange,
  } = useSunProjectionPanel({
    sunProjection,
    activeVertices: activeFootprint?.vertices ?? null,
    activePlane: solved.activeSolved?.solution.plane ?? null,
    setSunProjectionDatetimeIso,
    setSunProjectionDailyDateIso,
  })

  useRoofDebugSimulation({
    activeFootprint,
    activeSolved: solved.activeSolved,
    mapBearingDeg,
    mapPitchDeg,
  })

  const clearSelectionState = useCallback(() => {
    setSelectedVertexIndex(null)
    setSelectedEdgeIndex(null)
    clearInteractionError()
  }, [clearInteractionError])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setShowImportConfig((value) => !value)
        return
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      event.preventDefault()
      selectAllFootprints()
      clearSelectionState()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearSelectionState, selectAllFootprints])

  const onImportConfigSubmit = useCallback(() => {
    try {
      const entries = parseImportedFootprintsConfig(importConfigJson)
      upsertImportedFootprints(entries)
      clearSelectionState()
      setImportConfigError(null)
    } catch (error) {
      setImportConfigError(error instanceof Error ? error.message : 'Invalid configuration JSON.')
    }
  }, [clearSelectionState, importConfigJson, upsertImportedFootprints])

  return (
    <div className="editor-layout">
      <aside className="editor-panel">
        <h2>SunCast Editor</h2>
        <p className="subtitle">Geometry-first roof modeling on satellite imagery</p>
        <section style={{ display: showImportConfig ? 'block' : 'none', marginBottom: '0.8rem' }}>
          <h3>Hidden Polygon Import</h3>
          <p className="subtitle">Use Ctrl+Shift+I to toggle. Paste config JSON and inject polygons.</p>
          <textarea
            value={importConfigJson}
            onChange={(event) => {
              setImportConfigJson(event.target.value)
              setImportConfigError(null)
            }}
            rows={8}
            style={{ width: '100%', resize: 'vertical' }}
            placeholder='[{"footprintId":"fp-1","polygon":[[20,52],[20.1,52],[20.1,52.1]],"vertexHeights":[{"vertexIndex":0,"heightM":8}]}]'
          />
          {importConfigError ? <p style={{ color: '#b91c1c' }}>{importConfigError}</p> : null}
          <button type="button" onClick={onImportConfigSubmit}>
            Inject Polygons
          </button>
        </section>

        <DrawTools
          isDrawing={state.isDrawing}
          pointCount={state.drawDraft.length}
          onStart={() => {
            clearSelectionState()
            startDrawing()
          }}
          onUndo={undoDraftPoint}
          onCancel={() => {
            cancelDrawing()
            clearSelectionState()
          }}
          onCommit={() => {
            commitFootprint()
            clearSelectionState()
          }}
        />

        <FootprintPanel
          footprints={footprints}
          activeFootprintId={state.activeFootprintId}
          selectedFootprintIds={selectedFootprintIds}
          activeFootprintKwp={activeFootprint?.kwp ?? null}
          onSelectFootprint={(footprintId, multiSelect) => {
            if (multiSelect) {
              toggleFootprintSelection(footprintId)
            } else {
              selectOnlyFootprint(footprintId)
            }
            clearSelectionState()
          }}
          onSetActiveFootprintKwp={(kwp) => {
            setActiveFootprintKwp(kwp)
          }}
          onDeleteActiveFootprint={() => {
            if (!state.activeFootprintId) {
              return
            }
            deleteFootprint(state.activeFootprintId)
            clearSelectionState()
          }}
        />

        <RoofEditor
          footprint={activeFootprint}
          vertexConstraints={activeConstraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSetVertex={applyVertexHeight}
          onSetEdge={applyEdgeHeight}
          onClearVertex={clearVertexHeight}
          onClearEdge={clearEdgeHeight}
          onConstraintLimitExceeded={setConstraintLimitError}
        />

        <StatusPanel
          footprintErrors={activeFootprintErrors}
          interactionError={interactionError}
          solverError={solved.activeError}
          warnings={solved.activeSolved?.solution.warnings ?? []}
          pitchDeg={solved.activeSolved?.metrics.pitchDeg ?? null}
          azimuthDeg={solved.activeSolved?.metrics.azimuthDeg ?? null}
          roofAreaM2={solved.activeSolved?.metrics.roofAreaM2 ?? null}
          minHeightM={solved.activeSolved?.metrics.minHeightM ?? null}
          maxHeightM={solved.activeSolved?.metrics.maxHeightM ?? null}
          fitRmsErrorM={solved.activeSolved?.solution.rmsErrorM ?? null}
        />
      </aside>

      <main className="editor-map-wrap">
        <MapView
          footprints={footprints}
          activeFootprint={activeFootprint}
          selectedFootprintIds={selectedFootprintIds}
          drawDraft={state.drawDraft}
          isDrawing={state.isDrawing}
          orbitEnabled={orbitEnabled}
          onToggleOrbit={() => setOrbitEnabled((enabled) => !enabled)}
          roofMeshes={solved.entries.map((entry) => entry.mesh)}
          vertexConstraints={activeConstraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSelectVertex={(vertexIndex) => {
            setSelectedVertexIndex(vertexIndex)
            setSelectedEdgeIndex(null)
            clearInteractionError()
          }}
          onSelectEdge={(edgeIndex) => {
            setSelectedEdgeIndex(edgeIndex)
            setSelectedVertexIndex(null)
            clearInteractionError()
          }}
          onSelectFootprint={(footprintId, multiSelect) => {
            if (multiSelect) {
              toggleFootprintSelection(footprintId)
            } else {
              selectOnlyFootprint(footprintId)
            }
            clearSelectionState()
          }}
          onClearSelection={() => {
            clearSelectionState()
            clearFootprintSelection()
          }}
          onMoveVertex={moveVertexIfValid}
          onMoveEdge={moveEdgeIfValid}
          onMoveRejected={setMoveRejectedError}
          onAdjustHeight={applyHeightStep}
          showSolveHint={!solved.activeSolved}
          diagnostics={activeDiagnostics}
          onMapClick={addDraftPoint}
          onBearingChange={setMapBearingDeg}
          onPitchChange={setMapPitchDeg}
        />
        <SunOverlayColumn
          datetimeIso={sunDatetimeRaw}
          timeZone={sunDailyTimeZone}
          selectedRoofs={selectedRoofInputs}
          onDatetimeInputChange={onSunDatetimeInputChange}
          expanded={Boolean(solved.activeSolved) && !state.isDrawing}
        >
          {solved.activeSolved ? (
            <>
              <SunProjectionStatus
                enabled={sunProjection.enabled}
                hasDatetime={hasValidSunDatetime}
                datetimeError={sunDatetimeError}
                onToggleEnabled={setSunProjectionEnabled}
                result={sunProjectionResult}
              />
              <SunDailyChartPanel
                dateIso={sunDailyDateRaw}
                timeZone={sunDailyTimeZone}
                selectedRoofs={selectedRoofInputs}
              />
            </>
          ) : (
            <section className="panel-section">
              <h3>Sun Tools</h3>
              <p>Solve a roof plane first to enable projection and daily POA chart.</p>
            </section>
          )}
        </SunOverlayColumn>
      </main>
    </div>
  )
}
