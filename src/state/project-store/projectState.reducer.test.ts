import { describe, expect, it } from 'vitest'
import type { ProjectState } from './projectState.types'
import { DEFAULT_SUN_PROJECTION, initialProjectState, projectStateReducer } from './projectState.reducer'

function withFootprints(state: ProjectState): ProjectState {
  return {
    ...state,
    footprints: {
      a: {
        footprint: {
          id: 'a',
          vertices: [
            [1, 1],
            [2, 1],
            [2, 2],
          ],
          kwp: 4,
        },
        constraints: { vertexHeights: [{ vertexIndex: 0, heightM: 1.2 }] },
        pitchAdjustmentPercent: 0,
      },
      b: {
        footprint: {
          id: 'b',
          vertices: [
            [10, 10],
            [11, 10],
            [11, 11],
          ],
          kwp: 5,
        },
        constraints: { vertexHeights: [] },
        pitchAdjustmentPercent: 0,
      },
    },
    activeFootprintId: 'a',
    selectedFootprintIds: ['a'],
  }
}

describe('projectStateReducer', () => {
  it('handles draw flow and commit', () => {
    let state = projectStateReducer(initialProjectState, { type: 'START_DRAW' })
    state = projectStateReducer(state, { type: 'ADD_DRAFT_POINT', point: [1, 1] })
    state = projectStateReducer(state, { type: 'ADD_DRAFT_POINT', point: [2, 1] })
    state = projectStateReducer(state, { type: 'ADD_DRAFT_POINT', point: [2, 2] })
    state = projectStateReducer(state, { type: 'COMMIT_FOOTPRINT' })

    expect(state.isDrawing).toBe(false)
    expect(state.drawDraft).toEqual([])
    expect(Object.keys(state.footprints)).toHaveLength(1)
    expect(state.activeFootprintId).toBeTruthy()
    expect(state.selectedFootprintIds).toEqual([state.activeFootprintId])
  })

  it('handles selection flow', () => {
    let state = withFootprints(initialProjectState)
    state = projectStateReducer(state, { type: 'TOGGLE_FOOTPRINT_SELECTION', footprintId: 'b' })
    expect(state.selectedFootprintIds).toEqual(['a', 'b'])
    expect(state.activeFootprintId).toBe('b')

    state = projectStateReducer(state, { type: 'SELECT_ONLY_FOOTPRINT', footprintId: 'a' })
    expect(state.selectedFootprintIds).toEqual(['a'])
    expect(state.activeFootprintId).toBe('a')

    state = projectStateReducer(state, { type: 'CLEAR_FOOTPRINT_SELECTION' })
    expect(state.selectedFootprintIds).toEqual([])
  })

  it('handles delete behavior and active fallback', () => {
    let state = withFootprints(initialProjectState)
    state = { ...state, selectedFootprintIds: ['a', 'b'], activeFootprintId: 'a' }
    state = projectStateReducer(state, { type: 'DELETE_FOOTPRINT', footprintId: 'a' })

    expect(Object.keys(state.footprints)).toEqual(['b'])
    expect(state.activeFootprintId).toBe('b')
    expect(state.selectedFootprintIds).toEqual(['b'])
  })

  it('moves vertex and edge on active footprint', () => {
    let state = withFootprints(initialProjectState)
    state = projectStateReducer(state, { type: 'MOVE_VERTEX', payload: { vertexIndex: 1, point: [20, 30] } })
    expect(state.footprints.a.footprint.vertices[1]).toEqual([20, 30])

    state = projectStateReducer(state, { type: 'MOVE_EDGE', payload: { edgeIndex: 1, delta: [1, -2] } })
    expect(state.footprints.a.footprint.vertices[1]).toEqual([21, 28])
    expect(state.footprints.a.footprint.vertices[2]).toEqual([3, 0])
  })

  it('applies and clears edge-height semantics through vertex constraints', () => {
    let state = withFootprints(initialProjectState)
    state = projectStateReducer(state, { type: 'SET_EDGE_HEIGHT', payload: { edgeIndex: 1, heightM: 3.5 } })

    expect(state.footprints.a.constraints.vertexHeights).toEqual([
      { vertexIndex: 0, heightM: 1.2 },
      { vertexIndex: 1, heightM: 3.5 },
      { vertexIndex: 2, heightM: 3.5 },
    ])

    state = projectStateReducer(state, { type: 'CLEAR_EDGE_HEIGHT', edgeIndex: 1 })
    expect(state.footprints.a.constraints.vertexHeights).toEqual([{ vertexIndex: 0, heightM: 1.2 }])
  })

  it('updates active pitch adjustment percent with clamping', () => {
    let state = withFootprints(initialProjectState)
    state = projectStateReducer(state, { type: 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT', pitchAdjustmentPercent: 15.5 })
    expect(state.footprints.a.pitchAdjustmentPercent).toBe(15.5)

    state = projectStateReducer(state, { type: 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT', pitchAdjustmentPercent: 999 })
    expect(state.footprints.a.pitchAdjustmentPercent).toBe(200)
  })

  it('handles obstacle draw/edit/selection flow', () => {
    let state = projectStateReducer(initialProjectState, { type: 'START_OBSTACLE_DRAW' })
    state = projectStateReducer(state, { type: 'ADD_OBSTACLE_DRAFT_POINT', point: [1, 1] })
    state = projectStateReducer(state, { type: 'ADD_OBSTACLE_DRAFT_POINT', point: [2, 1] })
    state = projectStateReducer(state, { type: 'ADD_OBSTACLE_DRAFT_POINT', point: [2, 2] })
    state = projectStateReducer(state, { type: 'COMMIT_OBSTACLE' })

    const obstacleId = state.activeObstacleId
    expect(obstacleId).toBeTruthy()
    expect(state.isDrawingObstacle).toBe(false)
    expect(state.selectedObstacleIds).toEqual([obstacleId])

    state = projectStateReducer(state, {
      type: 'SET_OBSTACLE_HEIGHT',
      payload: { obstacleId: obstacleId ?? '', heightAboveGroundM: 12 },
    })
    state = projectStateReducer(state, {
      type: 'SET_OBSTACLE_KIND',
      payload: { obstacleId: obstacleId ?? '', kind: 'tree' },
    })
    state = projectStateReducer(state, {
      type: 'MOVE_OBSTACLE_VERTEX',
      payload: { obstacleId: obstacleId ?? '', vertexIndex: 1, point: [3, 1.5] },
    })

    expect(state.obstacles[obstacleId ?? ''].heightAboveGroundM).toBe(12)
    expect(state.obstacles[obstacleId ?? ''].kind).toBe('tree')
    expect(state.obstacles[obstacleId ?? ''].polygon[1]).toEqual([3, 1.5])

    state = projectStateReducer(state, { type: 'DELETE_OBSTACLE', obstacleId: obstacleId ?? '' })
    expect(state.activeObstacleId).toBeNull()
    expect(state.selectedObstacleIds).toEqual([])
    expect(Object.keys(state.obstacles)).toHaveLength(0)
  })

  it('sanitizes load payload', () => {
    const dirtyState: ProjectState = {
      ...initialProjectState,
      footprints: {
        a: {
          footprint: {
            id: '',
            vertices: [
              [1, 1],
              [2, 1],
              [2, 2],
            ],
            kwp: Number.NaN,
          },
          constraints: {
            vertexHeights: [
              { vertexIndex: 2, heightM: 2 },
              { vertexIndex: -1, heightM: 9 },
              { vertexIndex: 2, heightM: 3 },
            ],
          },
          pitchAdjustmentPercent: Number.NaN,
        },
      },
      activeFootprintId: 'missing',
      selectedFootprintIds: ['missing', 'a'],
      sunProjection: {
        enabled: undefined as unknown as boolean,
        datetimeIso: undefined as unknown as string,
        dailyDateIso: undefined as unknown as string,
      },
    }

    const loaded = projectStateReducer(initialProjectState, { type: 'LOAD', payload: dirtyState })
    const [loadedId] = Object.keys(loaded.footprints)

    expect(loadedId).toBe('a')
    expect(loaded.activeFootprintId).toBe('a')
    expect(loaded.selectedFootprintIds).toEqual(['a'])
    expect(loaded.footprints.a.footprint.kwp).toBe(4.3)
    expect(loaded.footprints.a.pitchAdjustmentPercent).toBe(0)
    expect(loaded.footprints.a.constraints.vertexHeights).toEqual([{ vertexIndex: 2, heightM: 3 }])
    expect(loaded.sunProjection).toEqual(DEFAULT_SUN_PROJECTION)
  })
})
