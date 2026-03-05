import { useEffect, useMemo, useReducer } from 'react'
import type {
  FaceConstraints,
  FootprintPolygon,
  ProjectData,
  VertexHeightConstraint,
} from '../../types/geometry'

const STORAGE_KEY = 'suncast.project.v1'
const SOLVER_CONFIG_VERSION = 'uc2'

interface ProjectState {
  footprint: FootprintPolygon | null
  constraints: FaceConstraints
  drawDraft: Array<[number, number]>
  isDrawing: boolean
}

type Action =
  | { type: 'START_DRAW' }
  | { type: 'CANCEL_DRAW' }
  | { type: 'ADD_DRAFT_POINT'; point: [number, number] }
  | { type: 'UNDO_DRAFT_POINT' }
  | { type: 'COMMIT_FOOTPRINT' }
  | { type: 'SET_FOOTPRINT'; footprint: FootprintPolygon }
  | { type: 'SET_VERTEX_HEIGHT'; payload: VertexHeightConstraint }
  | { type: 'SET_EDGE_HEIGHT'; payload: { edgeIndex: number; heightM: number } }
  | { type: 'CLEAR_VERTEX_HEIGHT'; vertexIndex: number }
  | { type: 'CLEAR_EDGE_HEIGHT'; edgeIndex: number }
  | { type: 'LOAD'; payload: ProjectData }

const initialState: ProjectState = {
  footprint: null,
  constraints: { vertexHeights: [] },
  drawDraft: [],
  isDrawing: false,
}

function setOrReplaceVertexConstraint(
  constraints: VertexHeightConstraint[],
  value: VertexHeightConstraint,
): VertexHeightConstraint[] {
  const next = constraints.filter((c) => c.vertexIndex !== value.vertexIndex)
  next.push(value)
  return next.sort((a, b) => a.vertexIndex - b.vertexIndex)
}

function sanitizeVertexHeights(vertexHeights: VertexHeightConstraint[], vertexCount: number): VertexHeightConstraint[] {
  const byIndex = new Map<number, number>()
  for (const constraint of vertexHeights) {
    if (constraint.vertexIndex < 0 || constraint.vertexIndex >= vertexCount) {
      continue
    }
    byIndex.set(constraint.vertexIndex, constraint.heightM)
  }
  return Array.from(byIndex.entries())
    .map(([vertexIndex, heightM]) => ({ vertexIndex, heightM }))
    .sort((a, b) => a.vertexIndex - b.vertexIndex)
}

function migrateConstraints(constraints: FaceConstraints, footprint: FootprintPolygon | null): FaceConstraints {
  if (!footprint) {
    return { vertexHeights: [] }
  }

  const vertexCount = footprint.vertices.length
  const byIndex = new Map<number, number>()

  for (const constraint of constraints.vertexHeights) {
    if (constraint.vertexIndex < 0 || constraint.vertexIndex >= vertexCount) {
      continue
    }
    byIndex.set(constraint.vertexIndex, constraint.heightM)
  }

  // Legacy support: old projects may still contain edge constraints.
  for (const edgeConstraint of constraints.edgeHeights ?? []) {
    if (edgeConstraint.edgeIndex < 0 || edgeConstraint.edgeIndex >= vertexCount) {
      continue
    }
    const start = edgeConstraint.edgeIndex
    const end = (edgeConstraint.edgeIndex + 1) % vertexCount
    byIndex.set(start, edgeConstraint.heightM)
    byIndex.set(end, edgeConstraint.heightM)
  }

  return {
    vertexHeights: Array.from(byIndex.entries())
      .map(([vertexIndex, heightM]) => ({ vertexIndex, heightM }))
      .sort((a, b) => a.vertexIndex - b.vertexIndex),
  }
}

