import { useMapNavigationTarget } from '../hooks/useMapNavigationTarget'
import { useProjectDocument } from '../../state/project-store/useProjectDocument'
import { useEditorSession } from '../editor-session/useEditorSession'
import { useAnalysis } from '../analysis/useAnalysis'
import { useShareProject } from '../hooks/useShareProject'
import { generateObstacleMeshResult } from '../../geometry/mesh/generateObstacleMesh'
import { useActiveFootprintState } from './hooks/useActiveFootprintState'
import { useObstacleMeshes } from './hooks/useObstacleMeshes'
import { useComputeProcessingToast } from './hooks/useComputeProcessingToast'
import { usePresentationKeyboardShortcuts } from './hooks/usePresentationKeyboardShortcuts'
import { useGlobalToastActions } from './hooks/useGlobalToastActions'
import { usePresentationErrorReporting } from './hooks/usePresentationErrorReporting'

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
    stateRevision: projectDocument.stateRevision,
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

  const { onShareProject } = useShareProject({
    footprints: store.state.footprints,
    activeFootprintId: null,
    obstacles: store.state.obstacles,
    activeObstacleId: null,
    sunProjection: store.state.sunProjection,
  })

  const { activeFootprintErrors, activeFootprintCentroid, activePitchAdjustmentPercent, adjustedPitchDeg } =
    useActiveFootprintState(projectDocument, analysis)

  const { obstacleMeshResults } = useObstacleMeshes(obstacles)

  useComputeProcessingToast(analysis.computeProcessingActive)
  usePresentationKeyboardShortcuts(projectDocument, editorSession)
  useGlobalToastActions({ projectDocument, editorSession, analysis, onShareProject })
  usePresentationErrorReporting({ activeFootprintErrors, editorSession, analysis })

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
    obstacleMeshes: obstacleMeshResults,
    selectedObstacleIds: selectedObstacles.map((obstacle) => obstacle.id),
    mapNavigationTarget,
    onPlaceSearchSelect,
    onShareProject,
  }
}
