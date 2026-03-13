import type {
  FootprintPolygon,
  ObstacleStateEntry,
  ProjectSunProjectionSettings,
  ShadingSettings,
} from '../../types/geometry'
import { createObstacleShapeForKind, withMovedObstacleShapeVertex, withObstacleKind } from '../../geometry/obstacles/obstacleModels'
import { sanitizeLoadedState } from './projectState.sanitize'
import { sanitizeVertexHeights, setOrReplaceVertexConstraint } from './projectState.constraints'
import type { Action, FootprintStateEntry, ProjectState } from './projectState.types'

export const DEFAULT_FOOTPRINT_KWP = 4.3
export const DEFAULT_SUN_PROJECTION: ProjectSunProjectionSettings = {
  enabled: true,
  datetimeIso: null,
  dailyDateIso: null,
}
export const DEFAULT_SHADING_SETTINGS: ShadingSettings = {
  enabled: true,
  gridResolutionM: 0.1,
}
export const DEFAULT_OBSTACLE_HEIGHT_M = 8

export const initialProjectState: ProjectState = {
  footprints: {},
  activeFootprintId: null,
  selectedFootprintIds: [],
  drawDraft: [],
  isDrawing: false,
  obstacles: {},
  activeObstacleId: null,
  selectedObstacleIds: [],
  obstacleDrawDraft: [],
  isDrawingObstacle: false,
  sunProjection: DEFAULT_SUN_PROJECTION,
  shadingSettings: DEFAULT_SHADING_SETTINGS,
}
const MIN_PITCH_ADJUSTMENT_PERCENT = -90
const MAX_PITCH_ADJUSTMENT_PERCENT = 200

function sanitizePitchAdjustmentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(MAX_PITCH_ADJUSTMENT_PERCENT, Math.max(MIN_PITCH_ADJUSTMENT_PERCENT, value))
}

