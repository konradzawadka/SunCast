import { useMemo, useState } from 'react'
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

export function EditorScreen() {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)

  const {
    state,
    activeFootprint,
    activeConstraints,
    startDrawing,
    cancelDrawing,
    addDraftPoint,
    undoDraftPoint,
    commitFootprint,
    setActiveFootprint,
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
  } = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(state.footprints), [state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])
  const activeFootprintErrors = validateFootprint(activeFootprint)

  const solved = useSolvedRoofEntries(footprintEntries, state.activeFootprintId)

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
    activeFootprintCentroid,
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

  const clearSelectionState = () => {
    setSelectedVertexIndex(null)
    setSelectedEdgeIndex(null)
    clearInteractionError()
  }

  return (
    <div className="editor-layout">
      <aside className="editor-panel">
        <h2>SunCast Editor</h2>
        <p className="subtitle">Geometry-first roof modeling on satellite imagery</p>

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
          onSelectFootprint={(footprintId) => {
            setActiveFootprint(footprintId)
            clearSelectionState()
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
          onSelectFootprint={(footprintId) => {
            setActiveFootprint(footprintId)
            clearSelectionState()
          }}
          onClearSelection={clearSelectionState}
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
                latDeg={activeFootprintCentroid ? activeFootprintCentroid[1] : null}
                lonDeg={activeFootprintCentroid ? activeFootprintCentroid[0] : null}
                plane={solved.activeSolved.solution.plane}
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
