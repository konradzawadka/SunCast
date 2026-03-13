import type { FootprintPolygon, ObstacleStateEntry } from '../../types/geometry'
import { createObstacleShapeForKind, withMovedObstacleShapeVertex, withObstacleKind } from '../../geometry/obstacles/obstacleModels'
import { assertValidVertexHeights, setOrReplaceVertexConstraint } from '../../state/project-store/projectState.constraints'
import type { Action, FootprintStateEntry, ProjectState } from '../../state/project-store/projectState.types'

export const DEFAULT_FOOTPRINT_KWP = 4.3
export const DEFAULT_OBSTACLE_HEIGHT_M = 8

function generateFootprintId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fp-${crypto.randomUUID()}`
  }
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function generateObstacleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ob-${crypto.randomUUID()}`
  }
  return `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function applyToActiveFootprint(
  state: ProjectState,
  updater: (entry: FootprintStateEntry) => FootprintStateEntry,
): ProjectState {
  if (!state.activeFootprintId) {
    return state
  }

  const activeEntry = state.footprints[state.activeFootprintId]
  if (!activeEntry) {
    return state
  }

  return {
    ...state,
    footprints: {
      ...state.footprints,
      [state.activeFootprintId]: updater(activeEntry),
    },
  }
}

function applyToObstacle(
  state: ProjectState,
  obstacleId: string,
  updater: (entry: ObstacleStateEntry) => ObstacleStateEntry,
): ProjectState {
  const obstacle = state.obstacles[obstacleId]
  if (!obstacle) {
    return state
  }

  return {
    ...state,
    obstacles: {
      ...state.obstacles,
      [obstacleId]: updater(obstacle),
    },
  }
}

export function projectDocumentReducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'COMMIT_FOOTPRINT': {
      if (state.drawDraft.length < 3) {
        return state
      }

      const footprintId = generateFootprintId()
      const footprint: FootprintPolygon = {
        id: footprintId,
        vertices: state.drawDraft,
        kwp: DEFAULT_FOOTPRINT_KWP,
      }

      return {
        ...state,
        footprints: {
          ...state.footprints,
          [footprintId]: {
            footprint,
            constraints: { vertexHeights: [] },
            pitchAdjustmentPercent: 0,
          },
        },
      }
    }
    case 'DELETE_FOOTPRINT': {
      if (!state.footprints[action.footprintId]) {
        return state
      }

      const nextFootprints = { ...state.footprints }
      delete nextFootprints[action.footprintId]
      return {
        ...state,
        footprints: nextFootprints,
      }
    }
    case 'MOVE_VERTEX':
      return applyToActiveFootprint(state, (entry) => {
        const vertexCount = entry.footprint.vertices.length
        const { vertexIndex, point } = action.payload
        if (vertexIndex < 0 || vertexIndex >= vertexCount) {
          return entry
        }
        const nextVertices = [...entry.footprint.vertices]
        nextVertices[vertexIndex] = point
        return {
          ...entry,
          footprint: {
            ...entry.footprint,
            vertices: nextVertices,
          },
        }
      })
    case 'MOVE_EDGE':
      return applyToActiveFootprint(state, (entry) => {
        const vertexCount = entry.footprint.vertices.length
        const { edgeIndex, delta } = action.payload
        if (edgeIndex < 0 || edgeIndex >= vertexCount) {
          return entry
        }

        const start = edgeIndex
        const end = (edgeIndex + 1) % vertexCount
        const nextVertices = [...entry.footprint.vertices]
        const [deltaLon, deltaLat] = delta
        nextVertices[start] = [nextVertices[start][0] + deltaLon, nextVertices[start][1] + deltaLat]
        nextVertices[end] = [nextVertices[end][0] + deltaLon, nextVertices[end][1] + deltaLat]

        return {
          ...entry,
          footprint: {
            ...entry.footprint,
            vertices: nextVertices,
          },
        }
      })
    case 'SET_VERTEX_HEIGHT':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        constraints: {
          ...entry.constraints,
          vertexHeights: assertValidVertexHeights(
            setOrReplaceVertexConstraint(entry.constraints.vertexHeights, action.payload),
            entry.footprint.vertices.length,
          ),
        },
      }))
    case 'SET_VERTEX_HEIGHTS':
      return applyToActiveFootprint(state, (entry) => {
        const vertexCount = entry.footprint.vertices.length
        let nextVertexHeights = entry.constraints.vertexHeights
        for (const constraint of action.payload) {
          nextVertexHeights = setOrReplaceVertexConstraint(nextVertexHeights, constraint)
        }
        return {
          ...entry,
          constraints: {
            ...entry.constraints,
            vertexHeights: assertValidVertexHeights(nextVertexHeights, vertexCount),
          },
        }
      })
    case 'SET_EDGE_HEIGHT':
      return applyToActiveFootprint(state, (entry) => {
        const vertexCount = entry.footprint.vertices.length
        if (action.payload.edgeIndex < 0 || action.payload.edgeIndex >= vertexCount) {
          return entry
        }

        const start = action.payload.edgeIndex
        const end = (action.payload.edgeIndex + 1) % vertexCount
        let nextVertexHeights = setOrReplaceVertexConstraint(entry.constraints.vertexHeights, {
          vertexIndex: start,
          heightM: action.payload.heightM,
        })
        nextVertexHeights = setOrReplaceVertexConstraint(nextVertexHeights, {
          vertexIndex: end,
          heightM: action.payload.heightM,
        })

        return {
          ...entry,
          constraints: {
            ...entry.constraints,
            vertexHeights: assertValidVertexHeights(nextVertexHeights, vertexCount),
          },
        }
      })
    case 'SET_ACTIVE_FOOTPRINT_KWP':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        footprint: {
          ...entry.footprint,
          kwp: action.kwp,
        },
      }))
    case 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        pitchAdjustmentPercent: action.pitchAdjustmentPercent,
      }))
    case 'CLEAR_VERTEX_HEIGHT':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        constraints: {
          ...entry.constraints,
          vertexHeights: entry.constraints.vertexHeights.filter((c) => c.vertexIndex !== action.vertexIndex),
        },
      }))
    case 'CLEAR_EDGE_HEIGHT':
      return applyToActiveFootprint(state, (entry) => {
        const vertexCount = entry.footprint.vertices.length
        if (action.edgeIndex < 0 || action.edgeIndex >= vertexCount) {
          return entry
        }

        const start = action.edgeIndex
        const end = (action.edgeIndex + 1) % vertexCount

        return {
          ...entry,
          constraints: {
            ...entry.constraints,
            vertexHeights: entry.constraints.vertexHeights.filter(
              (c) => c.vertexIndex !== start && c.vertexIndex !== end,
            ),
          },
        }
      })
    case 'SET_SUN_PROJECTION_ENABLED':
      return {
        ...state,
        sunProjection: {
          ...state.sunProjection,
          enabled: action.enabled,
        },
      }
    case 'SET_SUN_PROJECTION_DATETIME':
      return {
        ...state,
        sunProjection: {
          ...state.sunProjection,
          datetimeIso: action.datetimeIso,
        },
      }
    case 'SET_SUN_PROJECTION_DAILY_DATE':
      return {
        ...state,
        sunProjection: {
          ...state.sunProjection,
          dailyDateIso: action.dailyDateIso,
        },
      }
    case 'COMMIT_OBSTACLE': {
      if (state.obstacleDrawDraft.length < 3) {
        return state
      }

      const obstacleId = generateObstacleId()
      const obstacle: ObstacleStateEntry = {
        id: obstacleId,
        kind: 'custom',
        shape: createObstacleShapeForKind('custom', state.obstacleDrawDraft),
        heightAboveGroundM: DEFAULT_OBSTACLE_HEIGHT_M,
      }

      return {
        ...state,
        obstacles: {
          ...state.obstacles,
          [obstacleId]: obstacle,
        },
      }
    }
    case 'DELETE_OBSTACLE': {
      if (!state.obstacles[action.obstacleId]) {
        return state
      }

      const nextObstacles = { ...state.obstacles }
      delete nextObstacles[action.obstacleId]
      return {
        ...state,
        obstacles: nextObstacles,
      }
    }
    case 'SET_OBSTACLE_HEIGHT':
      return applyToObstacle(state, action.payload.obstacleId, (entry) => ({
        ...entry,
        heightAboveGroundM: action.payload.heightAboveGroundM,
      }))
    case 'SET_OBSTACLE_KIND':
      return applyToObstacle(state, action.payload.obstacleId, (entry) => withObstacleKind(entry, action.payload.kind))
    case 'MOVE_OBSTACLE_VERTEX':
      return applyToObstacle(state, action.payload.obstacleId, (entry) =>
        withMovedObstacleShapeVertex(entry, action.payload.vertexIndex, action.payload.point),
      )
    case 'SET_SHADING_ENABLED':
      return {
        ...state,
        shadingSettings: {
          ...state.shadingSettings,
          enabled: action.enabled,
        },
      }
    case 'SET_SHADING_GRID_RESOLUTION':
      return {
        ...state,
        shadingSettings: {
          ...state.shadingSettings,
          gridResolutionM: action.gridResolutionM,
        },
      }
    case 'UPSERT_IMPORTED_FOOTPRINTS': {
      if (action.entries.length === 0) {
        return state
      }

      const nextFootprints = { ...state.footprints }
      for (const entry of action.entries) {
        const footprint: FootprintPolygon = {
          id: entry.footprintId,
          vertices: entry.polygon,
          kwp: state.footprints[entry.footprintId]?.footprint.kwp ?? DEFAULT_FOOTPRINT_KWP,
        }
        nextFootprints[entry.footprintId] = {
          footprint,
          constraints: {
            vertexHeights: assertValidVertexHeights(entry.vertexHeights, footprint.vertices.length),
          },
          pitchAdjustmentPercent: state.footprints[entry.footprintId]?.pitchAdjustmentPercent ?? 0,
        }
      }

      return {
        ...state,
        footprints: nextFootprints,
      }
    }
    default:
      return state
  }
}
