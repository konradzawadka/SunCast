import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateFootprint } from '../../geometry/solver/validation'
import { useProjectStore } from '../../state/project-store'
import type { FaceConstraints, FootprintPolygon, RoofMeshData, SolverWarning } from '../../types/geometry'
import type { SunProjectionResult } from '../../geometry/sun/sunProjection'
import { useConstraintEditor } from './useConstraintEditor'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRoofDebugSimulation } from '../features/debug/useRoofDebugSimulation'
import { useSelectionState } from './useSelectionState'
import { useSolvedRoofEntries } from './useSolvedRoofEntries'
import { useSunProjectionPanel } from '../features/sun-tools/useSunProjectionPanel'
import type { SelectedRoofSunInput } from '../features/sun-tools/SunOverlayColumn'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import { buildSharePayload, serializeSharePayload } from '../../state/project-store/projectState.share'
import { encodeSharePayload } from '../../shared/utils/shareCodec'

const MAX_SHARE_URL_LENGTH = 3500
const MIN_PITCH_ADJUSTMENT_PERCENT = -90
const MAX_PITCH_ADJUSTMENT_PERCENT = 200

function clampPitchAdjustmentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(MAX_PITCH_ADJUSTMENT_PERCENT, Math.max(MIN_PITCH_ADJUSTMENT_PERCENT, value))
}

export interface SunCastSidebarModel {
  isDrawing: boolean
  drawDraftCount: number
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprint: FootprintPolygon | null
  activeConstraints: FaceConstraints
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  footprintEntries: Array<{
    footprint: FootprintPolygon
    constraints: FaceConstraints
  }>
  interactionError: string | null
  solverError: string | null
  footprintErrors: string[]
  warnings: SolverWarning[]
  basePitchDeg: number | null
  pitchAdjustmentPercent: number
  adjustedPitchDeg: number | null
  azimuthDeg: number | null
  roofAreaM2: number | null
  minHeightM: number | null
  maxHeightM: number | null
  fitRmsErrorM: number | null
  activeFootprintLatDeg: number | null
  activeFootprintLonDeg: number | null
  shareError: string | null
  shareSuccess: string | null
  onStartDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
  onCommitDrawing: () => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onSetPitchAdjustmentPercent: (pitchAdjustmentPercent: number) => void
  onDeleteActiveFootprint: () => void
  onSetVertex: (vertexIndex: number, heightM: number) => boolean
  onSetEdge: (edgeIndex: number, heightM: number) => boolean
  onClearVertex: (vertexIndex: number) => void
  onClearEdge: (edgeIndex: number) => void
  onConstraintLimitExceeded: () => void
  onStartTutorial: () => void
  onShareProject: () => Promise<void>
  onDevSelectVertex: (vertexIndex: number) => void
  onDevSelectEdge: (edgeIndex: number) => void
  onDevClearSelection: () => void
  onDevImportEntries: (entries: ImportedFootprintConfigEntry[]) => void
}

export interface SunCastCanvasModel {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  roofMeshes: RoofMeshData[]
  vertexConstraints: FaceConstraints['vertexHeights']
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  showSolveHint: boolean
  sunProjectionEnabled: boolean
  hasValidSunDatetime: boolean
  sunDatetimeError: string | null
  sunProjectionResult: SunProjectionResult | null
  sunDatetimeRaw: string
  sunDailyDateRaw: string
  sunDailyTimeZone: string
  selectedRoofInputs: SelectedRoofSunInput[]
  hasSolvedActiveRoof: boolean
  onToggleOrbit: () => void
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  onMapClick: (point: [number, number]) => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onGeometryDragStateChange: (dragging: boolean) => void
  productionComputationEnabled: boolean
  onInitialized: () => void
  onToggleSunProjectionEnabled: (enabled: boolean) => void
  onSunDatetimeInputChange: (datetimeIsoRaw: string) => void
}

export interface SunCastTutorialModel {
  mapInitialized: boolean
  draftVertexCount: number
  hasFinishedPolygon: boolean
  kwp: number | null
  hasEditedKwp: boolean
  constrainedVertexCount: number
  orbitEnabled: boolean
  hasEditedDatetime: boolean
  onReady: (controls: { startTutorial: () => void }) => void
}

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

export function useSunCastController(): {
  sidebarModel: SunCastSidebarModel
  canvasModel: SunCastCanvasModel
  tutorialModel: SunCastTutorialModel
} {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [mapInitialized, setMapInitialized] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [tutorialKwpEdited, setTutorialKwpEdited] = useState(false)
  const [tutorialDatetimeEdited, setTutorialDatetimeEdited] = useState(false)
  const [isGeometryDragActive, setIsGeometryDragActive] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)
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

  useEffect(() => {
    setTutorialKwpEdited(false)
  }, [state.activeFootprintId])

  const solved = useSolvedRoofEntries(footprintEntries, state.activeFootprintId)
  const activeFootprintCentroid = useMemo(
    () => computeFootprintCentroid(activeFootprint?.vertices ?? []),
    [activeFootprint],
  )
  const activePitchAdjustmentPercent = activeFootprint
    ? clampPitchAdjustmentPercent(state.footprints[activeFootprint.id]?.pitchAdjustmentPercent ?? 0)
    : 0
  const basePitchDeg = solved.activeSolved?.metrics.pitchDeg ?? null
  const adjustedPitchDeg =
    basePitchDeg === null ? null : basePitchDeg * (1 + activePitchAdjustmentPercent / 100)
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
        roofPitchDeg:
          solvedEntry.metrics.pitchDeg * (1 + clampPitchAdjustmentPercent(footprintEntry.pitchAdjustmentPercent) / 100),
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
  })

  const onImportDevEntries = (entries: ImportedFootprintConfigEntry[]) => {
    upsertImportedFootprints(entries)
    clearSelectionState()
  }

  const onShareProject = useCallback(async () => {
    setShareError(null)
    setShareSuccess(null)

    if (Object.keys(state.footprints).length === 0) {
      setShareError('Nothing to share yet. Add at least one footprint.')
      return
    }

    try {
      const payload = buildSharePayload({
        footprints: state.footprints,
        activeFootprintId: state.activeFootprintId,
        sunProjection: state.sunProjection,
      })
      const encoded = await encodeSharePayload(serializeSharePayload(payload))
      const shareUrl = new URL(window.location.href)
      shareUrl.hash = `c=${encoded}`
      const shareUrlValue = shareUrl.toString()

      if (shareUrlValue.length > MAX_SHARE_URL_LENGTH) {
        setShareError('Project is too large to share as a URL.')
        return
      }

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'SunCast project', url: shareUrlValue })
          setShareSuccess('Share dialog opened.')
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
        }
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard sharing is not available in this browser.')
      }

      await navigator.clipboard.writeText(shareUrlValue)
      setShareSuccess('Share URL copied to clipboard.')
    } catch {
      setShareError('Could not generate share URL.')
    }
  }, [state.activeFootprintId, state.footprints, state.sunProjection])

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
      setTutorialKwpEdited(true)
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
    hasEditedKwp: tutorialKwpEdited,
    constrainedVertexCount: activeConstraints.vertexHeights.length,
    orbitEnabled,
    hasEditedDatetime: tutorialDatetimeEdited,
    onReady: ({ startTutorial }) => {
      tutorialStartRef.current = startTutorial
    },
  }

  return { sidebarModel, canvasModel, tutorialModel }
}
