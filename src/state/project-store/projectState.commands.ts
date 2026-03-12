import type { Dispatch } from 'react'
import type { ObstacleKind, VertexHeightConstraint } from '../../types/geometry'
import { getActiveFootprint } from './projectState.selectors'
import type { Action, ImportedFootprintEntry, ProjectState } from './projectState.types'

export interface ProjectCommands {
  startDrawing: () => void
  cancelDrawing: () => void
  addDraftPoint: (point: [number, number]) => void
  undoDraftPoint: () => void
  commitFootprint: () => void
  setActiveFootprint: (footprintId: string) => void
  selectOnlyFootprint: (footprintId: string) => void
  toggleFootprintSelection: (footprintId: string) => void
  selectAllFootprints: () => void
  clearFootprintSelection: () => void
  deleteFootprint: (footprintId: string) => void
  moveVertex: (vertexIndex: number, point: [number, number]) => void
  moveEdge: (edgeIndex: number, delta: [number, number]) => void
  setVertexHeight: (vertexIndex: number, heightM: number) => boolean
  setEdgeHeight: (edgeIndex: number, heightM: number) => boolean
  setVertexHeights: (constraints: VertexHeightConstraint[]) => boolean
  setActiveFootprintKwp: (kwp: number) => boolean
  setActivePitchAdjustmentPercent: (pitchAdjustmentPercent: number) => boolean
  clearVertexHeight: (vertexIndex: number) => void
  clearEdgeHeight: (edgeIndex: number) => void
  setSunProjectionEnabled: (enabled: boolean) => void
  setSunProjectionDatetimeIso: (datetimeIso: string | null) => void
  setSunProjectionDailyDateIso: (dailyDateIso: string | null) => void
  startObstacleDrawing: () => void
  cancelObstacleDrawing: () => void
  addObstacleDraftPoint: (point: [number, number]) => void
  undoObstacleDraftPoint: () => void
  commitObstacle: () => void
  setActiveObstacle: (obstacleId: string) => void
  selectOnlyObstacle: (obstacleId: string) => void
  toggleObstacleSelection: (obstacleId: string) => void
  selectAllObstacles: () => void
  clearObstacleSelection: () => void
  deleteObstacle: (obstacleId: string) => void
  moveObstacleVertex: (obstacleId: string, vertexIndex: number, point: [number, number]) => boolean
  setObstacleHeight: (obstacleId: string, heightAboveGroundM: number) => boolean
  setObstacleKind: (obstacleId: string, kind: ObstacleKind) => boolean
  setShadingEnabled: (enabled: boolean) => void
  setShadingGridResolutionM: (gridResolutionM: number) => boolean
  upsertImportedFootprints: (entries: ImportedFootprintEntry[]) => boolean
}

function withDispatch(dispatch: Dispatch<Action>) {
  return {
    startDrawing: () => dispatch({ type: 'START_DRAW' }),
    cancelDrawing: () => dispatch({ type: 'CANCEL_DRAW' }),
    addDraftPoint: (point: [number, number]) => dispatch({ type: 'ADD_DRAFT_POINT', point }),
    undoDraftPoint: () => dispatch({ type: 'UNDO_DRAFT_POINT' }),
    commitFootprint: () => dispatch({ type: 'COMMIT_FOOTPRINT' }),
    setActiveFootprint: (footprintId: string) => dispatch({ type: 'SET_ACTIVE_FOOTPRINT', footprintId }),
    selectOnlyFootprint: (footprintId: string) => dispatch({ type: 'SELECT_ONLY_FOOTPRINT', footprintId }),
    toggleFootprintSelection: (footprintId: string) => dispatch({ type: 'TOGGLE_FOOTPRINT_SELECTION', footprintId }),
    selectAllFootprints: () => dispatch({ type: 'SELECT_ALL_FOOTPRINTS' }),
    clearFootprintSelection: () => dispatch({ type: 'CLEAR_FOOTPRINT_SELECTION' }),
    deleteFootprint: (footprintId: string) => dispatch({ type: 'DELETE_FOOTPRINT', footprintId }),
    moveVertex: (vertexIndex: number, point: [number, number]) =>
      dispatch({ type: 'MOVE_VERTEX', payload: { vertexIndex, point } }),
    moveEdge: (edgeIndex: number, delta: [number, number]) => dispatch({ type: 'MOVE_EDGE', payload: { edgeIndex, delta } }),
    clearVertexHeight: (vertexIndex: number) => dispatch({ type: 'CLEAR_VERTEX_HEIGHT', vertexIndex }),
    clearEdgeHeight: (edgeIndex: number) => dispatch({ type: 'CLEAR_EDGE_HEIGHT', edgeIndex }),
    setSunProjectionEnabled: (enabled: boolean) => dispatch({ type: 'SET_SUN_PROJECTION_ENABLED', enabled }),
    setSunProjectionDatetimeIso: (datetimeIso: string | null) => dispatch({ type: 'SET_SUN_PROJECTION_DATETIME', datetimeIso }),
    setSunProjectionDailyDateIso: (dailyDateIso: string | null) => dispatch({ type: 'SET_SUN_PROJECTION_DAILY_DATE', dailyDateIso }),
    startObstacleDrawing: () => dispatch({ type: 'START_OBSTACLE_DRAW' }),
    cancelObstacleDrawing: () => dispatch({ type: 'CANCEL_OBSTACLE_DRAW' }),
    addObstacleDraftPoint: (point: [number, number]) => dispatch({ type: 'ADD_OBSTACLE_DRAFT_POINT', point }),
    undoObstacleDraftPoint: () => dispatch({ type: 'UNDO_OBSTACLE_DRAFT_POINT' }),
    commitObstacle: () => dispatch({ type: 'COMMIT_OBSTACLE' }),
    setActiveObstacle: (obstacleId: string) => dispatch({ type: 'SET_ACTIVE_OBSTACLE', obstacleId }),
    selectOnlyObstacle: (obstacleId: string) => dispatch({ type: 'SELECT_ONLY_OBSTACLE', obstacleId }),
    toggleObstacleSelection: (obstacleId: string) => dispatch({ type: 'TOGGLE_OBSTACLE_SELECTION', obstacleId }),
    selectAllObstacles: () => dispatch({ type: 'SELECT_ALL_OBSTACLES' }),
    clearObstacleSelection: () => dispatch({ type: 'CLEAR_OBSTACLE_SELECTION' }),
    deleteObstacle: (obstacleId: string) => dispatch({ type: 'DELETE_OBSTACLE', obstacleId }),
    setShadingEnabled: (enabled: boolean) => dispatch({ type: 'SET_SHADING_ENABLED', enabled }),
  }
}

