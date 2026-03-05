import { useEffect, useMemo, useReducer, useRef } from 'react'
import type {
  FaceConstraints,
  FootprintPolygon,
  ProjectData,
  StoredFootprint,
  VertexHeightConstraint,
} from '../../types/geometry'

const STORAGE_KEY = 'suncast_project'
const LEGACY_STORAGE_KEY = 'suncast.project.v1'
const SOLVER_CONFIG_VERSION = 'uc3'

interface FootprintStateEntry {
  footprint: FootprintPolygon
  constraints: FaceConstraints
}

interface ProjectState {
  footprints: Record<string, FootprintStateEntry>
  activeFootprintId: string | null
  drawDraft: Array<[number, number]>
  isDrawing: boolean
}

type Action =
  | { type: 'START_DRAW' }
  | { type: 'CANCEL_DRAW' }
  | { type: 'ADD_DRAFT_POINT'; point: [number, number] }
  | { type: 'UNDO_DRAFT_POINT' }
  | { type: 'COMMIT_FOOTPRINT' }
  | { type: 'SET_ACTIVE_FOOTPRINT'; footprintId: string }
  | { type: 'DELETE_FOOTPRINT'; footprintId: string }
  | { type: 'MOVE_VERTEX'; payload: { vertexIndex: number; point: [number, number] } }
  | { type: 'MOVE_EDGE'; payload: { edgeIndex: number; delta: [number, number] } }
  | { type: 'SET_VERTEX_HEIGHT'; payload: VertexHeightConstraint }
  | { type: 'SET_VERTEX_HEIGHTS'; payload: VertexHeightConstraint[] }
  | { type: 'SET_EDGE_HEIGHT'; payload: { edgeIndex: number; heightM: number } }
  | { type: 'CLEAR_VERTEX_HEIGHT'; vertexIndex: number }
  | { type: 'CLEAR_EDGE_HEIGHT'; edgeIndex: number }
  | { type: 'LOAD'; payload: ProjectState }

interface LegacyProjectData {
  footprint: FootprintPolygon | null
  constraints: FaceConstraints
  solverConfigVersion?: string
}

const initialState: ProjectState = {
  footprints: {},
  activeFootprintId: null,
  drawDraft: [],
  isDrawing: false,
}

