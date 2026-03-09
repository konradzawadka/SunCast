import { useCallback, useMemo, useRef, useState } from 'react'
import { validateFootprint } from '../../geometry/solver/validation'
import { useProjectStore } from '../../state/project-store'
import { useConstraintEditor } from './useConstraintEditor'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRoofDebugSimulation } from '../features/debug/useRoofDebugSimulation'
import { useSelectionState } from './useSelectionState'
import { useSolvedRoofEntries } from './useSolvedRoofEntries'
import { useSunProjectionPanel } from '../features/sun-tools/useSunProjectionPanel'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import { useShareProject } from './useShareProject'
import { useMapNavigationTarget } from './useMapNavigationTarget'
import { useSelectedRoofInputs } from './useSelectedRoofInputs'
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
    isDrawing: state.isDrawing,
    onCancelDrawing: () => {
      cancelDrawing()
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
    isDrawing: state.isDrawing,
    drawDraftCount: state.drawDraft.length,
    footprints,
    activeFootprintId: state.activeFootprintId,
    selectedFootprintIds,
    activeFootprint,
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
    onStartDrawing: () => {
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
    onSelectFootprint: (footprintId, multiSelect) => {
      if (multiSelect) {
        toggleFootprintSelection(footprintId)
      } else {
        selectOnlyFootprint(footprintId)
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
    footprints,
    activeFootprint,
    selectedFootprintIds,
    drawDraft: state.drawDraft,
    isDrawing: state.isDrawing,
    orbitEnabled,
    roofMeshes: solved.entries.map((entry) => entry.mesh),
    vertexConstraints: activeConstraints.vertexHeights,
    selectedVertexIndex: safeSelectedVertexIndex,
    selectedEdgeIndex: safeSelectedEdgeIndex,
    showSolveHint: !solved.activeSolved,
    sunProjectionEnabled: sunProjection.enabled,
    hasValidSunDatetime,
    sunDatetimeError,
    sunProjectionResult,
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
    onClearSelection: () => {
      clearSelectionState()
      clearFootprintSelection()
    },
    onMoveVertex: moveVertexIfValid,
    onMoveEdge: moveEdgeIfValid,
    onMoveRejected: setMoveRejectedError,
    onAdjustHeight: applyHeightStep,
    onMapClick: addDraftPoint,
    onCloseDrawing: () => {
      commitFootprint()
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
