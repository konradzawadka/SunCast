import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateFootprint } from '../../geometry/solver/validation'
import { useProjectStore } from '../../state/project-store'
import { useConstraintEditor } from './useConstraintEditor'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRoofDebugSimulation } from '../features/debug/useRoofDebugSimulation'
import { useSelectionState } from './useSelectionState'
import { generateObstacleMeshResult } from '../../geometry/mesh/generateObstacleMesh'
import { useSunProjectionPanel } from '../features/sun-tools/useSunProjectionPanel'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import { useShareProject } from './useShareProject'
import { useMapNavigationTarget } from './useMapNavigationTarget'
import { deriveSolvedRoofs } from '../../application/analysis/deriveSolvedRoofs'
import { deriveSelectedRoofInputs } from '../../application/analysis/deriveSelectedRoofInputs'
import { useLiveShading } from '../../application/analysis/useLiveShading'
import { useAnnualSimulation } from '../../application/analysis/useAnnualSimulation'
import { useDerivedShadingRoofs } from '../../application/analysis/deriveShadingRoofs'
import { useDerivedHeatmapMode } from '../../application/analysis/deriveHeatmapMode'
import {
  reportAppError,
  reportAppErrorCode,
  reportAppSuccess,
  startGlobalProcessingToast,
  stopGlobalProcessingToast,
} from '../../shared/errors'
import {
  GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME,
  type GlobalErrorToastActionEventDetail,
} from '../components/globalErrorToastActions'
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
  const COMPUTE_PROCESSING_SOURCE = 'controller.compute'
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
    setShadingGridResolutionM,
    selectOnlyObstacle,
    toggleObstacleSelection,
    clearObstacleSelection,
    upsertImportedFootprints,
    resetState,
  } = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(state.footprints), [state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])
  const activeFootprintErrors = validateFootprint(activeFootprint)

  const solved = deriveSolvedRoofs(footprintEntries, state.activeFootprintId)
  const activeFootprintCentroid = computeFootprintCentroid(activeFootprint?.vertices ?? [])
  const activePitchAdjustmentPercent = activeFootprint
    ? clampPitchAdjustmentPercent(state.footprints[activeFootprint.id]?.pitchAdjustmentPercent ?? 0)
    : 0
  const basePitchDeg = solved.activeSolved?.metrics.pitchDeg ?? null
  const adjustedPitchDeg =
    basePitchDeg === null ? null : basePitchDeg * (1 + activePitchAdjustmentPercent / 100)

  const selectedRoofInputs = deriveSelectedRoofInputs({
    selectedFootprintIds,
    footprintEntries: state.footprints,
    solvedEntries: solved.entries,
  })

  const obstacleMeshResults = useMemo(() => {
    return obstacles.map((obstacle) => generateObstacleMeshResult(obstacle))
  }, [obstacles])
  const obstacleMeshErrors = useMemo(
    () => obstacleMeshResults.filter((result): result is Extract<typeof result, { ok: false }> => !result.ok),
    [obstacleMeshResults],
  )
  const obstacleMeshes = useMemo(
    () =>
      obstacleMeshResults
        .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
        .map((result) => result.value),
    [obstacleMeshResults],
  )

  const reportedObstacleMeshErrorSignaturesRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const signatures = new Set<string>()
    for (const result of obstacleMeshErrors) {
      const context = result.error.context ?? {}
      const signature = `${result.error.code}:${String(context.obstacleId ?? 'unknown')}:${String(context.reason ?? '')}`
      signatures.add(signature)
      if (!reportedObstacleMeshErrorSignaturesRef.current.has(signature)) {
        reportAppError(result.error)
        reportedObstacleMeshErrorSignaturesRef.current.add(signature)
      }
    }

    for (const existing of [...reportedObstacleMeshErrorSignaturesRef.current]) {
      if (!signatures.has(existing)) {
        reportedObstacleMeshErrorSignaturesRef.current.delete(existing)
      }
    }
  }, [obstacleMeshErrors])

  const shadingRoofs = useDerivedShadingRoofs({
    selectedFootprintIds,
    activeFootprintId: state.activeFootprintId,
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

  const shadingResult = useLiveShading({
    enabled: state.shadingSettings.enabled && sunProjection.enabled && hasValidSunDatetime && !isGeometryDragActive,
    roofs: shadingRoofs,
    obstacles,
    datetimeIso: state.sunProjection.datetimeIso,
    gridResolutionM: state.shadingSettings.gridResolutionM,
    interactionActive: isGeometryDragActive,
  })

  const annualSimulation = useAnnualSimulation({
    roofs: shadingRoofs,
    obstacles,
    gridResolutionM: state.shadingSettings.gridResolutionM,
    timeZone: sunDailyTimeZone,
  })
  const [requestedHeatmapMode, setRequestedHeatmapMode] = useState<'live-shading' | 'annual-sun-access' | 'none'>(
    'live-shading',
  )
  const activeHeatmapMode = useDerivedHeatmapMode({
    requestedHeatmapMode,
    annualSimulationState: annualSimulation.state,
    shadingEnabled: state.shadingSettings.enabled,
  })

  const annualHeatmapVisible =
    activeHeatmapMode === 'annual-sun-access' &&
    annualSimulation.state === 'READY' &&
    annualSimulation.heatmapFeatures.length > 0

  const heatmapFeaturesForMap =
    activeHeatmapMode === 'annual-sun-access' ? annualSimulation.heatmapFeatures : shadingResult.heatmapFeatures
  const heatmapComputeStateForMap =
    activeHeatmapMode === 'annual-sun-access'
      ? annualSimulation.state === 'RUNNING'
        ? ('SCHEDULED' as const)
        : annualSimulation.state === 'READY'
          ? ('READY' as const)
          : ('IDLE' as const)
      : shadingResult.computeState
  const heatmapEnabledForMap =
    activeHeatmapMode === 'annual-sun-access'
      ? annualSimulation.state === 'READY'
      : activeHeatmapMode === 'live-shading'
        ? state.shadingSettings.enabled
        : false
  const computeProcessingActive = shadingResult.computeState === 'SCHEDULED' || annualSimulation.state === 'RUNNING'

  useEffect(() => {
    if (computeProcessingActive) {
      startGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE, 'Processing geometry...')
    } else {
      stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
    }
    return () => stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
  }, [computeProcessingActive])

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

  const { onShareProject } = useShareProject({
    footprints: state.footprints,
    activeFootprintId: null,
    obstacles: state.obstacles,
    activeObstacleId: null,
    sunProjection: state.sunProjection,
  })

  useEffect(() => {
    const clearShareHashParam = () => {
      const normalizedHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      if (!normalizedHash) {
        return
      }
      const params = new URLSearchParams(normalizedHash)
      if (!params.has('c')) {
        return
      }
      params.delete('c')
      const nextHash = params.toString()
      const nextUrl = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`
      window.history.replaceState(window.history.state, '', nextUrl)
    }

    const onGlobalErrorToastAction = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<GlobalErrorToastActionEventDetail>
      if (!event.detail || typeof event.detail.action !== 'string') {
        return
      }

      if (event.detail.action === 'share-state') {
        void onShareProject()
        return
      }

      if (event.detail.action === 'reset-state') {
        resetState()
        clearSelectionState()
        setRequestedHeatmapMode('live-shading')
        clearShareHashParam()
        reportAppSuccess('Project state reset to defaults.', {
          area: 'global-error-toast',
          source: 'reset-state',
        })
      }
    }

    window.addEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
    return () => window.removeEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
  }, [clearSelectionState, onShareProject, resetState])

  const onImportDevEntries = (entries: ImportedFootprintConfigEntry[]) => {
    upsertImportedFootprints(entries)
    clearSelectionState()
  }

  const reportedUiErrorSignaturesRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const signatures = new Set<string>()
    for (const message of activeFootprintErrors) {
      const signature = `INPUT_VALIDATION_FAILED:footprint:${message}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INPUT_VALIDATION_FAILED', message, {
          context: { area: 'status-panel', source: 'footprint-validation' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (interactionError) {
      const signature = `INTERACTION_FAILED:${interactionError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INTERACTION_FAILED', interactionError, {
          context: { area: 'status-panel', source: 'interaction' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (solved.activeError) {
      const signature = `SOLVER_FAILED:${solved.activeError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('SOLVER_FAILED', solved.activeError, {
          context: { area: 'status-panel', source: 'solver' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (sunDatetimeError) {
      const signature = `INPUT_VALIDATION_FAILED:sun:${sunDatetimeError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INPUT_VALIDATION_FAILED', sunDatetimeError, {
          context: { area: 'sun-datetime', source: 'datetime-input' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    for (const existing of [...reportedUiErrorSignaturesRef.current]) {
      const isUiValidationSignature =
        existing.startsWith('INPUT_VALIDATION_FAILED:footprint:') ||
        existing.startsWith('INPUT_VALIDATION_FAILED:sun:') ||
        existing.startsWith('INTERACTION_FAILED:') ||
        existing.startsWith('SOLVER_FAILED:')
      if (isUiValidationSignature && !signatures.has(existing)) {
        reportedUiErrorSignaturesRef.current.delete(existing)
      }
    }
  }, [activeFootprintErrors, interactionError, solved.activeError, sunDatetimeError])

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
      setOrbitEnabled(false)
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
      setOrbitEnabled(false)
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
    hasValidSunDatetime,
    sunDatetimeError,
    sunProjectionResult,
    shadingEnabled: heatmapEnabledForMap,
    shadingHeatmapFeatures: heatmapFeaturesForMap,
    shadingComputeState: heatmapComputeStateForMap,
    annualSimulationHeatmapFeatures: annualSimulation.heatmapFeatures,
    annualSimulationState: annualSimulation.state,
    activeHeatmapMode,
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
    annualSunAccess: {
      selectedRoofCount: shadingRoofs.length,
      gridResolutionM: state.shadingSettings.gridResolutionM,
      state: annualSimulation.state,
      progressRatio: annualSimulation.progress.ratio,
      result: annualSimulation.result,
      error: annualSimulation.error,
      isAnnualHeatmapVisible: annualHeatmapVisible,
      onGridResolutionChange: (gridResolutionM: number) => {
        setShadingGridResolutionM(gridResolutionM)
      },
      onRunSimulation: annualSimulation.runSimulation,
      onClearSimulation: () => {
        annualSimulation.clearSimulation()
        setRequestedHeatmapMode(state.shadingSettings.enabled ? 'live-shading' : 'none')
      },
      onShowAnnualHeatmap: () => {
        if (annualSimulation.state !== 'READY' || annualSimulation.heatmapFeatures.length === 0) {
          return
        }
        setRequestedHeatmapMode('annual-sun-access')
      },
      onHideAnnualHeatmap: () => {
        setRequestedHeatmapMode(state.shadingSettings.enabled ? 'live-shading' : 'none')
      },
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
