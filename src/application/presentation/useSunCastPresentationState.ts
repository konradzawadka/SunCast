import { useEffect, useMemo, useRef } from 'react'
import { validateFootprint } from '../../geometry/solver/validation'
import { generateObstacleMeshResult } from '../../geometry/mesh/generateObstacleMesh'
import type { ImportedFootprintConfigEntry } from '../../app/features/debug/DevTools'
import { useShareProject } from '../../app/hooks/useShareProject'
import { useMapNavigationTarget } from '../../app/hooks/useMapNavigationTarget'
import { useKeyboardShortcuts } from '../../app/hooks/useKeyboardShortcuts'
import { useRoofDebugSimulation } from '../../app/features/debug/useRoofDebugSimulation'
import { useProjectDocument } from '../../domain/project-document/useProjectDocument'
import { useEditorSession } from '../editor-session/useEditorSession'
import { useAnalysis } from '../analysis/useAnalysis'
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
} from '../../app/components/globalErrorToastActions'
import { clampPitchAdjustmentPercent, computeFootprintCentroid } from './presentationModel.types'

const COMPUTE_PROCESSING_SOURCE = 'controller.compute'

export interface SunCastPresentationState {
  projectDocument: ReturnType<typeof useProjectDocument>
  editorSession: ReturnType<typeof useEditorSession>
  analysis: ReturnType<typeof useAnalysis>
  activeFootprintErrors: string[]
  activeFootprintCentroid: [number, number] | null
  activePitchAdjustmentPercent: number
  adjustedPitchDeg: number | null
  obstacleMeshes: ReturnType<typeof generateObstacleMeshResult>[]
  selectedObstacleIds: string[]
  mapNavigationTarget: ReturnType<typeof useMapNavigationTarget>['mapNavigationTarget']
  onPlaceSearchSelect: ReturnType<typeof useMapNavigationTarget>['onPlaceSearchSelect']
  onShareProject: () => Promise<void>
  onImportDevEntries: (entries: ImportedFootprintConfigEntry[]) => void
}