function generateFootprintId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fp-${crypto.randomUUID()}`
  }
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

function migrateConstraints(constraints: FaceConstraints, footprint: FootprintPolygon): FaceConstraints {
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
  }
}

function fromStoredFootprint(stored: StoredFootprint): FootprintStateEntry {
  const footprint: FootprintPolygon = {
    id: stored.id,
    vertices: stored.polygon,
  }

  const vertexHeights = Object.entries(stored.vertexHeights)
    .map(([vertexIndexRaw, heightM]) => ({
      vertexIndex: Number(vertexIndexRaw),
      heightM,
    }))
    .filter((c) => Number.isInteger(c.vertexIndex) && Number.isFinite(c.heightM))

  return {
    footprint,
    constraints: {
      vertexHeights: sanitizeVertexHeights(vertexHeights, footprint.vertices.length),
    },
  }
}

function toStoredFootprint(entry: FootprintStateEntry): StoredFootprint {
  const vertexHeights: Record<string, number> = {}
  for (const constraint of entry.constraints.vertexHeights) {
    vertexHeights[String(constraint.vertexIndex)] = constraint.heightM
  }

  return {
    id: entry.footprint.id,
    polygon: entry.footprint.vertices,
    vertexHeights,
  }
}

function sanitizeLoadedState(state: ProjectState): ProjectState {
  const sanitized: Record<string, FootprintStateEntry> = {}

  for (const [footprintId, entry] of Object.entries(state.footprints)) {
    if (!entry.footprint || !Array.isArray(entry.footprint.vertices)) {
      continue
    }

    const footprint: FootprintPolygon = {
      id: entry.footprint.id || footprintId,
      vertices: entry.footprint.vertices,
    }

    sanitized[footprint.id] = {
      footprint,
      constraints: {
        vertexHeights: sanitizeVertexHeights(entry.constraints.vertexHeights ?? [], footprint.vertices.length),
      },
    }
  }

  const ids = Object.keys(sanitized)
  return {
    ...state,
    footprints: sanitized,
    activeFootprintId:
      state.activeFootprintId && sanitized[state.activeFootprintId]
        ? state.activeFootprintId
        : (ids.at(-1) ?? null),
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

      const footprintId = generateFootprintId()
      const footprint: FootprintPolygon = {
        id: footprintId,
        vertices: state.drawDraft,
      }

      return {
        ...state,
        footprints: {
          ...state.footprints,
          [footprintId]: {
            footprint,
            constraints: { vertexHeights: [] },
          },
        },
        activeFootprintId: footprintId,
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
    case 'LOAD':
      return sanitizeLoadedState(action.payload)
    default:
      return state
  }
}

function readStorage(): ProjectState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ProjectData
      const entries = Object.values(parsed.footprints ?? {})
      const footprints = Object.fromEntries(entries.map((entry) => [entry.id, fromStoredFootprint(entry)]))

      return {
        footprints,
        activeFootprintId: parsed.activeFootprintId ?? null,
        drawDraft: [],
        isDrawing: false,
      }
    } catch {
      return null
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    return null
  }

  try {
    const legacy = JSON.parse(legacyRaw) as LegacyProjectData
    if (!legacy.footprint) {
      return {
        ...initialState,
      }
    }

    const footprint = legacy.footprint
    const migratedEntry: FootprintStateEntry = {
      footprint,
      constraints: migrateConstraints(legacy.constraints ?? { vertexHeights: [] }, footprint),
    }

    return {
      footprints: {
        [footprint.id]: migratedEntry,
      },
      activeFootprintId: footprint.id,
      drawDraft: [],
      isDrawing: false,
    }
  } catch {
    return null
  }
}

export function useProjectStore() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const emptyConstraints = useMemo(() => ({ vertexHeights: [] }), [])
  const hasSkippedInitialPersist = useRef(false)

  useEffect(() => {
    const stored = readStorage()
    if (stored) {
      dispatch({ type: 'LOAD', payload: stored })
    }
  }, [])

  useEffect(() => {
    if (!hasSkippedInitialPersist.current) {
      hasSkippedInitialPersist.current = true
      return
    }

    const footprints = Object.fromEntries(
      Object.entries(state.footprints).map(([id, entry]) => [id, toStoredFootprint(entry)]),
    )

    const data: ProjectData = {
      footprints,
      activeFootprintId: state.activeFootprintId,
      solverConfigVersion: SOLVER_CONFIG_VERSION,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [state.activeFootprintId, state.footprints])

  const activeEntry = state.activeFootprintId ? state.footprints[state.activeFootprintId] : null
  const activeFootprint = activeEntry?.footprint ?? null
  const activeConstraints = activeEntry?.constraints ?? emptyConstraints

  const wouldExceedConstraintLimit = (targetVertexIndices: number[]): boolean => {
    const existing = new Set(activeConstraints.vertexHeights.map((constraint) => constraint.vertexIndex))
    const nextCount =
      existing.size +
      targetVertexIndices.reduce((added, vertexIndex) => (existing.has(vertexIndex) ? added : added + 1), 0)
    return nextCount > 3
  }

  return useMemo(
    () => ({
      state,
      activeFootprint,
      activeConstraints,
      startDrawing: () => dispatch({ type: 'START_DRAW' }),
      cancelDrawing: () => dispatch({ type: 'CANCEL_DRAW' }),
      addDraftPoint: (point: [number, number]) => dispatch({ type: 'ADD_DRAFT_POINT', point }),
      undoDraftPoint: () => dispatch({ type: 'UNDO_DRAFT_POINT' }),
      commitFootprint: () => dispatch({ type: 'COMMIT_FOOTPRINT' }),
      setActiveFootprint: (footprintId: string) => dispatch({ type: 'SET_ACTIVE_FOOTPRINT', footprintId }),
      deleteFootprint: (footprintId: string) => dispatch({ type: 'DELETE_FOOTPRINT', footprintId }),
      moveVertex: (vertexIndex: number, point: [number, number]) =>
        dispatch({ type: 'MOVE_VERTEX', payload: { vertexIndex, point } }),
      moveEdge: (edgeIndex: number, delta: [number, number]) => dispatch({ type: 'MOVE_EDGE', payload: { edgeIndex, delta } }),
      setVertexHeight: (vertexIndex: number, heightM: number) => {
        if (wouldExceedConstraintLimit([vertexIndex])) {
          return false
        }
        dispatch({ type: 'SET_VERTEX_HEIGHT', payload: { vertexIndex, heightM } })
        return true
      },
      setEdgeHeight: (edgeIndex: number, heightM: number) => {
        if (!activeFootprint || edgeIndex < 0 || edgeIndex >= activeFootprint.vertices.length) {
          return false
        }
        const end = (edgeIndex + 1) % activeFootprint.vertices.length
        if (wouldExceedConstraintLimit([edgeIndex, end])) {
          return false
        }
        dispatch({ type: 'SET_EDGE_HEIGHT', payload: { edgeIndex, heightM } })
        return true
      },
      setVertexHeights: (constraints: VertexHeightConstraint[]) => {
        if (constraints.length === 0) {
          return false
        }
        if (wouldExceedConstraintLimit(constraints.map((constraint) => constraint.vertexIndex))) {
          return false
        }
        dispatch({ type: 'SET_VERTEX_HEIGHTS', payload: constraints })
        return true
      },
      clearVertexHeight: (vertexIndex: number) => dispatch({ type: 'CLEAR_VERTEX_HEIGHT', vertexIndex }),
      clearEdgeHeight: (edgeIndex: number) => dispatch({ type: 'CLEAR_EDGE_HEIGHT', edgeIndex }),
    }),
    [activeConstraints, activeFootprint, state],
  )
}
