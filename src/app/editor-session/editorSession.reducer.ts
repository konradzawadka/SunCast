import type { Action, ProjectState } from '../../state/project-store/projectState.types'
import { initialEditorSessionState } from './editorSession.types'

function resolveLastAvailableId(
  requestedId: string | null,
  selectedIds: string[],
  availableById: Record<string, unknown>,
): string | null {
  if (requestedId && availableById[requestedId]) {
    return requestedId
  }
  for (let i = selectedIds.length - 1; i >= 0; i -= 1) {
    const candidateId = selectedIds[i]
    if (availableById[candidateId]) {
      return candidateId
    }
  }
  return null
}

export function editorSessionReducer(state: ProjectState, action: Action): ProjectState {
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
      const nextFootprintId = Object.keys(state.footprints).at(-1) ?? null
      return {
        ...state,
        activeFootprintId: nextFootprintId,
        selectedFootprintIds: nextFootprintId ? [nextFootprintId] : [],
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
          activeFootprintId: resolveLastAvailableId(state.activeFootprintId, nextSelected, state.footprints),
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
    case 'DELETE_FOOTPRINT': {
      const nextSelected = state.selectedFootprintIds.filter((id) => id !== action.footprintId && state.footprints[id])
      return {
        ...state,
        selectedFootprintIds: nextSelected,
        activeFootprintId: state.activeFootprintId === action.footprintId ? null : state.activeFootprintId,
      }
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
      const nextObstacleId = Object.keys(state.obstacles).at(-1) ?? null
      return {
        ...state,
        activeObstacleId: nextObstacleId,
        selectedObstacleIds: nextObstacleId ? [nextObstacleId] : [],
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
          activeObstacleId: resolveLastAvailableId(state.activeObstacleId, nextSelected, state.obstacles),
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
    case 'DELETE_OBSTACLE': {
      const nextSelected = state.selectedObstacleIds.filter((id) => id !== action.obstacleId && state.obstacles[id])
      return {
        ...state,
        selectedObstacleIds: nextSelected,
        activeObstacleId: state.activeObstacleId === action.obstacleId ? null : state.activeObstacleId,
      }
    }
    case 'UPSERT_IMPORTED_FOOTPRINTS': {
      if (action.entries.length === 0) {
        return state
      }
      const importedIds = action.entries.map((entry) => entry.footprintId)
      return {
        ...state,
        activeFootprintId: importedIds.at(-1) ?? state.activeFootprintId,
        selectedFootprintIds: importedIds,
        isDrawing: false,
        drawDraft: [],
      }
    }
    case 'RESET_STATE':
      return {
        ...state,
        ...initialEditorSessionState,
      }
    default:
      return state
  }
}