export function useSunCastPresentationState(): SunCastPresentationState {
  const projectDocument = useProjectDocument()
  const {
    store,
    footprintEntries,
    footprints,
    activeFootprint,
    activeConstraints,
    obstacles,
    activeObstacle,
    selectedObstacles,
    selectedFootprintIds,
    sunProjection,
    shadingSettings,
  } = projectDocument

  const editorSession = useEditorSession({
    activeFootprint,
    activeConstraints,
    isDrawing: store.state.isDrawing,
    isDrawingObstacle: store.state.isDrawingObstacle,
    moveVertex: store.moveVertex,
    moveEdge: store.moveEdge,
    setVertexHeight: store.setVertexHeight,
    setVertexHeights: store.setVertexHeights,
    setEdgeHeight: store.setEdgeHeight,
  })

  const analysis = useAnalysis({
    footprintEntries,
    footprintEntriesById: store.state.footprints,
    activeFootprintId: store.state.activeFootprintId,
    selectedFootprintIds,
    activeFootprintVertices: activeFootprint?.vertices ?? null,
    obstacles,
    sunProjection,
    shadingSettings,
    hasVertexOrEdgeSelection:
      editorSession.safeSelectedVertexIndex !== null || editorSession.safeSelectedEdgeIndex !== null,
    isGeometryDragActive: editorSession.isGeometryDragActive,
    setSunProjectionDatetimeIso: store.setSunProjectionDatetimeIso,
    setSunProjectionDailyDateIso: store.setSunProjectionDailyDateIso,
  })

  const activeFootprintErrors = validateFootprint(activeFootprint)
  const activeFootprintCentroid = computeFootprintCentroid(activeFootprint?.vertices ?? [])
  const activePitchAdjustmentPercent = activeFootprint
    ? clampPitchAdjustmentPercent(store.state.footprints[activeFootprint.id]?.pitchAdjustmentPercent ?? 0)
    : 0
  const adjustedPitchDeg =
    analysis.solvedMetrics.basePitchDeg === null
      ? null
      : analysis.solvedMetrics.basePitchDeg * (1 + activePitchAdjustmentPercent / 100)

  const obstacleMeshResults = useMemo(() => {
    return obstacles.map((obstacle) => generateObstacleMeshResult(obstacle))
  }, [obstacles])

  const obstacleMeshErrors = useMemo(
    () => obstacleMeshResults.filter((result): result is Extract<typeof result, { ok: false }> => !result.ok),
    [obstacleMeshResults],
  )

  const obstacleMeshes = useMemo(
    () => obstacleMeshResults.filter((result): result is Extract<typeof result, { ok: true }> => result.ok),
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

  useEffect(() => {
    if (analysis.computeProcessingActive) {
      startGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE, 'Processing geometry...')
    } else {
      stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
    }
    return () => stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
  }, [analysis.computeProcessingActive])

  useRoofDebugSimulation({
    activeFootprint,
    activeSolved: analysis.solvedRoofs.activeSolved,
    mapBearingDeg: editorSession.mapBearingDeg,
    mapPitchDeg: editorSession.mapPitchDeg,
  })

  useKeyboardShortcuts({
    onSelectAllFootprints: () => {
      store.selectAllFootprints()
      editorSession.clearSelectionState()
    },
    isDrawing: store.state.isDrawing || store.state.isDrawingObstacle,
    onCancelDrawing: () => {
      if (store.state.isDrawingObstacle) {
        store.cancelObstacleDrawing()
      } else {
        store.cancelDrawing()
      }
      editorSession.clearSelectionState()
    },
  })

  const { onShareProject } = useShareProject({
    footprints: store.state.footprints,
    activeFootprintId: null,
    obstacles: store.state.obstacles,
    activeObstacleId: null,
    sunProjection: store.state.sunProjection,
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
        store.resetState()
        editorSession.clearSelectionState()
        analysis.setRequestedHeatmapMode('live-shading')
        clearShareHashParam()
        reportAppSuccess('Project state reset to defaults.', {
          area: 'global-error-toast',
          source: 'reset-state',
        })
      }
    }

    window.addEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
    return () => window.removeEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
  }, [analysis, editorSession, onShareProject, store])

  const onImportDevEntries = (entries: ImportedFootprintConfigEntry[]) => {
    store.upsertImportedFootprints(entries)
    editorSession.clearSelectionState()
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

    if (editorSession.interactionError) {
      const signature = `INTERACTION_FAILED:${editorSession.interactionError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INTERACTION_FAILED', editorSession.interactionError, {
          context: { area: 'status-panel', source: 'interaction' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (analysis.diagnostics.solverError) {
      const signature = `SOLVER_FAILED:${analysis.diagnostics.solverError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('SOLVER_FAILED', analysis.diagnostics.solverError, {
          context: { area: 'status-panel', source: 'solver' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (analysis.sunProjection.datetimeError) {
      const signature = `INPUT_VALIDATION_FAILED:sun:${analysis.sunProjection.datetimeError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INPUT_VALIDATION_FAILED', analysis.sunProjection.datetimeError, {
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
  }, [
    activeFootprintErrors,
    analysis.diagnostics.solverError,
    analysis.sunProjection.datetimeError,
    editorSession.interactionError,
  ])

  const { mapNavigationTarget, onPlaceSearchSelect } = useMapNavigationTarget()

  return {
    projectDocument: {
      ...projectDocument,
      footprints,
      activeObstacle,
      selectedObstacles,
      activeConstraints,
    },
    editorSession,
    analysis,
    activeFootprintErrors,
    activeFootprintCentroid,
    activePitchAdjustmentPercent,
    adjustedPitchDeg,
    obstacleMeshes,
    selectedObstacleIds: selectedObstacles.map((obstacle) => obstacle.id),
    mapNavigationTarget,
    onPlaceSearchSelect,
    onShareProject,
    onImportDevEntries,
  }
}