export function createProjectCommands(
  dispatch: Dispatch<Action>,
  getState: () => ProjectState,
): ProjectCommands {
  const dispatchOnly = withDispatch(dispatch)

  return {
    ...dispatchOnly,
    setVertexHeight: (vertexIndex: number, heightM: number) => {
      const activeFootprint = getActiveFootprint(getState())
      if (!activeFootprint || vertexIndex < 0 || vertexIndex >= activeFootprint.vertices.length) {
        return false
      }
      dispatch({ type: 'SET_VERTEX_HEIGHT', payload: { vertexIndex, heightM } })
      return true
    },
    setEdgeHeight: (edgeIndex: number, heightM: number) => {
      const activeFootprint = getActiveFootprint(getState())
      if (!activeFootprint || edgeIndex < 0 || edgeIndex >= activeFootprint.vertices.length) {
        return false
      }
      dispatch({ type: 'SET_EDGE_HEIGHT', payload: { edgeIndex, heightM } })
      return true
    },
    setVertexHeights: (constraints: VertexHeightConstraint[]) => {
      const activeFootprint = getActiveFootprint(getState())
      if (!activeFootprint || constraints.length === 0) {
        return false
      }
      const hasInvalidIndex = constraints.some(
        (constraint) => constraint.vertexIndex < 0 || constraint.vertexIndex >= activeFootprint.vertices.length,
      )
      if (hasInvalidIndex) {
        return false
      }
      dispatch({ type: 'SET_VERTEX_HEIGHTS', payload: constraints })
      return true
    },
    setActiveFootprintKwp: (kwp: number) => {
      if (!Number.isFinite(kwp) || !getActiveFootprint(getState())) {
        return false
      }
      dispatch({ type: 'SET_ACTIVE_FOOTPRINT_KWP', kwp })
      return true
    },
    setActivePitchAdjustmentPercent: (pitchAdjustmentPercent: number) => {
      if (!Number.isFinite(pitchAdjustmentPercent) || !getActiveFootprint(getState())) {
        return false
      }
      dispatch({ type: 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT', pitchAdjustmentPercent })
      return true
    },
    upsertImportedFootprints: (entries: ImportedFootprintEntry[]) => {
      if (entries.length === 0) {
        return false
      }
      dispatch({ type: 'UPSERT_IMPORTED_FOOTPRINTS', entries })
      return true
    },
    moveObstacleVertex: (obstacleId: string, vertexIndex: number, point: [number, number]) => {
      const obstacle = getState().obstacles[obstacleId]
      if (!obstacle || vertexIndex < 0 || vertexIndex >= obstacle.polygon.length) {
        return false
      }
      dispatch({ type: 'MOVE_OBSTACLE_VERTEX', payload: { obstacleId, vertexIndex, point } })
      return true
    },
    setObstacleHeight: (obstacleId: string, heightAboveGroundM: number) => {
      if (!getState().obstacles[obstacleId] || !Number.isFinite(heightAboveGroundM)) {
        return false
      }
      dispatch({ type: 'SET_OBSTACLE_HEIGHT', payload: { obstacleId, heightAboveGroundM } })
      return true
    },
    setObstacleKind: (obstacleId: string, kind: ObstacleKind) => {
      if (!getState().obstacles[obstacleId]) {
        return false
      }
      dispatch({ type: 'SET_OBSTACLE_KIND', payload: { obstacleId, kind } })
      return true
    },
    setShadingGridResolutionM: (gridResolutionM: number) => {
      if (!Number.isFinite(gridResolutionM) || gridResolutionM <= 0) {
        return false
      }
      dispatch({ type: 'SET_SHADING_GRID_RESOLUTION', gridResolutionM })
      return true
    },
  }
}
