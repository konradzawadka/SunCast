import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConstraintEditor } from '../hooks/useConstraintEditor'
import { useRoofDebugSimulation } from '../hooks/useRoofDebugSimulation'
import { useSolvedRoofEntries } from '../hooks/useSolvedRoofEntries'
import { useSunProjectionPanel } from '../hooks/useSunProjectionPanel'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useSelectionState } from '../hooks/useSelectionState'
import { SunCastCanvas } from './SunCastCanvas'
import { SunCastLayout } from './SunCastLayout'
import { type ImportedFootprintConfigEntry } from './DevTools'
import { SunCastSidebar } from './SunCastSidebar'
import { TutorialController } from './TutorialController'
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

export function SunCastScreen() {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [mapInitialized, setMapInitialized] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [tutorialKwpEdited, setTutorialKwpEdited] = useState(false)
  const [tutorialDatetimeEdited, setTutorialDatetimeEdited] = useState(false)

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
    setTutorialKwpEdited(false)
  }, [state.activeFootprintId])

  const solved = useSolvedRoofEntries(footprintEntries, state.activeFootprintId)
  const solvedByFootprintId = useMemo(
    () => new Map(solved.entries.map((entry) => [entry.footprintId, entry])),
    [solved.entries],
  )

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
    selectedVertexIndex,
    selectedEdgeIndex,
    clearSelectionState: clearSelectionIndices,
    selectVertex: selectVertexIndex,
    selectEdge: selectEdgeIndex,
  } = useSelectionState()

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

  const clearSelectionState = useCallback(() => {
    clearSelectionIndices()
    clearInteractionError()
  }, [clearInteractionError, clearSelectionIndices])

  const selectVertex = useCallback(
    (vertexIndex: number) => {
      selectVertexIndex(vertexIndex)
      clearInteractionError()
    },
    [clearInteractionError, selectVertexIndex],
  )

  const selectEdge = useCallback(
    (edgeIndex: number) => {
      selectEdgeIndex(edgeIndex)
      clearInteractionError()
    },
    [clearInteractionError, selectEdgeIndex],
  )

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

  useKeyboardShortcuts({
    onSelectAllFootprints: () => {
      selectAllFootprints()
      clearSelectionState()
    },
  })

  const onImportDevEntries = (entries: ImportedFootprintConfigEntry[]) => {
    upsertImportedFootprints(entries)
    clearSelectionState()
  }

  return (
    <SunCastLayout>
      <SunCastSidebar
        isDrawing={state.isDrawing}
        drawDraftCount={state.drawDraft.length}
        footprints={footprints}
        activeFootprintId={state.activeFootprintId}
        selectedFootprintIds={selectedFootprintIds}
        activeFootprint={activeFootprint}
        activeConstraints={activeConstraints}
        selectedVertexIndex={safeSelectedVertexIndex}
        selectedEdgeIndex={safeSelectedEdgeIndex}
        footprintEntries={footprintEntries}
        interactionError={interactionError}
        solverError={solved.activeError}
        footprintErrors={activeFootprintErrors}
        warnings={solved.activeSolved?.solution.warnings ?? []}
        pitchDeg={solved.activeSolved?.metrics.pitchDeg ?? null}
        azimuthDeg={solved.activeSolved?.metrics.azimuthDeg ?? null}
        roofAreaM2={solved.activeSolved?.metrics.roofAreaM2 ?? null}
        minHeightM={solved.activeSolved?.metrics.minHeightM ?? null}
        maxHeightM={solved.activeSolved?.metrics.maxHeightM ?? null}
        fitRmsErrorM={solved.activeSolved?.solution.rmsErrorM ?? null}
        onStartDrawing={() => {
          clearSelectionState()
          startDrawing()
        }}
        onUndoDrawing={undoDraftPoint}
        onCancelDrawing={() => {
          cancelDrawing()
          clearSelectionState()
        }}
        onCommitDrawing={() => {
          commitFootprint()
          clearSelectionState()
        }}
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
          setTutorialKwpEdited(true)
        }}
        onDeleteActiveFootprint={() => {
          if (!state.activeFootprintId) {
            return
          }
          deleteFootprint(state.activeFootprintId)
          clearSelectionState()
        }}
        onSetVertex={applyVertexHeight}
        onSetEdge={applyEdgeHeight}
        onClearVertex={clearVertexHeight}
        onClearEdge={clearEdgeHeight}
        onConstraintLimitExceeded={setConstraintLimitError}
        onDevSelectVertex={(vertexIndex) => {
          selectVertex(vertexIndex)
        }}
        onDevSelectEdge={(edgeIndex) => {
          selectEdge(edgeIndex)
        }}
        onDevClearSelection={() => {
          clearSelectionState()
        }}
        onDevImportEntries={onImportDevEntries}
      />

      <SunCastCanvas
        footprints={footprints}
        activeFootprint={activeFootprint}
        selectedFootprintIds={selectedFootprintIds}
        drawDraft={state.drawDraft}
        isDrawing={state.isDrawing}
        orbitEnabled={orbitEnabled}
        roofMeshes={solved.entries.map((entry) => entry.mesh)}
        vertexConstraints={activeConstraints.vertexHeights}
        selectedVertexIndex={safeSelectedVertexIndex}
        selectedEdgeIndex={safeSelectedEdgeIndex}
        showSolveHint={!solved.activeSolved}
        sunProjectionEnabled={sunProjection.enabled}
        hasValidSunDatetime={hasValidSunDatetime}
        sunDatetimeError={sunDatetimeError}
        sunProjectionResult={sunProjectionResult}
        sunDatetimeRaw={sunDatetimeRaw}
        sunDailyDateRaw={sunDailyDateRaw}
        sunDailyTimeZone={sunDailyTimeZone}
        selectedRoofInputs={selectedRoofInputs}
        hasSolvedActiveRoof={Boolean(solved.activeSolved)}
        onToggleOrbit={() => setOrbitEnabled((enabled) => !enabled)}
        onSelectVertex={(vertexIndex) => {
          selectVertex(vertexIndex)
        }}
        onSelectEdge={(edgeIndex) => {
          selectEdge(edgeIndex)
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
        onMapClick={addDraftPoint}
        onBearingChange={setMapBearingDeg}
        onPitchChange={setMapPitchDeg}
        onInitialized={() => setMapInitialized(true)}
        onToggleSunProjectionEnabled={setSunProjectionEnabled}
        onSunDatetimeInputChange={(datetimeIsoRaw) => {
          setTutorialDatetimeEdited(true)
          onSunDatetimeInputChange(datetimeIsoRaw)
        }}
      />

      <TutorialController
        mapInitialized={mapInitialized}
        draftVertexCount={state.drawDraft.length}
        hasFinishedPolygon={Boolean(activeFootprint)}
        kwp={activeFootprint?.kwp ?? null}
        hasEditedKwp={tutorialKwpEdited}
        constrainedVertexCount={activeConstraints.vertexHeights.length}
        orbitEnabled={orbitEnabled}
        hasEditedDatetime={tutorialDatetimeEdited}
      />
    </SunCastLayout>
  )
}
