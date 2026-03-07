import { useEffect, useMemo, useReducer, useRef } from 'react'
import type {
  FootprintPolygon,
  ProjectSunProjectionSettings,
  VertexHeightConstraint,
} from '../../types/geometry'
import { sanitizeLoadedState } from './projectState.sanitize'
import { readStorage, writeStorage } from './projectState.storage'
import type { Action, FootprintStateEntry, ImportedFootprintEntry, ProjectState } from './projectState.types'

const SOLVER_CONFIG_VERSION = 'uc6'
const DEFAULT_FOOTPRINT_KWP = 4.3
const DEFAULT_SUN_PROJECTION: ProjectSunProjectionSettings = {
  enabled: true,
  datetimeIso: null,
  dailyDateIso: null,
}

const initialState: ProjectState = {
  footprints: {},
  activeFootprintId: null,
  selectedFootprintIds: [],
  drawDraft: [],
  isDrawing: false,
  sunProjection: DEFAULT_SUN_PROJECTION,
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
        kwp: DEFAULT_FOOTPRINT_KWP,
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
      return sanitizeLoadedState(action.payload, DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP)
    default:
      return state
  }
}

export function useProjectStore() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const emptyConstraints = useMemo(() => ({ vertexHeights: [] }), [])
  const hasSkippedInitialPersist = useRef(false)

  useEffect(() => {
    const stored = readStorage(DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP)
    if (stored) {
      dispatch({ type: 'LOAD', payload: stored })
    }
  }, [])

  useEffect(() => {
    if (!hasSkippedInitialPersist.current) {
      hasSkippedInitialPersist.current = true
      return
    }

    writeStorage(
      {
        footprints: state.footprints,
        activeFootprintId: state.activeFootprintId,
        sunProjection: state.sunProjection,
      },
      SOLVER_CONFIG_VERSION,
      DEFAULT_FOOTPRINT_KWP,
    )
  }, [state.activeFootprintId, state.footprints, state.sunProjection])

  const activeEntry = state.activeFootprintId ? state.footprints[state.activeFootprintId] : null
  const activeFootprint = activeEntry?.footprint ?? null
  const activeConstraints = activeEntry?.constraints ?? emptyConstraints

  return useMemo(
    () => ({
      state,
      activeFootprint,
      activeConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      isFootprintSelected: (footprintId: string) => state.selectedFootprintIds.includes(footprintId),
      sunProjection: state.sunProjection,
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
      setVertexHeight: (vertexIndex: number, heightM: number) => {
        if (!activeFootprint || vertexIndex < 0 || vertexIndex >= activeFootprint.vertices.length) {
          return false
        }
        dispatch({ type: 'SET_VERTEX_HEIGHT', payload: { vertexIndex, heightM } })
        return true
      },
      setEdgeHeight: (edgeIndex: number, heightM: number) => {
        if (!activeFootprint || edgeIndex < 0 || edgeIndex >= activeFootprint.vertices.length) {
          return false
        }
        dispatch({ type: 'SET_EDGE_HEIGHT', payload: { edgeIndex, heightM } })
        return true
      },
      setVertexHeights: (constraints: VertexHeightConstraint[]) => {
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
        if (!activeFootprint || !Number.isFinite(kwp)) {
          return false
        }
        dispatch({ type: 'SET_ACTIVE_FOOTPRINT_KWP', kwp })
        return true
      },
      clearVertexHeight: (vertexIndex: number) => dispatch({ type: 'CLEAR_VERTEX_HEIGHT', vertexIndex }),
      clearEdgeHeight: (edgeIndex: number) => dispatch({ type: 'CLEAR_EDGE_HEIGHT', edgeIndex }),
      setSunProjectionEnabled: (enabled: boolean) => dispatch({ type: 'SET_SUN_PROJECTION_ENABLED', enabled }),
      setSunProjectionDatetimeIso: (datetimeIso: string | null) =>
        dispatch({ type: 'SET_SUN_PROJECTION_DATETIME', datetimeIso }),
      setSunProjectionDailyDateIso: (dailyDateIso: string | null) =>
        dispatch({ type: 'SET_SUN_PROJECTION_DAILY_DATE', dailyDateIso }),
      upsertImportedFootprints: (entries: ImportedFootprintEntry[]) => {
        if (entries.length === 0) {
          return false
        }
        dispatch({ type: 'UPSERT_IMPORTED_FOOTPRINTS', entries })
        return true
      },
    }),
    [activeConstraints, activeFootprint, state],
  )
}