function generateFootprintId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fp-${crypto.randomUUID()}`
  }
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Purpose: Builds obstacle id from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
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

function removeFootprintAndPickActive(state: ProjectState, footprintId: string): ProjectState {
  const nextFootprints = { ...state.footprints }
  delete nextFootprints[footprintId]
  const nextIds = Object.keys(nextFootprints)

  return {
    ...state,
    footprints: nextFootprints,
    activeFootprintId:
      state.activeFootprintId === footprintId
        ? (nextIds.at(-1) ?? null)
        : (state.activeFootprintId && nextFootprints[state.activeFootprintId] ? state.activeFootprintId : nextIds.at(-1) ?? null),
    selectedFootprintIds: state.selectedFootprintIds.filter((id) => id !== footprintId && nextFootprints[id]),
  }
}

// Purpose: Updates to obstacle in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
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

// Purpose: Updates obstacle and pick active in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function removeObstacleAndPickActive(state: ProjectState, obstacleId: string): ProjectState {
  const nextObstacles = { ...state.obstacles }
  delete nextObstacles[obstacleId]
  const nextIds = Object.keys(nextObstacles)

  return {
    ...state,
    obstacles: nextObstacles,
    activeObstacleId:
      state.activeObstacleId === obstacleId
        ? (nextIds.at(-1) ?? null)
        : (state.activeObstacleId && nextObstacles[state.activeObstacleId] ? state.activeObstacleId : nextIds.at(-1) ?? null),
    selectedObstacleIds: state.selectedObstacleIds.filter((id) => id !== obstacleId && nextObstacles[id]),
  }
}

export function projectStateReducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'START_DRAW':
      return { ...state, isDrawing: true, drawDraft: [] }
    case 'CANCEL_DRAW':
      return { ...state, isDrawing: false, drawDraft: [] }
    case 'ADD_DRAFT_POINT':
      return {
        ...state,
        drawDraft: [...state.drawDraft, action.point],
      }
    case 'UNDO_DRAFT_POINT':
      return {
        ...state,
        drawDraft: state.drawDraft.slice(0, -1),
      }
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
        activeFootprintId: footprintId,
        selectedFootprintIds: [footprintId],
        isDrawing: false,
        drawDraft: [],
      }
    }
    case 'SET_ACTIVE_FOOTPRINT':
      if (!state.footprints[action.footprintId]) {
        return state
      }
      return {
        ...state,
        activeFootprintId: action.footprintId,
      }
    case 'SELECT_ONLY_FOOTPRINT':
      if (!state.footprints[action.footprintId]) {
        return state
      }
      return {
        ...state,
        selectedFootprintIds: [action.footprintId],
        activeFootprintId: action.footprintId,
      }
    case 'TOGGLE_FOOTPRINT_SELECTION':
      if (!state.footprints[action.footprintId]) {
        return state
      }
      if (state.selectedFootprintIds.includes(action.footprintId)) {
        const nextSelected = state.selectedFootprintIds.filter((id) => id !== action.footprintId)
        return {
          ...state,
          selectedFootprintIds: nextSelected,
          activeFootprintId:
            state.activeFootprintId === action.footprintId
              ? (nextSelected.at(-1) ?? state.activeFootprintId)
              : state.activeFootprintId,
        }
      }
      return {
        ...state,
        selectedFootprintIds: [...state.selectedFootprintIds, action.footprintId],
        activeFootprintId: action.footprintId,
      }
    case 'SELECT_ALL_FOOTPRINTS': {
      const allIds = Object.keys(state.footprints)
      return {
        ...state,
        selectedFootprintIds: allIds,
      }
    }
    case 'CLEAR_FOOTPRINT_SELECTION':
      return {
        ...state,
        selectedFootprintIds: [],
      }
    case 'DELETE_FOOTPRINT':
      if (!state.footprints[action.footprintId]) {
        return state
      }
      return removeFootprintAndPickActive(state, action.footprintId)
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
          vertexHeights: sanitizeVertexHeights(
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
            vertexHeights: sanitizeVertexHeights(nextVertexHeights, vertexCount),
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
            vertexHeights: sanitizeVertexHeights(nextVertexHeights, vertexCount),
          },
        }
      })
    case 'SET_ACTIVE_FOOTPRINT_KWP':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        footprint: {
          ...entry.footprint,
          kwp: Math.max(0, action.kwp),
        },
      }))
    case 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT':
      return applyToActiveFootprint(state, (entry) => ({
        ...entry,
        pitchAdjustmentPercent: sanitizePitchAdjustmentPercent(action.pitchAdjustmentPercent),
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
    case 'START_OBSTACLE_DRAW':
      return { ...state, isDrawingObstacle: true, obstacleDrawDraft: [] }
    case 'CANCEL_OBSTACLE_DRAW':
      return { ...state, isDrawingObstacle: false, obstacleDrawDraft: [] }
    case 'ADD_OBSTACLE_DRAFT_POINT':
      return {
        ...state,
        obstacleDrawDraft: [...state.obstacleDrawDraft, action.point],
      }
    case 'UNDO_OBSTACLE_DRAFT_POINT':
      return {
        ...state,
        obstacleDrawDraft: state.obstacleDrawDraft.slice(0, -1),
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
        activeObstacleId: obstacleId,
        selectedObstacleIds: [obstacleId],
        isDrawingObstacle: false,
        obstacleDrawDraft: [],
      }
    }
    case 'SET_ACTIVE_OBSTACLE':
      if (!state.obstacles[action.obstacleId]) {
        return state
      }
      return {
        ...state,
        activeObstacleId: action.obstacleId,
      }
    case 'SELECT_ONLY_OBSTACLE':
      if (!state.obstacles[action.obstacleId]) {
        return state
      }
      return {
        ...state,
        selectedObstacleIds: [action.obstacleId],
        activeObstacleId: action.obstacleId,
      }
    case 'TOGGLE_OBSTACLE_SELECTION':
      if (!state.obstacles[action.obstacleId]) {
        return state
      }
      if (state.selectedObstacleIds.includes(action.obstacleId)) {
        const nextSelected = state.selectedObstacleIds.filter((id) => id !== action.obstacleId)
        return {
          ...state,
          selectedObstacleIds: nextSelected,
          activeObstacleId:
            state.activeObstacleId === action.obstacleId
              ? (nextSelected.at(-1) ?? state.activeObstacleId)
              : state.activeObstacleId,
        }
      }
      return {
        ...state,
        selectedObstacleIds: [...state.selectedObstacleIds, action.obstacleId],
        activeObstacleId: action.obstacleId,
      }
    case 'SELECT_ALL_OBSTACLES':
      return {
        ...state,
        selectedObstacleIds: Object.keys(state.obstacles),
      }
    case 'CLEAR_OBSTACLE_SELECTION':
      return {
        ...state,
        selectedObstacleIds: [],
      }
    case 'DELETE_OBSTACLE':
      if (!state.obstacles[action.obstacleId]) {
        return state
      }
      return removeObstacleAndPickActive(state, action.obstacleId)
    case 'SET_OBSTACLE_HEIGHT':
      return applyToObstacle(state, action.payload.obstacleId, (entry) => ({
        ...entry,
        heightAboveGroundM: Number.isFinite(action.payload.heightAboveGroundM)
          ? Math.max(0, action.payload.heightAboveGroundM)
          : entry.heightAboveGroundM,
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
          gridResolutionM: Number.isFinite(action.gridResolutionM)
            ? Math.max(0.1, action.gridResolutionM)
            : state.shadingSettings.gridResolutionM,
        },
      }
    case 'UPSERT_IMPORTED_FOOTPRINTS': {
      if (action.entries.length === 0) {
        return state
      }

      const nextFootprints = { ...state.footprints }
      const importedIds: string[] = []

      for (const entry of action.entries) {
        const footprint: FootprintPolygon = {
          id: entry.footprintId,
          vertices: entry.polygon,
          kwp: state.footprints[entry.footprintId]?.footprint.kwp ?? DEFAULT_FOOTPRINT_KWP,
        }
        nextFootprints[entry.footprintId] = {
          footprint,
          constraints: {
            vertexHeights: sanitizeVertexHeights(entry.vertexHeights, footprint.vertices.length),
          },
          pitchAdjustmentPercent: state.footprints[entry.footprintId]?.pitchAdjustmentPercent ?? 0,
        }
        importedIds.push(entry.footprintId)
      }

      const activeFootprintId = importedIds.at(-1) ?? state.activeFootprintId
      return {
        ...state,
        footprints: nextFootprints,
        activeFootprintId,
        selectedFootprintIds: importedIds,
        isDrawing: false,
        drawDraft: [],
      }
    }
    case 'LOAD':
      return sanitizeLoadedState(action.payload, DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP, DEFAULT_SHADING_SETTINGS)
    default:
      return state
  }
}