function reducer(state: ProjectState, action: Action): ProjectState {
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
      const footprint: FootprintPolygon = {
        id: `fp-${Date.now()}`,
        vertices: state.drawDraft,
      }
      return {
        ...state,
        footprint,
        isDrawing: false,
        drawDraft: [],
        constraints: { vertexHeights: [] },
      }
    }
    case 'SET_FOOTPRINT':
      return {
        ...state,
        footprint: action.footprint,
      }
    case 'SET_VERTEX_HEIGHT':
      if (!state.footprint) {
        return state
      }
      return {
        ...state,
        constraints: {
          ...state.constraints,
          vertexHeights: sanitizeVertexHeights(
            setOrReplaceVertexConstraint(state.constraints.vertexHeights, action.payload),
            state.footprint.vertices.length,
          ),
        },
      }
    case 'SET_EDGE_HEIGHT': {
      if (!state.footprint) {
        return state
      }
      const vertexCount = state.footprint.vertices.length
      if (action.payload.edgeIndex < 0 || action.payload.edgeIndex >= vertexCount) {
        return state
      }
      const start = action.payload.edgeIndex
      const end = (action.payload.edgeIndex + 1) % vertexCount
      let nextVertexHeights = setOrReplaceVertexConstraint(state.constraints.vertexHeights, {
        vertexIndex: start,
        heightM: action.payload.heightM,
      })
      nextVertexHeights = setOrReplaceVertexConstraint(nextVertexHeights, {
        vertexIndex: end,
        heightM: action.payload.heightM,
      })
      return {
        ...state,
        constraints: {
          ...state.constraints,
          vertexHeights: sanitizeVertexHeights(nextVertexHeights, vertexCount),
        },
      }
    }
    case 'CLEAR_VERTEX_HEIGHT':
      return {
        ...state,
        constraints: {
          ...state.constraints,
          vertexHeights: state.constraints.vertexHeights.filter((c) => c.vertexIndex !== action.vertexIndex),
        },
      }
    case 'CLEAR_EDGE_HEIGHT': {
      if (!state.footprint) {
        return state
      }
      const vertexCount = state.footprint.vertices.length
      if (action.edgeIndex < 0 || action.edgeIndex >= vertexCount) {
        return state
      }
      const start = action.edgeIndex
      const end = (action.edgeIndex + 1) % vertexCount
      return {
        ...state,
        constraints: {
          ...state.constraints,
          vertexHeights: state.constraints.vertexHeights.filter(
            (c) => c.vertexIndex !== start && c.vertexIndex !== end,
          ),
        },
      }
    }
    case 'LOAD':
      return {
        ...state,
        footprint: action.payload.footprint,
        constraints: migrateConstraints(action.payload.constraints, action.payload.footprint),
      }
    default:
      return state
  }
}

function readStorage(): ProjectData | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as ProjectData
    return parsed
  } catch {
    return null
  }
}

export function useProjectStore() {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const stored = readStorage()
    if (stored) {
      dispatch({ type: 'LOAD', payload: stored })
    }
  }, [])

  useEffect(() => {
    const data: ProjectData = {
      footprint: state.footprint,
      constraints: state.constraints,
      solverConfigVersion: SOLVER_CONFIG_VERSION,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [state.footprint, state.constraints])

  return useMemo(
    () => ({
      state,
      startDrawing: () => dispatch({ type: 'START_DRAW' }),
      cancelDrawing: () => dispatch({ type: 'CANCEL_DRAW' }),
      addDraftPoint: (point: [number, number]) => dispatch({ type: 'ADD_DRAFT_POINT', point }),
      undoDraftPoint: () => dispatch({ type: 'UNDO_DRAFT_POINT' }),
      commitFootprint: () => dispatch({ type: 'COMMIT_FOOTPRINT' }),
      setVertexHeight: (vertexIndex: number, heightM: number) =>
        dispatch({ type: 'SET_VERTEX_HEIGHT', payload: { vertexIndex, heightM } }),
      setEdgeHeight: (edgeIndex: number, heightM: number) =>
        dispatch({ type: 'SET_EDGE_HEIGHT', payload: { edgeIndex, heightM } }),
      clearVertexHeight: (vertexIndex: number) => dispatch({ type: 'CLEAR_VERTEX_HEIGHT', vertexIndex }),
      clearEdgeHeight: (edgeIndex: number) => dispatch({ type: 'CLEAR_EDGE_HEIGHT', edgeIndex }),
    }),
    [state],
  )
}
