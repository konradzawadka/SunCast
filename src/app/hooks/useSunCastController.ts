import { useCallback, useMemo, useRef, useState } from 'react'
import { validateFootprint } from '../../geometry/solver/validation'
import { useProjectStore } from '../../state/project-store'
import { useConstraintEditor } from './useConstraintEditor'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRoofDebugSimulation } from '../features/debug/useRoofDebugSimulation'
import { useSelectionState } from './useSelectionState'
import { useSolvedRoofEntries } from './useSolvedRoofEntries'
import { generateObstacleMesh } from '../../geometry/mesh/generateObstacleMesh'
import { useSunProjectionPanel } from '../features/sun-tools/useSunProjectionPanel'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import { useShareProject } from './useShareProject'
import { useMapNavigationTarget } from './useMapNavigationTarget'
import { useSelectedRoofInputs } from './useSelectedRoofInputs'
import { useRoofShading } from './useRoofShading'
import {
  clampPitchAdjustmentPercent,
  computeFootprintCentroid,
  type SunCastCanvasModel,
  type SunCastSidebarModel,
  type SunCastTutorialModel,
} from './sunCastController.types'

export type { SunCastCanvasModel, SunCastSidebarModel, SunCastTutorialModel } from './sunCastController.types'

export function useSunCastController(): {
  sidebarModel: SunCastSidebarModel
  canvasModel: SunCastCanvasModel
  tutorialModel: SunCastTutorialModel
} {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [editMode, setEditMode] = useState<'roof' | 'obstacle'>('roof')
  const [mapInitialized, setMapInitialized] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [tutorialEditedKwpByFootprint, setTutorialEditedKwpByFootprint] = useState<Record<string, true>>({})
  const [tutorialDatetimeEdited, setTutorialDatetimeEdited] = useState(false)
  const [isGeometryDragActive, setIsGeometryDragActive] = useState(false)
  const tutorialStartRef = useRef<() => void>(() => {})

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
    setActivePitchAdjustmentPercent,
    selectOnlyFootprint,
    toggleFootprintSelection,
    selectAllFootprints,
    clearFootprintSelection,
    obstacles,
    activeObstacle,
    selectedObstacles,
    startObstacleDrawing,
    cancelObstacleDrawing,
    addObstacleDraftPoint,
    undoObstacleDraftPoint,
    commitObstacle,
    deleteObstacle,
    moveObstacleVertex,
    setObstacleHeight,
    setObstacleKind,
    selectOnlyObstacle,
    toggleObstacleSelection,
    clearObstacleSelection,
    upsertImportedFootprints,
    startupHydrationError,
  } = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(state.footprints), [state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])
  const activeFootprintErrors = validateFootprint(activeFootprint)

  const solved = useSolvedRoofEntries(footprintEntries, state.activeFootprintId)
  const activeFootprintCentroid = computeFootprintCentroid(activeFootprint?.vertices ?? [])
  const activePitchAdjustmentPercent = activeFootprint
    ? clampPitchAdjustmentPercent(state.footprints[activeFootprint.id]?.pitchAdjustmentPercent ?? 0)
    : 0
  const basePitchDeg = solved.activeSolved?.metrics.pitchDeg ?? null
  const adjustedPitchDeg =
    basePitchDeg === null ? null : basePitchDeg * (1 + activePitchAdjustmentPercent / 100)

  const selectedRoofInputs = useSelectedRoofInputs({
    selectedFootprintIds,
    footprintEntries: state.footprints,
    solvedEntries: solved.entries,
  })

  const obstacleMeshes = useMemo(() => {
    return obstacles
      .map((obstacle) => generateObstacleMesh(obstacle))
      .filter((mesh): mesh is NonNullable<typeof mesh> => mesh !== null)
  }, [obstacles])

  const shadingRoofs = useMemo(() => {
    const solvedByFootprintId = new Map(solved.entries.map((entry) => [entry.footprintId, entry]))
    return selectedFootprintIds
      .map((footprintId) => {
        const footprintEntry = state.footprints[footprintId]
        const solvedEntry = solvedByFootprintId.get(footprintId)
        if (!footprintEntry || !solvedEntry) {
          return null
        }

        const polygon = footprintEntry.footprint.vertices
        const vertexHeightsM = solvedEntry.solution.vertexHeightsM
        if (polygon.length < 3 || polygon.length !== vertexHeightsM.length) {
          return null
        }

        return {
          roofId: footprintId,
          polygon,
          vertexHeightsM,
        }
      })
      .filter((entry): entry is { roofId: string; polygon: Array<[number, number]>; vertexHeightsM: number[] } =>
        Boolean(entry),
      )
  }, [selectedFootprintIds, solved.entries, state.footprints])

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
    isDrawing: state.isDrawing || state.isDrawingObstacle,
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

  const productionComputationEnabled =
    !isGeometryDragActive && safeSelectedVertexIndex === null && safeSelectedEdgeIndex === null

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

  const shadingResult = useRoofShading({
    enabled: state.shadingSettings.enabled && sunProjection.enabled && hasValidSunDatetime,
    roofs: shadingRoofs,
    obstacles,
    datetimeIso: state.sunProjection.datetimeIso,
    gridResolutionM: state.shadingSettings.gridResolutionM,
    interactionActive: isGeometryDragActive,
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
    isDrawing: state.isDrawing || state.isDrawingObstacle,
    onCancelDrawing: () => {
      if (state.isDrawingObstacle) {
        cancelObstacleDrawing()
      } else {
        cancelDrawing()
      }
      clearSelectionState()
    },
  })

  const { shareError, shareSuccess, onShareProject } = useShareProject({
    footprints: state.footprints,
    activeFootprintId: state.activeFootprintId,
    sunProjection: state.sunProjection,
  })

  const onImportDevEntries = (entries: ImportedFootprintConfigEntry[]) => {
    upsertImportedFootprints(entries)
    clearSelectionState()
  }

  const { mapNavigationTarget, onPlaceSearchSelect } = useMapNavigationTarget()

  const sidebarModel: SunCastSidebarModel = {
    editMode,
    isDrawingRoof: state.isDrawing,
    isDrawingObstacle: state.isDrawingObstacle,
    drawDraftCountRoof: state.drawDraft.length,
    drawDraftCountObstacle: state.obstacleDrawDraft.length,
    footprints,
    activeFootprintId: state.activeFootprintId,
    selectedFootprintIds,
    activeFootprint,
    obstacles,
    activeObstacle,
    selectedObstacleIds: selectedObstacles.map((obstacle) => obstacle.id),
    activeConstraints,
    selectedVertexIndex: safeSelectedVertexIndex,
    selectedEdgeIndex: safeSelectedEdgeIndex,
    footprintEntries,
    interactionError,
    solverError: solved.activeError,
    footprintErrors: activeFootprintErrors,
    warnings: solved.activeSolved?.solution.warnings ?? [],
    basePitchDeg,
    pitchAdjustmentPercent: activePitchAdjustmentPercent,
    adjustedPitchDeg,
    azimuthDeg: solved.activeSolved?.metrics.azimuthDeg ?? null,
    roofAreaM2: solved.activeSolved?.metrics.roofAreaM2 ?? null,
    minHeightM: solved.activeSolved?.metrics.minHeightM ?? null,
    maxHeightM: solved.activeSolved?.metrics.maxHeightM ?? null,
    fitRmsErrorM: solved.activeSolved?.solution.rmsErrorM ?? null,
    activeFootprintLatDeg: activeFootprintCentroid?.[1] ?? null,
    activeFootprintLonDeg: activeFootprintCentroid?.[0] ?? null,
    shareError: shareError ?? startupHydrationError,
    shareSuccess,
    onSetEditMode: (mode) => {
      setEditMode(mode)
      if (mode === 'roof' && state.isDrawingObstacle) {
        cancelObstacleDrawing()
      }
      if (mode === 'obstacle' && state.isDrawing) {
        cancelDrawing()
      }
    },
    onStartDrawing: () => {
      cancelObstacleDrawing()
      clearSelectionState()
      startDrawing()
    },
    onUndoDrawing: undoDraftPoint,
    onCancelDrawing: () => {
      cancelDrawing()
      clearSelectionState()
    },
    onCommitDrawing: () => {
      commitFootprint()
      clearSelectionState()
    },
    onStartObstacleDrawing: () => {
      cancelDrawing()
      clearSelectionState()
      startObstacleDrawing()
    },
    onUndoObstacleDrawing: undoObstacleDraftPoint,
    onCancelObstacleDrawing: () => {
      cancelObstacleDrawing()
      clearSelectionState()
    },
    onCommitObstacleDrawing: () => {
      commitObstacle()
      clearSelectionState()
    },
    onSelectFootprint: (footprintId, multiSelect) => {
      if (multiSelect) {
        toggleFootprintSelection(footprintId)
      } else {
        selectOnlyFootprint(footprintId)
      }
      clearSelectionState()
    },
    onSelectObstacle: (obstacleId, multiSelect) => {
      if (multiSelect) {
        toggleObstacleSelection(obstacleId)
      } else {
        selectOnlyObstacle(obstacleId)
      }
      clearSelectionState()
    },
    onSetActiveFootprintKwp: (kwp) => {
      setActiveFootprintKwp(kwp)
      const footprintId = state.activeFootprintId
      if (footprintId) {
        setTutorialEditedKwpByFootprint((current) => ({ ...current, [footprintId]: true }))
      }
    },
    onSetActiveObstacleHeight: (heightM) => {
      if (!state.activeObstacleId) {
        return
      }
      setObstacleHeight(state.activeObstacleId, heightM)
    },
    onSetActiveObstacleKind: (kind) => {
      if (!state.activeObstacleId) {
        return
      }
      setObstacleKind(state.activeObstacleId, kind)
    },
    onSetPitchAdjustmentPercent: (pitchAdjustmentPercent) => {
      setActivePitchAdjustmentPercent(clampPitchAdjustmentPercent(pitchAdjustmentPercent))
    },
    onDeleteActiveFootprint: () => {
      if (!state.activeFootprintId) {
        return
      }
      deleteFootprint(state.activeFootprintId)
      clearSelectionState()
    },
    onDeleteActiveObstacle: () => {
      if (!state.activeObstacleId) {
        return
      }
      deleteObstacle(state.activeObstacleId)
      clearSelectionState()
    },
    onSetVertex: applyVertexHeight,
    onSetEdge: applyEdgeHeight,
    onClearVertex: clearVertexHeight,
    onClearEdge: clearEdgeHeight,
    onConstraintLimitExceeded: setConstraintLimitError,
    onStartTutorial: () => tutorialStartRef.current(),
    onShareProject,
    onDevSelectVertex: (vertexIndex) => {
      selectVertex(vertexIndex)
    },
    onDevSelectEdge: (edgeIndex) => {
      selectEdge(edgeIndex)
    },
    onDevClearSelection: () => {
      clearSelectionState()
    },
    onDevImportEntries: onImportDevEntries,
  }

  const canvasModel: SunCastCanvasModel = {
    editMode,
    footprints,
    activeFootprint,
    selectedFootprintIds,
    drawDraftRoof: state.drawDraft,
    isDrawingRoof: state.isDrawing,
    obstacles,
    activeObstacle,
    selectedObstacleIds: selectedObstacles.map((obstacle) => obstacle.id),
    drawDraftObstacle: state.obstacleDrawDraft,
    isDrawingObstacle: state.isDrawingObstacle,
    orbitEnabled,
    roofMeshes: solved.entries.map((entry) => entry.mesh),
    obstacleMeshes,
    vertexConstraints: activeConstraints.vertexHeights,
    selectedVertexIndex: safeSelectedVertexIndex,
    selectedEdgeIndex: safeSelectedEdgeIndex,
    showSolveHint: !solved.activeSolved,
    sunProjectionEnabled: sunProjection.enabled,
    shadingEnabled: state.shadingSettings.enabled,
    hasValidSunDatetime,
    sunDatetimeError,
    sunProjectionResult,
    shadingHeatmapFeatures: shadingResult.heatmapFeatures,
    shadingComputeState: shadingResult.computeState,
    shadingComputeMode: shadingResult.computeMode,
    shadingResultStatus: shadingResult.resultStatus,
    shadingStatusMessage: shadingResult.statusMessage,
    shadingDiagnostics: shadingResult.diagnostics,
    shadingGridResolutionM: state.shadingSettings.gridResolutionM,
    shadingUsedGridResolutionM: shadingResult.usedGridResolutionM,
    sunDatetimeRaw,
    sunDailyDateRaw,
    sunDailyTimeZone,
    selectedRoofInputs,
    hasSolvedActiveRoof: Boolean(solved.activeSolved),
    mapNavigationTarget,
    onPlaceSearchSelect,
    onToggleOrbit: () => setOrbitEnabled((enabled) => !enabled),
    onSelectVertex: (vertexIndex) => {
      selectVertex(vertexIndex)
    },
    onSelectEdge: (edgeIndex) => {
      selectEdge(edgeIndex)
    },
    onSelectFootprint: (footprintId, multiSelect) => {
      if (multiSelect) {
        toggleFootprintSelection(footprintId)
      } else {
        selectOnlyFootprint(footprintId)
      }
      clearSelectionState()
    },
    onSelectObstacle: (obstacleId, multiSelect) => {
      if (multiSelect) {
        toggleObstacleSelection(obstacleId)
      } else {
        selectOnlyObstacle(obstacleId)
      }
      clearSelectionState()
    },
    onClearSelection: () => {
      clearSelectionState()
      clearFootprintSelection()
      clearObstacleSelection()
    },
    onMoveVertex: moveVertexIfValid,
    onMoveEdge: moveEdgeIfValid,
    onMoveObstacleVertex: moveObstacleVertex,
    onMoveRejected: setMoveRejectedError,
    onAdjustHeight: applyHeightStep,
    onMapClick: addDraftPoint,
    onCloseDrawing: () => {
      commitFootprint()
      clearSelectionState()
    },
    onObstacleMapClick: addObstacleDraftPoint,
    onCloseObstacleDrawing: () => {
      commitObstacle()
      clearSelectionState()
    },
    onBearingChange: setMapBearingDeg,
    onPitchChange: setMapPitchDeg,
    onGeometryDragStateChange: setIsGeometryDragActive,
    productionComputationEnabled,
    onInitialized: () => setMapInitialized(true),
    onToggleSunProjectionEnabled: setSunProjectionEnabled,
    onSunDatetimeInputChange: (datetimeIsoRaw) => {
      setTutorialDatetimeEdited(true)
      onSunDatetimeInputChange(datetimeIsoRaw)
    },
  }

  const tutorialModel: SunCastTutorialModel = {
    mapInitialized,
    draftVertexCount: state.drawDraft.length,
    hasFinishedPolygon: Boolean(activeFootprint),
    kwp: activeFootprint?.kwp ?? null,
    hasEditedKwp: activeFootprint ? Boolean(tutorialEditedKwpByFootprint[activeFootprint.id]) : false,
    constrainedVertexCount: activeConstraints.vertexHeights.length,
    orbitEnabled,
    hasEditedDatetime: tutorialDatetimeEdited,
    onReady: ({ startTutorial }) => {
      tutorialStartRef.current = startTutorial
    },
  }

  return { sidebarModel, canvasModel, tutorialModel }
}
